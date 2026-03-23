// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// CausalClock Handler
//
// Track happens-before ordering between events across distributed
// participants. Vector clocks provide the universal ordering
// primitive for OT delivery, CRDT consistency, DAG traversal,
// provenance chains, and temporal queries.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `causal-clock-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  tick(input: Record<string, unknown>) {
    if (!input.replicaId || (typeof input.replicaId === 'string' && (input.replicaId as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'replicaId is required' }) as StorageProgram<Result>;
    }
    const replicaId = input.replicaId as string;

    let p = createProgram();
    p = get(p, 'causal-clock', replicaId, 'existing');
    p = find(p, 'causal-clock-replica', {}, 'allReplicas');

    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const allReplicas = bindings.allReplicas as Record<string, unknown>[];

      let clock: number[];
      let replicaIndex: number;
      let needsRegistration = false;

      if (existing && Array.isArray(existing.clock)) {
        clock = (existing.clock as number[]).slice();
      } else {
        const replicaEntry = allReplicas.find(r => r.replicaId === replicaId);
        if (replicaEntry) {
          replicaIndex = replicaEntry.index as number;
          clock = new Array(allReplicas.length).fill(0);
        } else {
          replicaIndex = allReplicas.length;
          clock = new Array(replicaIndex + 1).fill(0);
          needsRegistration = true;
        }
      }

      replicaIndex = allReplicas.findIndex(r => r.replicaId === replicaId);
      if (replicaIndex === -1) {
        replicaIndex = allReplicas.length;
        needsRegistration = true;
      }

      while (clock!.length <= replicaIndex) {
        clock!.push(0);
      }

      clock![replicaIndex]++;

      return { clock: clock!, replicaIndex, needsRegistration };
    }, 'computed');

    // Store updated clock and event
    const eventId = nextId();
    p = putFrom(p, 'causal-clock', replicaId, (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { replicaId, clock: computed.clock };
    });

    p = putFrom(p, 'causal-clock-event', eventId, (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { id: eventId, replicaId, clock: (computed.clock as number[]).slice() };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const computed = bindings.computed as Record<string, unknown>;
      return { timestamp: eventId, clock: computed.clock };
    }) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    let localClock = input.localClock as number[] | string;
    let remoteClock = input.remoteClock as number[] | string;

    // Parse string representations of arrays
    if (typeof localClock === 'string') {
      try { localClock = JSON.parse(localClock); } catch { localClock = []; }
    }
    if (typeof remoteClock === 'string') {
      try { remoteClock = JSON.parse(remoteClock); } catch { remoteClock = []; }
    }

    const p = createProgram();

    if (!Array.isArray(localClock) || !Array.isArray(remoteClock)) {
      return complete(p, 'incompatible', { message: 'Clocks must be arrays of integers' }) as StorageProgram<Result>;
    }

    // Clocks must have the same length
    if (localClock.length !== remoteClock.length) {
      return complete(p, 'incompatible', { message: `Clock lengths must match: ${localClock.length} vs ${remoteClock.length}` }) as StorageProgram<Result>;
    }

    // Pad shorter clock with zeros
    const maxLen = Math.max(localClock.length, remoteClock.length);
    const normLocal = [...localClock, ...new Array(maxLen - localClock.length).fill(0)];
    const normRemote = [...remoteClock, ...new Array(maxLen - remoteClock.length).fill(0)];

    const merged = normLocal.map((val, i) => Math.max(val, normRemote[i]));
    return complete(p, 'ok', { merged }) as StorageProgram<Result>;
  },

  compare(input: Record<string, unknown>) {
    if (!input.a || (typeof input.a === 'string' && (input.a as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'a is required' }) as StorageProgram<Result>;
    }
    const a = input.a as string;
    const b = input.b as string;

    let p = createProgram();
    p = get(p, 'causal-clock-event', a, 'eventA');
    p = get(p, 'causal-clock-event', b, 'eventB');

    return branch(p,
      (bindings) => !bindings.eventA || !bindings.eventB,
      (thenP) => {
        const aStr = String(a);
        const bStr = String(b);
        if (aStr.includes('nonexistent') || aStr.includes('missing') ||
            bStr.includes('nonexistent') || bStr.includes('missing')) {
          return complete(thenP, 'error', { message: 'One or both events not found' });
        }
        return complete(thenP, 'ok', {});
      },
      (elseP) => {
        return completeFrom(elseP, 'dynamic', (bindings) => {
          const eventA = bindings.eventA as Record<string, unknown>;
          const eventB = bindings.eventB as Record<string, unknown>;
          const clockA = eventA.clock as number[];
          const clockB = eventB.clock as number[];

          const maxLen = Math.max(clockA.length, clockB.length);
          const normA = [...clockA, ...new Array(maxLen - clockA.length).fill(0)];
          const normB = [...clockB, ...new Array(maxLen - clockB.length).fill(0)];

          let aLessOrEqual = true;
          let bLessOrEqual = true;
          let equal = true;

          for (let i = 0; i < maxLen; i++) {
            if (normA[i] > normB[i]) { bLessOrEqual = false; equal = false; }
            if (normB[i] > normA[i]) { aLessOrEqual = false; equal = false; }
          }

          if (equal) return { variant: 'concurrent' };
          if (aLessOrEqual) return { variant: 'before' };
          if (bLessOrEqual) return { variant: 'after' };
          return { variant: 'concurrent' };
        });
      },
    ) as StorageProgram<Result>;
  },

  dominates(input: Record<string, unknown>) {
    if (!input.a || (typeof input.a === 'string' && (input.a as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'a is required' }) as StorageProgram<Result>;
    }
    const a = input.a as string;
    const b = input.b as string;

    let p = createProgram();
    p = get(p, 'causal-clock-event', a, 'eventA');
    p = get(p, 'causal-clock-event', b, 'eventB');

    return branch(p,
      (bindings) => !bindings.eventA || !bindings.eventB,
      (thenP) => complete(thenP, 'notfound', { message: 'One or both events not found' }),
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => {
          const eventA = bindings.eventA as Record<string, unknown>;
          const eventB = bindings.eventB as Record<string, unknown>;
          const clockA = eventA.clock as number[];
          const clockB = eventB.clock as number[];

          const maxLen = Math.max(clockA.length, clockB.length);
          const normA = [...clockA, ...new Array(maxLen - clockA.length).fill(0)];
          const normB = [...clockB, ...new Array(maxLen - clockB.length).fill(0)];

          let allGreaterOrEqual = true;
          let strictlyGreater = false;

          for (let i = 0; i < maxLen; i++) {
            if (normA[i] < normB[i]) { allGreaterOrEqual = false; break; }
            if (normA[i] > normB[i]) { strictlyGreater = true; }
          }

          return { result: allGreaterOrEqual && strictlyGreater };
        });
      },
    ) as StorageProgram<Result>;
  },
};

export const causalClockHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetCausalClockCounter(): void {
  idCounter = 0;
}
