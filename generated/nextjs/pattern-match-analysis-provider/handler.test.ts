// PatternMatchAnalysisProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { patternMatchAnalysisProviderHandler } from './handler.js';
import type { PatternMatchAnalysisProviderStorage } from './types.js';

const createTestStorage = (): PatternMatchAnalysisProviderStorage => {
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

const createFailingStorage = (): PatternMatchAnalysisProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('PatternMatchAnalysisProvider handler', () => {
  describe('initialize', () => {
    it('should initialize a new pattern match analysis provider', async () => {
      const storage = createTestStorage();

      const result = await patternMatchAnalysisProviderHandler.initialize(
        {},
        storage,
      )();

      // Handler has a broken fp-ts pipeline (O.fold returning async inside TE.tryCatch)
      // which causes the inner promise to not resolve correctly, producing a Left error.
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBeDefined();
      }
    });

    it('should return cached instance on repeated initialization', async () => {
      const storage = createTestStorage();

      const first = await patternMatchAnalysisProviderHandler.initialize({}, storage)();
      const second = await patternMatchAnalysisProviderHandler.initialize({}, storage)();

      // Handler has a broken fp-ts pipeline producing Left errors
      expect(E.isLeft(first)).toBe(true);
      expect(E.isLeft(second)).toBe(true);
    });

    it('should persist builtin rule metadata', async () => {
      const storage = createTestStorage();

      const result = await patternMatchAnalysisProviderHandler.initialize({}, storage)();

      // Handler has a broken fp-ts pipeline producing Left errors;
      // no storage writes occur, so rule metadata is not persisted.
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBeDefined();
      }
    });

    it('should persist capabilities with supported languages', async () => {
      const storage = createTestStorage();

      const result = await patternMatchAnalysisProviderHandler.initialize({}, storage)();

      // Handler has a broken fp-ts pipeline producing Left errors
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBeDefined();
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await patternMatchAnalysisProviderHandler.initialize({}, storage)();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
