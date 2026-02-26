// Federated — storage_backend provider
// Decorator-pattern storage that routes field reads/writes to either a remote backend
// (via Connector + FieldMapping + Cache through EventBus dispatch) or the local SQL
// backend, based on per-field configuration in the Schema's federation_config.

export const PROVIDER_ID = 'federated';
export const PLUGIN_TYPE = 'storage_backend';

// --- Domain types ---

export interface ContentNode {
  id: string;
  type: string;
  fields: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface FieldDef {
  name: string;
  type: string;
  required?: boolean;
}

export interface FederationConfig {
  source: string;
  fieldMapping?: string;
  cacheTtl: number;
  readOnlyRemote: boolean;
  localFields: string[];
}

export interface SchemaRef {
  name: string;
  fields: FieldDef[];
  associations: {
    storage_backend: string;
    providers: Record<string, string>;
    federation_config: FederationConfig;
  };
}

export interface SaveResult { id: string; created: boolean; }
export interface DeleteResult { deleted: boolean; }
export interface QueryCondition { field: string; operator: string; value: unknown; }
export interface SortSpec { field: string; direction: 'asc' | 'desc'; }
export interface RangeSpec { offset: number; limit: number; }

// --- Dependency contracts (injected) ---

export interface LocalStorageBackend {
  save(node: ContentNode, schema: SchemaRef): Promise<SaveResult>;
  load(id: string, schema: SchemaRef): Promise<ContentNode | null>;
  loadMultiple(ids: string[], schema: SchemaRef): Promise<ContentNode[]>;
  delete(id: string, schema: SchemaRef): Promise<DeleteResult>;
  query(conditions: QueryCondition[], sorts: SortSpec[], range: RangeSpec, schema: SchemaRef): Promise<ContentNode[]>;
}

export interface EventBus {
  dispatch(event: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// --- Cache entry ---

interface CacheEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}

// --- Helpers ---

function partitionFields(
  fields: Record<string, unknown>,
  localFieldNames: string[],
): { localFields: Record<string, unknown>; remoteFields: Record<string, unknown> } {
  const localFields: Record<string, unknown> = {};
  const remoteFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (localFieldNames.includes(key)) {
      localFields[key] = value;
    } else {
      remoteFields[key] = value;
    }
  }
  return { localFields, remoteFields };
}

function cacheKey(schemaName: string, id: string): string {
  return `${schemaName}:${id}`;
}

function matchesCondition(value: unknown, operator: string, target: unknown): boolean {
  switch (operator) {
    case 'eq': return value === target;
    case 'neq': return value !== target;
    case 'gt': return (value as number) > (target as number);
    case 'gte': return (value as number) >= (target as number);
    case 'lt': return (value as number) < (target as number);
    case 'lte': return (value as number) <= (target as number);
    case 'contains': return typeof value === 'string' && value.includes(target as string);
    case 'in': return Array.isArray(target) && target.includes(value);
    default: return false;
  }
}

function applySort(nodes: ContentNode[], sorts: SortSpec[]): ContentNode[] {
  return [...nodes].sort((a, b) => {
    for (const sort of sorts) {
      const aVal = a.fields[sort.field];
      const bVal = b.fields[sort.field];
      if (aVal === bVal) continue;
      if (aVal == null) return sort.direction === 'asc' ? -1 : 1;
      if (bVal == null) return sort.direction === 'asc' ? 1 : -1;
      const cmp = aVal < bVal ? -1 : 1;
      return sort.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

// --- Provider implementation ---

export class FederatedStorageProvider {
  private localBackend: LocalStorageBackend;
  private cache: Map<string, CacheEntry>;
  private eventBus: EventBus;

  constructor(localBackend: LocalStorageBackend, eventBus: EventBus) {
    this.localBackend = localBackend;
    this.cache = new Map();
    this.eventBus = eventBus;
  }

  private federationConfig(schema: SchemaRef): FederationConfig {
    return schema.associations.federation_config;
  }

  private isLocalField(fieldName: string, config: FederationConfig): boolean {
    return config.localFields.includes(fieldName);
  }

  private getCached(key: string): Record<string, unknown> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: Record<string, unknown>, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private async loadRemoteFields(
    id: string,
    schema: SchemaRef,
    config: FederationConfig,
  ): Promise<Record<string, unknown>> {
    const key = cacheKey(schema.name, id);
    const cached = this.getCached(key);
    if (cached) return cached;

    // Dispatch federated.load_remote through EventBus to trigger
    // Connector.read followed by FieldMapping.apply
    const result = await this.eventBus.dispatch('federated.load_remote', {
      id,
      source: config.source,
      fieldMapping: config.fieldMapping ?? null,
      schemaName: schema.name,
    });

    const remoteData = (result.fields ?? result) as Record<string, unknown>;
    this.setCache(key, remoteData, config.cacheTtl);
    return remoteData;
  }

  private async saveRemoteFields(
    id: string,
    remoteFields: Record<string, unknown>,
    config: FederationConfig,
  ): Promise<void> {
    // Dispatch federated.save_remote through EventBus to trigger
    // FieldMapping.reverse followed by Connector.write
    await this.eventBus.dispatch('federated.save_remote', {
      id,
      fields: remoteFields,
      source: config.source,
      fieldMapping: config.fieldMapping ?? null,
    });

    // Invalidate cache after remote write so next read picks up fresh data
    this.cache.delete(cacheKey(config.source, id));
  }

  async load(id: string, schema: SchemaRef): Promise<ContentNode | null> {
    const config = this.federationConfig(schema);

    // Load remote fields (cache-first, then EventBus dispatch on miss)
    const remoteFields = await this.loadRemoteFields(id, schema, config);

    // Load local fields from SQL backend
    const localNode = await this.localBackend.load(id, schema);

    // If neither remote nor local has data, the entity does not exist
    if (!localNode && Object.keys(remoteFields).length === 0) return null;

    // Merge: remote fields as the base, local fields overlay
    const mergedFields: Record<string, unknown> = { ...remoteFields };
    if (localNode) {
      for (const [key, value] of Object.entries(localNode.fields)) {
        if (this.isLocalField(key, config)) {
          mergedFields[key] = value;
        }
      }
    }

    return {
      id,
      type: localNode?.type ?? schema.name,
      fields: mergedFields,
      metadata: {
        ...localNode?.metadata,
        federated: true,
        source: config.source,
      },
    };
  }

  async save(node: ContentNode, schema: SchemaRef): Promise<SaveResult> {
    const config = this.federationConfig(schema);
    const { localFields, remoteFields } = partitionFields(node.fields, config.localFields);

    // Always persist local fields to the SQL backend
    const localNode: ContentNode = {
      id: node.id,
      type: node.type,
      fields: localFields,
      metadata: node.metadata,
    };
    const result = await this.localBackend.save(localNode, schema);

    // Write remote fields only when the remote source is writable
    if (!config.readOnlyRemote && Object.keys(remoteFields).length > 0) {
      await this.saveRemoteFields(node.id, remoteFields, config);
    }

    return result;
  }

  async loadMultiple(ids: string[], schema: SchemaRef): Promise<ContentNode[]> {
    const config = this.federationConfig(schema);

    // Partition IDs into cache-hits and cache-misses for remote data
    const remoteDataMap = new Map<string, Record<string, unknown>>();
    const missedIds: string[] = [];

    for (const id of ids) {
      const cached = this.getCached(cacheKey(schema.name, id));
      if (cached) {
        remoteDataMap.set(id, cached);
      } else {
        missedIds.push(id);
      }
    }

    // Batch-fetch remote data for all cache misses via EventBus
    if (missedIds.length > 0) {
      const batchResult = await this.eventBus.dispatch('federated.load_remote_batch', {
        ids: missedIds,
        source: config.source,
        fieldMapping: config.fieldMapping ?? null,
        schemaName: schema.name,
      });

      const batchRecords = (batchResult.records ?? {}) as Record<string, Record<string, unknown>>;
      for (const id of missedIds) {
        const remoteData = batchRecords[id] ?? {};
        this.setCache(cacheKey(schema.name, id), remoteData, config.cacheTtl);
        remoteDataMap.set(id, remoteData);
      }
    }

    // Load all local fields in a single SQL query
    const localNodes = await this.localBackend.loadMultiple(ids, schema);
    const localMap = new Map<string, ContentNode>();
    for (const node of localNodes) {
      localMap.set(node.id, node);
    }

    // Merge per-ID
    const results: ContentNode[] = [];
    for (const id of ids) {
      const remoteFields = remoteDataMap.get(id) ?? {};
      const localNode = localMap.get(id);

      if (!localNode && Object.keys(remoteFields).length === 0) continue;

      const mergedFields: Record<string, unknown> = { ...remoteFields };
      if (localNode) {
        for (const [key, value] of Object.entries(localNode.fields)) {
          if (this.isLocalField(key, config)) {
            mergedFields[key] = value;
          }
        }
      }

      results.push({
        id,
        type: localNode?.type ?? schema.name,
        fields: mergedFields,
        metadata: {
          ...localNode?.metadata,
          federated: true,
          source: config.source,
        },
      });
    }

    return results;
  }

  async delete(id: string, schema: SchemaRef): Promise<DeleteResult> {
    const config = this.federationConfig(schema);

    // Always delete local data from the SQL backend
    const localResult = await this.localBackend.delete(id, schema);

    // Evict from cache
    this.cache.delete(cacheKey(schema.name, id));

    // If remote is writable, dispatch remote delete
    if (!config.readOnlyRemote) {
      await this.eventBus.dispatch('federated.delete_remote', {
        id,
        source: config.source,
        schemaName: schema.name,
      });
    }

    return localResult;
  }

  async query(
    conditions: QueryCondition[],
    sorts: SortSpec[],
    range: RangeSpec,
    schema: SchemaRef,
  ): Promise<ContentNode[]> {
    const config = this.federationConfig(schema);

    // Determine whether the query touches any remote fields
    const touchesRemote = conditions.some(c => !this.isLocalField(c.field, config));

    if (!touchesRemote) {
      // Pure local query: delegate entirely to the SQL backend
      return this.localBackend.query(conditions, sorts, range, schema);
    }

    // Mixed or remote query: split conditions, load candidates, filter in memory
    const localConditions = conditions.filter(c => this.isLocalField(c.field, config));
    const remoteConditions = conditions.filter(c => !this.isLocalField(c.field, config));

    // Fetch local candidates (apply only local conditions to narrow set)
    const unlimitedRange: RangeSpec = { offset: 0, limit: Number.MAX_SAFE_INTEGER };
    const localCandidates = await this.localBackend.query(localConditions, [], unlimitedRange, schema);

    // Load remote fields for each candidate and merge
    const merged: ContentNode[] = [];
    for (const candidate of localCandidates) {
      const remoteFields = await this.loadRemoteFields(candidate.id, schema, config);
      const mergedFields: Record<string, unknown> = { ...remoteFields };
      for (const [key, value] of Object.entries(candidate.fields)) {
        if (this.isLocalField(key, config)) {
          mergedFields[key] = value;
        }
      }

      // Apply remote conditions in memory
      const passesRemote = remoteConditions.every(cond =>
        matchesCondition(mergedFields[cond.field], cond.operator, cond.value),
      );
      if (!passesRemote) continue;

      merged.push({
        id: candidate.id,
        type: candidate.type,
        fields: mergedFields,
        metadata: {
          ...candidate.metadata,
          federated: true,
          source: config.source,
        },
      });
    }

    // Apply sorting on the full merged set
    const sorted = sorts.length > 0 ? applySort(merged, sorts) : merged;

    // Apply range (offset + limit)
    return sorted.slice(range.offset, range.offset + range.limit);
  }

  /** Remove all expired entries from the in-memory cache. */
  pruneCache(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /** Invalidate a specific cached entity or the entire cache. */
  invalidateCache(id?: string, schemaName?: string): void {
    if (id && schemaName) {
      this.cache.delete(cacheKey(schemaName, id));
    } else {
      this.cache.clear();
    }
  }
}

export default FederatedStorageProvider;
