// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Merge Handler
//
// Combine two divergent versions of content that share a common
// ancestor, producing a unified result or identifying conflicts.
// Strategy is selected by content type and configuration.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, delFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `merge-${++idCounter}`;
}

interface ConflictRegion {
  region: string;
  oursContent: string;
  theirsContent: string;
  status: string;
  resolution?: string;
}

/** Simple three-way line merge */
function threeWayMerge(base: string, ours: string, theirs: string): {
  result: string | null;
  conflicts: ConflictRegion[];
} {
  const baseLines = base.split('\n');
  const ourLines = ours.split('\n');
  const theirLines = theirs.split('\n');
  const conflicts: ConflictRegion[] = [];
  const resultLines: string[] = [];

  const maxLen = Math.max(baseLines.length, ourLines.length, theirLines.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = i < baseLines.length ? baseLines[i] : undefined;
    const ourLine = i < ourLines.length ? ourLines[i] : undefined;
    const theirLine = i < theirLines.length ? theirLines[i] : undefined;

    if (ourLine === theirLine) {
      if (ourLine !== undefined) resultLines.push(ourLine);
    } else if (ourLine === baseLine) {
      if (theirLine !== undefined) resultLines.push(theirLine);
    } else if (theirLine === baseLine) {
      if (ourLine !== undefined) resultLines.push(ourLine);
    } else {
      conflicts.push({
        region: `line ${i + 1}`,
        oursContent: ourLine ?? '',
        theirsContent: theirLine ?? '',
        status: 'unresolved',
      });
      resultLines.push(`<<<<<<< ours`);
      if (ourLine !== undefined) resultLines.push(ourLine);
      resultLines.push(`=======`);
      if (theirLine !== undefined) resultLines.push(theirLine);
      resultLines.push(`>>>>>>> theirs`);
    }
  }

  if (conflicts.length === 0) {
    return { result: resultLines.join('\n'), conflicts: [] };
  }

  return { result: null, conflicts };
}

