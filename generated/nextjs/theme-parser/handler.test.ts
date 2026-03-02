// ThemeParser — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { themeParserHandler } from './handler.js';
import type { ThemeParserStorage } from './types.js';

const createTestStorage = (): ThemeParserStorage => {
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

const createFailingStorage = (): ThemeParserStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ThemeParser handler', () => {
  describe('parse', () => {
    it('should parse a valid theme source into an AST', async () => {
      const storage = createTestStorage();
      const source = JSON.stringify({
        colors: { primary: '#ff0000', background: '#ffffff' },
        typography: { fontSize: '16px' },
      });

      const result = await themeParserHandler.parse(
        { theme: 'light', source },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.theme).toBe('light');
          const ast = JSON.parse(result.right.ast);
          expect(ast.name).toBe('light');
          expect(ast.colors.primary).toBe('#ff0000');
        }
      }
    });

    it('should return error for invalid JSON source', async () => {
      const storage = createTestStorage();

      const result = await themeParserHandler.parse(
        { theme: 'bad', source: 'not-json{' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.errors.some((e) => e.includes('Syntax error'))).toBe(true);
        }
      }
    });

    it('should return error for missing required sections', async () => {
      const storage = createTestStorage();
      const source = JSON.stringify({ spacing: { sm: '4px' } });

      const result = await themeParserHandler.parse(
        { theme: 'incomplete', source },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.errors.some((e) => e.includes('colors'))).toBe(true);
          expect(result.right.errors.some((e) => e.includes('typography'))).toBe(true);
        }
      }
    });

    it('should return error for invalid hex color values', async () => {
      const storage = createTestStorage();
      const source = JSON.stringify({
        colors: { primary: 'not-a-color' },
        typography: { fontSize: '16px' },
      });

      const result = await themeParserHandler.parse(
        { theme: 'bad-colors', source },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.errors.some((e) => e.includes('Invalid color'))).toBe(true);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const source = JSON.stringify({
        colors: { primary: '#ff0000' },
        typography: { fontSize: '16px' },
      });

      const result = await themeParserHandler.parse(
        { theme: 'light', source },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkContrast', () => {
    it('should return ok when no foreground/background pairs exist', async () => {
      const storage = createTestStorage();
      await storage.put('theme_ast', 'light', {
        theme: 'light',
        ast: JSON.stringify({
          name: 'light',
          colors: { primary: '#ff0000' },
        }),
      });

      const result = await themeParserHandler.checkContrast(
        { theme: 'light' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return violations when contrast is insufficient', async () => {
      const storage = createTestStorage();
      await storage.put('theme_ast', 'low-contrast', {
        theme: 'low-contrast',
        ast: JSON.stringify({
          name: 'low-contrast',
          colors: {
            foreground: '#cccccc',
            background: '#dddddd',
          },
        }),
      });

      const result = await themeParserHandler.checkContrast(
        { theme: 'low-contrast' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('violations');
        if (result.right.variant === 'violations') {
          expect(result.right.failures.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return violations when theme has not been parsed', async () => {
      const storage = createTestStorage();

      const result = await themeParserHandler.checkContrast(
        { theme: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('violations');
      }
    });

    it('should return ok for high contrast theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme_ast', 'high-contrast', {
        theme: 'high-contrast',
        ast: JSON.stringify({
          name: 'high-contrast',
          colors: {
            foreground: '#000000',
            background: '#ffffff',
          },
        }),
      });

      const result = await themeParserHandler.checkContrast(
        { theme: 'high-contrast' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
