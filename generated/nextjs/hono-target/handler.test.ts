// HonoTarget — handler.test.ts
// Unit tests for Hono routing target handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { honoTargetHandler } from './handler.js';
import type { HonoTargetStorage } from './types.js';

const createTestStorage = (): HonoTargetStorage => {
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

const createFailingStorage = (): HonoTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('HonoTarget handler', () => {
  describe('register', () => {
    it('registers a new Hono target with routes', async () => {
      const storage = createTestStorage();
      const result = await honoTargetHandler.register(
        { target_name: 'desktop', base_path: '/api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.target_name).toBe('desktop');
        expect(result.right.route_count).toBeGreaterThan(0);
      }
    });

    it('returns already_registered for duplicate target', async () => {
      const storage = createTestStorage();
      await honoTargetHandler.register(
        { target_name: 'desktop', base_path: '/api' },
        storage,
      )();
      const result = await honoTargetHandler.register(
        { target_name: 'desktop', base_path: '/api' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_registered');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await honoTargetHandler.register(
        { target_name: 'desktop', base_path: '/api' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('generate', () => {
    it('generates Hono route files from a manifest', async () => {
      const storage = createTestStorage();
      const result = await honoTargetHandler.generate(
        { manifest_uri: 'urn:clef/test', output_dir: './generated/hono' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.files.length).toBeGreaterThan(0);
      }
    });

    it('returns error for empty manifest_uri', async () => {
      const storage = createTestStorage();
      const result = await honoTargetHandler.generate(
        { manifest_uri: '', output_dir: './out' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });
  });

  describe('listRoutes', () => {
    it('lists routes for a registered target', async () => {
      const storage = createTestStorage();
      await honoTargetHandler.register(
        { target_name: 'desktop', base_path: '/api' },
        storage,
      )();
      const result = await honoTargetHandler.listRoutes(
        { target_name: 'desktop' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).routes.length).toBeGreaterThan(0);
      }
    });

    it('returns notfound for unknown target', async () => {
      const storage = createTestStorage();
      const result = await honoTargetHandler.listRoutes(
        { target_name: 'unknown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('register then list matches routes', async () => {
      const storage = createTestStorage();
      const regResult = await honoTargetHandler.register(
        { target_name: 'test-target', base_path: '/v1' },
        storage,
      )();
      expect(E.isRight(regResult)).toBe(true);

      const listResult = await honoTargetHandler.listRoutes(
        { target_name: 'test-target' },
        storage,
      )();
      expect(E.isRight(listResult)).toBe(true);
      if (E.isRight(regResult) && E.isRight(listResult)) {
        expect(listResult.right.variant).toBe('ok');
        expect((listResult.right as any).routes.length).toBe(
          (regResult.right as any).route_count,
        );
      }
    });
  });
});
