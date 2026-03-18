// @migrated dsl-constructs 2026-03-18
// ============================================================
// Symbol Handler
//
// Globally unique, cross-file identifier for any named entity in
// the project. Provides hierarchical symbol strings (e.g.
// "clef/concept/Article", "ts/function/src/handlers/article.ts/createArticle")
// that unify identity across languages, file formats, and project layers.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, complete, completeFrom,
  branch, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `symbol-${++idCounter}`;
}

/**
 * Derive the namespace from a symbol string by stripping the last segment.
 * E.g. "clef/concept/Article" -> "clef/concept"
 */
function deriveNamespace(symbolString: string): string {
  const parts = symbolString.split('/');
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const symbolString = input.symbolString as string;
    const kind = input.kind as string;
    const displayName = input.displayName as string;
    const definingFile = input.definingFile as string;

    let p = createProgram();
    p = find(p, 'symbol', { symbolString }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'alreadyExists', (b) => ({
          existing: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        const id = nextId();
        const namespace = deriveNamespace(symbolString);
        let e = createProgram();
        e = put(e, 'symbol', id, {
          id,
          symbolString,
          kind,
          displayName,
          definingFile,
          namespace,
          visibility: 'public',
          deprecated: '',
          documentation: '',
        });
        return complete(e, 'ok', { symbol: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const symbolString = input.symbolString as string;

    let p = createProgram();
    p = find(p, 'symbol', { symbolString }, 'results');

    return completeFrom(p, 'ok', (b) => {
      const results = b.results as Record<string, unknown>[];
      if (results.length === 0) {
        return { variant: 'notfound' };
      }
      if (results.length > 1) {
        const candidates = results.map((r) => r.symbolString as string);
        return { variant: 'ambiguous', candidates: JSON.stringify(candidates) };
      }
      return { symbol: results[0].id as string };
    }) as StorageProgram<Result>;
  },

  findByKind(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const namespace = input.namespace as string;

    const criteria: Record<string, unknown> = {};
    if (kind !== undefined && kind !== '') criteria.kind = kind;
    if (namespace !== undefined && namespace !== '') criteria.namespace = namespace;

    let p = createProgram();
    p = find(p, 'symbol', Object.keys(criteria).length > 0 ? criteria : {}, 'results');

    return completeFrom(p, 'ok', (b) => {
      const results = b.results as Record<string, unknown>[];
      const symbols = results.map((r) => ({
        id: r.id,
        symbolString: r.symbolString,
        kind: r.kind,
        displayName: r.displayName,
        definingFile: r.definingFile,
        namespace: r.namespace,
      }));
      return { symbols: JSON.stringify(symbols) };
    }) as StorageProgram<Result>;
  },

  findByFile(input: Record<string, unknown>) {
    const file = input.file as string;

    const criteria: Record<string, unknown> = {};
    if (file !== undefined && file !== '') criteria.definingFile = file;

    let p = createProgram();
    p = find(p, 'symbol', Object.keys(criteria).length > 0 ? criteria : {}, 'results');

    return completeFrom(p, 'ok', (b) => {
      const results = b.results as Record<string, unknown>[];
      const symbols = results.map((r) => ({
        id: r.id,
        symbolString: r.symbolString,
        kind: r.kind,
        displayName: r.displayName,
        definingFile: r.definingFile,
        namespace: r.namespace,
      }));
      return { symbols: JSON.stringify(symbols) };
    }) as StorageProgram<Result>;
  },

  rename(input: Record<string, unknown>) {
    const symbol = input.symbol as string;
    const newName = input.newName as string;

    let p = createProgram();
    p = get(p, 'symbol', symbol, 'record');

    return branch(p,
      (b) => !b.record,
      (() => {
        const t = createProgram();
        return complete(t, 'notfound', {}) as StorageProgram<Result>;
      })(),
      (() => {
        let e = createProgram();
        e = mapBindings(e, (b) => {
          const record = b.record as Record<string, unknown>;
          const oldSymbolString = record.symbolString as string;
          const parts = oldSymbolString.split('/');
          parts[parts.length - 1] = newName;
          return parts.join('/');
        }, 'newSymbolString');

        e = find(e, 'symbol', {}, 'allSymbols');
        e = find(e, 'symbol-occurrence', {}, 'allOccurrences');

        return completeFrom(e, 'ok', (b) => {
          const record = b.record as Record<string, unknown>;
          const newSymbolString = b.newSymbolString as string;
          const allSymbols = b.allSymbols as Record<string, unknown>[];
          const oldName = record.displayName as string;
          const oldSymbolString = record.symbolString as string;

          const conflicts = allSymbols.filter(s => s.symbolString === newSymbolString && s.id !== symbol);
          if (conflicts.length > 0) {
            return { variant: 'conflict', conflicting: conflicts[0].id as string };
          }

          const allOccurrences = b.allOccurrences as Record<string, unknown>[];
          const matchingOccurrences = allOccurrences.filter(o => o.symbol === oldSymbolString);

          return { oldName, occurrencesUpdated: matchingOccurrences.length };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const symbol = input.symbol as string;

    let p = createProgram();
    p = get(p, 'symbol', symbol, 'record');

    return branch(p,
      (b) => !b.record,
      (() => {
        const t = createProgram();
        return complete(t, 'notfound', {}) as StorageProgram<Result>;
      })(),
      (() => {
        const e = createProgram();
        return completeFrom(e, 'ok', (b) => {
          const record = b.record as Record<string, unknown>;
          return {
            symbol: record.id as string,
            symbolString: record.symbolString as string,
            kind: record.kind as string,
            displayName: record.displayName as string,
            visibility: (record.visibility as string) || 'public',
            definingFile: record.definingFile as string,
            namespace: (record.namespace as string) || '',
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const symbolHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSymbolCounter(): void {
  idCounter = 0;
}
