// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// KindSystem Concept Implementation
//
// Defines the taxonomy of intermediate representations and
// artifacts in generation pipelines. Tracks which IR kinds
// can transform into which others. Enables pipeline validation,
// execution ordering, and cascading invalidation.
// See clef-generation-suite.md Part 1.2
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const KINDS_RELATION = 'kinds';
const EDGES_RELATION = 'edges';

/** Edge key convention: "from:to" */
function edgeKey(from: string, to: string): string {
  return `${from}:${to}`;
}

const _handler: FunctionalConceptHandler = {
  /**
   * Register a new kind in the taxonomy. Idempotent — returns
   * 'exists' if the kind is already defined.
   */
  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const category = input.category as string;

    let p = createProgram();
    p = get(p, KINDS_RELATION, name, 'existing');

    p = branch(p, 'existing',
      (b) => completeFrom(b, 'exists', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return { kind: existing.id as string };
      }),
      (b) => {
        const kindId = randomUUID();
        const b2 = put(b, KINDS_RELATION, name, {
          id: kindId,
          name,
          category,
        });
        return complete(b2, 'ok', { kind: kindId });
      },
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Declare a transform edge between two kinds.
   * Validates both kinds exist. Performs cycle detection via DFS
   * over pre-fetched edges in a mapBindings computation.
   */
  connect(input: Record<string, unknown>) {
    const from = input.from as string;
    const to = input.to as string;
    const relation = input.relation as string;
    const transformName = input.transformName as string | undefined;

    // Self-loop check
    if (from === to) {
      const p = createProgram();
      return complete(p, 'invalid', { message: `Self-loop: '${from}' cannot connect to itself` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, KINDS_RELATION, from, 'fromKind');
    p = get(p, KINDS_RELATION, to, 'toKind');

    // Also try finding by ID if not found by name
    p = find(p, KINDS_RELATION, { id: from }, 'fromById');
    p = find(p, KINDS_RELATION, { id: to }, 'toById');

    // Pre-fetch all edges for cycle detection
    p = find(p, EDGES_RELATION, {}, 'allEdges');

    p = branch(p,
      (bindings) => {
        const fromKind = bindings.fromKind as Record<string, unknown> | null;
        const fromById = bindings.fromById as Array<Record<string, unknown>>;
        return !fromKind && fromById.length === 0;
      },
      (b) => complete(b, 'invalid', { message: `Kind '${from}' does not exist` }),
      (b) => {
        return branch(b,
          (bindings) => {
            const toKind = bindings.toKind as Record<string, unknown> | null;
            const toById = bindings.toById as Array<Record<string, unknown>>;
            return !toKind && toById.length === 0;
          },
          (b2) => complete(b2, 'invalid', { message: `Kind '${to}' does not exist` }),
          (b2) => {
            // Resolve names and check for cycles in a single mapBindings
            let b3 = mapBindings(b2, (bindings) => {
              const fromKind = bindings.fromKind as Record<string, unknown> | null;
              const fromById = bindings.fromById as Array<Record<string, unknown>>;
              const toKind = bindings.toKind as Record<string, unknown> | null;
              const toById = bindings.toById as Array<Record<string, unknown>>;
              const allEdges = bindings.allEdges as Array<Record<string, unknown>>;

              const fromName = fromKind ? (fromKind.name as string) : (fromById[0].name as string);
              const toName = toKind ? (toKind.name as string) : (toById[0].name as string);

              // Cycle detection: check if adding from->to would create a cycle
              // A cycle exists if there's already a path from toName to fromName
              const visited = new Set<string>();
              const stack = [toName];
              let hasCycle = false;
              while (stack.length > 0) {
                const current = stack.pop()!;
                if (current === fromName) {
                  hasCycle = true;
                  break;
                }
                if (visited.has(current)) continue;
                visited.add(current);
                for (const edge of allEdges) {
                  if ((edge.fromName as string) === current) {
                    stack.push(edge.toName as string);
                  }
                }
              }

              return { fromName, toName, hasCycle };
            }, '_connectInfo');

            return branch(b3,
              (bindings) => {
                const info = bindings._connectInfo as Record<string, unknown>;
                return info.hasCycle as boolean;
              },
              (t) => completeFrom(t, 'invalid', (bindings) => {
                const info = bindings._connectInfo as Record<string, unknown>;
                return { message: `Adding edge ${info.fromName}->${info.toName} would create a cycle` };
              }),
              (e) => {
                // Store edge
                let e2 = putFrom(e, EDGES_RELATION, edgeKey(from, to), (bindings) => {
                  const info = bindings._connectInfo as Record<string, unknown>;
                  return {
                    fromName: info.fromName as string,
                    toName: info.toName as string,
                    relation,
                    transformName: transformName || null,
                  };
                });
                return complete(e2, 'ok', {});
              },
            );
          },
        );
      },
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Compute shortest valid transform chain between two kinds.
   */
  route(input: Record<string, unknown>) {
    const from = input.from as string;
    const to = input.to as string;

    let p = createProgram();
    p = get(p, KINDS_RELATION, from, 'fromKind');
    p = get(p, KINDS_RELATION, to, 'toKind');
    p = find(p, EDGES_RELATION, {}, 'allEdges');

    p = mapBindings(p, (bindings) => {
      const fromKind = bindings.fromKind as Record<string, unknown> | null;
      const toKind = bindings.toKind as Record<string, unknown> | null;
      const allEdges = bindings.allEdges as Array<Record<string, unknown>>;

      const fromName = fromKind ? (fromKind.name as string) : from;
      const toName = toKind ? (toKind.name as string) : to;

      // BFS in pure computation over pre-fetched edges
      if (fromName === toName) return { found: true, path: [] };

      const visited = new Set<string>();
      const queue: Array<{
        kind: string;
        path: Array<{ kind: string; relation: string; transform: string | null }>;
      }> = [{ kind: fromName, path: [] }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.kind)) continue;
        visited.add(current.kind);

        const edges = allEdges.filter(e => (e.fromName as string) === current.kind);
        for (const edge of edges) {
          const edgeTo = edge.toName as string;
          const newPath = [
            ...current.path,
            {
              kind: edgeTo,
              relation: edge.relation as string,
              transform: (edge.transformName as string) || null,
            },
          ];

          if (edgeTo === toName) return { found: true, path: newPath };
          if (!visited.has(edgeTo)) {
            queue.push({ kind: edgeTo, path: newPath });
          }
        }
      }

      return { found: false, path: [], message: `No valid path from ${fromName} to ${toName}` };
    }, '_routeResult');

    return branch(p,
      (b) => (b._routeResult as { found: boolean }).found,
      (thenP) => completeFrom(thenP, 'ok', (b) => ({ path: (b._routeResult as any).path })),
      (elseP) => completeFrom(elseP, 'ok', (b) => ({ message: (b._routeResult as any).message })),
    ) as StorageProgram<Result>;
  },

  /**
   * Confirm that a direct edge exists between two kinds.
   */
  validate(input: Record<string, unknown>) {
    const from = input.from as string;
    const to = input.to as string;

    let p = createProgram();
    p = get(p, KINDS_RELATION, from, 'fromKind');
    p = get(p, KINDS_RELATION, to, 'toKind');
    p = find(p, KINDS_RELATION, { id: from }, 'fromById');
    p = find(p, KINDS_RELATION, { id: to }, 'toById');
    p = find(p, EDGES_RELATION, {}, 'allEdges');

    p = mapBindings(p, (bindings) => {
      const fromKind = bindings.fromKind as Record<string, unknown> | null;
      const toKind = bindings.toKind as Record<string, unknown> | null;
      const fromById = bindings.fromById as Array<Record<string, unknown>>;
      const toById = bindings.toById as Array<Record<string, unknown>>;
      const fromRecord = fromKind || (fromById.length > 0 ? fromById[0] : null);
      const toRecord = toKind || (toById.length > 0 ? toById[0] : null);
      if (!fromRecord || !toRecord) {
        return { valid: false, missing: true, fName: from, tName: to, suggestions: [] };
      }
      const fName = fromRecord.name as string;
      const tName = toRecord.name as string;
      const allEdges = bindings.allEdges as Array<Record<string, unknown>>;
      const directEdge = allEdges.find(e =>
        (e.fromName as string) === fName && (e.toName as string) === tName
      );
      if (directEdge) return { valid: true, missing: false, fName, tName, suggestions: [] };
      const suggestions = allEdges
        .filter(e => (e.fromName as string) === fName)
        .map(e => e.toName as string);
      return { valid: false, missing: false, fName, tName, suggestions };
    }, '_validateResult');

    return branch(p,
      (bindings) => (bindings._validateResult as { valid: boolean }).valid,
      (thenP) => complete(thenP, 'ok', {}),
      (elseP) => completeFrom(elseP, 'invalid', (bindings) => {
        const r = bindings._validateResult as { missing: boolean; fName: string; tName: string; suggestions: string[] };
        if (r.missing) return { message: `One or both kinds not found: '${r.fName}', '${r.tName}'` };
        return { message: `No direct edge from ${r.fName} to ${r.tName}. Reachable from ${r.fName}: ${r.suggestions.join(', ') || 'none'}` };
      }),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Return all kinds transitively reachable from this kind.
   */
  dependents(input: Record<string, unknown>) {
    const kind = input.kind as string;

    let p = createProgram();
    p = get(p, KINDS_RELATION, kind, 'kindRecord');
    p = find(p, EDGES_RELATION, {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const kindRecord = bindings.kindRecord as Record<string, unknown> | null;
      const allEdges = bindings.allEdges as Array<Record<string, unknown>>;
      const kindName = kindRecord ? (kindRecord.name as string) : kind;

      // DFS over pre-fetched edges
      const visited = new Set<string>();
      const stack = [kindName];
      const result: string[] = [];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const edges = allEdges.filter(e => (e.fromName as string) === current);
        for (const edge of edges) {
          const toName = edge.toName as string;
          if (!visited.has(toName)) {
            result.push(toName);
            stack.push(toName);
          }
        }
      }

      return { downstream: result };
    }) as StorageProgram<Result>;
  },

  /**
   * What transforms can produce this kind?
   */
  producers(input: Record<string, unknown>) {
    const kind = input.kind as string;

    let p = createProgram();
    p = get(p, KINDS_RELATION, kind, 'kindRecord');
    p = find(p, EDGES_RELATION, {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const kindRecord = bindings.kindRecord as Record<string, unknown> | null;
      const allEdges = bindings.allEdges as Array<Record<string, unknown>>;
      const kindName = kindRecord ? (kindRecord.name as string) : kind;

      const transforms = allEdges
        .filter(e => (e.toName as string) === kindName)
        .map(e => ({
          fromKind: e.fromName as string,
          transformName: (e.transformName as string) || null,
        }));

      return { transforms };
    }) as StorageProgram<Result>;
  },

  /**
   * What transforms consume this kind?
   */
  consumers(input: Record<string, unknown>) {
    const kind = input.kind as string;

    let p = createProgram();
    p = get(p, KINDS_RELATION, kind, 'kindRecord');
    p = find(p, EDGES_RELATION, {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const kindRecord = bindings.kindRecord as Record<string, unknown> | null;
      const allEdges = bindings.allEdges as Array<Record<string, unknown>>;
      const kindName = kindRecord ? (kindRecord.name as string) : kind;

      const transforms = allEdges
        .filter(e => (e.fromName as string) === kindName)
        .map(e => ({
          toKind: e.toName as string,
          transformName: (e.transformName as string) || null,
        }));

      return { transforms };
    }) as StorageProgram<Result>;
  },

  /**
   * Return the full topology graph.
   */
  graph(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, KINDS_RELATION, {}, 'allKinds');
    p = find(p, EDGES_RELATION, {}, 'allEdges');

    return completeFrom(p, 'ok', (bindings) => {
      const allKinds = bindings.allKinds as Array<Record<string, unknown>>;
      const allEdges = bindings.allEdges as Array<Record<string, unknown>>;

      const kinds = allKinds.map(k => ({
        name: k.name as string,
        category: k.category as string,
      }));

      const edges = allEdges.map(e => ({
        from: e.fromName as string,
        to: e.toName as string,
        relation: e.relation as string,
        transform: (e.transformName as string) || null,
      }));

      return { kinds, edges };
    }) as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const kindSystemHandler = autoInterpret(_handler);
