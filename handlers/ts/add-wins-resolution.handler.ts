// @migrated dsl-constructs 2026-03-18
// ============================================================
// AddWinsResolution Handler
//
// Add-Wins (OR-Set semantics) conflict resolution. When elements
// are concurrently added and removed, additions win. Suitable for
// set-like data structures such as tags, permissions, and
// collection membership.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `add-wins-resolution-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

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

const _addWinsResolutionHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'add-wins-resolution', id, {
      id,
      name: 'add-wins',
      category: 'conflict-resolution',
      priority: 20,
    });

    return complete(p, 'ok', { name: 'add-wins', category: 'conflict-resolution', priority: 20 }) as StorageProgram<Result>;
  },

  attemptResolve(input: Record<string, unknown>) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;

    // Parse both versions as sets
    const set1 = parseSet(v1);
    const set2 = parseSet(v2);

    if (set1 === null || set2 === null) {
      const p = createProgram();
      return complete(p, 'cannotResolve', { reason: 'Content is not a set-like structure' }) as StorageProgram<Result>;
    }

    // Add-wins semantics: compute the union of both versions.
    const union = new Set<string>([...set1, ...set2]);
    const result = JSON.stringify(Array.from(union).sort());

    // Cache the resolution
    const cacheId = nextId();

    let p = createProgram();
    p = put(p, 'add-wins-resolution', cacheId, {
      id: cacheId,
      base: base ?? null,
      v1,
      v2,
      result,
      resolvedAt: new Date().toISOString(),
    });

    return complete(p, 'resolved', { result }) as StorageProgram<Result>;
  },
};

export const addWinsResolutionHandler = autoInterpret(_addWinsResolutionHandler);

/** Reset the ID counter. Useful for testing. */
export function resetAddWinsResolutionCounter(): void {
  idCounter = 0;
}
