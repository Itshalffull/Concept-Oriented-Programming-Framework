// TsSdkTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { tsSdkTargetHandler } from './handler.js';
import type { TsSdkTargetStorage } from './types.js';

const createTestStorage = (): TsSdkTargetStorage => {
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

const createFailingStorage = (): TsSdkTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = tsSdkTargetHandler;

const validProjection = JSON.stringify({
  name: 'user',
  actions: [
    {
      name: 'create',
      inputs: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ],
      outputs: [
        { name: 'id', type: 'string' },
      ],
      outputType: 'string',
    },
    {
      name: 'get',
      inputs: [
        { name: 'id', type: 'string' },
      ],
      outputs: [],
      outputType: 'object',
    },
  ],
});

describe('TsSdkTarget handler', () => {
  describe('generate', () => {
    it('should generate SDK files from a valid projection', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: validProjection, config: 'default' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.package).toBe('@clef/sdk-user');
        expect(result.right.files.length).toBe(3);
        expect(result.right.files).toContain('user/types.ts');
        expect(result.right.files).toContain('user/client.ts');
        expect(result.right.files).toContain('user/index.ts');
      }
    });

    it('should persist SDK artifact to storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { projection: validProjection, config: 'default' },
        storage,
      )();
      const artifact = await storage.get('ts_sdk_artifact', 'user');
      expect(artifact).not.toBeNull();
      expect(artifact?.packageName).toBe('@clef/sdk-user');
      expect(artifact?.typesContent).toBeTruthy();
      expect(artifact?.clientContent).toBeTruthy();
    });

    it('should return left for invalid projection JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: 'not valid json', config: 'default' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('INVALID_PROJECTION');
      }
    });

    it('should use default config when config not found in storage', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: validProjection, config: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should handle projection with no actions', async () => {
      const storage = createTestStorage();
      const emptyProjection = JSON.stringify({ name: 'empty', actions: [] });
      const result = await handler.generate(
        { projection: emptyProjection, config: 'default' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.files.length).toBe(3);
      }
    });

    it('should return left on storage failure during artifact persistence', async () => {
      // Create a storage that works for get but fails on put
      const store = new Map<string, Map<string, Record<string, unknown>>>();
      const storage: TsSdkTargetStorage = {
        get: async (relation, key) => store.get(relation)?.get(key) ?? null,
        put: async () => { throw new Error('storage failure'); },
        delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
        find: async (relation) => [...(store.get(relation)?.values() ?? [])],
      };
      const result = await handler.generate(
        { projection: validProjection, config: 'default' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
