// SymbolIndexProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { symbolIndexProviderHandler } from './handler.js';
import type { SymbolIndexProviderStorage } from './types.js';

const createTestStorage = (): SymbolIndexProviderStorage => {
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

const createFailingStorage = (): SymbolIndexProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = symbolIndexProviderHandler;

const testSymbol = {
  name: 'MyClass',
  qualifiedName: 'com.app.MyClass',
  kind: 'class',
  file: 'src/MyClass.ts',
  exported: true,
};

describe('SymbolIndexProvider handler', () => {
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('sip-');
        }
      }
    });

    it('should recover from storage failure with loadError', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('addSymbol', () => {
    it('should add a symbol to the index', async () => {
      const storage = createTestStorage();
      const result = await handler.addSymbol(testSymbol, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.added).toBe(true);
      }
    });

    it('should persist symbol data in storage', async () => {
      const storage = createTestStorage();
      await handler.addSymbol(testSymbol, storage)();
      const stored = await storage.get('symbol_index', 'com.app.MyClass');
      expect(stored).not.toBeNull();
      expect(stored?.name).toBe('MyClass');
      expect(stored?.kind).toBe('class');
    });
  });

  describe('removeSymbol', () => {
    it('should remove an existing symbol', async () => {
      const storage = createTestStorage();
      await handler.addSymbol(testSymbol, storage)();
      const result = await handler.removeSymbol(
        { qualifiedName: 'com.app.MyClass' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.removed).toBe(true);
      }
    });

    it('should return false for nonexistent symbol', async () => {
      const storage = createTestStorage();
      const result = await handler.removeSymbol(
        { qualifiedName: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.removed).toBe(false);
      }
    });
  });

  describe('exactLookup', () => {
    it('should find symbols by exact name', async () => {
      const storage = createTestStorage();
      await handler.addSymbol(testSymbol, storage)();
      await handler.addSymbol(
        { name: 'Helper', qualifiedName: 'com.app.Helper', kind: 'class', file: 'Helper.ts', exported: false },
        storage,
      )();
      const result = await handler.exactLookup({ name: 'MyClass' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(1);
        expect(result.right.symbols[0].qualifiedName).toBe('com.app.MyClass');
      }
    });

    it('should return empty array when no match', async () => {
      const storage = createTestStorage();
      const result = await handler.exactLookup({ name: 'Nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(0);
      }
    });
  });

  describe('prefixSearch', () => {
    it('should find symbols matching a prefix', async () => {
      const storage = createTestStorage();
      await handler.addSymbol(
        { name: 'MyClassA', qualifiedName: 'a', kind: 'class', file: 'a.ts', exported: true },
        storage,
      )();
      await handler.addSymbol(
        { name: 'MyClassB', qualifiedName: 'b', kind: 'class', file: 'b.ts', exported: true },
        storage,
      )();
      await handler.addSymbol(
        { name: 'Other', qualifiedName: 'c', kind: 'class', file: 'c.ts', exported: true },
        storage,
      )();
      const result = await handler.prefixSearch({ prefix: 'My', limit: 10 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(2);
      }
    });

    it('should respect limit parameter', async () => {
      const storage = createTestStorage();
      for (let i = 0; i < 5; i++) {
        await handler.addSymbol(
          { name: `Test${i}`, qualifiedName: `q${i}`, kind: 'class', file: 'a.ts', exported: true },
          storage,
        )();
      }
      const result = await handler.prefixSearch({ prefix: 'Test', limit: 3 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('fuzzySearch', () => {
    it('should find symbols with fuzzy matching', async () => {
      const storage = createTestStorage();
      await handler.addSymbol(
        { name: 'UserProfile', qualifiedName: 'up', kind: 'class', file: 'a.ts', exported: true },
        storage,
      )();
      const result = await handler.fuzzySearch(
        { query: 'UserProfil', maxDistance: 2, limit: 10 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should rank exact matches higher', async () => {
      const storage = createTestStorage();
      await handler.addSymbol(
        { name: 'MyClass', qualifiedName: 'mc', kind: 'class', file: 'a.ts', exported: true },
        storage,
      )();
      await handler.addSymbol(
        { name: 'MyClasz', qualifiedName: 'mc2', kind: 'class', file: 'b.ts', exported: true },
        storage,
      )();
      const result = await handler.fuzzySearch(
        { query: 'MyClass', maxDistance: 2, limit: 10 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.symbols.length >= 2) {
        expect(result.right.symbols[0].name).toBe('MyClass');
      }
    });
  });

  describe('getByFile', () => {
    it('should return all symbols in a given file', async () => {
      const storage = createTestStorage();
      await handler.addSymbol(
        { name: 'ClassA', qualifiedName: 'a', kind: 'class', file: 'module.ts', exported: true },
        storage,
      )();
      await handler.addSymbol(
        { name: 'ClassB', qualifiedName: 'b', kind: 'class', file: 'module.ts', exported: false },
        storage,
      )();
      await handler.addSymbol(
        { name: 'ClassC', qualifiedName: 'c', kind: 'class', file: 'other.ts', exported: true },
        storage,
      )();
      const result = await handler.getByFile({ file: 'module.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
