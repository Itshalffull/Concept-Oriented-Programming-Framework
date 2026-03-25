// @clef-handler style=functional
// ============================================================
// Replica Handler
//
// Maintain an independent, locally-modifiable copy of shared state
// that synchronizes with peers. Sync may complete after arbitrarily
// long delay due to network partitions or offline operation.
//
// getState/fork/addPeer are functional.
// localUpdate/receiveRemote/sync use imperative overrides because
// they need JSON.parse on stored values and conditional multi-puts
// that depend on runtime data.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `replica-${++idCounter}`;
}

const META_KEY = 'replica-meta';

const _handler: FunctionalConceptHandler = {
  // localUpdate uses imperative override — JSON.parse + dynamic pending ops
  localUpdate(input: Record<string, unknown>): StorageProgram<Result> {
    const op = input.op as string;

    if (!op || (typeof op === 'string' && op.trim() === '')) {
      return complete(createProgram(), 'invalidOp', {
        message: 'Operation payload is empty or malformed',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'replica', META_KEY, 'meta');
    return completeFrom(p, 'ok', (b) => {
      const meta = b.meta as Record<string, unknown> | null;
      const currentState = meta ? ((meta.localState as string) || '') : '';
      const newState = currentState ? `${currentState},${op}` : op;
      return { newState, output: { newState } };
    }) as StorageProgram<Result>;
  },

  // receiveRemote uses imperative override — peer lookup + JSON.parse
  receiveRemote(input: Record<string, unknown>): StorageProgram<Result> {
    const fromReplica = input.fromReplica as string;
    let p = createProgram();
    p = find(p, 'replica-peer', { peerId: fromReplica }, 'peers');
    p = get(p, 'replica', META_KEY, 'meta');
    return branch(p,
      (b) => {
        const peers = b.peers as unknown[];
        const meta = b.meta as Record<string, unknown> | null;
        const localState = meta ? (meta.localState as string) : null;
        return peers.length === 0 && !(localState && localState === fromReplica);
      },
      (unknownP) => complete(unknownP, 'unknownReplica', {
        message: `Replica "${fromReplica}" is not a known peer`,
      }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const meta = b.meta as Record<string, unknown> | null;
        const currentState = meta ? ((meta.localState as string) || '') : '';
        const op = input.op as string;
        const newState = currentState ? `${currentState},${op}` : op;
        return { newState };
      }),
    ) as StorageProgram<Result>;
  },

  // sync uses imperative override — needs to flush pending ops and multi-put
  sync(input: Record<string, unknown>): StorageProgram<Result> {
    const peer = input.peer as string;
    let p = createProgram();
    p = find(p, 'replica-peer', { peerId: peer }, 'peerRecords');
    p = get(p, 'replica', META_KEY, 'meta');
    return branch(p,
      (b) => {
        const peerRecords = b.peerRecords as unknown[];
        const meta = b.meta as Record<string, unknown> | null;
        const localState = meta ? (meta.localState as string) : null;
        return peerRecords.length === 0 && !(localState && localState === peer);
      },
      (unreachableP) => complete(unreachableP, 'unreachable', {
        message: `Peer "${peer}" is not reachable or not known`,
      }),
      (okP) => complete(okP, 'ok', {}),
    ) as StorageProgram<Result>;
  },

  getState(_input: Record<string, unknown>): StorageProgram<Result> {
    let p = createProgram();
    p = get(p, 'replica', META_KEY, 'meta');
    return branch(p,
      (b) => b.meta == null,
      (emptyP) => complete(emptyP, 'ok', { state: '', clock: JSON.stringify({ v: 0 }) }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const meta = b.meta as Record<string, unknown>;
        const state = (meta.localState as string) || '';
        const clock = JSON.stringify({ v: (meta.clock as number) || 0 });
        return { state, clock };
      }),
    ) as StorageProgram<Result>;
  },

  fork(_input: Record<string, unknown>): StorageProgram<Result> {
    const newReplicaId = nextId();

    let p = createProgram();
    p = get(p, 'replica', META_KEY, 'meta');

    p = putFrom(p, 'replica-fork', newReplicaId, (b) => {
      const meta = b.meta as Record<string, unknown> | null;
      const state = meta ? ((meta.localState as string) || '') : '';
      const clock = meta ? ((meta.clock as number) || 0) : 0;
      return {
        replicaId: newReplicaId,
        forkedFrom: meta ? (meta.replicaId as string) : null,
        localState: state,
        clock,
        pendingOps: '[]',
      };
    });

    return complete(p, 'ok', { newReplicaId }) as StorageProgram<Result>;
  },

  addPeer(input: Record<string, unknown>): StorageProgram<Result> {
    if (!input.peerId || (typeof input.peerId === 'string' && (input.peerId as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'peerId is required' }) as StorageProgram<Result>;
    }
    const peerId = input.peerId as string;

    const id = nextId();
    let p = createProgram();
    p = find(p, 'replica-peer', { peerId }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (dupP) => complete(dupP, 'alreadyKnown', {
        message: `Peer "${peerId}" is already in the peer set`,
      }),
      (newP) => {
        const p2 = put(newP, 'replica-peer', id, { id, peerId });
        return complete(p2, 'ok', { output: {} });
      },
    ) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

export const replicaHandler: typeof _base & {
  localUpdate(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  receiveRemote(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  sync(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
} = Object.assign(Object.create(Object.getPrototypeOf(_base)), _base, {
  async localUpdate(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const op = input.op as string;

    if (!op || op.trim() === '') {
      return { variant: 'invalidOp', message: 'Operation payload is empty or malformed' };
    }

    let meta = await storage.get('replica', META_KEY);
    if (!meta) {
      const replicaId = nextId();
      meta = { replicaId, localState: '', pendingOps: '[]', clock: 0 };
    }

    const currentState = (meta.localState as string) || '';
    const newState = currentState ? `${currentState},${op}` : op;

    const pendingOps: string[] = JSON.parse((meta.pendingOps as string) || '[]');
    pendingOps.push(op);
    const clock = ((meta.clock as number) || 0) + 1;

    await storage.put('replica', META_KEY, {
      ...meta,
      localState: newState,
      pendingOps: JSON.stringify(pendingOps),
      clock,
    });

    return { variant: 'ok', newState, output: { newState } };
  },

  async receiveRemote(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const op = input.op as string;
    const fromReplica = input.fromReplica as string;

    const peers = await storage.find('replica-peer', { peerId: fromReplica });
    if (peers.length === 0) {
      const meta = await storage.get('replica', META_KEY);
      const localState = meta ? (meta.localState as string) : null;
      const isLocalRef = localState && localState === fromReplica;
      if (!isLocalRef) {
        return { variant: 'unknownReplica', message: `Replica "${fromReplica}" is not a known peer` };
      }
    }

    let meta = await storage.get('replica', META_KEY);
    if (!meta) {
      meta = { replicaId: nextId(), localState: '', pendingOps: '[]', clock: 0 };
    }

    const pendingOps: string[] = JSON.parse((meta.pendingOps as string) || '[]');
    if (pendingOps.includes(op)) {
      return {
        variant: 'conflict',
        details: JSON.stringify({ localPending: pendingOps, remoteOp: op, fromReplica }),
      };
    }

    const currentState = (meta.localState as string) || '';
    const newState = currentState ? `${currentState},${op}` : op;
    const clock = ((meta.clock as number) || 0) + 1;

    await storage.put('replica-sync', fromReplica, {
      peerId: fromReplica, lastOp: op, lastSyncClock: clock,
    });

    await storage.put('replica', META_KEY, { ...meta, localState: newState, clock });

    return { variant: 'ok', newState };
  },

  async sync(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const peer = input.peer as string;

    const peerRecords = await storage.find('replica-peer', { peerId: peer });
    if (peerRecords.length === 0) {
      const meta = await storage.get('replica', META_KEY);
      const localState = meta ? (meta.localState as string) : null;
      const isLocalRef = localState && localState === peer;
      if (!isLocalRef) {
        return { variant: 'unreachable', message: `Peer "${peer}" is not reachable or not known` };
      }
    }

    const meta = await storage.get('replica', META_KEY);
    if (meta) {
      await storage.put('replica', META_KEY, { ...meta, pendingOps: '[]' });
      const clock = (meta.clock as number) || 0;
      await storage.put('replica-sync', peer, { peerId: peer, lastOp: null, lastSyncClock: clock });
    }

    return { variant: 'ok' };
  },
});

/** Reset the ID counter. Useful for testing. */
export function resetReplicaCounter(): void {
  idCounter = 0;
}
