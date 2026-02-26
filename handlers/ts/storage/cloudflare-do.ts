// ============================================================
// Cloudflare Durable Objects Storage Adapter
//
// Implements ConceptStorage backed by Durable Objects storage.
// Used for stateful edge concepts needing transactional guarantees.
//
// Durable Objects characteristics:
//   - Strong consistency (single-threaded per object)
//   - Transactional reads and writes
//   - Each concept instance maps to one Durable Object
//   - Supports onConflict hooks (Section 16.6)
//   - Max value size: 128 KiB per key
//   - Max keys per list: 128
//
// Mapping:
//   put/get/del → DO storage put/get/delete
//   find       → DO storage list with prefix + filter
//   lastWrittenAt → stored as part of entry metadata
//   getMeta    → read metadata from stored entry
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../../../kernel/src/types.js';

/**
 * Durable Object storage interface.
 * In a Workers environment, this is available via `this.state.storage`
 * inside a Durable Object class.
 */
interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T>(key: string, value: T): Promise<void>;
  put<T>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T = unknown>(options?: {
    prefix?: string;
    limit?: number;
    start?: string;
    end?: string;
    reverse?: boolean;
  }): Promise<Map<string, T>>;
  transaction<T>(closure: (txn: DurableObjectStorage) => Promise<T>): Promise<T>;
}

interface StoredEntry {
  fields: Record<string, unknown>;
  meta: EntryMeta;
}

function storageKey(relation: string, key: string): string {
  return `${relation}:${key}`;
}

/**
 * Create a ConceptStorage backed by Cloudflare Durable Objects.
 *
 * Each concept instance should map to a single Durable Object,
 * providing strong consistency and transactional guarantees.
 *
 * @param doStorage - The Durable Object's storage API (this.state.storage)
 */
export function createDurableObjectStorage(doStorage: DurableObjectStorage): ConceptStorage {
  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const now = new Date().toISOString();
      const k = storageKey(relation, key);

      if (storage.onConflict) {
        // Transactional conflict check
        await doStorage.transaction(async (txn) => {
          const existing = await txn.get<StoredEntry>(k);
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

            const resolution = storage.onConflict!(info);
            switch (resolution.action) {
              case 'keep-existing':
                return;
              case 'accept-incoming':
                break;
              case 'merge':
                await txn.put<StoredEntry>(k, {
                  fields: { ...resolution.merged },
                  meta: { lastWrittenAt: now },
                });
                return;
              case 'escalate':
                break;
            }
          }

          await txn.put<StoredEntry>(k, {
            fields: { ...value },
            meta: { lastWrittenAt: now },
          });
        });
      } else {
        await doStorage.put<StoredEntry>(k, {
          fields: { ...value },
          meta: { lastWrittenAt: now },
        });
      }
    },

    async get(relation, key) {
      const entry = await doStorage.get<StoredEntry>(storageKey(relation, key));
      return entry ? { ...entry.fields } : null;
    },

    async find(relation, criteria?) {
      const prefix = `${relation}:`;
      const entries = await doStorage.list<StoredEntry>({ prefix });
      const results: Record<string, unknown>[] = [];

      for (const [, entry] of entries) {
        if (!criteria || Object.keys(criteria).length === 0 ||
            Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          results.push({ ...entry.fields });
        }
      }

      return results;
    },

    async del(relation, key) {
      await doStorage.delete(storageKey(relation, key));
    },

    async delMany(relation, criteria) {
      const prefix = `${relation}:`;
      const entries = await doStorage.list<StoredEntry>({ prefix });
      const toDelete: string[] = [];

      for (const [name, entry] of entries) {
        if (Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          toDelete.push(name);
        }
      }

      if (toDelete.length > 0) {
        return await doStorage.delete(toDelete);
      }
      return 0;
    },

    async getMeta(relation, key) {
      const entry = await doStorage.get<StoredEntry>(storageKey(relation, key));
      return entry ? { ...entry.meta } : null;
    },
  };

  return storage;
}
