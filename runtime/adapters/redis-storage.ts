// ============================================================
// Redis Storage Adapter
//
// Implements ConceptStorage backed by Redis.
// Supports both traditional Redis (ElastiCache, Memorystore)
// and serverless Redis (Upstash) via an abstracted client interface.
//
// Redis characteristics:
//   - Sub-millisecond latency for key-value operations
//   - No native secondary indexes (find() uses key set + pipeline)
//   - Connection pooling concerns in serverless (use Upstash HTTP)
//   - TTL support per key
//
// Key format:
//   {prefix}:{relation}:{key}         -> Hash with entry fields
//   {prefix}:{relation}:_keys         -> Set of all keys in relation
//   {prefix}:{relation}:{key}:_meta   -> String with lastWrittenAt
//   {prefix}:_version                 -> Schema version
//
// Best suited for concepts with key-based access patterns
// (session, cache, rate-limit). Complex where-clause queries
// should prefer DynamoDB or Firestore.
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../types.js';

// --- Redis Client Interface ---
// Abstracted to support both ioredis and Upstash REST clients.

export interface RedisClient {
  hset(key: string, fields: Record<string, string>): Promise<number>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  del(key: string): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  set(key: string, value: string): Promise<string | null>;
  get(key: string): Promise<string | null>;
  /** Pipeline multiple hgetall calls for find() */
  pipeline?(): RedisPipeline;
}

export interface RedisPipeline {
  hgetall(key: string): RedisPipeline;
  exec(): Promise<[Error | null, Record<string, string> | null][]>;
}

// --- Configuration ---

export interface RedisStorageConfig {
  /** Redis connection URL (redis://... or rediss://...) */
  url: string;
  /** Key prefix for all entries (e.g. "myapp:prod") */
  keyPrefix: string;
  /** Optional default TTL in seconds for all entries */
  ttlSeconds?: number;
}

// --- Internal Helpers ---

function entryKey(prefix: string, relation: string, key: string): string {
  return `${prefix}:${relation}:${key}`;
}

function keySetKey(prefix: string, relation: string): string {
  return `${prefix}:${relation}:_keys`;
}

function metaKey(prefix: string, relation: string, key: string): string {
  return `${prefix}:${relation}:${key}:_meta`;
}

function serializeFields(value: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    result[k] = JSON.stringify(v);
  }
  return result;
}

function deserializeFields(raw: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    try {
      result[k] = JSON.parse(v);
    } catch {
      result[k] = v;
    }
  }
  return result;
}

// --- Factory ---

/**
 * Create a ConceptStorage backed by Redis.
 *
 * @param client - A Redis client (ioredis, Upstash, or mock)
 * @param config - Storage configuration
 */
export function createRedisStorage(
  client: RedisClient,
  config: RedisStorageConfig,
): ConceptStorage {
  const prefix = config.keyPrefix;

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const ek = entryKey(prefix, relation, key);
      const mk = metaKey(prefix, relation, key);
      const ks = keySetKey(prefix, relation);

      // Check for conflicts if onConflict callback is set
      if (storage.onConflict) {
        const existing = await client.hgetall(ek);
        if (existing && Object.keys(existing).length > 0) {
          const existingMeta = await client.get(mk);
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: deserializeFields(existing),
              writtenAt: existingMeta ?? now,
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
              await client.hset(ek, serializeFields(resolution.merged));
              await client.set(mk, now);
              await client.sadd(ks, key);
              return;
            case 'escalate':
              break;
          }
        }
      }

      await client.hset(ek, serializeFields(value));
      await client.set(mk, now);
      await client.sadd(ks, key);
    },

    async get(relation, key) {
      const ek = entryKey(prefix, relation, key);
      const raw = await client.hgetall(ek);
      if (!raw || Object.keys(raw).length === 0) return null;
      return deserializeFields(raw);
    },

    async find(relation, criteria?) {
      const ks = keySetKey(prefix, relation);
      const keys = await client.smembers(ks);

      if (keys.length === 0) return [];

      // Fetch all entries (pipeline if available, sequential otherwise)
      const entries: Record<string, unknown>[] = [];

      if (client.pipeline) {
        const pipe = client.pipeline();
        for (const key of keys) {
          pipe.hgetall(entryKey(prefix, relation, key));
        }
        const results = await pipe.exec();
        for (const [err, raw] of results) {
          if (!err && raw && Object.keys(raw).length > 0) {
            entries.push(deserializeFields(raw));
          }
        }
      } else {
        for (const key of keys) {
          const raw = await client.hgetall(entryKey(prefix, relation, key));
          if (raw && Object.keys(raw).length > 0) {
            entries.push(deserializeFields(raw));
          }
        }
      }

      // Apply criteria filter
      if (!criteria || Object.keys(criteria).length === 0) {
        return entries;
      }

      return entries.filter(entry =>
        Object.entries(criteria!).every(([k, v]) => entry[k] === v),
      );
    },

    async del(relation, key) {
      const ek = entryKey(prefix, relation, key);
      const mk = metaKey(prefix, relation, key);
      const ks = keySetKey(prefix, relation);

      await client.del(ek);
      await client.del(mk);
      await client.srem(ks, key);
    },

    async delMany(relation, criteria) {
      const matches = await storage.find(relation, criteria);
      if (matches.length === 0) return 0;

      let count = 0;
      for (const entry of matches) {
        // Find the key for this entry by checking all keys
        const ks = keySetKey(prefix, relation);
        const allKeys = await client.smembers(ks);

        for (const key of allKeys) {
          const raw = await client.hgetall(entryKey(prefix, relation, key));
          if (raw && Object.keys(raw).length > 0) {
            const fields = deserializeFields(raw);
            const isMatch = Object.entries(criteria).every(([k, v]) => fields[k] === v);
            if (isMatch) {
              await storage.del(relation, key);
              count++;
              break;
            }
          }
        }
      }

      return count;
    },

    async getMeta(relation, key) {
      const mk = metaKey(prefix, relation, key);
      const lastWrittenAt = await client.get(mk);
      if (!lastWrittenAt) return null;
      return { lastWrittenAt };
    },
  };

  return storage;
}
