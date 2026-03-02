// HandlerScaffoldGen — handler.test.ts
// Unit tests for handlerScaffoldGen handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { handlerScaffoldGenHandler } from './handler.js';
import type { HandlerScaffoldGenStorage } from './types.js';

const createTestStorage = (): HandlerScaffoldGenStorage => {
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

const createFailingStorage = (): HandlerScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('HandlerScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate scaffold files for a valid concept', async () => {
      const storage = createTestStorage();
      const input = {
        conceptName: 'my-concept',
        actions: ['create', 'get', 'list'],
      };

      const result = await handlerScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBe(3);
          expect(result.right.files).toHaveLength(3);
        }
      }
    });

    it('should return error for empty concept name', async () => {
      const storage = createTestStorage();
      const input = { conceptName: '', actions: ['create'] };

      const result = await handlerScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for empty actions array', async () => {
      const storage = createTestStorage();
      const input = { conceptName: 'valid-name', actions: [] as unknown[] };

      const result = await handlerScaffoldGenHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { conceptName: 'test', actions: ['create'] };

      const result = await handlerScaffoldGenHandler.generate(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview files to write for a new concept', async () => {
      const storage = createTestStorage();
      const input = { conceptName: 'new-concept', actions: ['create', 'delete'] };

      const result = await handlerScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBe(3);
          expect(result.right.wouldSkip).toBe(0);
        }
      }
    });

    it('should return cached when no new files are needed', async () => {
      const storage = createTestStorage();
      const input = { conceptName: 'cached-concept', actions: ['create'] };

      // Generate first, then preview with same actions
      await handlerScaffoldGenHandler.generate(input, storage)();
      const result = await handlerScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return error for empty concept name', async () => {
      const storage = createTestStorage();
      const input = { conceptName: '  ', actions: ['create'] };

      const result = await handlerScaffoldGenHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { conceptName: 'test', actions: ['create'] };

      const result = await handlerScaffoldGenHandler.preview(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return handler registration metadata', async () => {
      const storage = createTestStorage();
      const input = {};

      const result = await handlerScaffoldGenHandler.register(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('handler-scaffold-gen');
        expect(result.right.capabilities).toContain('generate');
        expect(result.right.capabilities).toContain('preview');
      }
    });
  });
});
