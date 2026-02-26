// ============================================================
// SymbolRelationship Handler
//
// Typed semantic relationships between Symbols beyond simple
// reference -- implements, extends, overrides, generates,
// configures, tests, documents. Extends the Linking Kit's
// Reference/Relation vocabulary with program-analysis-specific
// edge types.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `symbol-relationship-${++idCounter}`;
}

export const symbolRelationshipHandler: ConceptHandler = {
  async add(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const target = input.target as string;
    const kind = input.kind as string;

    // Check for duplicate relationship (same source, target, kind)
    const existing = await storage.find('symbol-relationship', { source });
    const duplicate = existing.find(
      (r) => r.target === target && r.kind === kind,
    );
    if (duplicate) {
      return { variant: 'alreadyExists', existing: duplicate.id as string };
    }

    const id = nextId();
    await storage.put('symbol-relationship', id, {
      id,
      source,
      target,
      kind,
      metadata: '',
    });

    return { variant: 'ok', relationship: id };
  },

  async findFrom(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const kind = input.kind as string;

    const criteria: Record<string, unknown> = { source };
    if (kind !== undefined && kind !== '') criteria.kind = kind;

    const results = await storage.find('symbol-relationship', criteria);

    const relationships = results.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      kind: r.kind,
      metadata: r.metadata,
    }));

    return { variant: 'ok', relationships: JSON.stringify(relationships) };
  },

  async findTo(input: Record<string, unknown>, storage: ConceptStorage) {
    const target = input.target as string;
    const kind = input.kind as string;

    const criteria: Record<string, unknown> = { target };
    if (kind !== undefined && kind !== '') criteria.kind = kind;

    const results = await storage.find('symbol-relationship', criteria);

    const relationships = results.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      kind: r.kind,
      metadata: r.metadata,
    }));

    return { variant: 'ok', relationships: JSON.stringify(relationships) };
  },

  async transitiveClosure(input: Record<string, unknown>, storage: ConceptStorage) {
    const start = input.start as string;
    const kind = input.kind as string;
    const direction = input.direction as string;

    const visited = new Set<string>();
    const paths: string[][] = [];
    const queue: { symbol: string; path: string[] }[] = [
      { symbol: start, path: [start] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.symbol)) continue;
      visited.add(current.symbol);

      const criteria: Record<string, unknown> = {};
      if (kind !== undefined && kind !== '') criteria.kind = kind;

      let results: Record<string, unknown>[];
      if (direction === 'backward') {
        criteria.target = current.symbol;
        results = await storage.find('symbol-relationship', criteria);
      } else {
        criteria.source = current.symbol;
        results = await storage.find('symbol-relationship', criteria);
      }

      for (const rel of results) {
        const nextSymbol = direction === 'backward'
          ? (rel.source as string)
          : (rel.target as string);
        if (!visited.has(nextSymbol)) {
          const newPath = [...current.path, nextSymbol];
          paths.push(newPath);
          queue.push({ symbol: nextSymbol, path: newPath });
        }
      }
    }

    // Remove the start symbol from visited set for the output
    visited.delete(start);
    const reachable = Array.from(visited);

    return {
      variant: 'ok',
      symbols: JSON.stringify(reachable),
      paths: JSON.stringify(paths),
    };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const relationship = input.relationship as string;

    const record = await storage.get('symbol-relationship', relationship);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      relationship: record.id as string,
      source: record.source as string,
      target: record.target as string,
      kind: record.kind as string,
      metadata: (record.metadata as string) || '',
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSymbolRelationshipCounter(): void {
  idCounter = 0;
}
