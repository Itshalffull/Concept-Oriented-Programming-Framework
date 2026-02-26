// ============================================================
// CausalClock Handler
//
// Track happens-before ordering between events across distributed
// participants. Vector clocks provide the universal ordering
// primitive for OT delivery, CRDT consistency, DAG traversal,
// provenance chains, and temporal queries.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `causal-clock-${++idCounter}`;
}

export const causalClockHandler: ConceptHandler = {
  async tick(input: Record<string, unknown>, storage: ConceptStorage) {
    const replicaId = input.replicaId as string;

    // Retrieve current clock for this replica, or initialize
    const existing = await storage.get('causal-clock', replicaId);
    let clock: number[];

    if (existing && Array.isArray(existing.clock)) {
      clock = (existing.clock as number[]).slice();
    } else {
      // Initialize clock based on known replicas
      const allReplicas = await storage.find('causal-clock-replica', {});
      const replicaEntry = allReplicas.find(r => r.replicaId === replicaId);
      let index: number;
      if (replicaEntry) {
        index = replicaEntry.index as number;
        clock = new Array(allReplicas.length).fill(0);
      } else {
        index = allReplicas.length;
        await storage.put('causal-clock-replica', replicaId, {
          replicaId,
          index,
        });
        clock = new Array(index + 1).fill(0);
      }
    }

    // Find the replica's index
    const allReplicas = await storage.find('causal-clock-replica', {});
    let replicaIndex = allReplicas.findIndex(r => r.replicaId === replicaId);
    if (replicaIndex === -1) {
      replicaIndex = allReplicas.length;
      await storage.put('causal-clock-replica', replicaId, {
        replicaId,
        index: replicaIndex,
      });
    }

    // Ensure clock is large enough
    while (clock.length <= replicaIndex) {
      clock.push(0);
    }

    // Increment this replica's position
    clock[replicaIndex]++;

    // Store updated clock
    await storage.put('causal-clock', replicaId, {
      replicaId,
      clock,
    });

    // Create event record
    const eventId = nextId();
    await storage.put('causal-clock-event', eventId, {
      id: eventId,
      replicaId,
      clock: clock.slice(),
    });

    return { variant: 'ok', timestamp: eventId, clock };
  },

  async merge(input: Record<string, unknown>, storage: ConceptStorage) {
    const localClock = input.localClock as number[];
    const remoteClock = input.remoteClock as number[];

    if (!Array.isArray(localClock) || !Array.isArray(remoteClock)) {
      return { variant: 'incompatible', message: 'Clocks must be arrays of integers' };
    }

    if (localClock.length !== remoteClock.length) {
      return { variant: 'incompatible', message: `Clock dimensions differ: local=${localClock.length}, remote=${remoteClock.length}` };
    }

    // Component-wise maximum
    const merged = localClock.map((val, i) => Math.max(val, remoteClock[i]));

    return { variant: 'ok', merged };
  },

  async compare(input: Record<string, unknown>, storage: ConceptStorage) {
    const a = input.a as string;
    const b = input.b as string;

    const eventA = await storage.get('causal-clock-event', a);
    if (!eventA) {
      return { variant: 'concurrent' };
    }

    const eventB = await storage.get('causal-clock-event', b);
    if (!eventB) {
      return { variant: 'concurrent' };
    }

    const clockA = eventA.clock as number[];
    const clockB = eventB.clock as number[];

    // Normalize lengths
    const maxLen = Math.max(clockA.length, clockB.length);
    const normA = [...clockA, ...new Array(maxLen - clockA.length).fill(0)];
    const normB = [...clockB, ...new Array(maxLen - clockB.length).fill(0)];

    let aLessOrEqual = true;
    let bLessOrEqual = true;
    let equal = true;

    for (let i = 0; i < maxLen; i++) {
      if (normA[i] > normB[i]) {
        bLessOrEqual = false;
        equal = false;
      }
      if (normB[i] > normA[i]) {
        aLessOrEqual = false;
        equal = false;
      }
    }

    if (equal) {
      return { variant: 'concurrent' };
    }

    if (aLessOrEqual) {
      return { variant: 'before' };
    }

    if (bLessOrEqual) {
      return { variant: 'after' };
    }

    return { variant: 'concurrent' };
  },

  async dominates(input: Record<string, unknown>, storage: ConceptStorage) {
    const a = input.a as string;
    const b = input.b as string;

    const eventA = await storage.get('causal-clock-event', a);
    if (!eventA) {
      return { variant: 'ok', result: false };
    }

    const eventB = await storage.get('causal-clock-event', b);
    if (!eventB) {
      return { variant: 'ok', result: false };
    }

    const clockA = eventA.clock as number[];
    const clockB = eventB.clock as number[];

    const maxLen = Math.max(clockA.length, clockB.length);
    const normA = [...clockA, ...new Array(maxLen - clockA.length).fill(0)];
    const normB = [...clockB, ...new Array(maxLen - clockB.length).fill(0)];

    // a dominates b: a[i] >= b[i] for all i, and a != b
    let allGreaterOrEqual = true;
    let strictlyGreater = false;

    for (let i = 0; i < maxLen; i++) {
      if (normA[i] < normB[i]) {
        allGreaterOrEqual = false;
        break;
      }
      if (normA[i] > normB[i]) {
        strictlyGreater = true;
      }
    }

    return { variant: 'ok', result: allGreaterOrEqual && strictlyGreater };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetCausalClockCounter(): void {
  idCounter = 0;
}
