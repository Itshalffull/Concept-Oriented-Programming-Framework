// ============================================================
// Replica Handler
//
// Maintain an independent, locally-modifiable copy of shared state
// that synchronizes with peers. Sync may complete after arbitrarily
// long delay due to network partitions or offline operation.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `replica-${++idCounter}`;
}

/** Storage key for the singleton replica metadata record. */
const META_KEY = 'replica-meta';

export const replicaHandler: ConceptHandler = {
  async localUpdate(input: Record<string, unknown>, storage: ConceptStorage) {
    const op = input.op as string;

    if (!op || op.trim() === '') {
      return { variant: 'invalidOp', message: 'Operation payload is empty or malformed' };
    }

    // Retrieve current replica state
    let meta = await storage.get('replica', META_KEY);
    if (!meta) {
      // Bootstrap replica state on first use
      const replicaId = nextId();
      meta = {
        replicaId,
        localState: '',
        pendingOps: '[]',
        clock: 0,
      };
    }

    // Apply op to local state (append-style; real CRDT would merge)
    const currentState = (meta.localState as string) || '';
    const newState = currentState ? `${currentState},${op}` : op;

    // Add to pending ops queue
    const pendingOps: string[] = JSON.parse((meta.pendingOps as string) || '[]');
    pendingOps.push(op);

    // Increment logical clock
    const clock = ((meta.clock as number) || 0) + 1;

    await storage.put('replica', META_KEY, {
      ...meta,
      localState: newState,
      pendingOps: JSON.stringify(pendingOps),
      clock,
    });

    return { variant: 'ok', newState };
  },

  async receiveRemote(input: Record<string, unknown>, storage: ConceptStorage) {
    const op = input.op as string;
    const fromReplica = input.fromReplica as string;

    // Check that the sender is a known peer
    const peers = await storage.find('replica-peer', { peerId: fromReplica });
    if (peers.length === 0) {
      return { variant: 'unknownReplica', message: `Replica "${fromReplica}" is not a known peer` };
    }

    // Retrieve current replica state
    let meta = await storage.get('replica', META_KEY);
    if (!meta) {
      meta = {
        replicaId: nextId(),
        localState: '',
        pendingOps: '[]',
        clock: 0,
      };
    }

    // Simple conflict detection: if the remote op duplicates a pending local op,
    // flag a conflict. In production this would use vector clocks.
    const pendingOps: string[] = JSON.parse((meta.pendingOps as string) || '[]');
    if (pendingOps.includes(op)) {
      return {
        variant: 'conflict',
        details: JSON.stringify({
          localPending: pendingOps,
          remoteOp: op,
          fromReplica,
        }),
      };
    }

    // Integrate remote op into local state
    const currentState = (meta.localState as string) || '';
    const newState = currentState ? `${currentState},${op}` : op;
    const clock = ((meta.clock as number) || 0) + 1;

    // Track sync state for this peer
    await storage.put('replica-sync', fromReplica, {
      peerId: fromReplica,
      lastOp: op,
      lastSyncClock: clock,
    });

    await storage.put('replica', META_KEY, {
      ...meta,
      localState: newState,
      clock,
    });

    return { variant: 'ok', newState };
  },

  async sync(input: Record<string, unknown>, storage: ConceptStorage) {
    const peer = input.peer as string;

    // Check that the peer is known
    const peers = await storage.find('replica-peer', { peerId: peer });
    if (peers.length === 0) {
      return { variant: 'unreachable', message: `Peer "${peer}" is not reachable or not known` };
    }

    // In a real implementation this would send pending ops over the network.
    // Here we flush the pending ops queue, marking them as synced.
    const meta = await storage.get('replica', META_KEY);
    if (meta) {
      await storage.put('replica', META_KEY, {
        ...meta,
        pendingOps: '[]',
      });

      // Record sync state
      const clock = (meta.clock as number) || 0;
      await storage.put('replica-sync', peer, {
        peerId: peer,
        lastOp: null,
        lastSyncClock: clock,
      });
    }

    return { variant: 'ok' };
  },

  async getState(input: Record<string, unknown>, storage: ConceptStorage) {
    const meta = await storage.get('replica', META_KEY);
    if (!meta) {
      return { variant: 'ok', state: '', clock: JSON.stringify({ v: 0 }) };
    }

    const state = (meta.localState as string) || '';
    const clock = JSON.stringify({ v: (meta.clock as number) || 0 });

    return { variant: 'ok', state, clock };
  },

  async fork(input: Record<string, unknown>, storage: ConceptStorage) {
    // Create a new replica ID for offline branching
    const newReplicaId = nextId();

    // Copy current state into a new branch record
    const meta = await storage.get('replica', META_KEY);
    const state = meta ? (meta.localState as string) || '' : '';
    const clock = meta ? ((meta.clock as number) || 0) : 0;

    await storage.put('replica-fork', newReplicaId, {
      replicaId: newReplicaId,
      forkedFrom: meta ? (meta.replicaId as string) : null,
      localState: state,
      clock,
      pendingOps: '[]',
    });

    return { variant: 'ok', newReplicaId };
  },

  async addPeer(input: Record<string, unknown>, storage: ConceptStorage) {
    const peerId = input.peerId as string;

    // Check if peer already exists
    const existing = await storage.find('replica-peer', { peerId });
    if (existing.length > 0) {
      return { variant: 'alreadyKnown', message: `Peer "${peerId}" is already in the peer set` };
    }

    const id = nextId();
    await storage.put('replica-peer', id, {
      id,
      peerId,
    });

    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetReplicaCounter(): void {
  idCounter = 0;
}
