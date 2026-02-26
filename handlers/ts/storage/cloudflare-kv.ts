// ============================================================
// Cloudflare KV Storage Adapter
//
// Implements ConceptStorage backed by Cloudflare Workers KV.
// Used for edge concepts deployed on Cloudflare Workers.
//
// KV characteristics:
//   - Eventually consistent reads across regions
//   - Strong consistency within same region
//   - Max value size: 25 MiB
//   - Max key size: 512 bytes
//   - List operations return up to 1,000 keys per call
//
// Mapping:
//   put/get/del → KV put/get/delete
//   find       → KV list + filter (paginated)
//   lastWrittenAt → KV metadata field
//   getMeta    → KV getWithMetadata
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../../../kernel/src/types.js';

/**
 * Cloudflare KV namespace interface.
 * In a Workers environment, this is provided by the runtime binding.
 */
interface KVNamespace {
  get(key: string, options?: { type?: string }): Promise<string | null>;
  getWithMetadata<M = unknown>(
    key: string,
    options?: { type?: string },
  ): Promise<{ value: string | null; metadata: M | null }>;
  put(
    key: string,
    value: string,
    options?: { metadata?: Record<string, string>; expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: { name: string; metadata?: Record<string, string> }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Key format: {relation}:{key}
 * This allows list with prefix to scope queries to a single relation.
 */
function storageKey(relation: string, key: string): string {
  return `${relation}:${key}`;
}

function parseStorageKey(compositeKey: string): { relation: string; key: string } {
  const idx = compositeKey.indexOf(':');
  return {
    relation: compositeKey.substring(0, idx),
    key: compositeKey.substring(idx + 1),
  };
}

/**
 * Create a ConceptStorage backed by Cloudflare Workers KV.
 *
 * @param kv - The KV namespace binding from the Workers environment
 */
export function createCloudflareKVStorage(kv: KVNamespace): ConceptStorage {
  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const k = storageKey(relation, key);

      // Check for conflicts if onConflict callback is set
      if (storage.onConflict) {
        const { value: existing, metadata } = await kv.getWithMetadata<{ lastWrittenAt: string }>(k, { type: 'text' });
        if (existing) {
          const info: ConflictInfo = {
            relation,
            key,
            existing: {
              fields: JSON.parse(existing),
              writtenAt: metadata?.lastWrittenAt ?? now,
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
              await kv.put(k, JSON.stringify(resolution.merged), {
                metadata: { lastWrittenAt: now },
              });
              return;
            case 'escalate':
              break;
          }
        }
      }

      await kv.put(k, JSON.stringify(value), {
        metadata: { lastWrittenAt: now },
      });
    },

    async get(relation, key) {
      const raw = await kv.get(storageKey(relation, key), { type: 'text' });
      return raw ? JSON.parse(raw) : null;
    },

    async find(relation, criteria?) {
      const prefix = `${relation}:`;
      const results: Record<string, unknown>[] = [];

      let cursor: string | undefined;
      let complete = false;

      while (!complete) {
        const page = await kv.list({ prefix, limit: 1000, cursor });
        for (const { name } of page.keys) {
          const raw = await kv.get(name, { type: 'text' });
          if (raw) {
            const entry = JSON.parse(raw);
            if (!criteria || Object.keys(criteria).length === 0 ||
                Object.entries(criteria).every(([k, v]) => entry[k] === v)) {
              results.push(entry);
            }
          }
        }
        complete = page.list_complete;
        cursor = page.cursor;
      }

      return results;
    },

    async del(relation, key) {
      await kv.delete(storageKey(relation, key));
    },

    async delMany(relation, criteria) {
      const prefix = `${relation}:`;
      let count = 0;
      let cursor: string | undefined;
      let complete = false;

      while (!complete) {
        const page = await kv.list({ prefix, limit: 1000, cursor });
        for (const { name } of page.keys) {
          const raw = await kv.get(name, { type: 'text' });
          if (raw) {
            const entry = JSON.parse(raw);
            if (Object.entries(criteria).every(([k, v]) => entry[k] === v)) {
              await kv.delete(name);
              count++;
            }
          }
        }
        complete = page.list_complete;
        cursor = page.cursor;
      }

      return count;
    },

    async getMeta(relation, key) {
      const { metadata } = await kv.getWithMetadata<{ lastWrittenAt: string }>(
        storageKey(relation, key),
        { type: 'text' },
      );
      return metadata ? { lastWrittenAt: metadata.lastWrittenAt } : null;
    },
  };

  return storage;
}
