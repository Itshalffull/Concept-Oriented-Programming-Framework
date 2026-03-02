// CloudflareRuntime — handler.test.ts
// Unit tests for cloudflareRuntime handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { cloudflareRuntimeHandler } from './handler.js';
import type { CloudflareRuntimeStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CloudflareRuntimeStorage => {
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
const createFailingStorage = (): CloudflareRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CloudflareRuntime handler', () => {
  describe('provision', () => {
    it('should return ok when no route conflicts', async () => {
      const storage = createTestStorage();

      const result = await cloudflareRuntimeHandler.provision(
        { concept: 'api', accountId: 'acc-1', routes: ['example.com/*'] },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.worker).toContain('api');
          expect(result.right.scriptName).toBe('api-script');
          expect(result.right.endpoint).toContain('workers.dev');
        }
      }
    });

    it('should return routeConflict when route is already bound', async () => {
      const storage = createTestStorage();
      await storage.put('routes', 'acc-1:example.com/*', {
        route: 'example.com/*',
        worker: 'existing-worker',
        accountId: 'acc-1',
      });

      const result = await cloudflareRuntimeHandler.provision(
        { concept: 'api', accountId: 'acc-1', routes: ['example.com/*'] },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('routeConflict');
        if (result.right.variant === 'routeConflict') {
          expect(result.right.route).toBe('example.com/*');
          expect(result.right.existingWorker).toBe('existing-worker');
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudflareRuntimeHandler.provision(
        { concept: 'api', accountId: 'acc-1', routes: ['example.com/*'] },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should return ok with version when worker exists and script is small enough', async () => {
      const storage = createTestStorage();
      await storage.put('workers', 'my-worker', {
        worker: 'my-worker',
        version: 0,
      });

      const result = await cloudflareRuntimeHandler.deploy(
        { worker: 'my-worker', scriptContent: 'export default { fetch() {} }' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe('v1');
        }
      }
    });

    it('should return scriptTooLarge when script exceeds limit', async () => {
      const storage = createTestStorage();
      await storage.put('workers', 'my-worker', {
        worker: 'my-worker',
        version: 0,
      });

      const largeScript = 'x'.repeat(1_048_577);

      const result = await cloudflareRuntimeHandler.deploy(
        { worker: 'my-worker', scriptContent: largeScript },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('scriptTooLarge');
      }
    });

    it('should return Left when worker does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudflareRuntimeHandler.deploy(
        { worker: 'nonexistent', scriptContent: 'code' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('WORKER_NOT_FOUND');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudflareRuntimeHandler.deploy(
        { worker: 'my-worker', scriptContent: 'code' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should return ok when worker exists', async () => {
      const storage = createTestStorage();
      await storage.put('workers', 'my-worker', { worker: 'my-worker', weight: 100 });

      const result = await cloudflareRuntimeHandler.setTrafficWeight(
        { worker: 'my-worker', weight: 50 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left when worker does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudflareRuntimeHandler.setTrafficWeight(
        { worker: 'nonexistent', weight: 50 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudflareRuntimeHandler.setTrafficWeight(
        { worker: 'my-worker', weight: 50 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should return ok when version exists', async () => {
      const storage = createTestStorage();
      await storage.put('workers', 'my-worker', { worker: 'my-worker', version: 2 });
      await storage.put('versions', 'my-worker:v1', { worker: 'my-worker', version: 'v1' });

      const result = await cloudflareRuntimeHandler.rollback(
        { worker: 'my-worker', targetVersion: 'v1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.restoredVersion).toBe('v1');
      }
    });

    it('should return Left when version does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudflareRuntimeHandler.rollback(
        { worker: 'my-worker', targetVersion: 'nonexistent' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudflareRuntimeHandler.rollback(
        { worker: 'my-worker', targetVersion: 'v1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should return ok when worker exists', async () => {
      const storage = createTestStorage();
      await storage.put('workers', 'my-worker', { worker: 'my-worker' });

      const result = await cloudflareRuntimeHandler.destroy(
        { worker: 'my-worker' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.worker).toBe('my-worker');
      }
    });

    it('should return Left when worker does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudflareRuntimeHandler.destroy(
        { worker: 'nonexistent' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudflareRuntimeHandler.destroy(
        { worker: 'my-worker' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
