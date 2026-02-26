// ============================================================
// OpenAIEmbeddingProvider Handler Tests
//
// Embedding model provider using OpenAI's text-embedding-3-large API.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  openAIEmbeddingProviderHandler,
  resetOpenAIEmbeddingProviderCounter,
} from '../implementations/typescript/open-ai-embedding-provider.impl.js';

describe('OpenAIEmbeddingProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetOpenAIEmbeddingProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', async () => {
      const result = await openAIEmbeddingProviderHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('open-ai-embedding-provider-1');
    });

    it('stores provider with correct model name and ref', async () => {
      await openAIEmbeddingProviderHandler.initialize!({}, storage);
      const stored = await storage.get(
        'open-ai-embedding-provider',
        'open-ai-embedding-provider-1',
      );
      expect(stored).not.toBeNull();
      expect(stored!.modelName).toBe('openai-code');
      expect(stored!.providerRef).toBe('embedding:openai-code');
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await openAIEmbeddingProviderHandler.initialize!({}, storage);
      const second = await openAIEmbeddingProviderHandler.initialize!({}, storage);
      expect(first.variant).toBe('ok');
      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate entries', async () => {
      await openAIEmbeddingProviderHandler.initialize!({}, storage);
      await openAIEmbeddingProviderHandler.initialize!({}, storage);
      const all = await storage.find('open-ai-embedding-provider');
      expect(all.length).toBe(1);
    });
  });
});
