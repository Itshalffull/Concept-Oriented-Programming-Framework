// @migrated dsl-constructs 2026-03-18
// ============================================================
// SymbolRelationship Handler
//
// Typed semantic relationships between Symbols beyond simple
// reference -- implements, extends, overrides, generates,
// configures, tests, documents. Extends the Linking Kit's
// Reference/Relation vocabulary with program-analysis-specific
// edge types.
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
  return `symbol-relationship-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  add(input: Record<string, unknown>) {
    const source = input.source as string;
    const target = input.target as string;
    const kind = input.kind as string;

    let p = createProgram();
    p = find(p, 'symbol-relationship', { source }, 'existing');

    return branch(p,
      (b) => {
        const existing = b.existing as Record<string, unknown>[];
        return existing.some(r => r.target === target && r.kind === kind);
      },
      (() => {
        const t = createProgram();
        return completeFrom(t, 'alreadyExists', (b) => {
          const existing = b.existing as Record<string, unknown>[];
          const duplicate = existing.find(r => r.target === target && r.kind === kind);
          return { existing: duplicate!.id as string };
        });
      })(),
      (() => {
        const id = nextId();
        let e = createProgram();
        e = put(e, 'symbol-relationship', id, {
          id,
          source,
          target,
          kind,
          metadata: '',
        });
        return complete(e, 'ok', { relationship: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  findFrom(input: Record<string, unknown>) {
    const source = input.source as string;
    const kind = input.kind as string;

    const criteria: Record<string, unknown> = { source };
    if (kind !== undefined && kind !== '') criteria.kind = kind;

    let p = createProgram();
    p = find(p, 'symbol-relationship', criteria, 'results');

    return completeFrom(p, 'ok', (b) => {
      const results = b.results as Record<string, unknown>[];
      const relationships = results.map((r) => ({
        id: r.id,
        source: r.source,
        target: r.target,
        kind: r.kind,
        metadata: r.metadata,
      }));
      return { relationships: JSON.stringify(relationships) };
    }) as StorageProgram<Result>;
  },

  findTo(input: Record<string, unknown>) {
    const target = input.target as string;
    const kind = input.kind as string;

    const criteria: Record<string, unknown> = { target };
    if (kind !== undefined && kind !== '') criteria.kind = kind;

    let p = createProgram();
    p = find(p, 'symbol-relationship', criteria, 'results');

    return completeFrom(p, 'ok', (b) => {
      const results = b.results as Record<string, unknown>[];
      const relationships = results.map((r) => ({
        id: r.id,
        source: r.source,
        target: r.target,
        kind: r.kind,
        metadata: r.metadata,
      }));
      return { relationships: JSON.stringify(relationships) };
    }) as StorageProgram<Result>;
  },

  transitiveClosure(input: Record<string, unknown>) {
    const start = input.start as string;
    const kind = input.kind as string;
    const direction = input.direction as string;

    // Transitive closure requires iterative storage queries which can't be
    // expressed as a static program. We fetch all relationships and compute
    // the closure in a mapBindings/completeFrom.
    let p = createProgram();
    const criteria: Record<string, unknown> = {};
    if (kind !== undefined && kind !== '') criteria.kind = kind;
    p = find(p, 'symbol-relationship', criteria, 'allRels');

    return completeFrom(p, 'ok', (b) => {
      const allRels = b.allRels as Record<string, unknown>[];

      const visited = new Set<string>();
      const paths: string[][] = [];
      const queue: { symbol: string; path: string[] }[] = [
        { symbol: start, path: [start] },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.symbol)) continue;
        visited.add(current.symbol);

        let results: Record<string, unknown>[];
        if (direction === 'backward') {
          results = allRels.filter(r => r.target === current.symbol);
        } else {
          results = allRels.filter(r => r.source === current.symbol);
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

      visited.delete(start);
      const reachable = Array.from(visited);

      return {
        symbols: JSON.stringify(reachable),
        paths: JSON.stringify(paths),
      };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const relationship = input.relationship as string;

    let p = createProgram();
    p = get(p, 'symbol-relationship', relationship, 'record');

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
            relationship: record.id as string,
            source: record.source as string,
            target: record.target as string,
            kind: record.kind as string,
            metadata: (record.metadata as string) || '',
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const symbolRelationshipHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSymbolRelationshipCounter(): void {
  idCounter = 0;
}
