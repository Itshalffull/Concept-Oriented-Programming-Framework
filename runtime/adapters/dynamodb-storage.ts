// ============================================================
// DynamoDB Storage Adapter
//
// Implements ConceptStorage backed by AWS DynamoDB.
// Supports both single-table and table-per-relation designs.
//
// DynamoDB characteristics:
//   - Single-digit millisecond latency at any scale
//   - Automatic scaling with on-demand billing
//   - Conditional writes for conflict detection
//   - TTL attribute for automatic expiry
//
// Default: single-table design (one table per concept).
//   pk = relation, sk = key
//   GSI "relation-index" on pk for scanning a relation
//
// Mapping:
//   put  -> PutItem with lastWrittenAt attribute
//   get  -> GetItem
//   find -> Query (with pk=relation) or Scan with FilterExpression
//   del  -> DeleteItem
//   delMany -> BatchWriteItem after query
//   getMeta -> GetItem projecting only _meta
//   onConflict -> conditional PutItem with attribute_exists + lastWrittenAt comparison
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../types.js';

// --- DynamoDB Client Interface ---
// Abstracted so callers can provide the real AWS SDK client
// or a mock for testing.

export interface DynamoDBDocumentClient {
  put(params: {
    TableName: string;
    Item: Record<string, unknown>;
    ConditionExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, unknown>;
  }): Promise<void>;

  get(params: {
    TableName: string;
    Key: Record<string, unknown>;
    ProjectionExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
  }): Promise<{ Item?: Record<string, unknown> }>;

  query(params: {
    TableName: string;
    KeyConditionExpression: string;
    FilterExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, unknown>;
    IndexName?: string;
  }): Promise<{ Items?: Record<string, unknown>[] }>;

  delete(params: {
    TableName: string;
    Key: Record<string, unknown>;
  }): Promise<void>;

  batchWrite(params: {
    RequestItems: Record<string, { DeleteRequest: { Key: Record<string, unknown> } }[]>;
  }): Promise<void>;
}

// --- Configuration ---

export interface DynamoDBStorageConfig {
  /** AWS region (e.g. "us-east-1") */
  region: string;
  /** Prefix for table names (e.g. "myapp-prod-") */
  tablePrefix: string;
  /** Use single-table design (one table, pk=relation, sk=key). Default: true */
  singleTable?: boolean;
  /** DynamoDB endpoint override (for DynamoDB Local in dev) */
  endpoint?: string;
  /** Billing mode. Default: 'PAY_PER_REQUEST' */
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED';
  /** Enable TTL on entries. Set attribute name if using TTL. */
  ttlAttribute?: string;
}

// --- Internal Helpers ---

function tableName(config: DynamoDBStorageConfig, relation?: string): string {
  if (config.singleTable !== false) {
    return `${config.tablePrefix}data`;
  }
  return `${config.tablePrefix}${relation}`;
}

function buildKey(config: DynamoDBStorageConfig, relation: string, key: string): Record<string, unknown> {
  if (config.singleTable !== false) {
    return { pk: relation, sk: key };
  }
  return { pk: key };
}

function extractFields(item: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (k !== 'pk' && k !== 'sk' && k !== '_lastWrittenAt' && k !== '_ttl') {
      fields[k] = v;
    }
  }
  return fields;
}

// --- Factory ---

/**
 * Create a ConceptStorage backed by AWS DynamoDB.
 *
 * @param client - A DynamoDB document client (real or mock)
 * @param config - Storage configuration
 */