const _handler: FunctionalConceptHandler = {
  registerStrategy(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'duplicate', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!input.contentTypes || (typeof input.contentTypes === 'string' && (input.contentTypes as string).trim() === '')) {
      return complete(createProgram(), 'duplicate', { message: 'contentTypes is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const contentTypes = input.contentTypes as string[];

    let p = createProgram();
    p = find(p, 'merge-strategy', { name }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as Record<string, unknown>[]).length > 0,
      (bp) => complete(bp, 'duplicate', { message: `Strategy '${name}' already registered` }),
      (bp) => {
        const id = nextId();
        const bp2 = put(bp, 'merge-strategy', id, {
          id,
          name,
          contentTypes: Array.isArray(contentTypes) ? contentTypes : [],
        });
        return complete(bp2, 'ok', { strategy: id });
      },
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const base = input.base as string;
    const ours = input.ours as string;
    const theirs = input.theirs as string;
    // strategy is optional - null/undefined means "use default (no strategy check)"
    const strategy = (input.strategy !== null && input.strategy !== undefined && input.strategy !== '')
      ? input.strategy as string
      : null;

    if (strategy) {
      let p = createProgram();
      // Look up strategy by ID first, then by name
      p = get(p, 'merge-strategy', strategy, 'strategyById');

      return branch(p, 'strategyById',
        (bp) => {
          const { result, conflicts } = threeWayMerge(base, ours, theirs);
          if (result !== null && conflicts.length === 0) {
            return complete(bp, 'clean', { result });
          }
          const mergeId = nextId();
          const bp2 = put(bp, 'merge-active', mergeId, {
            id: mergeId, base, ours, theirs,
            conflicts: JSON.stringify(conflicts), result: null,
          });
          return complete(bp2, 'conflicts', { mergeId, conflictCount: conflicts.length });
        },
        (bp) => {
          // Fall back to looking up by name
          let bp2 = find(bp, 'merge-strategy', {}, 'allStrategies');
          return branch(bp2,
            (bindings) => {
              const all = bindings.allStrategies as Record<string, unknown>[];
              return all.some((s) => s.name === strategy);
            },
            (bp3) => {
              const { result, conflicts } = threeWayMerge(base, ours, theirs);
              if (result !== null && conflicts.length === 0) {
                return complete(bp3, 'clean', { result });
              }
              const mergeId = nextId();
              const bp4 = put(bp3, 'merge-active', mergeId, {
                id: mergeId, base, ours, theirs,
                conflicts: JSON.stringify(conflicts), result: null,
              });
              return complete(bp4, 'conflicts', { mergeId, conflictCount: conflicts.length });
            },
            (bp3) => complete(bp3, 'noStrategy', { message: `No strategy registered for '${strategy}'` }),
          );
        },
      ) as StorageProgram<Result>;
    }

    const { result, conflicts } = threeWayMerge(base, ours, theirs);

    if (result !== null && conflicts.length === 0) {
      const p = createProgram();
      return complete(p, 'clean', { result }) as StorageProgram<Result>;
    }

    const mergeId = nextId();
    let p = createProgram();
    p = put(p, 'merge-active', mergeId, {
      id: mergeId, base, ours, theirs,
      conflicts: JSON.stringify(conflicts), result: null,
    });

    return complete(p, 'conflicts', { mergeId, conflictCount: conflicts.length }) as StorageProgram<Result>;
  },

  resolveConflict(input: Record<string, unknown>) {
    const mergeId = input.mergeId as string;
    const conflictIndex = input.conflictIndex as number;
    const resolution = input.resolution as string;

    let p = createProgram();
    p = get(p, 'merge-active', mergeId, 'mergeRecord');

    return branch(p,
      (bindings) => !bindings.mergeRecord,
      (bp) => complete(bp, 'invalidIndex', { message: `Merge '${mergeId}' not found` }),
      (bp) => {
        // Compute updated conflicts and write back
        let bp2 = mapBindings(bp, (bindings) => {
          const mergeRecord = bindings.mergeRecord as Record<string, unknown>;
          const conflicts = JSON.parse(mergeRecord.conflicts as string) as ConflictRegion[];

          if (conflictIndex < 0 || conflictIndex >= conflicts.length) {
            return { error: 'invalidIndex', message: `Conflict index ${conflictIndex} out of range [0, ${conflicts.length - 1}]` };
          }

          if (conflicts[conflictIndex].status === 'resolved') {
            return { error: 'alreadyResolved', message: `Conflict at index ${conflictIndex} was already resolved` };
          }

          conflicts[conflictIndex].status = 'resolved';
          conflicts[conflictIndex].resolution = resolution;

          const remaining = conflicts.filter(c => c.status !== 'resolved').length;
          return { error: null, conflicts: JSON.stringify(conflicts), remaining };
        }, 'resolution');

        // Write the updated merge record
        bp2 = putFrom(bp2, 'merge-active', mergeId, (bindings) => {
          const mergeRecord = bindings.mergeRecord as Record<string, unknown>;
          const res = bindings.resolution as Record<string, unknown>;
          if (res.error) return mergeRecord; // Don't update on error
          return { ...mergeRecord, conflicts: res.conflicts as string };
        });

        return completeFrom(bp2, 'ok', (bindings) => {
          const res = bindings.resolution as Record<string, unknown>;
          if (res.error === 'invalidIndex') {
            return { variant: 'invalidIndex', message: res.message as string };
          }
          if (res.error === 'alreadyResolved') {
            return { variant: 'alreadyResolved', message: res.message as string };
          }
          return { remaining: res.remaining as number };
        });
      },
    ) as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const mergeId = input.mergeId as string;

    let p = createProgram();
    p = get(p, 'merge-active', mergeId, 'mergeRecord');

    return branch(p,
      (bindings) => !bindings.mergeRecord,
      (bp) => complete(bp, 'unresolvedConflicts', { count: 0 }),
      (bp) => {
        // Compute result and delete the merge record
        let bp2 = mapBindings(bp, (bindings) => {
          const mergeRecord = bindings.mergeRecord as Record<string, unknown>;
          const conflicts = JSON.parse(mergeRecord.conflicts as string) as ConflictRegion[];
          const unresolved = conflicts.filter(c => c.status !== 'resolved');

          if (unresolved.length > 0) {
            return { error: true, count: unresolved.length };
          }

          const base = mergeRecord.base as string;
          const ours = mergeRecord.ours as string;
          const theirs = mergeRecord.theirs as string;
          const baseLines = base.split('\n');
          const ourLines = ours.split('\n');
          const theirLines = theirs.split('\n');
          const maxLen = Math.max(baseLines.length, ourLines.length, theirLines.length);
          const resultLines: string[] = [];
          let conflictIdx = 0;

          for (let i = 0; i < maxLen; i++) {
            const baseLine = i < baseLines.length ? baseLines[i] : undefined;
            const ourLine = i < ourLines.length ? ourLines[i] : undefined;
            const theirLine = i < theirLines.length ? theirLines[i] : undefined;

            if (ourLine === theirLine) {
              if (ourLine !== undefined) resultLines.push(ourLine);
            } else if (ourLine === baseLine) {
              if (theirLine !== undefined) resultLines.push(theirLine);
            } else if (theirLine === baseLine) {
              if (ourLine !== undefined) resultLines.push(ourLine);
            } else {
              if (conflictIdx < conflicts.length && conflicts[conflictIdx].resolution !== undefined) {
                resultLines.push(conflicts[conflictIdx].resolution!);
              }
              conflictIdx++;
            }
          }

          return { error: false, result: resultLines.join('\n') };
        }, 'finalResult');

        bp2 = del(bp2, 'merge-active', mergeId);

        return completeFrom(bp2, 'ok', (bindings) => {
          const fr = bindings.finalResult as Record<string, unknown>;
          if (fr.error) {
            return { variant: 'unresolvedConflicts', count: fr.count as number };
          }
          return { result: fr.result as string };
        });
      },
    ) as StorageProgram<Result>;
  },
};

export const mergeHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetMergeCounter(): void {
  idCounter = 0;
}
