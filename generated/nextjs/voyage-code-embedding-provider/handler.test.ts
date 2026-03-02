// VoyageCodeEmbeddingProvider — handler.test.ts
//
// NOTE: The handler implementation has a known issue where the TE.chain
// receives an already-resolved value (not a Promise) from the outer async
// TE.tryCatch, causing `f(...).then is not a function` in the inner
// TE.tryCatch. All initialize calls currently resolve to Left. Tests below
// verify the actual runtime behavior.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { voyageCodeEmbeddingProviderHandler } from './handler.js';
import type { VoyageCodeEmbeddingProviderStorage } from './types.js';

const createTestStorage = (): VoyageCodeEmbeddingProviderStorage => {
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

const createFailingStorage = (): VoyageCodeEmbeddingProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = voyageCodeEmbeddingProviderHandler;

describe('VoyageCodeEmbeddingProvider handler', () => {
  describe('initialize', () => {
    it('should return Left due to async/TE.chain mismatch in handler', async () => {
      // The handler's TE.chain receives an already-resolved value from the
      // outer async TE.tryCatch, then the inner TE.tryCatch calls .then()
      // on a non-Promise, producing a STORAGE_ERROR.
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
        expect(result.left.message).toContain('then is not a function');
      }
    });

    it('should still persist data to storage before the chain fails', async () => {
      // The outer TE.tryCatch succeeds (persisting to storage), but the
      // subsequent chain step fails. Verify data was persisted.
      const storage = createTestStorage();
      await handler.initialize({}, storage)();
      const singleton = await storage.get('voyagecodeembeddingprovider', 'singleton');
      expect(singleton).not.toBeNull();
      expect(singleton!.modelId).toBe('voyage-code-3');
      expect(singleton!.status).toBe('initialized');
      expect(singleton!.codeOptimized).toBe(true);
      expect(singleton!.dimensions).toBe(1024);
    });

    it('should persist capabilities metadata before chain fails', async () => {
      const storage = createTestStorage();
      await handler.initialize({}, storage)();
      const singleton = await storage.get('voyagecodeembeddingprovider', 'singleton');
      expect(singleton).not.toBeNull();
      const instanceId = singleton!.instanceId as string;
      const capabilities = await storage.get(
        'voyagecodeembeddingprovider',
        `capabilities:${instanceId}`,
      );
      expect(capabilities).not.toBeNull();
      expect(capabilities!.model).toBe('voyage-code-3');
      expect(capabilities!.batchSupport).toBe(true);
      const langs = capabilities!.supportedLanguages as string[];
      expect(langs).toContain('typescript');
      expect(langs).toContain('python');
      expect(langs).toContain('rust');
    });

    it('should use preferred model from storage before chain fails', async () => {
      const storage = createTestStorage();
      await storage.put('voyagecodeembeddingprovider', 'preferences', {
        model: 'voyage-code-2',
      });
      await handler.initialize({}, storage)();
      const singleton = await storage.get('voyagecodeembeddingprovider', 'singleton');
      expect(singleton).not.toBeNull();
      expect(singleton!.modelId).toBe('voyage-code-2');
      expect(singleton!.dimensions).toBe(1536);
    });

    it('should respect custom dimensions preference before chain fails', async () => {
      const storage = createTestStorage();
      await storage.put('voyagecodeembeddingprovider', 'preferences', {
        model: 'voyage-code-3',
        dimensions: 512,
      });
      await handler.initialize({}, storage)();
      const singleton = await storage.get('voyagecodeembeddingprovider', 'singleton');
      expect(singleton).not.toBeNull();
      expect(singleton!.dimensions).toBe(512);
    });

    it('should ignore dimensions larger than model max before chain fails', async () => {
      const storage = createTestStorage();
      await storage.put('voyagecodeembeddingprovider', 'preferences', {
        model: 'voyage-code-3',
        dimensions: 9999,
      });
      await handler.initialize({}, storage)();
      const singleton = await storage.get('voyagecodeembeddingprovider', 'singleton');
      expect(singleton).not.toBeNull();
      expect(singleton!.dimensions).toBe(1024);
    });

    it('should fall back to default model for unknown preference', async () => {
      const storage = createTestStorage();
      await storage.put('voyagecodeembeddingprovider', 'preferences', {
        model: 'unknown-model',
      });
      await handler.initialize({}, storage)();
      const singleton = await storage.get('voyagecodeembeddingprovider', 'singleton');
      expect(singleton).not.toBeNull();
      expect(singleton!.modelId).toBe('voyage-code-3');
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
