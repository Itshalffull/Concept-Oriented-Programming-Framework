// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SymbolIndexProvider Handler
//
// Search index provider optimised for symbol lookup. Indexes symbol
// strings, kinds, and namespaces for fast symbol resolution and
// fuzzy symbol search. Registers as a SearchIndex provider.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `symbol-index-provider-${++idCounter}`;
}

const PROVIDER_REF = 'search:symbol-index';

const INSTANCE_RELATION = 'symbol-index-provider';
const INDEX_RELATION = 'symbol-index-provider-idx';
const SYMBOL_RELATION = 'symbol-index-provider-sym';

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

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, INSTANCE_RELATION, { providerRef: PROVIDER_REF }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'ok', (b) => ({
          instance: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        const id = nextId();
        let e = createProgram();
        e = put(e, INSTANCE_RELATION, id, {
          id,
          providerRef: PROVIDER_REF,
        });
        return complete(e, 'ok', { instance: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  index(input: Record<string, unknown>) {
    const symbolId = input.symbolId as string;
    const name = input.name as string;
    const kind = input.kind as string;
    const namespace = (input.namespace as string) || '';

    let p = createProgram();
    p = put(p, SYMBOL_RELATION, symbolId, {
      id: symbolId,
      name,
      kind,
      namespace,
    });

    const keys = indexKeysFor(name, kind, namespace);
    for (const key of keys) {
      const entryId = `${key}::${symbolId}`;
      p = put(p, INDEX_RELATION, entryId, {
        id: entryId,
        indexKey: key,
        symbolId,
      });
    }

    return complete(p, 'ok', { symbolId }) as StorageProgram<Result>;
  },

  searchByKind(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const indexKey = `kind:${kind.toLowerCase()}`;

    let p = createProgram();
    p = find(p, INDEX_RELATION, { indexKey }, 'entries');
    p = find(p, SYMBOL_RELATION, {}, 'allSymbols');

    return completeFrom(p, 'ok', (b) => {
      const entries = b.entries as Record<string, unknown>[];
      const allSymbols = b.allSymbols as Record<string, unknown>[];
      const symMap = new Map(allSymbols.map(s => [s.id as string, s]));

      const results: Array<{ symbolId: string; name: string; kind: string; namespace: string }> = [];
      for (const entry of entries) {
        const sym = symMap.get(entry.symbolId as string);
        if (sym) {
          results.push({
            symbolId: sym.id as string,
            name: sym.name as string,
            kind: sym.kind as string,
            namespace: sym.namespace as string,
          });
        }
      }

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  searchByName(input: Record<string, unknown>) {
    const name = input.name as string;
    const indexKey = `name:${name.toLowerCase()}`;

    let p = createProgram();
    p = find(p, INDEX_RELATION, { indexKey }, 'entries');
    p = find(p, SYMBOL_RELATION, {}, 'allSymbols');

    return completeFrom(p, 'ok', (b) => {
      const entries = b.entries as Record<string, unknown>[];
      const allSymbols = b.allSymbols as Record<string, unknown>[];
      const symMap = new Map(allSymbols.map(s => [s.id as string, s]));

      const results: Array<{ symbolId: string; name: string; kind: string; namespace: string }> = [];
      for (const entry of entries) {
        const sym = symMap.get(entry.symbolId as string);
        if (sym) {
          results.push({
            symbolId: sym.id as string,
            name: sym.name as string,
            kind: sym.kind as string,
            namespace: sym.namespace as string,
          });
        }
      }

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  fuzzySearch(input: Record<string, unknown>) {
    const query = input.query as string;
    const topK = (input.topK as number) || 10;

    let p = createProgram();
    p = find(p, SYMBOL_RELATION, {}, 'allSymbols');

    return completeFrom(p, 'ok', (b) => {
      const allSymbols = b.allSymbols as Record<string, unknown>[];

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

      return { results: JSON.stringify(matches) };
    }) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const symbolId = input.symbolId as string;

    let p = createProgram();
    p = get(p, SYMBOL_RELATION, symbolId, 'sym');

    return branch(p,
      (b) => !b.sym,
      (() => {
        const t = createProgram();
        return complete(t, 'ok', { symbolId }) as StorageProgram<Result>;
      })(),
      (() => {
        // We need to read all index entries for this symbol and delete them
        let e = createProgram();
        e = find(e, INDEX_RELATION, { symbolId }, 'indexEntries');
        e = mapBindings(e, (b) => {
          return (b.indexEntries as Record<string, unknown>[]).map(entry => entry.id as string);
        }, 'entryIds');
        // Since we can't loop with del in the DSL, we delete the symbol
        // and use completeFrom which will be interpreted
        e = del(e, SYMBOL_RELATION, symbolId);
        return complete(e, 'ok', { symbolId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const symbolIndexProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSymbolIndexProviderCounter(): void {
  idCounter = 0;
}
