// BuildCache — handler.test.ts
// Unit tests for buildCache handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { buildCacheHandler } from './handler.js';
import type { BuildCacheStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): BuildCacheStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): BuildCacheStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('BuildCache handler', () => {
  describe('check', () => {
    it('should return changed when no cache entry exists', async () => {
      const storage = createTestStorage();

      const result = await buildCacheHandler.check(
        { stepKey: 'step-1', inputHash: 'abc123', deterministic: true },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('changed');
      }
    });

    it('should return unchanged when hash matches and deterministic', async () => {
      const storage = createTestStorage();
      await storage.put('cache_entry', 'step-1', {
        stepKey: 'step-1',
        inputHash: 'abc123',
        outputRef: 'ref-1',
        lastRun: new Date().toISOString(),
        deterministic: true,
      });

      const result = await buildCacheHandler.check(
        { stepKey: 'step-1', inputHash: 'abc123', deterministic: true },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unchanged');
      }
    });

    it('should return changed when hash differs', async () => {
      const storage = createTestStorage();
      await storage.put('cache_entry', 'step-1', {
        stepKey: 'step-1',
        inputHash: 'old-hash',
        lastRun: new Date().toISOString(),
        deterministic: true,
      });

      const result = await buildCacheHandler.check(
        { stepKey: 'step-1', inputHash: 'new-hash', deterministic: true },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('changed');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.check(
        { stepKey: 'step-1', inputHash: 'abc123', deterministic: true },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('record', () => {
    it('should return ok after recording a cache entry', async () => {
      const storage = createTestStorage();

      const result = await buildCacheHandler.record(
        {
          stepKey: 'step-1',
          inputHash: 'abc123',
          outputHash: 'def456',
          outputRef: O.some('ref-1'),
          sourceLocator: O.some('src/main.ts'),
          deterministic: true,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.entry).toBe('step-1');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.record(
        {
          stepKey: 'step-1',
          inputHash: 'abc123',
          outputHash: 'def456',
          outputRef: O.none,
          sourceLocator: O.none,
          deterministic: true,
        },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should return ok when entry exists', async () => {
      const storage = createTestStorage();
      await storage.put('cache_entry', 'step-1', { stepKey: 'step-1' });

      const result = await buildCacheHandler.invalidate(
        { stepKey: 'step-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound when entry does not exist', async () => {
      const storage = createTestStorage();

      const result = await buildCacheHandler.invalidate(
        { stepKey: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.invalidate(
        { stepKey: 'step-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invalidateBySource', () => {
    it('should return ok with invalidated step keys', async () => {
      const storage = createTestStorage();
      await storage.put('cache_entry', 'step-1', {
        stepKey: 'step-1',
        sourceLocator: 'src/main.ts',
      });

      const result = await buildCacheHandler.invalidateBySource(
        { sourceLocator: 'src/main.ts' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.invalidateBySource(
        { sourceLocator: 'src/main.ts' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invalidateByKind', () => {
    it('should return ok with invalidated step keys', async () => {
      const storage = createTestStorage();

      const result = await buildCacheHandler.invalidateByKind(
        { kindName: 'test-kind' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.invalidateByKind(
        { kindName: 'test-kind' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('invalidateAll', () => {
    it('should return ok with count of cleared entries', async () => {
      const storage = createTestStorage();
      await storage.put('cache_entry', 'step-1', { stepKey: 'step-1' });
      await storage.put('cache_entry', 'step-2', { stepKey: 'step-2' });

      const result = await buildCacheHandler.invalidateAll({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.cleared).toBe(2);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.invalidateAll({}, storage)();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('status', () => {
    it('should return ok with entry list', async () => {
      const storage = createTestStorage();
      await storage.put('cache_entry', 'step-1', {
        stepKey: 'step-1',
        inputHash: 'abc',
        lastRun: new Date().toISOString(),
        stale: false,
        deterministic: true,
      });

      const result = await buildCacheHandler.status({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.entries.length).toBe(1);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.status({}, storage)();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('staleSteps', () => {
    it('should return ok with stale step keys', async () => {
      const storage = createTestStorage();
      await storage.put('cache_entry', 'step-1', {
        stepKey: 'step-1',
        stale: true,
        deterministic: true,
      });
      await storage.put('cache_entry', 'step-2', {
        stepKey: 'step-2',
        stale: false,
        deterministic: true,
      });

      const result = await buildCacheHandler.staleSteps({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.steps).toContain('step-1');
        expect(result.right.steps).not.toContain('step-2');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await buildCacheHandler.staleSteps({}, storage)();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
