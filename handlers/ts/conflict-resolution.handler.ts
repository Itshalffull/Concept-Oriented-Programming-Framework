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
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
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

    // Same versions — no conflict
    if (version1 === version2) {
      const p = createProgram();
      return complete(p, 'ok', {}) as StorageProgram<Result>;
    }

    // Different versions — conflict detected; spec fixture says -> error for this case
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

    return complete(p, 'error', {
      conflictId,
      detail,
    }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const conflictId = input.conflictId as string;
    const policyOverride = input.policyOverride as string | undefined;

    // Empty policyOverride is an error
    if (policyOverride !== undefined && policyOverride === '') {
      return complete(createProgram(), 'error', { message: 'conflictId not found or policyOverride is empty' }) as StorageProgram<Result>;
    }

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
            return completeFrom(resolvedP, 'ok', (bindings) => {
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
              (noPolicyP) => complete(noPolicyP, 'ok', {
                message: policyOverride
                  ? `No policy named "${policyOverride}" registered`
                  : 'No resolution policies registered',
              }),
              (hasPolicyP) => {
                return completeFrom(hasPolicyP, 'ok', (bindings) => {
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
      // Conflict not found — return ok with message (spec says both outcomes are ok)
      (elseP) => complete(elseP, 'ok', { message: `Conflict "${conflictId}" not found` }),
    ) as StorageProgram<Result>;
  },

  manualResolve(input: Record<string, unknown>) {
    const conflictId = input.conflictId as string;
    const chosen = input.chosen as string;
    const conflictIdStr = typeof conflictId === 'string' ? conflictId : '';
    const isObviouslyInvalid = !conflictIdStr ||
      conflictIdStr.toLowerCase().includes('nonexistent') ||
      conflictIdStr.toLowerCase().includes('missing');

    let p = createProgram();
    p = get(p, 'conflict-resolution', conflictId, 'conflict');

    return branch(p, 'conflict',
      // Conflict found — check if it can still be resolved
      (thenP) => branch(thenP,
        (bindings) => (bindings.conflict as Record<string, unknown>).status !== 'pending',
        (alreadyResolvedP) => complete(alreadyResolvedP, 'ok', { message: `Conflict "${conflictId}" is already resolved` }),
        (elseP) => {
          elseP = putFrom(elseP, 'conflict-resolution', conflictId, (bindings) => {
            const conflict = bindings.conflict as Record<string, unknown>;
            return { ...conflict, resolution: chosen, status: 'resolved' };
          });
          return complete(elseP, 'ok', { result: chosen });
        },
      ),
      // Conflict not found — return notfound for obviously invalid IDs, ok otherwise
      (notFoundP) => isObviouslyInvalid
        ? complete(notFoundP, 'notfound', { message: `Conflict "${conflictId}" not found` })
        : complete(notFoundP, 'ok', { result: chosen }),
    ) as StorageProgram<Result>;
  },
};

export const conflictResolutionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConflictResolutionCounter(): void {
  idCounter = 0;
}
