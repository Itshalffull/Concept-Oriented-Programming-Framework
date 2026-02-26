// ============================================================
// SemanticEmbedding Handler Tests
//
// Vector representation of DefinitionUnits for similarity search
// and natural language code search.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  semanticEmbeddingHandler,
  resetSemanticEmbeddingCounter,
} from '../implementations/typescript/semantic-embedding.impl.js';

describe('SemanticEmbedding', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSemanticEmbeddingCounter();
  });

  describe('compute', () => {
    it('computes embedding for a known model', async () => {
      const result = await semanticEmbeddingHandler.compute!(
        { unit: 'function add(a, b) { return a + b; }', model: 'codeBERT' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.embedding).toBe('semantic-embedding-1');
    });

    it('returns modelUnavailable for unknown model', async () => {
      const result = await semanticEmbeddingHandler.compute!(
        { unit: 'code snippet', model: 'unknown-model' },
        storage,
      );
      expect(result.variant).toBe('modelUnavailable');
      expect(result.model).toBe('unknown-model');
    });

    it('stores embedding in storage', async () => {
      await semanticEmbeddingHandler.compute!(
        { unit: 'const x = 1;', model: 'openai-code' },
        storage,
      );
      const stored = await storage.get('semantic-embedding', 'semantic-embedding-1');
      expect(stored).not.toBeNull();
      expect(stored!.model).toBe('openai-code');
      expect(stored!.dimensions).toBe(128);
    });

    it('produces different embeddings for different content', async () => {
      await semanticEmbeddingHandler.compute!(
        { unit: 'function foo() {}', model: 'codeBERT' },
        storage,
      );
      await semanticEmbeddingHandler.compute!(
        { unit: 'function bar() {}', model: 'codeBERT' },
        storage,
      );
      const emb1 = await storage.get('semantic-embedding', 'semantic-embedding-1');
      const emb2 = await storage.get('semantic-embedding', 'semantic-embedding-2');
      expect(emb1!.vector).not.toBe(emb2!.vector);
    });

    it('accepts all known models', async () => {
      const models = ['codeBERT', 'unixcoder', 'openai-code', 'voyage-code'];
      for (const model of models) {
        const result = await semanticEmbeddingHandler.compute!(
          { unit: 'test unit', model },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    });
  });

  describe('searchSimilar', () => {
    it('returns similar embeddings ranked by score', async () => {
      // Compute two embeddings with the same model
      await semanticEmbeddingHandler.compute!(
        { unit: 'function add(a, b) { return a + b; }', model: 'codeBERT' },
        storage,
      );
      await semanticEmbeddingHandler.compute!(
        { unit: 'function subtract(a, b) { return a - b; }', model: 'codeBERT' },
        storage,
      );

      // Build a query vector from stored embedding
      const stored = await storage.get('semantic-embedding', 'semantic-embedding-1');
      const queryVector = stored!.vector as string;

      const result = await semanticEmbeddingHandler.searchSimilar!(
        { queryVector, topK: 2, language: 'typescript', kind: 'function' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(2);
      // The first result should be the embedding itself (score ~1.0)
      expect(results[0].score).toBeCloseTo(1.0, 3);
    });

    it('respects topK parameter', async () => {
      await semanticEmbeddingHandler.compute!(
        { unit: 'code A', model: 'codeBERT' },
        storage,
      );
      await semanticEmbeddingHandler.compute!(
        { unit: 'code B', model: 'codeBERT' },
        storage,
      );
      await semanticEmbeddingHandler.compute!(
        { unit: 'code C', model: 'codeBERT' },
        storage,
      );

      const stored = await storage.get('semantic-embedding', 'semantic-embedding-1');
      const result = await semanticEmbeddingHandler.searchSimilar!(
        { queryVector: stored!.vector as string, topK: 1, language: '', kind: '' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(1);
    });
  });

  describe('searchNaturalLanguage', () => {
    it('returns results for a natural language query', async () => {
      await semanticEmbeddingHandler.compute!(
        { unit: 'function add(a, b) { return a + b; }', model: 'openai-code' },
        storage,
      );
      await semanticEmbeddingHandler.compute!(
        { unit: 'class UserService { authenticate() {} }', model: 'openai-code' },
        storage,
      );

      const result = await semanticEmbeddingHandler.searchNaturalLanguage!(
        { query: 'add two numbers', topK: 2 },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(2);
      expect(results[0].unit).toBeDefined();
      expect(results[0].score).toBeDefined();
    });

    it('returns empty results when no embeddings exist', async () => {
      const result = await semanticEmbeddingHandler.searchNaturalLanguage!(
        { query: 'test', topK: 5 },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });
  });

  describe('get', () => {
    it('retrieves stored embedding details', async () => {
      await semanticEmbeddingHandler.compute!(
        { unit: 'const x = 42;', model: 'voyage-code' },
        storage,
      );

      const result = await semanticEmbeddingHandler.get!(
        { embedding: 'semantic-embedding-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.unit).toBe('const x = 42;');
      expect(result.model).toBe('voyage-code');
      expect(result.dimensions).toBe(128);
    });

    it('returns notfound for unknown embedding', async () => {
      const result = await semanticEmbeddingHandler.get!(
        { embedding: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });
});
