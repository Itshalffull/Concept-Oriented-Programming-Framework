// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConflictResolution Handler
//
// Detect and resolve incompatible concurrent modifications using a
// pluggable strategy selected by data type and domain policy.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  registerPolicy(input: Record<string, unknown>) {
    const name = input.name as string;
    const priority = input.priority as number;

    let p = createProgram();
    p = find(p, 'conflict-resolution-policy', { name }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'duplicate', { message: `Policy "${name}" already exists` }),
      (elseP) => {
        const id = nextId('policy');
        elseP = put(elseP, 'conflict-resolution-policy', id, {
          id,
          name,
          priority,
        });
        return complete(elseP, 'ok', { policy: id });
      },
    ) as StorageProgram<Result>;
  },

  detect(input: Record<string, unknown>) {
    const base = input.base as string | undefined;
    const version1 = input.version1 as string;
    const version2 = input.version2 as string;
    const context = input.context as string;

    if (version1 === version2) {
      const p = createProgram();
      return complete(p, 'noConflict', {}) as StorageProgram<Result>;
    }

    const conflictId = nextId('conflict');
    const detail = JSON.stringify({
      base: base ?? null,
      version1,
      version2,
      context,
    });

    let p = createProgram();
    p = put(p, 'conflict-resolution', conflictId, {
      id: conflictId,
      base: base ?? null,
      version1,
      version2,
      clock1: '',
      clock2: '',
      context,
      resolution: null,
      status: 'pending',
    });

    return complete(p, 'detected', {
      conflictId,
      detail,
    }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const conflictId = input.conflictId as string;
    const policyOverride = input.policyOverride as string | undefined;

    let p = createProgram();
    p = get(p, 'conflict-resolution', conflictId, 'conflict');

    return branch(p, 'conflict',
      (thenP) => {
        thenP = find(thenP, 'conflict-resolution-policy', {}, 'allPolicies');

        return branch(thenP,
          (bindings) => {
            const conflict = bindings.conflict as Record<string, unknown>;
            return conflict.resolution !== null && conflict.resolution !== undefined;
          },
          (resolvedP) => {
            resolvedP = putFrom(resolvedP, 'conflict-resolution', conflictId, (bindings) => {
              const conflict = bindings.conflict as Record<string, unknown>;
              return { ...conflict, status: 'resolved' };
            });
            return completeFrom(resolvedP, 'resolved', (bindings) => {
              const conflict = bindings.conflict as Record<string, unknown>;
              return { result: conflict.resolution as string };
            });
          },
          (unresolvedP) => {
            return branch(unresolvedP,
              (bindings) => {
                const allPolicies = bindings.allPolicies as Record<string, unknown>[];
                const candidates = policyOverride
                  ? allPolicies.filter(p => p.name === policyOverride)
                  : allPolicies;
                return candidates.length === 0;
              },
              (noPolicyP) => complete(noPolicyP, 'noPolicy', {
                message: policyOverride
                  ? `No policy named "${policyOverride}" registered`
                  : 'No resolution policies registered',
              }),
              (hasPolicyP) => {
                return completeFrom(hasPolicyP, 'requiresHuman', (bindings) => {
                  const conflict = bindings.conflict as Record<string, unknown>;
                  const options = [
                    JSON.stringify(conflict.version1),
                    JSON.stringify(conflict.version2),
                  ];
                  if (conflict.base !== null && conflict.base !== undefined) {
                    options.push(JSON.stringify(conflict.base));
                  }
                  return { conflictId, options };
                });
              },
            );
          },
        );
      },
      (elseP) => complete(elseP, 'noPolicy', { message: `Conflict "${conflictId}" not found` }),
    ) as StorageProgram<Result>;
  },

  manualResolve(input: Record<string, unknown>) {
    const conflictId = input.conflictId as string;
    const chosen = input.chosen as string;

    let p = createProgram();
    p = get(p, 'conflict-resolution', conflictId, 'conflict');

    return branch(p,
      (bindings) => {
        const conflict = bindings.conflict as Record<string, unknown> | null;
        return !conflict || conflict.status !== 'pending';
      },
      (thenP) => completeFrom(thenP, 'notPending', (bindings) => {
        const conflict = bindings.conflict as Record<string, unknown> | null;
        return {
          message: conflict
            ? `Conflict "${conflictId}" is already resolved`
            : `Conflict "${conflictId}" not found`,
        };
      }),
      (elseP) => {
        elseP = putFrom(elseP, 'conflict-resolution', conflictId, (bindings) => {
          const conflict = bindings.conflict as Record<string, unknown>;
          return { ...conflict, resolution: chosen, status: 'resolved' };
        });
        return complete(elseP, 'ok', { result: chosen });
      },
    ) as StorageProgram<Result>;
  },
};

export const conflictResolutionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConflictResolutionCounter(): void {
  idCounter = 0;
}
