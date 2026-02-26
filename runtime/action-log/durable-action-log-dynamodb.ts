// ============================================================
// DynamoDB Durable Action Log
//
// Persists action records and sync edges to DynamoDB for
// engine state durability and recovery.
//
// Table design:
//   pk: flow#{flowId}, sk: {timestamp}#{recordId}
//   - Stores ActionRecord entries sorted by time within a flow
//
// Sync edge table (or same table with different pk prefix):
//   pk: edge#{sorted-completionIds}#{syncName}, sk: "edge"
//   - Used for firing guard checks across concurrent instances
//
// TTL attribute enables automatic GC of old flows.
// ============================================================

import type { ActionRecord } from '../types.js';
import type { DurableActionLog } from './durable-action-log.js';
import { toPersistenceKey, syncEdgeKey } from './durable-action-log.js';
import type { DynamoDBDocumentClient } from '../adapters/dynamodb-storage.js';

// --- Configuration ---

export interface DynamoDBActionLogConfig {
  /** AWS region */
  region: string;
  /** Table name for action records */
  tableName: string;
  /** Table name for sync edges (defaults to same table) */
  edgeTableName?: string;
  /** TTL in seconds for automatic GC (default: 7 days) */
  ttlSeconds?: number;
}

// --- Implementation ---

export function createDynamoDBActionLog(
  client: DynamoDBDocumentClient,
  config: DynamoDBActionLogConfig,
): DurableActionLog {
  const table = config.tableName;
  const edgeTable = config.edgeTableName || config.tableName;
  const ttlSeconds = config.ttlSeconds ?? 7 * 24 * 60 * 60; // 7 days

  return {
    async append(record: ActionRecord): Promise<void> {
      const persisted = toPersistenceKey(record);
      const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

      await client.put({
        TableName: table,
        Item: {
          ...persisted,
          _ttl: ttl,
        },
      });
    },

    async loadFlow(flowId: string): Promise<ActionRecord[]> {
      const result = await client.query({
        TableName: table,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'pk' },
        ExpressionAttributeValues: { ':pk': `flow#${flowId}` },
      });

      if (!result.Items) return [];

      return result.Items.map(item => ({
        id: item.id as string,
        type: item.type as 'invocation' | 'completion',
        concept: item.concept as string,
        action: item.action as string,
        input: (item.input as Record<string, unknown>) || {},
        variant: item.variant as string | undefined,
        output: item.output as Record<string, unknown> | undefined,
        flow: item.flow as string,
        sync: item.sync as string | undefined,
        parent: item.parent as string | undefined,
        timestamp: item.timestamp as string,
      }));
    },

    async hasSyncEdge(completionIds: string[], syncName: string): Promise<boolean> {
      const edgePk = syncEdgeKey(completionIds, syncName);

      const result = await client.get({
        TableName: edgeTable,
        Key: { pk: edgePk, sk: 'edge' },
      });

      return result.Item !== undefined;
    },

    async addSyncEdge(completionId: string, invocationId: string, syncName: string): Promise<void> {
      const edgePk = syncEdgeKey([completionId], `${syncName}:${invocationId}`);
      const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

      await client.put({
        TableName: edgeTable,
        Item: {
          pk: edgePk,
          sk: 'edge',
          completionId,
          invocationId,
          syncName,
          timestamp: new Date().toISOString(),
          _ttl: ttl,
        },
      });
    },

    async addSyncEdgeForMatch(matchedIds: string[], syncName: string): Promise<void> {
      const edgePk = syncEdgeKey(matchedIds, syncName);
      const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

      await client.put({
        TableName: edgeTable,
        Item: {
          pk: edgePk,
          sk: 'edge',
          matchedIds: [...matchedIds].sort(),
          syncName,
          timestamp: new Date().toISOString(),
          _ttl: ttl,
        },
      });
    },

    async gc(olderThan: Date): Promise<number> {
      const cutoff = olderThan.toISOString();

      // Query for old flow records using a scan with filter
      // In production, use a GSI on timestamp for efficiency
      const result = await client.query({
        TableName: table,
        KeyConditionExpression: '#pk = #pk', // Scan — this is simplified
        FilterExpression: '#ts < :cutoff',
        ExpressionAttributeNames: { '#pk': 'pk', '#ts': 'timestamp' },
        ExpressionAttributeValues: { ':cutoff': cutoff },
      });

      if (!result.Items || result.Items.length === 0) return 0;

      const batchSize = 25;
      let deleted = 0;

      for (let i = 0; i < result.Items.length; i += batchSize) {
        const batch = result.Items.slice(i, i + batchSize);
        const deleteRequests = batch.map(item => ({
          DeleteRequest: {
            Key: { pk: item.pk as string, sk: item.sk as string },
          },
        }));

        await client.batchWrite({
          RequestItems: { [table]: deleteRequests },
        });

        deleted += batch.length;
      }

      return deleted;
    },
  };
}
