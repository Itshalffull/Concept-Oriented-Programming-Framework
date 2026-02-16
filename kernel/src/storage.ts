// ============================================================
// COPF Kernel - In-Memory Storage Implementation
// ============================================================

import type { ConceptStorage } from './types.js';

/**
 * In-memory storage. Used for tests and lightweight concepts.
 * Data is lost on process restart.
 *
 * Each relation is stored as a Map<string, Record<string, unknown>>.
 */
export function createInMemoryStorage(): ConceptStorage {
  const relations = new Map<string, Map<string, Record<string, unknown>>>();

  function getRelation(name: string): Map<string, Record<string, unknown>> {
    let rel = relations.get(name);
    if (!rel) {
      rel = new Map();
      relations.set(name, rel);
    }
    return rel;
  }

  return {
    async put(relation, key, value) {
      const rel = getRelation(relation);
      rel.set(key, { ...value });
    },

    async get(relation, key) {
      const rel = getRelation(relation);
      const record = rel.get(key);
      return record ? { ...record } : null;
    },

    async find(relation, criteria?) {
      const rel = getRelation(relation);
      const entries = Array.from(rel.values());

      if (!criteria || Object.keys(criteria).length === 0) {
        return entries.map(e => ({ ...e }));
      }

      return entries
        .filter(entry =>
          Object.entries(criteria).every(([k, v]) => entry[k] === v),
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
        if (Object.entries(criteria).every(([k, v]) => entry[k] === v)) {
          rel.delete(key);
          count++;
        }
      }
      return count;
    },
  };
}
