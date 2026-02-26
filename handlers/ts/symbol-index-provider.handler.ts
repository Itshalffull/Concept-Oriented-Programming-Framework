// ============================================================
// SymbolIndexProvider Handler
//
// Search index provider optimised for symbol lookup. Indexes symbol
// strings, kinds, and namespaces for fast symbol resolution and
// fuzzy symbol search. Registers as a SearchIndex provider.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `symbol-index-provider-${++idCounter}`;
}

const PROVIDER_REF = 'search:symbol-index';

// ---------------------------------------------------------------------------
// Storage relations
// ---------------------------------------------------------------------------

const INSTANCE_RELATION = 'symbol-index-provider';
/** Inverted index entries: one record per (indexKey, symbolId) pair. */
const INDEX_RELATION = 'symbol-index-provider-idx';
/** Symbol metadata records keyed by symbolId. */
const SYMBOL_RELATION = 'symbol-index-provider-sym';

// ---------------------------------------------------------------------------
// Utility: generate index keys from a symbol record
// ---------------------------------------------------------------------------

/**
 * Produce the set of inverted-index keys for a symbol.
 * Includes the exact name, lowercase name, kind, and namespace segments.
 */
function indexKeysFor(name: string, kind: string, namespace: string): string[] {
  const keys: string[] = [];
  const lowerName = name.toLowerCase();
  keys.push(`name:${lowerName}`);
  if (kind) {
    keys.push(`kind:${kind.toLowerCase()}`);
  }
  if (namespace) {
    keys.push(`ns:${namespace.toLowerCase()}`);
    // Also index each segment of the namespace for partial match
    const parts = namespace.split('/').filter(Boolean);
    for (const part of parts) {
      keys.push(`nsseg:${part.toLowerCase()}`);
    }
  }
  return keys;
}

/**
 * Simple fuzzy match: returns true when every character of `query`
 * appears in `target` in order (case-insensitive).
 */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export const symbolIndexProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.find(INSTANCE_RELATION, { providerRef: PROVIDER_REF });
    if (existing.length > 0) {
      return { variant: 'ok', instance: existing[0].id as string };
    }

    const id = nextId();
    await storage.put(INSTANCE_RELATION, id, {
      id,
      providerRef: PROVIDER_REF,
    });

    return { variant: 'ok', instance: id };
  },

  /**
   * Add a symbol to the index. Stores the symbol metadata and creates
   * inverted index entries for name, kind, and namespace.
   */
  async index(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbolId = input.symbolId as string;
    const name = input.name as string;
    const kind = input.kind as string;
    const namespace = (input.namespace as string) || '';

    // Store symbol metadata
    await storage.put(SYMBOL_RELATION, symbolId, {
      id: symbolId,
      name,
      kind,
      namespace,
    });

    // Create inverted index entries
    const keys = indexKeysFor(name, kind, namespace);
    for (const key of keys) {
      const entryId = `${key}::${symbolId}`;
      await storage.put(INDEX_RELATION, entryId, {
        id: entryId,
        indexKey: key,
        symbolId,
      });
    }

    return { variant: 'ok', symbolId };
  },

  /**
   * Search by exact kind. Returns all symbols with the given kind.
   */
  async searchByKind(input: Record<string, unknown>, storage: ConceptStorage) {
    const kind = input.kind as string;

    const indexKey = `kind:${kind.toLowerCase()}`;
    const entries = await storage.find(INDEX_RELATION, { indexKey });

    const results: Array<{ symbolId: string; name: string; kind: string; namespace: string }> = [];
    for (const entry of entries) {
      const sym = await storage.get(SYMBOL_RELATION, entry.symbolId as string);
      if (sym) {
        results.push({
          symbolId: sym.id as string,
          name: sym.name as string,
          kind: sym.kind as string,
          namespace: sym.namespace as string,
        });
      }
    }

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  /**
   * Search by exact name (case-insensitive).
   */
  async searchByName(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    const indexKey = `name:${name.toLowerCase()}`;
    const entries = await storage.find(INDEX_RELATION, { indexKey });

    const results: Array<{ symbolId: string; name: string; kind: string; namespace: string }> = [];
    for (const entry of entries) {
      const sym = await storage.get(SYMBOL_RELATION, entry.symbolId as string);
      if (sym) {
        results.push({
          symbolId: sym.id as string,
          name: sym.name as string,
          kind: sym.kind as string,
          namespace: sym.namespace as string,
        });
      }
    }

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  /**
   * Fuzzy symbol search. Scans all indexed symbols and returns those
   * whose name fuzzy-matches the query string.
   */
  async fuzzySearch(input: Record<string, unknown>, storage: ConceptStorage) {
    const query = input.query as string;
    const topK = (input.topK as number) || 10;

    const allSymbols = await storage.find(SYMBOL_RELATION);

    const matches: Array<{ symbolId: string; name: string; kind: string; namespace: string }> = [];
    for (const sym of allSymbols) {
      if (fuzzyMatch(query, sym.name as string)) {
        matches.push({
          symbolId: sym.id as string,
          name: sym.name as string,
          kind: sym.kind as string,
          namespace: sym.namespace as string,
        });
      }
      if (matches.length >= topK) break;
    }

    return { variant: 'ok', results: JSON.stringify(matches) };
  },

  /**
   * Remove a symbol from the index, deleting both the metadata record
   * and all its inverted index entries.
   */
  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const symbolId = input.symbolId as string;

    const sym = await storage.get(SYMBOL_RELATION, symbolId);
    if (!sym) {
      return { variant: 'ok', symbolId };
    }

    // Remove inverted index entries
    const keys = indexKeysFor(sym.name as string, sym.kind as string, sym.namespace as string);
    for (const key of keys) {
      const entryId = `${key}::${symbolId}`;
      await storage.del(INDEX_RELATION, entryId);
    }

    // Remove symbol metadata
    await storage.del(SYMBOL_RELATION, symbolId);

    return { variant: 'ok', symbolId };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSymbolIndexProviderCounter(): void {
  idCounter = 0;
}
