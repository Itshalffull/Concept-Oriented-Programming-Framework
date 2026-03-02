// DockerComposeRuntime — handler.test.ts
// Unit tests for dockerComposeRuntime handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { dockerComposeRuntimeHandler } from './handler.js';
import type { DockerComposeRuntimeStorage } from './types.js';

const createTestStorage = (): DockerComposeRuntimeStorage => {
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

const createFailingStorage = (): DockerComposeRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DockerComposeRuntime handler', () => {
  describe('provision', () => {
    it('should provision a service with ok variant', async () => {
      const storage = createTestStorage();
      const result = await dockerComposeRuntimeHandler.provision(
        { concept: 'my-svc', composePath: '/docker-compose.yml', ports: ['8080:80'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.serviceName).toBe('compose-my-svc');
          expect(result.right.endpoint).toContain('http://localhost:');
        }
      }
    });

    it('should return portConflict when port already in use', async () => {
      const storage = createTestStorage();
      await dockerComposeRuntimeHandler.provision(
        { concept: 'svc-a', composePath: '/dc.yml', ports: ['8080:80'] },
        storage,
      )();
      const result = await dockerComposeRuntimeHandler.provision(
        { concept: 'svc-b', composePath: '/dc.yml', ports: ['8080:80'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('portConflict');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dockerComposeRuntimeHandler.provision(
        { concept: 'my-svc', composePath: '/dc.yml', ports: ['8080:80'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy an image to an existing service', async () => {
      const storage = createTestStorage();
      await dockerComposeRuntimeHandler.provision(
        { concept: 'my-svc', composePath: '/dc.yml', ports: ['8080:80'] },
        storage,
      )();
      const result = await dockerComposeRuntimeHandler.deploy(
        { service: 'compose-my-svc', imageUri: 'registry/image:latest' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.service).toBe('compose-my-svc');
          expect(result.right.containerId).toBeTruthy();
        }
      }
    });

    it('should return left when service does not exist', async () => {
      const storage = createTestStorage();
      const result = await dockerComposeRuntimeHandler.deploy(
        { service: 'nonexistent', imageUri: 'registry/image:latest' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dockerComposeRuntimeHandler.deploy(
        { service: 'compose-my-svc', imageUri: 'registry/image:latest' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should set traffic weight on an existing service', async () => {
      const storage = createTestStorage();
      await dockerComposeRuntimeHandler.provision(
        { concept: 'my-svc', composePath: '/dc.yml', ports: ['9090:90'] },
        storage,
      )();
      const result = await dockerComposeRuntimeHandler.setTrafficWeight(
        { service: 'compose-my-svc', weight: 42 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left when service does not exist', async () => {
      const storage = createTestStorage();
      const result = await dockerComposeRuntimeHandler.setTrafficWeight(
        { service: 'nonexistent', weight: 42 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback service to a target image', async () => {
      const storage = createTestStorage();
      await dockerComposeRuntimeHandler.provision(
        { concept: 'my-svc', composePath: '/dc.yml', ports: ['9090:90'] },
        storage,
      )();
      const result = await dockerComposeRuntimeHandler.rollback(
        { service: 'compose-my-svc', targetImage: 'registry/image:v1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.restoredImage).toBe('registry/image:v1');
        }
      }
    });

    it('should return left when service does not exist', async () => {
      const storage = createTestStorage();
      const result = await dockerComposeRuntimeHandler.rollback(
        { service: 'nonexistent', targetImage: 'registry/image:v1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy an existing service', async () => {
      const storage = createTestStorage();
      await dockerComposeRuntimeHandler.provision(
        { concept: 'my-svc', composePath: '/dc.yml', ports: ['9090:90'] },
        storage,
      )();
      const result = await dockerComposeRuntimeHandler.destroy(
        { service: 'compose-my-svc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left when service does not exist', async () => {
      const storage = createTestStorage();
      const result = await dockerComposeRuntimeHandler.destroy(
        { service: 'nonexistent' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
