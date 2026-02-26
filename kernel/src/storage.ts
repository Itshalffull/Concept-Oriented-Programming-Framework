// ============================================================
// Clef Kernel - In-Memory Storage Implementation
//
// Tracks lastWrittenAt timestamps for all entries,
// supports getMeta() for timestamp retrieval, and onConflict
// callback for conflict detection during concurrent writes.
// ============================================================

import type {
  ConceptStorage,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from './types.js';

/** Internal entry with metadata */
interface StoredEntry {
  fields: Record<string, unknown>;
  meta: EntryMeta;
}

/**
 * In-memory storage. Used for tests and lightweight concepts.
 * Data is lost on process restart.
 *
 * Each relation is stored as a Map<string, StoredEntry>.
 * All writes track lastWrittenAt timestamps and support
 * conflict detection via the onConflict callback.
 */
export function createInMemoryStorage(): ConceptStorage {
  const relations = new Map<string, Map<string, StoredEntry>>();

  function getRelation(name: string): Map<string, StoredEntry> {
    let rel = relations.get(name);
    if (!rel) {
      rel = new Map();
      relations.set(name, rel);
    }
    return rel;
  }

  const storage: ConceptStorage = {
    async put(relation, key, value) {
      const rel = getRelation(relation);
      const now = new Date().toISOString();
      const existing = rel.get(key);

      if (existing) {
        // Check for conflict via onConflict callback
        if (storage.onConflict) {
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
              return; // Don't write
            case 'accept-incoming':
              break; // Fall through to normal write
            case 'merge':
              rel.set(key, {
                fields: { ...resolution.merged },
                meta: { lastWrittenAt: now },
              });
              return;
            case 'escalate':
              // Store the write but mark for escalation
              // The caller (eventual sync queue) handles producing the conflict completion
              break;
          }
        } else {
          // Default LWW: log warning if overwriting a more recent entry
          if (existing.meta.lastWrittenAt > now) {
            console.warn(
              `[copf/storage] LWW conflict: overwriting ${relation}/${key} ` +
              `(existing: ${existing.meta.lastWrittenAt}, incoming: ${now})`,
            );
          }
        }
      }

      rel.set(key, {
        fields: { ...value },
        meta: { lastWrittenAt: now },
      });
    },

    async get(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry.fields } : null;
    },

    async find(relation, criteria?) {
      const rel = getRelation(relation);
      const entries = Array.from(rel.values()).map(e => e.fields);

      if (!criteria || Object.keys(criteria).length === 0) {
        return entries.map(e => ({ ...e }));
      }

      return entries
        .filter(entry =>
          Object.entries(criteria!).every(([k, v]) => entry[k] === v),
        )
        .map(e => ({ ...e }));
    },

    async del(relation, key) {
      const rel = getRelation(relation);
      rel.delete(key);
    },

    async delMany(relation, criteria) {
      const rel = getRelation(relation);
      let count = 0;
      for (const [key, entry] of rel.entries()) {
        if (Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          rel.delete(key);
          count++;
        }
      }
      return count;
    },

    async getMeta(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry.meta } : null;
    },
  };

  return storage;
}
