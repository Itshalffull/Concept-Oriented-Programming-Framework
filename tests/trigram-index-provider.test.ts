// ============================================================
// TrigramIndexProvider Handler Tests
//
// Search index using trigram indexing for fast substring and
// regex text search across project files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  trigramIndexProviderHandler,
  resetTrigramIndexProviderCounter,
} from '../handlers/ts/trigram-index-provider.handler.js';

describe('TrigramIndexProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTrigramIndexProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', async () => {
      const result = await trigramIndexProviderHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('trigram-index-provider-1');
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await trigramIndexProviderHandler.initialize!({}, storage);
      const second = await trigramIndexProviderHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('index', () => {
    it('indexes a document and returns trigram count', async () => {
      const result = await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'Hello World' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.docId).toBe('doc-1');
      expect(result.trigramCount).toBeGreaterThan(0);
    });

    it('stores document text in storage', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'test content' },
        storage,
      );
      const stored = await storage.get('trigram-index-provider-doc', 'doc-1');
      expect(stored).not.toBeNull();
      expect(stored!.text).toBe('test content');
    });

    it('creates posting list entries for trigrams', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'abcdef' },
        storage,
      );
      // 'abcdef' lowercased has trigrams: abc, bcd, cde, def
      const postings = await storage.find('trigram-index-provider-post', { docId: 'doc-1' });
      expect(postings.length).toBe(4);
    });
  });

  describe('search', () => {
    it('finds documents containing the query string', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'function calculateTotal() { return 42; }' },
        storage,
      );

      const result = await trigramIndexProviderHandler.search!(
        { query: 'calculate' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(1);
      expect(results[0].docId).toBe('doc-1');
      expect(results[0].positions).toContain(9); // "calculate" starts at index 9
    });

    it('performs case-insensitive search', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'HelloWorld' },
        storage,
      );

      const result = await trigramIndexProviderHandler.search!(
        { query: 'helloworld' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(1);
    });

    it('returns empty for queries too short for trigram search', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'abcdef' },
        storage,
      );

      const result = await trigramIndexProviderHandler.search!(
        { query: 'ab' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });

    it('returns empty when no documents match', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'Hello World' },
        storage,
      );

      const result = await trigramIndexProviderHandler.search!(
        { query: 'zzzzz' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });

    it('searches across multiple documents', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'function process(data) {}' },
        storage,
      );
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-2', text: 'function transform(data) {}' },
        storage,
      );
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-3', text: 'class MyClass {}' },
        storage,
      );

      const result = await trigramIndexProviderHandler.search!(
        { query: 'function' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(2);
    });

    it('finds multiple positions within a single document', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'test test test' },
        storage,
      );

      const result = await trigramIndexProviderHandler.search!(
        { query: 'test' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results[0].positions.length).toBe(3);
    });
  });

  describe('remove', () => {
    it('removes a document and its posting entries', async () => {
      await trigramIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'Hello World' },
        storage,
      );

      const result = await trigramIndexProviderHandler.remove!(
        { docId: 'doc-1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify document is no longer searchable
      const searchResult = await trigramIndexProviderHandler.search!(
        { query: 'hello' },
        storage,
      );
      const results = JSON.parse(searchResult.results as string);
      expect(results.length).toBe(0);
    });

    it('handles removing a non-existent document gracefully', async () => {
      const result = await trigramIndexProviderHandler.remove!(
        { docId: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });
});
