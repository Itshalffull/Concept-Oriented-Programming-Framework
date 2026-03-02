// CloudRunRuntime — handler.test.ts
// Unit tests for cloudRunRuntime handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { cloudRunRuntimeHandler } from './handler.js';
import type { CloudRunRuntimeStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CloudRunRuntimeStorage => {
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
const createFailingStorage = (): CloudRunRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CloudRunRuntime handler', () => {
  describe('provision', () => {
    it('should return ok with valid region and billing', async () => {
      const storage = createTestStorage();

      const result = await cloudRunRuntimeHandler.provision(
        { concept: 'api', projectId: 'proj-1', region: 'us-central1', cpu: 1, memory: 512 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.service).toContain('api');
          expect(result.right.serviceUrl).toContain('run.app');
        }
      }
    });

    it('should return billingDisabled when billing is disabled', async () => {
      const storage = createTestStorage();
      await storage.put('billing', 'proj-1', { disabled: true });

      const result = await cloudRunRuntimeHandler.provision(
        { concept: 'api', projectId: 'proj-1', region: 'us-central1', cpu: 1, memory: 512 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('billingDisabled');
      }
    });

    it('should return regionUnavailable for unsupported region', async () => {
      const storage = createTestStorage();

      const result = await cloudRunRuntimeHandler.provision(
        { concept: 'api', projectId: 'proj-1', region: 'antarctica-south1', cpu: 1, memory: 512 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('regionUnavailable');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudRunRuntimeHandler.provision(
        { concept: 'api', projectId: 'proj-1', region: 'us-central1', cpu: 1, memory: 512 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should return ok with revision when service exists and image is valid', async () => {
      const storage = createTestStorage();
      await storage.put('services', 'svc-api', {
        service: 'svc-api',
        revisionCount: 0,
      });

      const result = await cloudRunRuntimeHandler.deploy(
        { service: 'svc-api', imageUri: 'gcr.io/proj-1/api:latest' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.revision).toContain('rev-1');
        }
      }
    });

    it('should return imageNotFound for invalid image URI', async () => {
      const storage = createTestStorage();
      await storage.put('services', 'svc-api', {
        service: 'svc-api',
        revisionCount: 0,
      });

      const result = await cloudRunRuntimeHandler.deploy(
        { service: 'svc-api', imageUri: 'no-registry' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('imageNotFound');
      }
    });

    it('should return Left when service does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudRunRuntimeHandler.deploy(
        { service: 'nonexistent', imageUri: 'gcr.io/proj-1/api:latest' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudRunRuntimeHandler.deploy(
        { service: 'svc-api', imageUri: 'gcr.io/proj-1/api:latest' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should return ok when service exists', async () => {
      const storage = createTestStorage();
      await storage.put('services', 'svc-api', { service: 'svc-api', weight: 100 });

      const result = await cloudRunRuntimeHandler.setTrafficWeight(
        { service: 'svc-api', weight: 50 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left when service does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudRunRuntimeHandler.setTrafficWeight(
        { service: 'nonexistent', weight: 50 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudRunRuntimeHandler.setTrafficWeight(
        { service: 'svc-api', weight: 50 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should return ok when revision exists', async () => {
      const storage = createTestStorage();
      await storage.put('services', 'svc-api', { service: 'svc-api' });
      await storage.put('revisions', 'svc-api:svc-api-rev-1', {
        service: 'svc-api',
        revision: 'svc-api-rev-1',
        imageUri: 'gcr.io/proj-1/api:v1',
      });

      const result = await cloudRunRuntimeHandler.rollback(
        { service: 'svc-api', targetRevision: 'svc-api-rev-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.restoredRevision).toBe('svc-api-rev-1');
      }
    });

    it('should return Left when revision does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudRunRuntimeHandler.rollback(
        { service: 'svc-api', targetRevision: 'nonexistent' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudRunRuntimeHandler.rollback(
        { service: 'svc-api', targetRevision: 'rev-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should return ok when service exists', async () => {
      const storage = createTestStorage();
      await storage.put('services', 'svc-api', { service: 'svc-api' });

      const result = await cloudRunRuntimeHandler.destroy(
        { service: 'svc-api' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.service).toBe('svc-api');
      }
    });

    it('should return Left when service does not exist', async () => {
      const storage = createTestStorage();

      const result = await cloudRunRuntimeHandler.destroy(
        { service: 'nonexistent' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await cloudRunRuntimeHandler.destroy(
        { service: 'svc-api' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