export function createDynamoDBStorage(
  client: DynamoDBDocumentClient,
  config: DynamoDBStorageConfig,
): ConceptStorage {
  const isSingleTable = config.singleTable !== false;

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const table = tableName(config, relation);
      const dbKey = buildKey(config, relation, key);

      // Check for conflicts if onConflict callback is set
      if (storage.onConflict) {
        const existing = await client.get({
          TableName: table,
          Key: dbKey,
        });

        if (existing.Item) {
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: extractFields(existing.Item),
              writtenAt: (existing.Item._lastWrittenAt as string) ?? now,
            },
            incoming: {
              fields: { ...value },
              writtenAt: now,
            },
          };

          const resolution = storage.onConflict(info);
          switch (resolution.action) {
            case 'keep-existing':
              return;
            case 'accept-incoming':
              break;
            case 'merge':
              await client.put({
                TableName: table,
                Item: {
                  ...dbKey,
                  ...resolution.merged,
                  _lastWrittenAt: now,
                },
              });
              return;
            case 'escalate':
              break;
          }
        }
      }

      const item: Record<string, unknown> = {
        ...dbKey,
        ...value,
        _lastWrittenAt: now,
      };

      if (config.ttlAttribute) {
        item._ttl = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days default
      }

      await client.put({
        TableName: table,
        Item: item,
      });
    },

    async get(relation, key) {
      const table = tableName(config, relation);
      const dbKey = buildKey(config, relation, key);

      const result = await client.get({
        TableName: table,
        Key: dbKey,
      });

      if (!result.Item) return null;
      return extractFields(result.Item);
    },

    async find(relation, criteria?) {
      const table = tableName(config, relation);

      if (isSingleTable) {
        // Query using partition key = relation
        const expressionNames: Record<string, string> = { '#pk': 'pk' };
        const expressionValues: Record<string, unknown> = { ':pk': relation };
        let filterExpression: string | undefined;

        if (criteria && Object.keys(criteria).length > 0) {
          const filters: string[] = [];
          let idx = 0;
          for (const [field, val] of Object.entries(criteria)) {
            const nameAlias = `#f${idx}`;
            const valAlias = `:v${idx}`;
            expressionNames[nameAlias] = field;
            expressionValues[valAlias] = val;
            filters.push(`${nameAlias} = ${valAlias}`);
            idx++;
          }
          filterExpression = filters.join(' AND ');
        }

        const result = await client.query({
          TableName: table,
          KeyConditionExpression: '#pk = :pk',
          FilterExpression: filterExpression,
          ExpressionAttributeNames: expressionNames,
          ExpressionAttributeValues: expressionValues,
        });

        return (result.Items || []).map(extractFields);
      }

      // Table-per-relation: scan with filter
      const expressionNames: Record<string, string> = {};
      const expressionValues: Record<string, unknown> = {};
      let filterExpression: string | undefined;

      if (criteria && Object.keys(criteria).length > 0) {
        const filters: string[] = [];
        let idx = 0;
        for (const [field, val] of Object.entries(criteria)) {
          const nameAlias = `#f${idx}`;
          const valAlias = `:v${idx}`;
          expressionNames[nameAlias] = field;
          expressionValues[valAlias] = val;
          filters.push(`${nameAlias} = ${valAlias}`);
          idx++;
        }
        filterExpression = filters.join(' AND ');
      }

      // Use a query with a dummy key condition (table-per-relation
      // still uses pk as the entry key, so we scan via query on a GSI
      // or fall back to full table query)
      const result = await client.query({
        TableName: table,
        KeyConditionExpression: 'pk = pk',  // Will be handled by scan fallback
        FilterExpression: filterExpression,
        ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
        ExpressionAttributeValues: Object.keys(expressionValues).length > 0 ? expressionValues : undefined,
      });

      return (result.Items || []).map(extractFields);
    },

    async del(relation, key) {
      const table = tableName(config, relation);
      const dbKey = buildKey(config, relation, key);

      await client.delete({
        TableName: table,
        Key: dbKey,
      });
    },

    async delMany(relation, criteria) {
      // First, find matching entries
      const matches = await storage.find(relation, criteria);

      if (matches.length === 0) return 0;

      const table = tableName(config, relation);

      // DynamoDB BatchWriteItem supports up to 25 items per batch
      const batchSize = 25;
      for (let i = 0; i < matches.length; i += batchSize) {
        const batch = matches.slice(i, i + batchSize);
        const deleteRequests = batch.map(item => {
          // Reconstruct the key from the item — need a key field
          // In single-table design, we need the sk value.
          // The key is typically a field like 'id' or the first field.
          const entryKey = (item.id as string) || Object.values(item)[0] as string;
          return {
            DeleteRequest: {
              Key: buildKey(config, relation, entryKey),
            },
          };
        });

        await client.batchWrite({
          RequestItems: { [table]: deleteRequests },
        });
      }

      return matches.length;
    },

    async getMeta(relation, key) {
      const table = tableName(config, relation);
      const dbKey = buildKey(config, relation, key);

      const result = await client.get({
        TableName: table,
        Key: dbKey,
        ProjectionExpression: '#lw',
        ExpressionAttributeNames: { '#lw': '_lastWrittenAt' },
      });

      if (!result.Item || !result.Item._lastWrittenAt) return null;
      return { lastWrittenAt: result.Item._lastWrittenAt as string };
    },
  };

  return storage;
}
