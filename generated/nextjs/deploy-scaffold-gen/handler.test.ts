// DeployScaffoldGen — handler.test.ts
// Unit tests for deployScaffoldGen handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { deployScaffoldGenHandler } from './handler.js';
import type { DeployScaffoldGenStorage } from './types.js';

const createTestStorage = (): DeployScaffoldGenStorage => {
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

const createFailingStorage = (): DeployScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DeployScaffoldGen handler', () => {
  describe('generate', () => {
    it('returns ok with files for valid input', async () => {
      const storage = createTestStorage();
      const result = await deployScaffoldGenHandler.generate(
        { appName: 'my-app', runtimes: ['node', 'deno'], concepts: ['auth', 'storage'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBeGreaterThan(0);
          expect(result.right.files.length).toBeGreaterThan(0);
        }
      }
    });

    it('returns error when appName is empty', async () => {
      const storage = createTestStorage();
      const result = await deployScaffoldGenHandler.generate(
        { appName: '', runtimes: ['node'], concepts: ['auth'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deployScaffoldGenHandler.generate(
        { appName: 'my-app', runtimes: ['node'], concepts: ['auth'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('returns ok with files to write for first preview', async () => {
      const storage = createTestStorage();
      const result = await deployScaffoldGenHandler.preview(
        { appName: 'my-app', runtimes: ['node'], concepts: ['auth'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBeGreaterThan(0);
        }
      }
    });

    it('returns cached when scaffold already matches', async () => {
      const storage = createTestStorage();
      await deployScaffoldGenHandler.generate(
        { appName: 'my-app', runtimes: ['node'], concepts: ['auth'] },
        storage,
      )();
      const result = await deployScaffoldGenHandler.preview(
        { appName: 'my-app', runtimes: ['node'], concepts: ['auth'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('returns error when appName is empty', async () => {
      const storage = createTestStorage();
      const result = await deployScaffoldGenHandler.preview(
        { appName: '', runtimes: ['node'], concepts: ['auth'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deployScaffoldGenHandler.preview(
        { appName: 'my-app', runtimes: ['node'], concepts: ['auth'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('returns ok with handler metadata (pure computation)', async () => {
      const storage = createTestStorage();
      const result = await deployScaffoldGenHandler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('deploy-scaffold-gen');
        expect(result.right.capabilities.length).toBeGreaterThan(0);
      }
    });
  });
});
