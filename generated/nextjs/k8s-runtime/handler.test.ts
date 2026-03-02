// K8sRuntime — handler.test.ts
// Unit tests for k8sRuntime handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { k8sRuntimeHandler } from './handler.js';
import type { K8sRuntimeStorage } from './types.js';

const createTestStorage = (): K8sRuntimeStorage => {
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

const createFailingStorage = (): K8sRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('K8sRuntime handler', () => {
  describe('provision', () => {
    it('should provision a deployment in an existing namespace', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'default', { name: 'default' });

      const input = {
        concept: 'user',
        namespace: 'default',
        cluster: 'prod-cluster',
        replicas: 3,
      };

      const result = await k8sRuntimeHandler.provision(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.deployment).toBe('default-user');
          expect(result.right.serviceName).toBe('svc-user');
          expect(result.right.endpoint).toContain('svc-user.default');
        }
      }
    });

    it('should return namespaceNotFound for missing namespace', async () => {
      const storage = createTestStorage();
      const input = {
        concept: 'user',
        namespace: 'missing-ns',
        cluster: 'cluster',
        replicas: 1,
      };

      const result = await k8sRuntimeHandler.provision(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('namespaceNotFound');
      }
    });

    it('should return resourceQuotaExceeded when over limit', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'full-ns', { name: 'full-ns' });
      // Pre-populate with existing deployments near the limit
      await storage.put('deployments', 'full-ns-existing', {
        namespace: 'full-ns',
        replicas: 48,
      });

      const input = {
        concept: 'big-svc',
        namespace: 'full-ns',
        cluster: 'cluster',
        replicas: 5,
      };

      const result = await k8sRuntimeHandler.provision(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resourceQuotaExceeded');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { concept: 'x', namespace: 'ns', cluster: 'c', replicas: 1 };
      const result = await k8sRuntimeHandler.provision(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy a new image to an existing deployment', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'default', { name: 'default' });
      await k8sRuntimeHandler.provision({
        concept: 'api', namespace: 'default', cluster: 'c', replicas: 1,
      }, storage)();

      const input = {
        deployment: 'default-api',
        imageUri: 'registry.io/api:v1.0',
      };

      const result = await k8sRuntimeHandler.deploy(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.revision).toBe('rev-1');
        }
      }
    });

    it('should return imageNotFound for missing deployment', async () => {
      const storage = createTestStorage();
      const input = {
        deployment: 'nonexistent',
        imageUri: 'registry.io/api:v1',
      };

      const result = await k8sRuntimeHandler.deploy(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('imageNotFound');
      }
    });

    it('should return imageNotFound for image without tag', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'default', { name: 'default' });
      await k8sRuntimeHandler.provision({
        concept: 'notag', namespace: 'default', cluster: 'c', replicas: 1,
      }, storage)();

      const input = {
        deployment: 'default-notag',
        imageUri: 'registry.io/api',
      };

      const result = await k8sRuntimeHandler.deploy(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('imageNotFound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await k8sRuntimeHandler.deploy({
        deployment: 'x', imageUri: 'x:v1',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should set traffic weight on an existing deployment', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'ns', { name: 'ns' });
      await k8sRuntimeHandler.provision({
        concept: 'svc', namespace: 'ns', cluster: 'c', replicas: 1,
      }, storage)();

      const result = await k8sRuntimeHandler.setTrafficWeight({
        deployment: 'ns-svc', weight: 50,
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left for missing deployment', async () => {
      const storage = createTestStorage();
      const result = await k8sRuntimeHandler.setTrafficWeight({
        deployment: 'nope', weight: 50,
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback to a previous revision', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'ns', { name: 'ns' });
      await k8sRuntimeHandler.provision({
        concept: 'rb', namespace: 'ns', cluster: 'c', replicas: 1,
      }, storage)();
      await k8sRuntimeHandler.deploy({
        deployment: 'ns-rb', imageUri: 'img:v1',
      }, storage)();
      await k8sRuntimeHandler.deploy({
        deployment: 'ns-rb', imageUri: 'img:v2',
      }, storage)();

      const result = await k8sRuntimeHandler.rollback({
        deployment: 'ns-rb', targetRevision: 'rev-1',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.restoredRevision).toBe('rev-1');
      }
    });

    it('should return left for missing revision', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'ns', { name: 'ns' });
      await k8sRuntimeHandler.provision({
        concept: 'rb2', namespace: 'ns', cluster: 'c', replicas: 1,
      }, storage)();

      const result = await k8sRuntimeHandler.rollback({
        deployment: 'ns-rb2', targetRevision: 'rev-999',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy an existing deployment', async () => {
      const storage = createTestStorage();
      await storage.put('namespaces', 'ns', { name: 'ns' });
      await k8sRuntimeHandler.provision({
        concept: 'del', namespace: 'ns', cluster: 'c', replicas: 1,
      }, storage)();

      const result = await k8sRuntimeHandler.destroy({
        deployment: 'ns-del',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return ok for already-absent deployment', async () => {
      const storage = createTestStorage();
      const result = await k8sRuntimeHandler.destroy({
        deployment: 'absent',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await k8sRuntimeHandler.destroy({ deployment: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
