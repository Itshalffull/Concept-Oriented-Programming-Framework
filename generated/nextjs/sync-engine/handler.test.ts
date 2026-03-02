// SyncEngine — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncEngineHandler } from './handler.js';
import type { SyncEngineStorage } from './types.js';

const createTestStorage = (): SyncEngineStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): SyncEngineStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncEngineHandler;

const syncRule = {
  syncId: 'sync-1',
  syncName: 'user-to-profile',
  trigger: {
    conceptUri: 'clef://user',
    action: 'create',
    variant: 'ok',
  },
  effects: [
    {
      conceptUri: 'clef://profile',
      action: 'create',
      bindings: { name: '$trigger.name', email: '$trigger.email' },
    },
  ],
  guards: [],
};

describe('SyncEngine handler', () => {
  describe('registerSync', () => {
    it('should register a sync rule', async () => {
      const storage = createTestStorage();
      const result = await handler.registerSync(
        { sync: syncRule },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should persist sync rule to storage', async () => {
      const storage = createTestStorage();
      await handler.registerSync({ sync: syncRule }, storage)();
      const stored = await storage.get('registered_syncs', 'sync-1');
      expect(stored).not.toBeNull();
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerSync({ sync: syncRule }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('onCompletion', () => {
    it('should match completion against registered triggers', async () => {
      const storage = createTestStorage();
      await handler.registerSync({ sync: syncRule }, storage)();
      const result = await handler.onCompletion(
        {
          completion: {
            conceptUri: 'clef://user',
            action: 'create',
            variant: 'ok',
            output: { name: 'Alice', email: 'alice@test.com' },
          },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.invocations.length).toBe(1);
        const inv = result.right.invocations[0] as Record<string, unknown>;
        expect(inv.conceptUri).toBe('clef://profile');
        expect(inv.action).toBe('create');
      }
    });

    it('should resolve bindings from trigger output', async () => {
      const storage = createTestStorage();
      await handler.registerSync({ sync: syncRule }, storage)();
      const result = await handler.onCompletion(
        {
          completion: {
            conceptUri: 'clef://user',
            action: 'create',
            variant: 'ok',
            output: { name: 'Bob' },
          },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.invocations.length === 1) {
        const inv = result.right.invocations[0] as Record<string, unknown>;
        const bindings = inv.bindings as Record<string, unknown>;
        expect(bindings.name).toBe('Bob');
      }
    });

    it('should return empty invocations when no rules match', async () => {
      const storage = createTestStorage();
      await handler.registerSync({ sync: syncRule }, storage)();
      const result = await handler.onCompletion(
        {
          completion: {
            conceptUri: 'clef://other',
            action: 'delete',
            variant: 'ok',
            output: {},
          },
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.invocations.length).toBe(0);
      }
    });
  });

  describe('evaluateWhere', () => {
    it('should evaluate passing guard conditions', async () => {
      const storage = createTestStorage();
      const result = await handler.evaluateWhere(
        {
          bindings: { status: 'active', count: 5 },
          queries: [
            { field: 'status', operator: '==', value: 'active' },
            { field: 'count', operator: '>', value: 3 },
          ],
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error when guard condition fails', async () => {
      const storage = createTestStorage();
      const result = await handler.evaluateWhere(
        {
          bindings: { status: 'inactive' },
          queries: [
            { field: 'status', operator: '==', value: 'active' },
          ],
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should support contains operator', async () => {
      const storage = createTestStorage();
      const result = await handler.evaluateWhere(
        {
          bindings: { email: 'alice@test.com' },
          queries: [{ field: 'email', operator: 'contains', value: '@test' }],
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('queueSync', () => {
    it('should queue a pending sync invocation', async () => {
      const storage = createTestStorage();
      const result = await handler.queueSync(
        { sync: syncRule, bindings: { name: 'test' }, flow: 'flow-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.pendingId).toContain('pending-');
      }
    });
  });

  describe('onAvailabilityChange', () => {
    it('should drain pending syncs when concept becomes available', async () => {
      const storage = createTestStorage();
      await storage.put('pending_syncs', 'p1', {
        pendingId: 'p1',
        sync: syncRule,
        bindings: {},
        flow: 'flow-1',
        status: 'pending',
      });
      const result = await handler.onAvailabilityChange(
        { conceptUri: 'clef://profile', available: true },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.drained.length).toBe(1);
      }
    });

    it('should not drain when concept becomes unavailable', async () => {
      const storage = createTestStorage();
      const result = await handler.onAvailabilityChange(
        { conceptUri: 'clef://profile', available: false },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.drained.length).toBe(0);
      }
    });
  });

  describe('drainConflicts', () => {
    it('should return unresolved conflicts', async () => {
      const storage = createTestStorage();
      await storage.put('sync_conflicts', 'c1', {
        conflictId: 'c1',
        syncId: 'sync-1',
        conceptUri: 'clef://profile',
        field: 'name',
        valueA: 'Alice',
        valueB: 'Bob',
        resolved: false,
        detectedAt: new Date().toISOString(),
      });
      const result = await handler.drainConflicts({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.conflicts.length).toBe(1);
      }
    });

    it('should return empty when no conflicts', async () => {
      const storage = createTestStorage();
      const result = await handler.drainConflicts({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.conflicts.length).toBe(0);
      }
    });
  });
});
