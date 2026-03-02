// GcfRuntime — handler.test.ts
// Unit tests for gcfRuntime handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { gcfRuntimeHandler } from './handler.js';
import type { GcfRuntimeStorage } from './types.js';

const createTestStorage = (): GcfRuntimeStorage => {
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

const createFailingStorage = (): GcfRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const provisionFunction = async (storage: GcfRuntimeStorage, concept = 'auth', region = 'us-central1') => {
  return gcfRuntimeHandler.provision(
    { concept, projectId: 'my-project', region, runtime: 'nodejs18-gen2', triggerType: 'http' },
    storage,
  )();
};

describe('GcfRuntime handler', () => {
  describe('provision', () => {
    it('should provision a new function', async () => {
      const storage = createTestStorage();
      const result = await provisionFunction(storage);
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.endpoint).toContain('cloudfunctions.net');
        }
      }
    });

    it('should return gen2Required for eventarc trigger without gen2', async () => {
      const storage = createTestStorage();
      const result = await gcfRuntimeHandler.provision(
        { concept: 'events', projectId: 'proj', region: 'us-central1', runtime: 'nodejs18', triggerType: 'eventarc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('gen2Required');
      }
    });

    it('should return triggerConflict for duplicate trigger in same region', async () => {
      const storage = createTestStorage();
      await provisionFunction(storage, 'auth', 'us-central1');
      const result = await gcfRuntimeHandler.provision(
        { concept: 'other', projectId: 'proj', region: 'us-central1', runtime: 'nodejs18-gen2', triggerType: 'http' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('triggerConflict');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gcfRuntimeHandler.provision(
        { concept: 'c', projectId: 'p', region: 'r', runtime: 'rt', triggerType: 'http' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy source to a provisioned function', async () => {
      const storage = createTestStorage();
      const provResult = await provisionFunction(storage);
      if (E.isRight(provResult) && provResult.right.variant === 'ok') {
        const result = await gcfRuntimeHandler.deploy(
          { function: provResult.right.function, sourceArchive: 'gs://bucket/source.zip' },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.version).toBe('v1');
          }
        }
      }
    });

    it('should return buildFailed for empty source archive', async () => {
      const storage = createTestStorage();
      const provResult = await provisionFunction(storage);
      if (E.isRight(provResult) && provResult.right.variant === 'ok') {
        const result = await gcfRuntimeHandler.deploy(
          { function: provResult.right.function, sourceArchive: '' },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('buildFailed');
        }
      }
    });

    it('should return left for unknown function', async () => {
      const storage = createTestStorage();
      const result = await gcfRuntimeHandler.deploy(
        { function: 'nonexistent', sourceArchive: 'archive.zip' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gcfRuntimeHandler.deploy(
        { function: 'f', sourceArchive: 'a.zip' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should set traffic weight on a provisioned function', async () => {
      const storage = createTestStorage();
      const provResult = await provisionFunction(storage);
      if (E.isRight(provResult) && provResult.right.variant === 'ok') {
        const result = await gcfRuntimeHandler.setTrafficWeight(
          { function: provResult.right.function, weight: 50 },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return left for unknown function', async () => {
      const storage = createTestStorage();
      const result = await gcfRuntimeHandler.setTrafficWeight(
        { function: 'nonexistent', weight: 50 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gcfRuntimeHandler.setTrafficWeight(
        { function: 'f', weight: 50 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback to a specific version', async () => {
      const storage = createTestStorage();
      const provResult = await provisionFunction(storage);
      if (E.isRight(provResult) && provResult.right.variant === 'ok') {
        const fn = provResult.right.function;
        await gcfRuntimeHandler.deploy({ function: fn, sourceArchive: 'v1.zip' }, storage)();
        await gcfRuntimeHandler.deploy({ function: fn, sourceArchive: 'v2.zip' }, storage)();
        const result = await gcfRuntimeHandler.rollback(
          { function: fn, targetVersion: 'v1' },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          expect(result.right.restoredVersion).toBe('v1');
        }
      }
    });

    it('should return left for unknown version', async () => {
      const storage = createTestStorage();
      const result = await gcfRuntimeHandler.rollback(
        { function: 'fn', targetVersion: 'v999' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gcfRuntimeHandler.rollback(
        { function: 'f', targetVersion: 'v1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy a provisioned function', async () => {
      const storage = createTestStorage();
      const provResult = await provisionFunction(storage);
      if (E.isRight(provResult) && provResult.right.variant === 'ok') {
        const result = await gcfRuntimeHandler.destroy(
          { function: provResult.right.function },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return left for unknown function', async () => {
      const storage = createTestStorage();
      const result = await gcfRuntimeHandler.destroy(
        { function: 'nonexistent' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await gcfRuntimeHandler.destroy(
        { function: 'f' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
