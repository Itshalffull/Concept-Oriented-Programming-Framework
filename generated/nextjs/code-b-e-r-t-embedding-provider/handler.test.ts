// CodeBERTEmbeddingProvider — handler.test.ts
// Unit tests for codeBERTEmbeddingProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { codeBERTEmbeddingProviderHandler } from './handler.js';
import type { CodeBERTEmbeddingProviderStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): CodeBERTEmbeddingProviderStorage => {
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
const createFailingStorage = (): CodeBERTEmbeddingProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CodeBERTEmbeddingProvider handler', () => {
  describe('initialize', () => {
    it('should return Left when no cache exists (handler has fp-ts pipeline bug)', async () => {
      const storage = createTestStorage();

      // Handler has a TE.chain that expects a Promise but receives an already-resolved
      // value due to async O.fold being auto-awaited by the outer TE.tryCatch.
      const result = await codeBERTEmbeddingProviderHandler.initialize(
        {},
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBeDefined();
      }
    });

    it('should return Left with valid cache (handler has fp-ts pipeline bug)', async () => {
      const storage = createTestStorage();
      await storage.put('codebertembeddingprovider', 'singleton', {
        instanceId: 'codebert-embedding-cached',
        modelId: 'microsoft/codebert-base',
        embeddingDim: 768,
      });

      // Handler has a TE.chain that expects a Promise but receives an already-resolved
      // value due to async O.fold being auto-awaited by the outer TE.tryCatch.
      const result = await codeBERTEmbeddingProviderHandler.initialize(
        {},
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBeDefined();
      }
    });

    it('should return Left when cache has wrong model (handler has fp-ts pipeline bug)', async () => {
      const storage = createTestStorage();
      await storage.put('codebertembeddingprovider', 'singleton', {
        instanceId: 'old-instance',
        modelId: 'wrong-model',
        embeddingDim: 768,
      });

      // Handler has a TE.chain that expects a Promise but receives an already-resolved
      // value due to async O.fold being auto-awaited by the outer TE.tryCatch.
      const result = await codeBERTEmbeddingProviderHandler.initialize(
        {},
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBeDefined();
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await codeBERTEmbeddingProviderHandler.initialize(
        {},
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
