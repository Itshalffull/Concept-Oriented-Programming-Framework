// ============================================================
// AddWinsResolution Handler
//
// Add-Wins (OR-Set semantics) conflict resolution. When elements
// are concurrently added and removed, additions win. Suitable for
// set-like data structures such as tags, permissions, and
// collection membership.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `add-wins-resolution-${++idCounter}`;
}

/**
 * Parse a JSON-encoded set (array). Returns null if parsing fails,
 * indicating the content is not a set-like structure.
 */
function parseSet(data: string): string[] | null {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
    return null;
  } catch {
    return null;
  }
}

export const addWinsResolutionHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('add-wins-resolution', id, {
      id,
      name: 'add-wins',
      category: 'conflict-resolution',
      priority: 20,
    });

    return { variant: 'ok', name: 'add-wins', category: 'conflict-resolution', priority: 20 };
  },

  async attemptResolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;
    const context = input.context as string;

    // Parse both versions as sets
    const set1 = parseSet(v1);
    const set2 = parseSet(v2);

    if (set1 === null || set2 === null) {
      return { variant: 'cannotResolve', reason: 'Content is not a set-like structure' };
    }

    // Parse the base set if provided
    const baseSet = base ? parseSet(base) : [];

    // Add-wins semantics: compute the union of both versions.
    // Items present in either version are kept (additions win over removals).
    const union = new Set<string>([...set1, ...set2]);

    // If we have a base, items explicitly removed by both sides (not in either)
    // stay removed. But if removed by one side and present in the other, the
    // add wins — which the union already handles.
    const result = JSON.stringify(Array.from(union).sort());

    // Cache the resolution
    const cacheId = nextId();
    await storage.put('add-wins-resolution', cacheId, {
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
export function resetAddWinsResolutionCounter(): void {
  idCounter = 0;
}
