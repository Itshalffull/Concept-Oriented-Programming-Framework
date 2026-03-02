// KitScaffoldGen — handler.test.ts
// Unit tests for kitScaffoldGen handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { kitScaffoldGenHandler } from './handler.js';
import type { KitScaffoldGenStorage } from './types.js';

const createTestStorage = (): KitScaffoldGenStorage => {
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

const createFailingStorage = (): KitScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('KitScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate suite scaffold files', async () => {
      const storage = createTestStorage();
      const input = {
        name: 'collaboration',
        description: 'Real-time collaboration suite',
        concepts: ['channel', 'message', 'presence'],
      };

      const result = await kitScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          // 1 suite.yaml + 3 concept stubs + 1 index = 5
          expect(result.right.filesGenerated).toBe(5);
        }
      }
    });

    it('should return error for empty suite name', async () => {
      const storage = createTestStorage();
      const input = { name: '', description: 'desc', concepts: ['c'] };

      const result = await kitScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for empty concepts list', async () => {
      const storage = createTestStorage();
      const input = { name: 'empty-concepts', description: 'desc', concepts: [] as string[] };

      const result = await kitScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { name: 'test', description: 'd', concepts: ['c'] };
      const result = await kitScaffoldGenHandler.generate(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview files for a new suite', async () => {
      const storage = createTestStorage();
      const input = {
        name: 'preview-suite',
        description: 'Preview test',
        concepts: ['auth', 'session'],
      };

      const result = await kitScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBeGreaterThan(0);
          expect(result.right.wouldSkip).toBe(0);
        }
      }
    });

    it('should return cached when all files already exist', async () => {
      const storage = createTestStorage();
      const input = {
        name: 'cached-suite',
        description: 'Cached test',
        concepts: ['concept-a'],
      };

      await kitScaffoldGenHandler.generate(input, storage)();
      const result = await kitScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return error for empty suite name', async () => {
      const storage = createTestStorage();
      const input = { name: '  ', description: 'd', concepts: ['c'] };

      const result = await kitScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { name: 'test', description: 'd', concepts: ['c'] };
      const result = await kitScaffoldGenHandler.preview(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const input = {};

      const result = await kitScaffoldGenHandler.register(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('kit-scaffold-gen');
        expect(result.right.capabilities).toContain('generate');
        expect(result.right.capabilities).toContain('preview');
        expect(result.right.capabilities).toContain('suite-manifest');
      }
    });
  });
});
