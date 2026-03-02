// ThemeGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { themeGenHandler } from './handler.js';
import type { ThemeGenStorage } from './types.js';

const createTestStorage = (): ThemeGenStorage => {
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

const createFailingStorage = (): ThemeGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const sampleAst = JSON.stringify({
  name: 'my-theme',
  colors: { primary: '#ff0000', secondary: '#00ff00' },
  typography: { fontSize: '16px' },
  spacing: { sm: '4px', md: '8px' },
});

describe('ThemeGen handler', () => {
  describe('generate', () => {
    it('should generate CSS output', async () => {
      const storage = createTestStorage();

      const result = await themeGenHandler.generate(
        { gen: 'my-gen', target: 'css', themeAst: sampleAst },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.output).toContain(':root');
          expect(result.right.output).toContain('--colors-primary');
          expect(result.right.gen).toBe('my-gen');
        }
      }
    });

    it('should generate SCSS output', async () => {
      const storage = createTestStorage();

      const result = await themeGenHandler.generate(
        { gen: 'my-gen', target: 'scss', themeAst: sampleAst },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.output).toContain('$colors-primary');
        }
      }
    });

    it('should generate Tailwind output', async () => {
      const storage = createTestStorage();

      const result = await themeGenHandler.generate(
        { gen: 'my-gen', target: 'tailwind', themeAst: sampleAst },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.output).toContain('module.exports');
        }
      }
    });

    it('should generate JSON output', async () => {
      const storage = createTestStorage();

      const result = await themeGenHandler.generate(
        { gen: 'my-gen', target: 'json', themeAst: sampleAst },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.output);
          expect(parsed.theme).toBe('my-theme');
          expect(parsed.tokens['colors-primary']).toBe('#ff0000');
        }
      }
    });

    it('should return error for an unsupported target', async () => {
      const storage = createTestStorage();

      const result = await themeGenHandler.generate(
        { gen: 'my-gen', target: 'yaml', themeAst: sampleAst },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('Unsupported target');
        }
      }
    });

    it('should return error for invalid JSON in themeAst', async () => {
      const storage = createTestStorage();

      const result = await themeGenHandler.generate(
        { gen: 'my-gen', target: 'css', themeAst: 'not-json{' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('not valid JSON');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await themeGenHandler.generate(
        { gen: 'my-gen', target: 'css', themeAst: sampleAst },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
