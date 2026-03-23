// @clef-handler style=functional concept=manual
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ManualResolution Handler
//
// Manual conflict resolution that escalates to a human reviewer.
// Returns candidate options rather than auto-resolving. Used as
// the last-resort policy when no automatic strategy can make a
// domain-safe decision.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `manual-resolution-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'manual-resolution', id, {
      id,
      name: 'ManualResolution',
      category: 'conflict-resolution',
      priority: 99,
    });

    return complete(p, 'ok', { name: 'ManualResolution', category: 'conflict-resolution', priority: 99 }) as StorageProgram<Result>;
  },

  attemptResolve(input: Record<string, unknown>) {
    const base = input.base as string | null;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;
    const context = input.context as string;

    // When base is provided, the conflict has history — manual resolution needed, cannot auto-resolve
    if (base != null && base.trim() !== '') {
      const conflictId = nextId();
      let p = createProgram();
      p = put(p, 'manual-resolution', conflictId, {
        id: conflictId,
        base,
        v1,
        v2,
        context,
        candidates: JSON.stringify([v1, v2, base]),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      return complete(p, 'cannotResolve', {
        reason: 'Manual resolution required — conflict has base version requiring human review',
      }) as StorageProgram<Result>;
    }

    const conflictId = nextId();
    const candidates = [v1, v2];

    let p = createProgram();
    p = put(p, 'manual-resolution', conflictId, {
      id: conflictId,
      base: null,
      v1,
      v2,
      context,
      candidates: JSON.stringify(candidates),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      reason: 'Manual resolution required — escalating to human review',
    }) as StorageProgram<Result>;
  },
};

export const manualResolutionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetManualResolutionCounter(): void {
  idCounter = 0;
}
