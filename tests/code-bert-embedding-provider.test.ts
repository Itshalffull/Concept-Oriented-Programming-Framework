// ============================================================
// CodeBERTEmbeddingProvider Handler Tests
//
// Embedding model provider using CodeBERT for local code embeddings.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  codeBERTEmbeddingProviderHandler,
  resetCodeBERTEmbeddingProviderCounter,
} from '../implementations/typescript/code-bert-embedding-provider.impl.js';

describe('CodeBERTEmbeddingProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetCodeBERTEmbeddingProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', async () => {
      const result = await codeBERTEmbeddingProviderHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('code-bert-embedding-provider-1');
    });

    it('stores provider with correct model name and ref', async () => {
      await codeBERTEmbeddingProviderHandler.initialize!({}, storage);
      const stored = await storage.get(
        'code-bert-embedding-provider',
        'code-bert-embedding-provider-1',
      );
      expect(stored).not.toBeNull();
      expect(stored!.modelName).toBe('codeBERT');
      expect(stored!.providerRef).toBe('embedding:codeBERT');
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await codeBERTEmbeddingProviderHandler.initialize!({}, storage);
      const second = await codeBERTEmbeddingProviderHandler.initialize!({}, storage);
      expect(first.variant).toBe('ok');
      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate entries', async () => {
      await codeBERTEmbeddingProviderHandler.initialize!({}, storage);
      await codeBERTEmbeddingProviderHandler.initialize!({}, storage);
      const all = await storage.find('code-bert-embedding-provider');
      expect(all.length).toBe(1);
    });
  });
});
