// @clef-handler style=functional concept=lww
// @migrated dsl-constructs 2026-03-18
// ============================================================
// LWWResolution Handler
//
// Last-Writer-Wins conflict resolution. Uses causal timestamps to
// select the most recent write. Default strategy for simple key-value
// stores and LWW registers.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

  const d = new Date(value).getTime();
  if (!isNaN(d)) return d;

  return null;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'lww-resolution', id, {
      id,
      name: 'lww',
      category: 'conflict-resolution',
      priority: 10,
    });

    return complete(p, 'ok', { name: 'lww', category: 'conflict-resolution', priority: 10 }) as StorageProgram<Result>;
  },

  attemptResolve(input: Record<string, unknown>) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;

    const ts1 = extractTimestamp(v1);
    const ts2 = extractTimestamp(v2);

    if (ts1 === null || ts2 === null) {
      const p = createProgram();
      return complete(p, 'cannotResolve', {
        reason: 'Unable to extract causal timestamps from one or both values',
      }) as StorageProgram<Result>;
    }

    if (ts1 === ts2) {
      const p = createProgram();
      return complete(p, 'cannotResolve', {
        reason: 'Timestamps are identical — exactly concurrent writes with no ordering',
      }) as StorageProgram<Result>;
    }

    const winner = ts1 > ts2 ? v1 : v2;

    const cacheId = nextId();
    let p = createProgram();
    p = put(p, 'lww-resolution', cacheId, {
      id: cacheId,
      base: base ?? null,
      v1,
      v2,
      result: winner,
      resolvedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { result: winner }) as StorageProgram<Result>;
  },
};

export const lWWResolutionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetLWWResolutionCounter(): void {
  idCounter = 0;
}
