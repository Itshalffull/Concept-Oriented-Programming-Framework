// ============================================================
// SuffixArrayIndexProvider Handler Tests
//
// Search index using suffix arrays for exact and approximate
// substring matching with compressed storage.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  suffixArrayIndexProviderHandler,
  resetSuffixArrayIndexProviderCounter,
} from '../handlers/ts/suffix-array-index-provider.handler.js';

describe('SuffixArrayIndexProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSuffixArrayIndexProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', async () => {
      const result = await suffixArrayIndexProviderHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('suffix-array-index-provider-1');
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await suffixArrayIndexProviderHandler.initialize!({}, storage);
      const second = await suffixArrayIndexProviderHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('index', () => {
    it('indexes a document and returns ok', async () => {
      const result = await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'Hello World' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.docId).toBe('doc-1');
    });

    it('stores the document text lowercased with suffix array', async () => {
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'FooBar' },
        storage,
      );
      const stored = await storage.get('suffix-array-index-provider-sa', 'doc-1');
      expect(stored).not.toBeNull();
      expect(stored!.text).toBe('foobar');
      expect(stored!.suffixArray).toBeDefined();
    });
  });

  describe('search', () => {
    it('finds a substring in an indexed document', async () => {
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'function calculateSum(a, b) { return a + b; }' },
        storage,
      );

      const result = await suffixArrayIndexProviderHandler.search!(
        { pattern: 'calculate' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(1);
      expect(results[0].docId).toBe('doc-1');
      expect(results[0].positions.length).toBeGreaterThan(0);
    });

    it('performs case-insensitive search', async () => {
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'HelloWorld' },
        storage,
      );

      const result = await suffixArrayIndexProviderHandler.search!(
        { pattern: 'HELLOWORLD' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(1);
    });

    it('returns empty results when pattern not found', async () => {
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'Hello World' },
        storage,
      );

      const result = await suffixArrayIndexProviderHandler.search!(
        { pattern: 'zzz' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });

    it('searches across multiple documents', async () => {
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'function add(a, b) {}' },
        storage,
      );
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-2', text: 'function subtract(a, b) {}' },
        storage,
      );
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-3', text: 'class MyClass {}' },
        storage,
      );

      const result = await suffixArrayIndexProviderHandler.search!(
        { pattern: 'function' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(2);
      const docIds = results.map((r: { docId: string }) => r.docId);
      expect(docIds).toContain('doc-1');
      expect(docIds).toContain('doc-2');
    });

    it('finds multiple occurrences in the same document', async () => {
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'aba aba aba' },
        storage,
      );

      const result = await suffixArrayIndexProviderHandler.search!(
        { pattern: 'aba' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results[0].positions.length).toBe(3);
    });
  });

  describe('remove', () => {
    it('removes a document from the index', async () => {
      await suffixArrayIndexProviderHandler.index!(
        { docId: 'doc-1', text: 'Hello World' },
        storage,
      );

      const result = await suffixArrayIndexProviderHandler.remove!(
        { docId: 'doc-1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const searchResult = await suffixArrayIndexProviderHandler.search!(
        { pattern: 'hello' },
        storage,
      );
      const results = JSON.parse(searchResult.results as string);
      expect(results.length).toBe(0);
    });

    it('handles removing a non-existent document gracefully', async () => {
      const result = await suffixArrayIndexProviderHandler.remove!(
        { docId: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });
});
