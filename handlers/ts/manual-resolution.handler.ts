// @clef-handler style=functional
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
      name: 'manual',
      category: 'conflict-resolution',
      priority: 99,
    });

    return complete(p, 'ok', { name: 'manual', category: 'conflict-resolution', priority: 99 }) as StorageProgram<Result>;
  },

  attemptResolve(input: Record<string, unknown>) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;
    const context = input.context as string;

    const conflictId = nextId();
    const candidates = [v1, v2];
    if (base) {
      candidates.push(base);
    }

    let p = createProgram();
    p = put(p, 'manual-resolution', conflictId, {
      id: conflictId,
      base: base ?? null,
      v1,
      v2,
      context,
      candidates: JSON.stringify(candidates),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'cannotResolve', {
      reason: 'Manual resolution required — escalating to human review',
    }) as StorageProgram<Result>;
  },
};

export const manualResolutionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetManualResolutionCounter(): void {
  idCounter = 0;
}
