// Health — handler.test.ts
// Unit tests for health handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { healthHandler } from './handler.js';
import type { HealthStorage } from './types.js';

const createTestStorage = (): HealthStorage => {
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

const createFailingStorage = (): HealthStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Health handler', () => {
  describe('checkConcept', () => {
    it('should return ok for a healthy concept probe', async () => {
      const storage = createTestStorage();
      const input = { concept: 'user', runtime: 'nextjs' };

      const result = await healthHandler.checkConcept(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.check).toContain('user');
          expect(typeof result.right.latencyMs).toBe('number');
        }
      }
    });

    it('should detect storageFailed when storage probe throws non-connection error', async () => {
      const storage = createTestStorage();
      // Override only the get to throw a generic error on probes
      const failingGet: HealthStorage = {
        ...storage,
        get: async (relation, key) => {
          if (relation === 'health_probes') throw new Error('disk full');
          return storage.get(relation, key);
        },
      };
      const input = { concept: 'broken', runtime: 'node' };

      const result = await healthHandler.checkConcept(input, failingGet)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('storageFailed');
      }
    });

    it('should detect unreachable when probe throws connection error', async () => {
      const storage = createTestStorage();
      const connFailStorage: HealthStorage = {
        ...storage,
        get: async (relation, key) => {
          if (relation === 'health_probes') throw new Error('ECONNREFUSED');
          return storage.get(relation, key);
        },
      };
      const input = { concept: 'remote', runtime: 'grpc' };

      const result = await healthHandler.checkConcept(input, connFailStorage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unreachable');
      }
    });

    it('should return Right with storageFailed when all storage methods throw', async () => {
      const storage = createFailingStorage();
      // The handler catches the storage.get error in its internal try/catch
      // and returns checkConceptStorageFailed (a Right variant), not a Left.
      const result = await healthHandler.checkConcept({ concept: 'x', runtime: 'y' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('storageFailed');
      }
    });
  });

  describe('checkSync', () => {
    it('should return ok when all sync concepts are healthy', async () => {
      const storage = createTestStorage();
      const input = { sync: 'user-sync', concepts: ['user', 'profile'] };

      const result = await healthHandler.checkSync(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should report partialFailure when some concepts fail', async () => {
      const storage = createTestStorage();
      const failPartial: HealthStorage = {
        ...storage,
        get: async (relation, key) => {
          if (relation === 'health_probes' && key === 'broken') throw new Error('fail');
          return storage.get(relation, key);
        },
      };
      const input = { sync: 'mixed-sync', concepts: ['ok-concept', 'broken'] };

      const result = await healthHandler.checkSync(input, failPartial)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('partialFailure');
        if (result.right.variant === 'partialFailure') {
          expect(result.right.failed).toContain('broken');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await healthHandler.checkSync({ sync: 'x', concepts: ['a'] }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkKit', () => {
    it('should return ok for a kit with all healthy items', async () => {
      const storage = createTestStorage();
      await storage.put('health_kits', 'my-kit', {
        concepts: ['c1'],
        syncs: ['s1'],
      });
      await storage.put('health_results', 'concept::c1', { status: 'healthy' });
      await storage.put('health_results', 'sync::s1', { status: 'healthy' });

      const input = { kit: 'my-kit', environment: 'production' };
      const result = await healthHandler.checkKit(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return failed when kit items have unknown status', async () => {
      const storage = createTestStorage();
      await storage.put('health_kits', 'bad-kit', {
        concepts: ['missing-concept'],
        syncs: [],
      });

      const input = { kit: 'bad-kit', environment: 'staging' };
      const result = await healthHandler.checkKit(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('failed');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await healthHandler.checkKit({ kit: 'x', environment: 'prod' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkInvariant', () => {
    it('should pass when no invariant is stored', async () => {
      const storage = createTestStorage();
      const input = { concept: 'user', invariant: 'unique-email' };

      const result = await healthHandler.checkInvariant(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should pass when expected matches actual', async () => {
      const storage = createTestStorage();
      await storage.put('health_invariants', 'user::unique-email', {
        expected: 'true',
        actual: 'true',
      });
      const input = { concept: 'user', invariant: 'unique-email' };

      const result = await healthHandler.checkInvariant(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return violated when expected differs from actual', async () => {
      const storage = createTestStorage();
      await storage.put('health_invariants', 'order::positive-total', {
        expected: 'positive',
        actual: 'negative',
      });
      const input = { concept: 'order', invariant: 'positive-total' };

      const result = await healthHandler.checkInvariant(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('violated');
        if (result.right.variant === 'violated') {
          expect(result.right.expected).toBe('positive');
          expect(result.right.actual).toBe('negative');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await healthHandler.checkInvariant({ concept: 'x', invariant: 'y' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
