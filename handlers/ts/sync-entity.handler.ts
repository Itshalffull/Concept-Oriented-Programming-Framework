// @migrated dsl-constructs 2026-03-18
// ============================================================
// SyncEntity Handler
//
// Compiled sync rule as a queryable node -- the semantic glue
// connecting concepts. Stores resolved when-patterns, where-clauses,
// and then-actions with full concept/action references. Enables
// flow tracing, dead-end detection, and orphan variant analysis.
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
  return `sync-entity-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const source = input.source as string;
    const compiled = input.compiled as string;

    let p = createProgram();
    p = find(p, 'sync-entity', { name }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'alreadyRegistered', (b) => ({
          existing: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        const id = nextId();
        const symbol = `clef/sync/${name}`;

        let annotations = '[]';
        let whenPatterns = '[]';
        let whereClauses = '[]';
        let thenActions = '[]';
        let tier = 'standard';
        let whenPatternCount = 0;
        let thenActionCount = 0;

        try {
          const parsed = JSON.parse(compiled);
          annotations = JSON.stringify(parsed.annotations || []);
          whenPatterns = JSON.stringify(parsed.when || []);
          whereClauses = JSON.stringify(parsed.where || []);
          thenActions = JSON.stringify(parsed.then || []);
          tier = parsed.tier || 'standard';
          whenPatternCount = (parsed.when || []).length;
          thenActionCount = (parsed.then || []).length;
        } catch {
          // compiled may be empty or non-JSON; store defaults
        }

        let e = createProgram();
        e = put(e, 'sync-entity', id, {
          id,
          name,
          symbol,
          sourceFile: source,
          compiled,
          annotations,
          whenPatterns,
          whereClauses,
          thenActions,
          tier,
          whenPatternCount,
          thenActionCount,
        });

        return complete(e, 'ok', { sync: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  findByConcept(input: Record<string, unknown>) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'sync-entity', {}, 'allSyncs');

    return completeFrom(p, 'ok', (b) => {
      const allSyncs = b.allSyncs as Record<string, unknown>[];
      const matching = allSyncs.filter((s) => {
        try {
          const when = JSON.parse(s.whenPatterns as string || '[]');
          const then = JSON.parse(s.thenActions as string || '[]');
          const whenMatch = when.some((w: Record<string, unknown>) => w.concept === concept);
          const thenMatch = then.some((t: Record<string, unknown>) => t.concept === concept);
          return whenMatch || thenMatch;
        } catch {
          return false;
        }
      });

      return { syncs: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findTriggerableBy(input: Record<string, unknown>) {
    const action = input.action as string;
    const variantFilter = input.variant as string;

    let p = createProgram();
    p = find(p, 'sync-entity', {}, 'allSyncs');

    return completeFrom(p, 'ok', (b) => {
      const allSyncs = b.allSyncs as Record<string, unknown>[];
      const matching = allSyncs.filter((s) => {
        try {
          const when = JSON.parse(s.whenPatterns as string || '[]');
          return when.some((w: Record<string, unknown>) => {
            const actionMatch = w.action === action;
            if (!actionMatch) return false;
            if (variantFilter && variantFilter !== '') {
              const outputFields = w.outputFields as Array<Record<string, unknown>> | undefined;
              if (outputFields) {
                return outputFields.some(
                  (f) =>
                    f.name === 'variant' &&
                    ((f.match as Record<string, unknown>)?.type === 'wildcard' ||
                      (f.match as Record<string, unknown>)?.value === variantFilter),
                );
              }
            }
            return true;
          });
        } catch {
          return false;
        }
      });

      return { syncs: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  chainFrom(input: Record<string, unknown>) {
    const action = input.action as string;
    const variantFilter = input.variant as string;
    const depth = input.depth as number;

    let p = createProgram();
    p = find(p, 'sync-entity', {}, 'allSyncs');

    return completeFrom(p, 'ok', (b) => {
      const allSyncs = b.allSyncs as Record<string, unknown>[];

      const chain: Array<Record<string, unknown>> = [];
      let currentActions = [{ action, variant: variantFilter }];

      for (let d = 0; d < depth && currentActions.length > 0; d++) {
        const nextActions: Array<{ action: string; variant: string }> = [];

        for (const current of currentActions) {
          const triggered = allSyncs.filter((s) => {
            try {
              const when = JSON.parse(s.whenPatterns as string || '[]');
              return when.some((w: Record<string, unknown>) => w.action === current.action);
            } catch {
              return false;
            }
          });

          for (const sync of triggered) {
            try {
              const then = JSON.parse(sync.thenActions as string || '[]');
              for (const t of then) {
                const thenAction = t as Record<string, unknown>;
                chain.push({
                  depth: d,
                  sync: sync.name,
                  triggerAction: current.action,
                  thenConcept: thenAction.concept,
                  thenAction: thenAction.action,
                });
                nextActions.push({
                  action: thenAction.action as string,
                  variant: '',
                });
              }
            } catch {
              // skip malformed
            }
          }
        }

        currentActions = nextActions;
      }

      if (chain.length === 0) {
        return { variant: 'noChain' };
      }

      return { chain: JSON.stringify(chain) };
    }) as StorageProgram<Result>;
  },

  findDeadEnds(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'sync-entity', {}, 'allSyncs');

    return completeFrom(p, 'ok', (b) => {
      const allSyncs = b.allSyncs as Record<string, unknown>[];

      const triggeredActions = new Set<string>();
      for (const s of allSyncs) {
        try {
          const when = JSON.parse(s.whenPatterns as string || '[]');
          for (const w of when) {
            triggeredActions.add((w as Record<string, unknown>).action as string);
          }
        } catch {
          // skip
        }
      }

      const deadEnds = allSyncs.filter((s) => {
        try {
          const then = JSON.parse(s.thenActions as string || '[]');
          return then.every((t: Record<string, unknown>) => !triggeredActions.has(t.action as string));
        } catch {
          return false;
        }
      });

      return { deadEnds: JSON.stringify(deadEnds) };
    }) as StorageProgram<Result>;
  },

  findOrphanVariants(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'sync-entity', {}, 'allSyncs');
    p = find(p, 'variant-entity', {}, 'allVariants');

    return completeFrom(p, 'ok', (b) => {
      const allSyncs = b.allSyncs as Record<string, unknown>[];
      const allVariants = b.allVariants as Record<string, unknown>[];

      const matchedTags = new Set<string>();
      for (const s of allSyncs) {
        try {
          const when = JSON.parse(s.whenPatterns as string || '[]');
          for (const w of when) {
            const outputFields = (w as Record<string, unknown>).outputFields as
              | Array<Record<string, unknown>>
              | undefined;
            if (outputFields) {
              for (const f of outputFields) {
                if (f.name === 'variant') {
                  const match = f.match as Record<string, unknown>;
                  if (match?.type === 'literal' && match.value) {
                    matchedTags.add(match.value as string);
                  }
                }
              }
            }
          }
        } catch {
          // skip
        }
      }

      const orphans = allVariants.filter((v) => !matchedTags.has(v.tag as string));

      return { orphans: JSON.stringify(orphans) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const sync = input.sync as string;

    let p = createProgram();
    p = get(p, 'sync-entity', sync, 'record');

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
            sync: record.id as string,
            name: record.name as string,
            annotations: record.annotations as string,
            tier: record.tier as string,
            whenPatternCount: (record.whenPatternCount as number) || 0,
            thenActionCount: (record.thenActionCount as number) || 0,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const syncEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSyncEntityCounter(): void {
  idCounter = 0;
}
