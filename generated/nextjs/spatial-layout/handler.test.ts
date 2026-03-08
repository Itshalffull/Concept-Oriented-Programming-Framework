// SpatialLayout — handler.test.ts
// Unit tests for SpatialLayout provider registration and layout application.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { spatialLayoutHandler } from './handler.js';
import type { SpatialLayoutStorage } from './types.js';

const createTestStorage = (): SpatialLayoutStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): SpatialLayoutStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('SpatialLayout handler', () => {
  describe('registerProvider', () => {
    it('registers a new layout provider with ok variant', async () => {
      const storage = createTestStorage();
      const result = await spatialLayoutHandler.registerProvider(
        { algorithm: 'force-directed', provider: 'fd-provider' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns already_registered for duplicate algorithm', async () => {
      const storage = createTestStorage();
      await spatialLayoutHandler.registerProvider(
        { algorithm: 'force-directed', provider: 'fd-provider' },
        storage,
      )();
      const result = await spatialLayoutHandler.registerProvider(
        { algorithm: 'force-directed', provider: 'another-provider' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialLayoutHandler.registerProvider(
        { algorithm: 'force-directed', provider: 'fd-provider' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('apply', () => {
    it('applies a registered algorithm with ok variant', async () => {
      const storage = createTestStorage();
      await spatialLayoutHandler.registerProvider(
        { algorithm: 'grid', provider: 'grid-provider' },
        storage,
      )();

      const result = await spatialLayoutHandler.apply(
        { canvas: 'canvas-1', algorithm: 'grid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).layout).toBeDefined();
      }
    });

    it('returns unknown_algorithm for unregistered algorithm', async () => {
      const storage = createTestStorage();
      const result = await spatialLayoutHandler.apply(
        { canvas: 'canvas-1', algorithm: 'unknown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknown_algorithm');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialLayoutHandler.apply(
        { canvas: 'canvas-1', algorithm: 'grid' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listProviders', () => {
    it('lists registered providers with ok variant', async () => {
      const storage = createTestStorage();
      await spatialLayoutHandler.registerProvider(
        { algorithm: 'grid', provider: 'grid-provider' },
        storage,
      )();
      await spatialLayoutHandler.registerProvider(
        { algorithm: 'circular', provider: 'circular-provider' },
        storage,
      )();

      const result = await spatialLayoutHandler.listProviders({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const providers = JSON.parse((result.right as any).providers);
        expect(providers.length).toBe(2);
      }
    });

    it('returns empty list when no providers registered', async () => {
      const storage = createTestStorage();
      const result = await spatialLayoutHandler.listProviders({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const providers = JSON.parse((result.right as any).providers);
        expect(providers.length).toBe(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await spatialLayoutHandler.listProviders({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('multi-step sequence: register -> apply -> list', () => {
    it('completes full lifecycle', async () => {
      const storage = createTestStorage();

      const regResult = await spatialLayoutHandler.registerProvider(
        { algorithm: 'hierarchical', provider: 'hier-provider' },
        storage,
      )();
      expect(E.isRight(regResult)).toBe(true);

      const applyResult = await spatialLayoutHandler.apply(
        { canvas: 'main-canvas', algorithm: 'hierarchical' },
        storage,
      )();
      expect(E.isRight(applyResult)).toBe(true);
      if (E.isRight(applyResult)) {
        expect(applyResult.right.variant).toBe('ok');
      }

      const listResult = await spatialLayoutHandler.listProviders({}, storage)();
      expect(E.isRight(listResult)).toBe(true);
      if (E.isRight(listResult)) {
        const providers = JSON.parse((listResult.right as any).providers);
        expect(providers.length).toBe(1);
      }
    });
  });
});
