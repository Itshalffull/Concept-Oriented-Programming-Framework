// ============================================================
// VoyageCodeEmbeddingProvider Handler Tests
//
// Embedding model provider using Voyage AI's voyage-code-3 model.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  voyageCodeEmbeddingProviderHandler,
  resetVoyageCodeEmbeddingProviderCounter,
} from '../handlers/ts/voyage-code-embedding-provider.handler.js';

describe('VoyageCodeEmbeddingProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetVoyageCodeEmbeddingProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', async () => {
      const result = await voyageCodeEmbeddingProviderHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('voyage-code-embedding-provider-1');
    });

    it('stores provider with correct model name and ref', async () => {
      await voyageCodeEmbeddingProviderHandler.initialize!({}, storage);
      const stored = await storage.get(
        'voyage-code-embedding-provider',
        'voyage-code-embedding-provider-1',
      );
      expect(stored).not.toBeNull();
      expect(stored!.modelName).toBe('voyage-code');
      expect(stored!.providerRef).toBe('embedding:voyage-code');
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await voyageCodeEmbeddingProviderHandler.initialize!({}, storage);
      const second = await voyageCodeEmbeddingProviderHandler.initialize!({}, storage);
      expect(first.variant).toBe('ok');
      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate entries', async () => {
      await voyageCodeEmbeddingProviderHandler.initialize!({}, storage);
      await voyageCodeEmbeddingProviderHandler.initialize!({}, storage);
      const all = await storage.find('voyage-code-embedding-provider');
      expect(all.length).toBe(1);
    });
  });
});
