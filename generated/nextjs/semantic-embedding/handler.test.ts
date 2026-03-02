// SemanticEmbedding — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { semanticEmbeddingHandler } from './handler.js';
import type { SemanticEmbeddingStorage } from './types.js';

const createTestStorage = (): SemanticEmbeddingStorage => {
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

const createFailingStorage = (): SemanticEmbeddingStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = semanticEmbeddingHandler;

describe('SemanticEmbedding handler', () => {
  describe('compute', () => {
    it('should compute embedding for a supported model', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        { unit: 'function add(a, b) { return a + b; }', model: 'openai-ada-002' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.embedding).toContain('emb_');
        }
      }
    });

    it('should return modelUnavailable for unsupported model', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        { unit: 'test', model: 'nonexistent-model' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('modelUnavailable');
        if (result.right.variant === 'modelUnavailable') {
          expect(result.right.model).toBe('nonexistent-model');
        }
      }
    });

    it('should persist the embedding in storage', async () => {
      const storage = createTestStorage();
      await handler.compute(
        { unit: 'const x = 1;', model: 'codeBERT' },
        storage,
      )();
      const record = await storage.get('embedding', 'emb_const x = 1;_codeBERT');
      expect(record).not.toBeNull();
      expect(record!['model']).toBe('codeBERT');
      expect(record!['dimensions']).toBe(768);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.compute(
        { unit: 'test', model: 'openai-ada-002' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve a computed embedding', async () => {
      const storage = createTestStorage();
      await handler.compute(
        { unit: 'fn greet()', model: 'openai-3-small' },
        storage,
      )();
      const result = await handler.get(
        { embedding: 'emb_fn greet()_openai-3-small' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.model).toBe('openai-3-small');
          expect(result.right.dimensions).toBe(1536);
        }
      }
    });

    it('should return notfound for missing embedding', async () => {
      const storage = createTestStorage();
      const result = await handler.get(
        { embedding: 'emb_nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('searchSimilar', () => {
    it('should return search results', async () => {
      const storage = createTestStorage();
      await handler.compute({ unit: 'function add(a, b)', model: 'openai-ada-002' }, storage)();
      await handler.compute({ unit: 'function sub(a, b)', model: 'openai-ada-002' }, storage)();
      const result = await handler.searchSimilar(
        { queryVector: JSON.stringify([0.5, 0.5]), topK: 5, language: '*', kind: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const parsed = JSON.parse(result.right.results);
        expect(Array.isArray(parsed)).toBe(true);
      }
    });
  });

  describe('searchNaturalLanguage', () => {
    it('should return search results from natural language query', async () => {
      const storage = createTestStorage();
      await handler.compute({ unit: 'sort algorithm', model: 'openai-ada-002' }, storage)();
      const result = await handler.searchNaturalLanguage(
        { query: 'sorting', topK: 3 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const parsed = JSON.parse(result.right.results);
        expect(Array.isArray(parsed)).toBe(true);
      }
    });
  });
});
