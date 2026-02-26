// ============================================================
// LWWResolution Handler
//
// Last-Writer-Wins conflict resolution. Uses causal timestamps to
// select the most recent write. Default strategy for simple key-value
// stores and LWW registers.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `lww-resolution-${++idCounter}`;
}

/**
 * Extract a timestamp from a versioned value. Expects values to be
 * JSON-encoded objects with a `_ts` field (ISO string or epoch number),
 * or a raw ISO timestamp string.
 */
function extractTimestamp(value: string): number | null {
  // Try parsing as JSON object with _ts field
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && '_ts' in parsed) {
      const ts = parsed._ts;
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') {
        const d = new Date(ts).getTime();
        return isNaN(d) ? null : d;
      }
    }
  } catch {
    // Not JSON — fall through
  }

  // Try parsing as raw ISO timestamp
  const d = new Date(value).getTime();
  if (!isNaN(d)) return d;

  return null;
}

export const lWWResolutionHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    await storage.put('lww-resolution', id, {
      id,
      name: 'lww',
      category: 'conflict-resolution',
      priority: 10,
    });

    return { variant: 'ok', name: 'lww', category: 'conflict-resolution', priority: 10 };
  },

  async attemptResolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;
    const context = input.context as string;

    const ts1 = extractTimestamp(v1);
    const ts2 = extractTimestamp(v2);

    // If we cannot extract timestamps from either value, we cannot resolve
    if (ts1 === null || ts2 === null) {
      return {
        variant: 'cannotResolve',
        reason: 'Unable to extract causal timestamps from one or both values',
      };
    }

    // Exactly concurrent — timestamps are identical
    if (ts1 === ts2) {
      return {
        variant: 'cannotResolve',
        reason: 'Timestamps are identical — exactly concurrent writes with no ordering',
      };
    }

    // Pick the value with the higher (more recent) timestamp
    const winner = ts1 > ts2 ? v1 : v2;

    // Cache the resolution
    const cacheId = nextId();
    await storage.put('lww-resolution', cacheId, {
      id: cacheId,
      base: base ?? null,
      v1,
      v2,
      result: winner,
      resolvedAt: new Date().toISOString(),
    });

    return { variant: 'resolved', result: winner };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetLWWResolutionCounter(): void {
  idCounter = 0;
}
