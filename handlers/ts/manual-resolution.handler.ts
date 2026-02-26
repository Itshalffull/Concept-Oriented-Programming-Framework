// ============================================================
// ManualResolution Handler
//
// Manual conflict resolution that escalates to a human reviewer.
// Returns candidate options rather than auto-resolving. Used as
// the last-resort policy when no automatic strategy can make a
// domain-safe decision.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `manual-resolution-${++idCounter}`;
}

export const manualResolutionHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('manual-resolution', id, {
      id,
      name: 'manual',
      category: 'conflict-resolution',
      priority: 99,
    });

    return { variant: 'ok', name: 'manual', category: 'conflict-resolution', priority: 99 };
  },

  async attemptResolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;
    const context = input.context as string;

    // Manual resolution never auto-resolves. Store the conflict for human review.
    const conflictId = nextId();
    const candidates = [v1, v2];
    if (base) {
      candidates.push(base);
    }

    await storage.put('manual-resolution', conflictId, {
      id: conflictId,
      base: base ?? null,
      v1,
      v2,
      context,
      candidates: JSON.stringify(candidates),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return {
      variant: 'cannotResolve',
      reason: 'Manual resolution required — escalating to human review',
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetManualResolutionCounter(): void {
  idCounter = 0;
}
