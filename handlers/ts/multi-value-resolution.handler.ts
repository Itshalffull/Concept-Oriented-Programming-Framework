// ============================================================
// MultiValueResolution Handler
//
// Multi-value (keep-all) conflict resolution. Preserves both
// concurrent values rather than selecting one. Suitable for systems
// where all concurrent writes have equal validity, such as shopping
// cart contents or collaborative annotation lists.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `multi-value-resolution-${++idCounter}`;
}

export const multiValueResolutionHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('multi-value-resolution', id, {
      id,
      name: 'multi-value',
      category: 'conflict-resolution',
      priority: 30,
    });

    return { variant: 'ok', name: 'multi-value', category: 'conflict-resolution', priority: 30 };
  },

  async attemptResolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;
    const context = input.context as string;

    // Build a multi-value collection containing both concurrent values.
    // The result is a JSON-encoded array so consumers can iterate all values.
    // Sort to ensure commutative result (order of v1/v2 should not matter).
    const values = [v1, v2].sort();
    const result = JSON.stringify(values);

    // Cache the resolution
    const cacheId = nextId();
    await storage.put('multi-value-resolution', cacheId, {
      id: cacheId,
      base: base ?? null,
      v1,
      v2,
      result,
      resolvedAt: new Date().toISOString(),
    });

    return { variant: 'resolved', result };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetMultiValueResolutionCounter(): void {
  idCounter = 0;
}
