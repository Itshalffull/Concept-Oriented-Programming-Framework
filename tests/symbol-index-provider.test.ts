// ============================================================
// SymbolIndexProvider Handler Tests
//
// Search index optimised for symbol lookup with inverted index
// for name, kind, and namespace resolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  symbolIndexProviderHandler,
  resetSymbolIndexProviderCounter,
} from '../handlers/ts/symbol-index-provider.handler.js';

describe('SymbolIndexProvider', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSymbolIndexProviderCounter();
  });

  describe('initialize', () => {
    it('creates a new provider instance', async () => {
      const result = await symbolIndexProviderHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('symbol-index-provider-1');
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await symbolIndexProviderHandler.initialize!({}, storage);
      const second = await symbolIndexProviderHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('index', () => {
    it('indexes a symbol with name, kind, and namespace', async () => {
      const result = await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'calculateTotal', kind: 'function', namespace: 'billing/utils' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.symbolId).toBe('sym-1');
    });

    it('stores symbol metadata in storage', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'MyClass', kind: 'class', namespace: 'models' },
        storage,
      );
      const stored = await storage.get('symbol-index-provider-sym', 'sym-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('MyClass');
      expect(stored!.kind).toBe('class');
      expect(stored!.namespace).toBe('models');
    });
  });

  describe('searchByKind', () => {
    it('finds all symbols of a given kind', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'add', kind: 'function', namespace: '' },
        storage,
      );
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-2', name: 'subtract', kind: 'function', namespace: '' },
        storage,
      );
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-3', name: 'User', kind: 'class', namespace: '' },
        storage,
      );

      const result = await symbolIndexProviderHandler.searchByKind!(
        { kind: 'function' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(2);
    });

    it('performs case-insensitive kind search', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'Foo', kind: 'Class', namespace: '' },
        storage,
      );

      const result = await symbolIndexProviderHandler.searchByKind!(
        { kind: 'class' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(1);
    });

    it('returns empty for unmatched kind', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'x', kind: 'variable', namespace: '' },
        storage,
      );

      const result = await symbolIndexProviderHandler.searchByKind!(
        { kind: 'class' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });
  });

  describe('searchByName', () => {
    it('finds symbols by exact name (case-insensitive)', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'MyComponent', kind: 'class', namespace: 'ui' },
        storage,
      );
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-2', name: 'myComponent', kind: 'variable', namespace: 'utils' },
        storage,
      );

      const result = await symbolIndexProviderHandler.searchByName!(
        { name: 'mycomponent' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(2);
    });

    it('returns empty for non-existent name', async () => {
      const result = await symbolIndexProviderHandler.searchByName!(
        { name: 'nonexistent' },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });
  });

  describe('fuzzySearch', () => {
    it('matches symbols by fuzzy subsequence', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'calculateTotalPrice', kind: 'function', namespace: '' },
        storage,
      );
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-2', name: 'getPrice', kind: 'function', namespace: '' },
        storage,
      );

      const result = await symbolIndexProviderHandler.fuzzySearch!(
        { query: 'cltp', topK: 10 },
        storage,
      );
      const results = JSON.parse(result.results as string);
      // 'cltp' should match 'calculateTotalPrice' (c-a-l-c-u-l-a-t-e-T-o-t-a-l-P-r-i-c-e)
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('calculateTotalPrice');
    });

    it('respects topK limit', async () => {
      for (let i = 0; i < 15; i++) {
        await symbolIndexProviderHandler.index!(
          { symbolId: `sym-${i}`, name: `func${i}`, kind: 'function', namespace: '' },
          storage,
        );
      }

      const result = await symbolIndexProviderHandler.fuzzySearch!(
        { query: 'f', topK: 5 },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(5);
    });

    it('returns empty when nothing matches', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'abc', kind: 'variable', namespace: '' },
        storage,
      );

      const result = await symbolIndexProviderHandler.fuzzySearch!(
        { query: 'xyz', topK: 10 },
        storage,
      );
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });
  });

  describe('remove', () => {
    it('removes a symbol and its index entries', async () => {
      await symbolIndexProviderHandler.index!(
        { symbolId: 'sym-1', name: 'MyFunc', kind: 'function', namespace: 'utils' },
        storage,
      );

      const result = await symbolIndexProviderHandler.remove!(
        { symbolId: 'sym-1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify symbol is no longer searchable
      const searchResult = await symbolIndexProviderHandler.searchByName!(
        { name: 'MyFunc' },
        storage,
      );
      const results = JSON.parse(searchResult.results as string);
      expect(results.length).toBe(0);
    });

    it('handles removing non-existent symbol gracefully', async () => {
      const result = await symbolIndexProviderHandler.remove!(
        { symbolId: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });
});
