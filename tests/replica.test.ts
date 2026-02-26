// ============================================================
// Replica Concept Handler Tests
//
// Validates localUpdate, receiveRemote, sync, getState, fork,
// and addPeer actions for the collaboration kit's replica concept.
// Covers local state management, remote op integration, conflict
// detection, peer management, and fork/branch workflows.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  replicaHandler,
  resetReplicaCounter,
} from '../implementations/typescript/replica.impl.js';

describe('Replica', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetReplicaCounter();
  });

  // ---- localUpdate ----

  describe('localUpdate', () => {
    it('applies a local operation and returns new state', async () => {
      const result = await replicaHandler.localUpdate({ op: 'add:x' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.newState).toBe('add:x');
    });

    it('appends subsequent ops with comma separator', async () => {
      await replicaHandler.localUpdate({ op: 'add:x' }, storage);
      const result = await replicaHandler.localUpdate({ op: 'add:y' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.newState).toBe('add:x,add:y');
    });

    it('increments logical clock with each update', async () => {
      await replicaHandler.localUpdate({ op: 'op1' }, storage);
      await replicaHandler.localUpdate({ op: 'op2' }, storage);
      const state = await replicaHandler.getState({}, storage);
      const clock = JSON.parse(state.clock as string);
      expect(clock.v).toBe(2);
    });

    it('queues operations as pending', async () => {
      await replicaHandler.localUpdate({ op: 'op1' }, storage);
      await replicaHandler.localUpdate({ op: 'op2' }, storage);

      const meta = await storage.get('replica', 'replica-meta');
      const pendingOps = JSON.parse(meta!.pendingOps as string);
      expect(pendingOps).toEqual(['op1', 'op2']);
    });

    it('returns invalidOp for empty operation', async () => {
      const result = await replicaHandler.localUpdate({ op: '' }, storage);
      expect(result.variant).toBe('invalidOp');
      expect(result.message).toContain('empty');
    });

    it('returns invalidOp for whitespace-only operation', async () => {
      const result = await replicaHandler.localUpdate({ op: '   ' }, storage);
      expect(result.variant).toBe('invalidOp');
    });

    it('bootstraps replica state on first use', async () => {
      await replicaHandler.localUpdate({ op: 'first' }, storage);
      const meta = await storage.get('replica', 'replica-meta');
      expect(meta).not.toBeNull();
      expect(meta!.replicaId).toBeDefined();
    });
  });

  // ---- receiveRemote ----

  describe('receiveRemote', () => {
    it('integrates a remote op from a known peer', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      const result = await replicaHandler.receiveRemote(
        { op: 'remote-op', fromReplica: 'peer-A' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.newState).toBe('remote-op');
    });

    it('appends remote op to existing local state', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      await replicaHandler.localUpdate({ op: 'local-op' }, storage);
      const result = await replicaHandler.receiveRemote(
        { op: 'remote-op', fromReplica: 'peer-A' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.newState).toBe('local-op,remote-op');
    });

    it('returns unknownReplica when sender is not a known peer', async () => {
      const result = await replicaHandler.receiveRemote(
        { op: 'op', fromReplica: 'stranger' },
        storage,
      );
      expect(result.variant).toBe('unknownReplica');
      expect(result.message).toContain('stranger');
    });

    it('detects conflict when remote op duplicates a pending local op', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      // Create a local op that's still pending
      await replicaHandler.localUpdate({ op: 'shared-op' }, storage);

      const result = await replicaHandler.receiveRemote(
        { op: 'shared-op', fromReplica: 'peer-A' },
        storage,
      );
      expect(result.variant).toBe('conflict');
      const details = JSON.parse(result.details as string);
      expect(details.localPending).toContain('shared-op');
      expect(details.remoteOp).toBe('shared-op');
      expect(details.fromReplica).toBe('peer-A');
    });

    it('does not conflict when remote op differs from pending ops', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      await replicaHandler.localUpdate({ op: 'local-only' }, storage);

      const result = await replicaHandler.receiveRemote(
        { op: 'remote-only', fromReplica: 'peer-A' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('tracks sync state for the peer', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      await replicaHandler.receiveRemote(
        { op: 'op1', fromReplica: 'peer-A' },
        storage,
      );

      const syncState = await storage.get('replica-sync', 'peer-A');
      expect(syncState).not.toBeNull();
      expect(syncState!.peerId).toBe('peer-A');
      expect(syncState!.lastOp).toBe('op1');
    });
  });

  // ---- sync ----

  describe('sync', () => {
    it('flushes pending ops when syncing with a known peer', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      await replicaHandler.localUpdate({ op: 'op1' }, storage);
      await replicaHandler.localUpdate({ op: 'op2' }, storage);

      const result = await replicaHandler.sync({ peer: 'peer-A' }, storage);
      expect(result.variant).toBe('ok');

      // Pending ops should be cleared
      const meta = await storage.get('replica', 'replica-meta');
      const pendingOps = JSON.parse(meta!.pendingOps as string);
      expect(pendingOps).toEqual([]);
    });

    it('returns unreachable for unknown peer', async () => {
      const result = await replicaHandler.sync({ peer: 'unknown' }, storage);
      expect(result.variant).toBe('unreachable');
      expect(result.message).toContain('unknown');
    });

    it('records sync state for the peer after sync', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      await replicaHandler.localUpdate({ op: 'op1' }, storage);
      await replicaHandler.sync({ peer: 'peer-A' }, storage);

      const syncState = await storage.get('replica-sync', 'peer-A');
      expect(syncState).not.toBeNull();
      expect(syncState!.lastSyncClock).toBeDefined();
    });

    it('succeeds even when no local state exists yet', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      const result = await replicaHandler.sync({ peer: 'peer-A' }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  // ---- getState ----

  describe('getState', () => {
    it('returns empty state when replica is uninitialized', async () => {
      const result = await replicaHandler.getState({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.state).toBe('');
      const clock = JSON.parse(result.clock as string);
      expect(clock.v).toBe(0);
    });

    it('returns current state and clock after local updates', async () => {
      await replicaHandler.localUpdate({ op: 'a' }, storage);
      await replicaHandler.localUpdate({ op: 'b' }, storage);

      const result = await replicaHandler.getState({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.state).toBe('a,b');
      const clock = JSON.parse(result.clock as string);
      expect(clock.v).toBe(2);
    });

    it('reflects both local and remote ops in state', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      await replicaHandler.localUpdate({ op: 'local' }, storage);
      await replicaHandler.receiveRemote({ op: 'remote', fromReplica: 'peer-A' }, storage);

      const result = await replicaHandler.getState({}, storage);
      expect(result.state).toBe('local,remote');
    });
  });

  // ---- fork ----

  describe('fork', () => {
    it('creates a new replica ID for offline branching', async () => {
      const result = await replicaHandler.fork({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.newReplicaId).toBeDefined();
    });

    it('copies current state into the fork record', async () => {
      await replicaHandler.localUpdate({ op: 'x' }, storage);
      await replicaHandler.localUpdate({ op: 'y' }, storage);

      const result = await replicaHandler.fork({}, storage);
      const forkRecord = await storage.get('replica-fork', result.newReplicaId as string);
      expect(forkRecord).not.toBeNull();
      expect(forkRecord!.localState).toBe('x,y');
      expect(forkRecord!.clock).toBe(2);
      expect(forkRecord!.pendingOps).toBe('[]');
    });

    it('records the forked-from replica ID', async () => {
      await replicaHandler.localUpdate({ op: 'init' }, storage);
      const meta = await storage.get('replica', 'replica-meta');
      const originalId = meta!.replicaId;

      const result = await replicaHandler.fork({}, storage);
      const forkRecord = await storage.get('replica-fork', result.newReplicaId as string);
      expect(forkRecord!.forkedFrom).toBe(originalId);
    });

    it('forks from empty state when no ops have been applied', async () => {
      const result = await replicaHandler.fork({}, storage);
      const forkRecord = await storage.get('replica-fork', result.newReplicaId as string);
      expect(forkRecord!.localState).toBe('');
      expect(forkRecord!.clock).toBe(0);
      expect(forkRecord!.forkedFrom).toBeNull();
    });

    it('generates unique IDs for multiple forks', async () => {
      const f1 = await replicaHandler.fork({}, storage);
      const f2 = await replicaHandler.fork({}, storage);
      expect(f1.newReplicaId).not.toBe(f2.newReplicaId);
    });
  });

  // ---- addPeer ----

  describe('addPeer', () => {
    it('adds a new peer to the peer set', async () => {
      const result = await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      expect(result.variant).toBe('ok');
    });

    it('returns alreadyKnown for a duplicate peer', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      const result = await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      expect(result.variant).toBe('alreadyKnown');
      expect(result.message).toContain('peer-A');
    });

    it('allows adding multiple distinct peers', async () => {
      const r1 = await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);
      const r2 = await replicaHandler.addPeer({ peerId: 'peer-B' }, storage);
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
    });
  });

  // ---- Multi-step sequences ----

  describe('full replication workflow', () => {
    it('local update -> add peer -> sync -> state reflects all ops', async () => {
      // Local updates
      await replicaHandler.localUpdate({ op: 'create:doc' }, storage);
      await replicaHandler.localUpdate({ op: 'edit:title' }, storage);

      // Add a peer
      await replicaHandler.addPeer({ peerId: 'server' }, storage);

      // Sync flushes pending
      await replicaHandler.sync({ peer: 'server' }, storage);

      // Receive remote update from server
      await replicaHandler.receiveRemote(
        { op: 'edit:body', fromReplica: 'server' },
        storage,
      );

      // Check final state
      const state = await replicaHandler.getState({}, storage);
      expect(state.state).toBe('create:doc,edit:title,edit:body');
      const clock = JSON.parse(state.clock as string);
      expect(clock.v).toBe(3);
    });

    it('conflict detected after sync does not corrupt state', async () => {
      await replicaHandler.addPeer({ peerId: 'peer-A' }, storage);

      // Local edit
      await replicaHandler.localUpdate({ op: 'set:x=1' }, storage);

      // Remote sends same op (conflict)
      const conflict = await replicaHandler.receiveRemote(
        { op: 'set:x=1', fromReplica: 'peer-A' },
        storage,
      );
      expect(conflict.variant).toBe('conflict');

      // State should still reflect only the local op (remote was rejected)
      const state = await replicaHandler.getState({}, storage);
      expect(state.state).toBe('set:x=1');
    });

    it('fork creates independent state that does not affect main replica', async () => {
      await replicaHandler.localUpdate({ op: 'a' }, storage);
      const fork = await replicaHandler.fork({}, storage);

      // Continue local updates on main replica
      await replicaHandler.localUpdate({ op: 'b' }, storage);

      // Main state has both ops
      const mainState = await replicaHandler.getState({}, storage);
      expect(mainState.state).toBe('a,b');

      // Fork record still has only the state at fork time
      const forkRecord = await storage.get('replica-fork', fork.newReplicaId as string);
      expect(forkRecord!.localState).toBe('a');
    });
  });
});
