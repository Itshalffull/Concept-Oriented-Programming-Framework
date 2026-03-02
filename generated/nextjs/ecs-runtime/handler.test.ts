// EcsRuntime — handler.test.ts
// Unit tests for ecsRuntime handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { ecsRuntimeHandler } from './handler.js';
import type { EcsRuntimeStorage } from './types.js';

const createTestStorage = (): EcsRuntimeStorage => {
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

const createFailingStorage = (): EcsRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

/** Seed a cluster with available capacity. */
const seedCluster = async (storage: EcsRuntimeStorage, name: string, cpu: number, memory: number) => {
  await storage.put('clusters', name, {
    name,
    availableCpu: cpu,
    availableMemory: memory,
  });
};

describe('EcsRuntime handler', () => {
  describe('provision', () => {
    it('should provision a service when cluster has capacity', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'prod-cluster', 4, 8192);
      const result = await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod-cluster' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.service).toBe('ecs-api');
          expect(result.right.serviceArn).toContain('arn:aws:ecs');
          expect(result.right.endpoint).toContain('.local');
        }
      }
    });

    it('should return clusterNotFound for unknown cluster', async () => {
      const storage = createTestStorage();
      const result = await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clusterNotFound');
      }
    });

    it('should return capacityUnavailable when resources exceed availability', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'small-cluster', 1, 512);
      const result = await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 4, memory: 8192, cluster: 'small-cluster' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('capacityUnavailable');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy an image to a provisioned service', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'prod-cluster', 4, 8192);
      await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod-cluster' },
        storage,
      )();
      const result = await ecsRuntimeHandler.deploy(
        { service: 'ecs-api', imageUri: 'ecr.aws/my-repo/api:latest' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.service).toBe('ecs-api');
          expect(result.right.taskDefinition).toBeTruthy();
        }
      }
    });

    it('should return imageNotFound for invalid imageUri without slash', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'prod-cluster', 4, 8192);
      await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod-cluster' },
        storage,
      )();
      const result = await ecsRuntimeHandler.deploy(
        { service: 'ecs-api', imageUri: 'invalid-image' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('imageNotFound');
      }
    });

    it('should return left when service does not exist', async () => {
      const storage = createTestStorage();
      const result = await ecsRuntimeHandler.deploy(
        { service: 'nonexistent', imageUri: 'ecr.aws/repo:latest' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should set traffic weight on existing service', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'prod-cluster', 4, 8192);
      await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod-cluster' },
        storage,
      )();
      const result = await ecsRuntimeHandler.setTrafficWeight(
        { service: 'ecs-api', weight: 42 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left when service does not exist', async () => {
      const storage = createTestStorage();
      const result = await ecsRuntimeHandler.setTrafficWeight(
        { service: 'nonexistent', weight: 42 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback to a previously deployed task definition', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'prod-cluster', 4, 8192);
      await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod-cluster' },
        storage,
      )();
      const deployResult = await ecsRuntimeHandler.deploy(
        { service: 'ecs-api', imageUri: 'ecr.aws/repo/api:v1' },
        storage,
      )();
      if (E.isRight(deployResult) && deployResult.right.variant === 'ok') {
        const result = await ecsRuntimeHandler.rollback(
          { service: 'ecs-api', targetTaskDefinition: deployResult.right.taskDefinition },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return left when task definition not found', async () => {
      const storage = createTestStorage();
      const result = await ecsRuntimeHandler.rollback(
        { service: 'ecs-api', targetTaskDefinition: 'nonexistent-td' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy a service with no active connections', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'prod-cluster', 4, 8192);
      await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod-cluster' },
        storage,
      )();
      const result = await ecsRuntimeHandler.destroy(
        { service: 'ecs-api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return drainTimeout when active connections exist', async () => {
      const storage = createTestStorage();
      await seedCluster(storage, 'prod-cluster', 4, 8192);
      await ecsRuntimeHandler.provision(
        { concept: 'api', cpu: 1, memory: 2048, cluster: 'prod-cluster' },
        storage,
      )();
      // Manually set activeConnections > 0
      const svc = await storage.get('ecs-services', 'ecs-api');
      if (svc) {
        await storage.put('ecs-services', 'ecs-api', { ...svc, activeConnections: 42 });
      }
      const result = await ecsRuntimeHandler.destroy(
        { service: 'ecs-api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('drainTimeout');
        if (result.right.variant === 'drainTimeout') {
          expect(result.right.activeConnections).toBe(42);
        }
      }
    });

    it('should return left when service does not exist', async () => {
      const storage = createTestStorage();
      const result = await ecsRuntimeHandler.destroy(
        { service: 'nonexistent' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
