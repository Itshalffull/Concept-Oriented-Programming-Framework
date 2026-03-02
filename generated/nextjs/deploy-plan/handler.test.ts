// DeployPlan — handler.test.ts
// Unit tests for deployPlan handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { deployPlanHandler } from './handler.js';
import type { DeployPlanStorage } from './types.js';

const createTestStorage = (): DeployPlanStorage => {
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

const createFailingStorage = (): DeployPlanStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DeployPlan handler', () => {
  describe('plan', () => {
    it('returns invalidManifest when manifest not found', async () => {
      const storage = createTestStorage();
      const result = await deployPlanHandler.plan(
        { manifest: 'missing', environment: 'staging' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidManifest');
      }
    });

    it('returns ok when manifest is valid with nodes', async () => {
      const storage = createTestStorage();
      await storage.put('manifests', 'my-manifest', {
        nodes: [
          { name: 'api', deps: [] },
          { name: 'db', deps: [] },
        ],
      });
      const result = await deployPlanHandler.plan(
        { manifest: 'my-manifest', environment: 'staging' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.plan).toBeTruthy();
          expect(result.right.estimatedDuration).toBeGreaterThan(0);
        }
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deployPlanHandler.plan(
        { manifest: 'test', environment: 'staging' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('returns schemaIncompatible when plan not found', async () => {
      const storage = createTestStorage();
      const result = await deployPlanHandler.validate(
        { plan: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('schemaIncompatible');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deployPlanHandler.validate(
        { plan: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('execute', () => {
    it('returns left when plan does not exist', async () => {
      const storage = createTestStorage();
      const result = await deployPlanHandler.execute(
        { plan: 'missing' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deployPlanHandler.execute(
        { plan: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('returns left when plan does not exist', async () => {
      const storage = createTestStorage();
      const result = await deployPlanHandler.rollback(
        { plan: 'missing' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deployPlanHandler.rollback(
        { plan: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('status', () => {
    it('returns notfound when plan does not exist', async () => {
      const storage = createTestStorage();
      const result = await deployPlanHandler.status(
        { plan: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deployPlanHandler.status(
        { plan: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
