// SyncPair — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncPairHandler } from './handler.js';
import type { SyncPairStorage } from './types.js';

const createTestStorage = (): SyncPairStorage => {
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

const createFailingStorage = (): SyncPairStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncPairHandler;

describe('SyncPair handler', () => {
  describe('link', () => {
    it('should link a new pair', async () => {
      const storage = createTestStorage();
      const result = await handler.link(
        { pairId: 'pair-1', idA: 'entity-a', idB: 'entity-b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should persist pair to storage', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      const stored = await storage.get('sync_pairs', 'pair-1');
      expect(stored).not.toBeNull();
      expect(stored?.idA).toBe('a');
      expect(stored?.idB).toBe('b');
    });

    it('should succeed when pair already exists', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      const result = await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.link({ pairId: 'p', idA: 'a', idB: 'b' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('sync', () => {
    it('should sync a pair successfully', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      const result = await handler.sync({ pairId: 'pair-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const changes = JSON.parse(result.right.changes);
          expect(changes.direction).toBe('bidirectional');
          expect(changes.syncCount).toBe(1);
        }
      }
    });

    it('should return notfound for unknown pair', async () => {
      const storage = createTestStorage();
      const result = await handler.sync({ pairId: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return conflict when unresolved conflicts exist', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      await storage.put('sync_conflicts', 'c1', {
        conflictId: 'c1',
        pairId: 'pair-1',
        field: 'name',
        valueA: 'Alice',
        valueB: 'Bob',
        resolved: false,
      });
      const result = await handler.sync({ pairId: 'pair-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflict');
      }
    });

    it('should increment sync count on repeated syncs', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      await handler.sync({ pairId: 'pair-1' }, storage)();
      await handler.sync({ pairId: 'pair-1' }, storage)();
      const stored = await storage.get('sync_pairs', 'pair-1');
      expect(stored?.syncCount).toBe(2);
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicts for a pair', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      await storage.put('sync_conflicts', 'c1', {
        conflictId: 'c1',
        pairId: 'pair-1',
        field: 'name',
        valueA: 'X',
        valueB: 'Y',
        resolved: false,
      });
      const result = await handler.detectConflicts({ pairId: 'pair-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const conflicts = JSON.parse(result.right.conflicts);
        expect(conflicts.length).toBe(1);
      }
    });

    it('should return notfound for unknown pair', async () => {
      const storage = createTestStorage();
      const result = await handler.detectConflicts({ pairId: 'unknown' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('resolve', () => {
    it('should resolve a conflict with a-wins strategy', async () => {
      const storage = createTestStorage();
      await storage.put('sync_conflicts', 'c1', {
        conflictId: 'c1',
        pairId: 'pair-1',
        field: 'name',
        valueA: 'X',
        valueB: 'Y',
        resolved: false,
      });
      const result = await handler.resolve(
        { conflictId: 'c1', resolution: 'a-wins' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.winner).toBe('A');
        }
      }
    });

    it('should resolve with b-wins strategy', async () => {
      const storage = createTestStorage();
      await storage.put('sync_conflicts', 'c1', {
        conflictId: 'c1',
        resolved: false,
      });
      const result = await handler.resolve(
        { conflictId: 'c1', resolution: 'b-wins' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.winner).toBe('B');
      }
    });

    it('should return error for invalid resolution strategy', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { conflictId: 'c1', resolution: 'invalid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return notfound for unknown conflict', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { conflictId: 'nonexistent', resolution: 'a-wins' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('unlink', () => {
    it('should unlink an existing pair', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      const result = await handler.unlink({ pairId: 'pair-1', idA: 'a' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const stored = await storage.get('sync_pairs', 'pair-1');
      expect(stored).toBeNull();
    });

    it('should return notfound for unknown pair', async () => {
      const storage = createTestStorage();
      const result = await handler.unlink({ pairId: 'unknown', idA: 'a' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getChangeLog', () => {
    it('should return changelog entries', async () => {
      const storage = createTestStorage();
      await handler.link({ pairId: 'pair-1', idA: 'a', idB: 'b' }, storage)();
      await handler.sync({ pairId: 'pair-1' }, storage)();
      const result = await handler.getChangeLog(
        { pairId: 'pair-1', since: '2000-01-01T00:00:00.000Z' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const log = JSON.parse(result.right.log);
          expect(log.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('should return notfound for unknown pair', async () => {
      const storage = createTestStorage();
      const result = await handler.getChangeLog(
        { pairId: 'nonexistent', since: '2000-01-01' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
