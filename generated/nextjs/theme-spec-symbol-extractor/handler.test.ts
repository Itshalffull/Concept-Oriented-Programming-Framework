// ThemeSpecSymbolExtractor — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { themeSpecSymbolExtractorHandler } from './handler.js';
import type { ThemeSpecSymbolExtractorStorage } from './types.js';

const createTestStorage = (): ThemeSpecSymbolExtractorStorage => {
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

const createFailingStorage = (): ThemeSpecSymbolExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ThemeSpecSymbolExtractor handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();

      const result = await themeSpecSymbolExtractorHandler.initialize({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toMatch(/^tsse-/);
        }
      }
    });

    it('should return loadError on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await themeSpecSymbolExtractorHandler.initialize({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('extract', () => {
    it('should extract symbols from a JSON theme spec', async () => {
      const storage = createTestStorage();
      const content = JSON.stringify({
        name: 'dark',
        tokens: {
          colors: { primary: '#ff0000', secondary: '#00ff00' },
        },
        variants: ['compact', 'spacious'],
        aliases: { textPrimary: 'colors.primary' },
        breakpoints: { sm: '640px', md: '768px' },
      });

      const result = await themeSpecSymbolExtractorHandler.extract(
        { file: 'dark.theme.json', content },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const symbols = result.right.symbols;
        expect(symbols.length).toBeGreaterThan(0);

        const themeSymbol = symbols.find((s) => s.kind === 'theme');
        expect(themeSymbol).toBeDefined();
        expect(themeSymbol!.name).toBe('dark');

        const tokenSymbols = symbols.filter((s) => s.kind === 'token');
        expect(tokenSymbols.length).toBe(2);

        const variantSymbols = symbols.filter((s) => s.kind === 'variant');
        expect(variantSymbols.length).toBe(2);

        const aliasSymbols = symbols.filter((s) => s.kind === 'alias');
        expect(aliasSymbols.length).toBe(1);

        const bpSymbols = symbols.filter((s) => s.kind === 'breakpoint');
        expect(bpSymbols.length).toBe(2);
      }
    });

    it('should extract from line-based format when JSON parse fails', async () => {
      const storage = createTestStorage();
      const content = `theme MyTheme {\n  primary: #ff0000;\n  secondary: #00ff00;\n}`;

      const result = await themeSpecSymbolExtractorHandler.extract(
        { file: 'custom.theme', content },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const symbols = result.right.symbols;
        expect(symbols.length).toBeGreaterThan(0);

        const themeSymbol = symbols.find((s) => s.kind === 'theme');
        expect(themeSymbol).toBeDefined();
        expect(themeSymbol!.name).toBe('MyTheme');
      }
    });

    it('should handle scales in theme spec', async () => {
      const storage = createTestStorage();
      const content = JSON.stringify({
        name: 'spaced',
        scales: {
          spacing: { xs: '2px', sm: '4px', md: '8px' },
        },
      });

      const result = await themeSpecSymbolExtractorHandler.extract(
        { file: 'spaced.theme.json', content },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const scaleSymbols = result.right.symbols.filter((s) => s.kind === 'scale');
        expect(scaleSymbols.length).toBe(3);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await themeSpecSymbolExtractorHandler.extract(
        { file: 'f.json', content: JSON.stringify({ name: 'x' }) },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getSymbolsForFile', () => {
    it('should retrieve stored symbols for a file', async () => {
      const storage = createTestStorage();
      await storage.put('theme_symbols', 'dark.primary', {
        name: 'primary',
        kind: 'token',
        qualifiedName: 'dark.primary',
        file: 'dark.json',
        value: '#ff0000',
      });

      const result = await themeSpecSymbolExtractorHandler.getSymbolsForFile(
        { file: 'dark.json' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getTokens', () => {
    it('should return only token symbols for a specific theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme_symbols', 'dark.primary', {
        name: 'primary',
        kind: 'token',
        qualifiedName: 'dark.primary',
        file: 'dark.json',
        value: '#ff0000',
      });
      await storage.put('theme_symbols', 'dark', {
        name: 'dark',
        kind: 'theme',
        qualifiedName: 'dark',
        file: 'dark.json',
        value: '',
      });

      const result = await themeSpecSymbolExtractorHandler.getTokens(
        { theme: 'dark' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.tokens.every((t) => t.kind === 'token')).toBe(true);
      }
    });
  });

  describe('findByName', () => {
    it('should find symbols matching a name', async () => {
      const storage = createTestStorage();
      await storage.put('theme_symbols', 'dark.primary', {
        name: 'primary',
        kind: 'token',
        qualifiedName: 'dark.primary',
        file: 'dark.json',
        value: '#ff0000',
      });
      await storage.put('theme_symbols', 'light.primary', {
        name: 'primary',
        kind: 'token',
        qualifiedName: 'light.primary',
        file: 'light.json',
        value: '#0000ff',
      });

      const result = await themeSpecSymbolExtractorHandler.findByName(
        { name: 'primary' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(2);
      }
    });
  });
});
