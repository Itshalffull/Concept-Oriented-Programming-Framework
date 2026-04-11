// ============================================================
// Clef Kernel - In-Memory Storage Implementation
//
// Tracks lastWrittenAt timestamps for all entries,
// supports getMeta() for timestamp retrieval, and onConflict
// callback for conflict detection during concurrent writes.
// ============================================================

import type {
  ConceptStorage,
  FindOptions,
  EntryMeta,
  ConflictInfo,
  ConflictResolution,
} from '../types.js';

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

  // Secondary indexes: relation → field → value → Set<key>
  const indexes = new Map<string, Map<string, Map<string, Set<string>>>>();

  function getRelation(name: string): Map<string, StoredEntry> {
    let rel = relations.get(name);
    if (!rel) {
      rel = new Map();
      relations.set(name, rel);
    }
    return rel;
  }

  /** Get the set of indexed fields for a relation, or undefined if none. */
  function getRelationIndexes(relation: string): Map<string, Map<string, Set<string>>> | undefined {
    return indexes.get(relation);
  }

  /** Add a key to all applicable indexes for a relation after a write. */
  function indexAdd(relation: string, key: string, fields: Record<string, unknown>): void {
    const relIndexes = indexes.get(relation);
    if (!relIndexes) return;
    for (const [indexedField, valueMap] of relIndexes) {
      const val = fields[indexedField];
      if (val === undefined || val === null) continue;
      const valStr = String(val);
      let keySet = valueMap.get(valStr);
      if (!keySet) {
        keySet = new Set();
        valueMap.set(valStr, keySet);
      }
      keySet.add(key);
    }
  }

  /** Remove a key from all applicable indexes for a relation before a delete. */
  function indexRemove(relation: string, key: string, fields: Record<string, unknown>): void {
    const relIndexes = indexes.get(relation);
    if (!relIndexes) return;
    for (const [indexedField, valueMap] of relIndexes) {
      const val = fields[indexedField];
      if (val === undefined || val === null) continue;
      const valStr = String(val);
      const keySet = valueMap.get(valStr);
      if (keySet) {
        keySet.delete(key);
        if (keySet.size === 0) valueMap.delete(valStr);
      }
    }
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
              indexRemove(relation, key, existing.fields);
              rel.set(key, {
                fields: { ...resolution.merged },
                meta: { lastWrittenAt: now },
              });
              indexAdd(relation, key, resolution.merged);
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
              `[clef/storage] LWW conflict: overwriting ${relation}/${key} ` +
              `(existing: ${existing.meta.lastWrittenAt}, incoming: ${now})`,
            );
          }
        }
      }

      // Remove old index entries if updating an existing record
      if (existing) {
        indexRemove(relation, key, existing.fields);
      }

      rel.set(key, {
        fields: { ...value },
        meta: { lastWrittenAt: now },
      });

      // Add new index entries
      indexAdd(relation, key, value);
    },

    async get(relation, key) {
      const rel = getRelation(relation);
      const entry = rel.get(key);
      return entry ? { ...entry.fields } : null;
    },

    async find(relation, criteria?, options?: FindOptions) {
      const rel = getRelation(relation);

      let results: Record<string, unknown>[];
      if (!criteria || Object.keys(criteria).length === 0) {
        // No criteria — full scan
        results = Array.from(rel.entries()).map(([key, e]) => ({ ...e.fields, _key: key }));
      } else {
        const relIndexes = getRelationIndexes(relation);
        const criteriaEntries = Object.entries(criteria);

        // Find the best indexed field (smallest candidate set)
        let bestIndexField: string | null = null;
        let bestCandidates: Set<string> | null = null;

        if (relIndexes) {
          for (const [k, v] of criteriaEntries) {
            const fieldIndex = relIndexes.get(k);
            if (fieldIndex) {
              const valStr = String(v);
              const candidates = fieldIndex.get(valStr);
              const size = candidates ? candidates.size : 0;
              if (bestCandidates === null || size < bestCandidates.size) {
                bestIndexField = k;
                bestCandidates = candidates ?? new Set();
              }
            }
          }
        }

        if (bestIndexField !== null && bestCandidates !== null) {
          // Index-accelerated path: fetch only candidate keys, then filter remaining criteria
          const remainingCriteria = criteriaEntries.filter(([k]) => k !== bestIndexField);
          results = [];
          for (const key of bestCandidates) {
            const entry = rel.get(key);
            if (!entry) continue;
            const row: Record<string, unknown> = { ...entry.fields, _key: key };
            if (remainingCriteria.every(([k, v]) => row[k] === v)) {
              results.push(row);
            }
          }
        } else {
          // No index available — fall back to linear scan
          const entries = Array.from(rel.entries()).map(([key, e]) => ({ ...e.fields, _key: key }));
          results = entries.filter(entry =>
            criteriaEntries.every(([k, v]) => entry[k] === v),
          );
        }
      }

      // Apply sort if specified
      if (options?.sort) {
        const { field, order } = options.sort;
        results.sort((a, b) => {
          const aVal = a[field];
          const bVal = b[field];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return order === 'asc' ? -1 : 1;
          if (bVal == null) return order === 'asc' ? 1 : -1;
          if (aVal < bVal) return order === 'asc' ? -1 : 1;
          if (aVal > bVal) return order === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // Apply offset and limit for pagination
      if (options?.offset != null || options?.limit != null) {
        const start = options?.offset ?? 0;
        const end = options?.limit != null ? start + options.limit : undefined;
        results = results.slice(start, end);
      }

      return results;
    },

    async del(relation, key) {
      const rel = getRelation(relation);
      const existing = rel.get(key);
      if (existing) {
        indexRemove(relation, key, existing.fields);
      }
      rel.delete(key);
    },

    async delMany(relation, criteria) {
      const rel = getRelation(relation);
      let count = 0;
      for (const [key, entry] of rel.entries()) {
        if (Object.entries(criteria).every(([k, v]) => entry.fields[k] === v)) {
          indexRemove(relation, key, entry.fields);
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

    ensureIndex(relation: string, field: string): void {
      let relIndexes = indexes.get(relation);
      if (!relIndexes) {
        relIndexes = new Map();
        indexes.set(relation, relIndexes);
      }

      // Idempotent: if index already exists, no-op
      if (relIndexes.has(field)) return;

      // Create the value→keys map for this field
      const valueMap = new Map<string, Set<string>>();
      relIndexes.set(field, valueMap);

      // Backfill from existing data
      const rel = relations.get(relation);
      if (rel) {
        for (const [key, entry] of rel) {
          const val = entry.fields[field];
          if (val === undefined || val === null) continue;
          const valStr = String(val);
          let keySet = valueMap.get(valStr);
          if (!keySet) {
            keySet = new Set();
            valueMap.set(valStr, keySet);
          }
          keySet.add(key);
        }
      }
    },
  };

  return storage;
}
