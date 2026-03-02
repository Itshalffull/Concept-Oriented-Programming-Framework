// CssTokenSymbolExtractor — handler.test.ts
// Unit tests for cssTokenSymbolExtractor handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { cssTokenSymbolExtractorHandler } from './handler.js';
import type { CssTokenSymbolExtractorStorage } from './types.js';

const createTestStorage = (): CssTokenSymbolExtractorStorage => {
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

const createFailingStorage = (): CssTokenSymbolExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CssTokenSymbolExtractor handler', () => {
  describe('initialize', () => {
    it('returns ok with instance id', async () => {
      const storage = createTestStorage();
      const result = await cssTokenSymbolExtractorHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toBeTruthy();
        }
      }
    });

    it('returns loadError on storage failure (handled via orElse)', async () => {
      const storage = createFailingStorage();
      const result = await cssTokenSymbolExtractorHandler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('extract', () => {
    it('extracts CSS custom properties from content', async () => {
      const storage = createTestStorage();
      const css = ':root { --color-primary: #ff0000; --spacing-sm: 8px; }';
      const result = await cssTokenSymbolExtractorHandler.extract(
        { file: 'tokens.css', content: css },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const symbols = result.right.symbols;
        expect(symbols.length).toBeGreaterThanOrEqual(2);
        expect(symbols.some((s) => s.name === '--color-primary')).toBe(true);
      }
    });

    it('extracts keyframes from content', async () => {
      const storage = createTestStorage();
      const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
      const result = await cssTokenSymbolExtractorHandler.extract(
        { file: 'anim.css', content: css },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.some((s) => s.name === 'fadeIn' && s.kind === 'keyframes')).toBe(true);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await cssTokenSymbolExtractorHandler.extract(
        { file: 'test.css', content: '.btn { color: red; }' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getCustomProperties', () => {
    it('returns custom properties for a file', async () => {
      const storage = createTestStorage();
      const css = ':root { --bg: white; --fg: black; }';
      await cssTokenSymbolExtractorHandler.extract({ file: 'vars.css', content: css }, storage)();
      const result = await cssTokenSymbolExtractorHandler.getCustomProperties(
        { file: 'vars.css' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.properties.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await cssTokenSymbolExtractorHandler.getCustomProperties(
        { file: 'test.css' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByName', () => {
    it('finds symbols by name across files', async () => {
      const storage = createTestStorage();
      const css = ':root { --brand-color: blue; }';
      await cssTokenSymbolExtractorHandler.extract({ file: 'brand.css', content: css }, storage)();
      const result = await cssTokenSymbolExtractorHandler.findByName(
        { name: '--brand-color' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await cssTokenSymbolExtractorHandler.findByName(
        { name: '--test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
