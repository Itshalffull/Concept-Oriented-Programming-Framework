// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Symbol Handler
//
// Globally unique, cross-file identifier for any named entity in
// the project. Provides hierarchical symbol strings (e.g.
// "clef/concept/Article", "ts/function/src/handlers/article.ts/createArticle")
// that unify identity across languages, file formats, and project layers.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `symbol-${++idCounter}`;
}

/**
 * Derive the namespace from a symbol string by stripping the last segment.
 */
function deriveNamespace(symbolString: string): string {
  const parts = symbolString.split('/');
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

export const symbolHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const symbolString = input.symbolString as string;
    const kind = input.kind as string;
    const displayName = input.displayName as string;
    const definingFile = input.definingFile as string;

    const existing = await storage.find('symbol', { symbolString });
    if (existing.length > 0) {
      return { variant: 'ok', symbol: existing[0].id as string };
    }

    const id = nextId();
    const namespace = deriveNamespace(symbolString);
    await storage.put('symbol', id, {
      id, symbolString, kind, displayName, definingFile,
      namespace, visibility: 'public', deprecated: '', documentation: '',
    });
    return { variant: 'ok', symbol: id };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const symbolString = input.symbolString as string;
    const results = await storage.find('symbol', { symbolString });
    if (results.length === 0) return { variant: 'notfound' };
    if (results.length > 1) {
      const candidates = results.map(r => r.symbolString as string);
      return { variant: 'ambiguous', candidates: JSON.stringify(candidates) };
    }
    return { variant: 'ok', symbol: results[0].id as string };
  },

  async findByKind(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const kind = input.kind as string;
    const namespace = input.namespace as string;

    const criteria: Record<string, unknown> = {};
    if (kind !== undefined && kind !== '') criteria.kind = kind;
    if (namespace !== undefined && namespace !== '') criteria.namespace = namespace;

    const results = await storage.find('symbol', Object.keys(criteria).length > 0 ? criteria : {});
    const symbols = results.map(r => ({
      id: r.id, symbolString: r.symbolString, kind: r.kind,
      displayName: r.displayName, definingFile: r.definingFile, namespace: r.namespace,
    }));
    return { variant: 'ok', symbols: JSON.stringify(symbols) };
  },

  async findByFile(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const file = input.file as string;
    const criteria: Record<string, unknown> = {};
    if (file !== undefined && file !== '') criteria.definingFile = file;

    const results = await storage.find('symbol', Object.keys(criteria).length > 0 ? criteria : {});
    const symbols = results.map(r => ({
      id: r.id, symbolString: r.symbolString, kind: r.kind,
      displayName: r.displayName, definingFile: r.definingFile, namespace: r.namespace,
    }));
    return { variant: 'ok', symbols: JSON.stringify(symbols) };
  },

  async rename(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const symbol = input.symbol as string;
    const newName = input.newName as string;

    const record = await storage.get('symbol', symbol);
    if (!record) return { variant: 'notfound' };

    const oldSymbolString = record.symbolString as string;
    const parts = oldSymbolString.split('/');
    parts[parts.length - 1] = newName;
    const newSymbolString = parts.join('/');

    // Check for conflicts
    const allSymbols = await storage.find('symbol', { symbolString: newSymbolString });
    const conflicts = allSymbols.filter(s => s.id !== symbol);
    if (conflicts.length > 0) {
      return { variant: 'conflict', conflicting: conflicts[0].id as string };
    }

    const oldName = record.displayName as string;

    // Write back updated symbol
    await storage.put('symbol', symbol, {
      ...record,
      displayName: newName,
      symbolString: newSymbolString,
      namespace: deriveNamespace(newSymbolString),
    });

    // Update occurrences
    const allOccurrences = await storage.find('symbol-occurrence', {});
    const matchingOccurrences = allOccurrences.filter(o => o.symbol === oldSymbolString);
    for (const occ of matchingOccurrences) {
      await storage.put('symbol-occurrence', occ.id as string, {
        ...occ,
        symbol: newSymbolString,
      });
    }

    return { variant: 'ok', oldName, occurrencesUpdated: matchingOccurrences.length };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const symbol = input.symbol as string;
    const record = await storage.get('symbol', symbol);
    if (!record) return { variant: 'notfound' };
    return {
      variant: 'ok',
      symbol: record.id as string,
      symbolString: record.symbolString as string,
      kind: record.kind as string,
      displayName: record.displayName as string,
      visibility: (record.visibility as string) || 'public',
      definingFile: record.definingFile as string,
      namespace: (record.namespace as string) || '',
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSymbolCounter(): void {
  idCounter = 0;
}
