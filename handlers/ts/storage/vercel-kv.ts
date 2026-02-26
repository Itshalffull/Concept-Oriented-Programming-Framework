// ============================================================
// Vercel KV Storage Adapter
//
// Implements ConceptStorage backed by Vercel KV (Redis-compatible).
// Used for edge concepts deployed on Vercel Edge Functions.
//
// Vercel KV characteristics:
//   - Redis-compatible API (upstash/redis under the hood)
//   - Low latency reads via regional replication
//   - Supports TTL per key
//   - SCAN for prefix-based listing
//
// Mapping:
//   put → HSET (hash per relation:key with fields + meta)
//   get → HGETALL
//   del → DEL
//   find → SCAN with prefix + filter
//   lastWrittenAt → stored in hash meta field
//   getMeta → HGET meta field
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../../../kernel/src/types.js';

/**
 * Vercel KV client interface (Redis-compatible).
 * In a Vercel environment, use @vercel/kv or @upstash/redis.
 */
interface VercelKVClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<string>;
  del(...keys: string[]): Promise<number>;
  scan(cursor: number, options?: { match?: string; count?: number }): Promise<[string, string[]]>;
  keys(pattern: string): Promise<string[]>;
}

interface StoredValue {
  fields: Record<string, unknown>;
  meta: EntryMeta;
}

function storageKey(relation: string, key: string): string {
  return `clef:${relation}:${key}`;
}

/**
 * Create a ConceptStorage backed by Vercel KV (Redis-compatible).
 *
 * @param kv - A Vercel KV or Upstash Redis client instance
 */
export function createVercelKVStorage(kv: VercelKVClient): ConceptStorage {
  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const k = storageKey(relation, key);

      if (storage.onConflict) {
        const existing = await kv.get<StoredValue>(k);
        if (existing) {
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: { ...existing.fields },
              writtenAt: existing.meta.lastWrittenAt,
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
              await kv.set(k, {
                fields: { ...resolution.merged },
                meta: { lastWrittenAt: now },
              } satisfies StoredValue);
              return;
            case 'escalate':
              break;
          }
        }
      }

      await kv.set(k, {
        fields: { ...value },
        meta: { lastWrittenAt: now },
      } satisfies StoredValue);
    },

    async get(relation, key) {
      const entry = await kv.get<StoredValue>(storageKey(relation, key));
      return entry ? { ...entry.fields } : null;
    },

    async find(relation, criteria?) {
      const prefix = `clef:${relation}:`;
      const matchingKeys = await kv.keys(`${prefix}*`);
      const results: Record<string, unknown>[] = [];

      for (const k of matchingKeys) {
        const entry = await kv.get<StoredValue>(k);
        if (entry) {
          if (!criteria || Object.keys(criteria).length === 0 ||
              Object.entries(criteria).every(([ck, cv]) => entry.fields[ck] === cv)) {
            results.push({ ...entry.fields });
          }
        }
      }

      return results;
    },

    async del(relation, key) {
      await kv.del(storageKey(relation, key));
    },

    async delMany(relation, criteria) {
      const prefix = `clef:${relation}:`;
      const matchingKeys = await kv.keys(`${prefix}*`);
      let count = 0;

      for (const k of matchingKeys) {
        const entry = await kv.get<StoredValue>(k);
        if (entry && Object.entries(criteria).every(([ck, cv]) => entry.fields[ck] === cv)) {
          await kv.del(k);
          count++;
        }
      }

      return count;
    },

    async getMeta(relation, key) {
      const entry = await kv.get<StoredValue>(storageKey(relation, key));
      return entry ? { ...entry.meta } : null;
    },
  };

  return storage;
}
