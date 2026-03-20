// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DerivedEntity Handler
//
// Queryable representation of a parsed .derived file — enables
// trace rollup by linking derivedContext tags to composition
// hierarchies, and queries like "what concepts compose this
// derived concept?" and "what syncs wire it together?"
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { DerivedAST } from '../../runtime/types.js';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `derived-entity-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;

    let p = createProgram();
    p = find(p, 'derived-entity', { name }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'alreadyRegistered', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>[];
        return { existing: existing[0].id as string };
      }),
      (elseP) => {
        const id = nextId();
        const symbol = `clef/derived/${name}`;

        let purposeText = '';
        let composesRefs = '[]';
        let requiredSyncs = '[]';
        let surfaceActions = '[]';
        let surfaceQueries = '[]';
        let principle = '';

        try {
          const parsed: DerivedAST = JSON.parse(ast);
          purposeText = parsed.purpose || '';
          composesRefs = JSON.stringify(parsed.composes || []);
          requiredSyncs = JSON.stringify(parsed.syncs?.required || []);
          surfaceActions = JSON.stringify(parsed.surface?.actions || []);
          surfaceQueries = JSON.stringify(parsed.surface?.queries || []);
          principle = parsed.principle ? JSON.stringify(parsed.principle) : '';
        } catch {
          // AST may be empty or non-JSON; store defaults
        }

        elseP = put(elseP, 'derived-entity', id, {
          id,
          name,
          symbol,
          sourceFile: source,
          ast,
          purposeText,
          composesRefs,
          requiredSyncs,
          surfaceActions,
          surfaceQueries,
          principle,
        });

        return complete(elseP, 'ok', { entity: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'derived-entity', { name }, 'results');

    return branch(p,
      (bindings) => (bindings.results as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', {}),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const results = bindings.results as Record<string, unknown>[];
        return { entity: results[0].id as string };
      }),
    ) as StorageProgram<Result>;
  },

  findByComposedConcept(input: Record<string, unknown>) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'derived-entity', {}, 'allDerived');

    return completeFrom(p, 'ok', (bindings) => {
      const allDerived = bindings.allDerived as Record<string, unknown>[];
      const matching = allDerived.filter((d) => {
        try {
          const composes = JSON.parse(d.composesRefs as string || '[]');
          return composes.some(
            (c: Record<string, unknown> | string) =>
              (typeof c === 'string' && c === concept) ||
              (typeof c === 'object' && c.name === concept),
          );
        } catch {
          return false;
        }
      });

      return { entities: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findBySync(input: Record<string, unknown>) {
    const syncName = input.syncName as string;

    let p = createProgram();
    p = find(p, 'derived-entity', {}, 'allDerived');

    return completeFrom(p, 'ok', (bindings) => {
      const allDerived = bindings.allDerived as Record<string, unknown>[];
      const matching = allDerived.filter((d) => {
        try {
          const syncs = JSON.parse(d.requiredSyncs as string || '[]');
          return syncs.includes(syncName);
        } catch {
          return false;
        }
      });

      return { entities: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  compositionTree(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = get(p, 'derived-entity', entity, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const composes = JSON.parse(record.composesRefs as string || '[]');
        const tree: Record<string, unknown>[] = [];

        for (const entry of composes) {
          const entryName = typeof entry === 'string' ? entry : (entry.name as string);
          const isDerived = typeof entry === 'object' && entry.isDerived;

          if (isDerived) {
            tree.push({ name: entryName, type: 'derived', children: [] });
          } else {
            tree.push({ name: entryName, type: 'concept' });
          }
        }

        return { tree: JSON.stringify(tree) };
      }),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },

  traceRollup(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const flowId = input.flowId as string;

    let p = createProgram();
    p = get(p, 'derived-entity', entity, 'record');
    p = find(p, 'action-log', { flow: flowId }, 'flowRecords');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const flowRecords = bindings.flowRecords as Record<string, unknown>[];
        const claimedSyncs = JSON.parse(record.requiredSyncs as string || '[]');

        const grouped: Record<string, Record<string, unknown>[]> = {};
        for (const syncName of claimedSyncs) {
          grouped[syncName] = flowRecords.filter((r) => r.sync === syncName);
        }

        const unclaimed = flowRecords.filter(
          (r) => r.sync && !claimedSyncs.includes(r.sync),
        );

        return {
          rollup: JSON.stringify({
            derivedConcept: record.name,
            claimedSyncs: grouped,
            unclaimedActions: unclaimed.length,
            totalActions: flowRecords.length,
          }),
        };
      }),
      (elseP) => complete(elseP, 'notfound', {}),
    ) as StorageProgram<Result>;
  },
};

export const derivedEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetDerivedEntityCounter(): void {
  idCounter = 0;
}
