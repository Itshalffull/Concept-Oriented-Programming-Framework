// Theme — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { themeHandler } from './handler.js';
import type { ThemeStorage } from './types.js';

const createTestStorage = (): ThemeStorage => {
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

const createFailingStorage = (): ThemeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Theme handler', () => {
  describe('create', () => {
    it('should create a new theme', async () => {
      const storage = createTestStorage();

      const result = await themeHandler.create(
        { theme: 'dark', name: 'Dark Theme', overrides: JSON.stringify({ bg: '#000' }) },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.theme).toBe('dark');
        }
      }
    });

    it('should return duplicate for an existing theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme', 'dark', { theme: 'dark' });

      const result = await themeHandler.create(
        { theme: 'dark', name: 'Dark', overrides: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return left for invalid JSON in overrides', async () => {
      const storage = createTestStorage();

      const result = await themeHandler.create(
        { theme: 'bad', name: 'Bad', overrides: 'not-json{' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARSE_ERROR');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await themeHandler.create(
        { theme: 'dark', name: 'Dark', overrides: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('extend', () => {
    it('should extend from a base theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme', 'base', {
        theme: 'base',
        overrides: { colors: { primary: '#111' } },
      });

      const result = await themeHandler.extend(
        {
          theme: 'child',
          base: 'base',
          overrides: JSON.stringify({ colors: { secondary: '#222' } }),
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.theme).toBe('child');
        }
      }
    });

    it('should return notfound when base theme does not exist', async () => {
      const storage = createTestStorage();

      const result = await themeHandler.extend(
        { theme: 'child', base: 'missing', overrides: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('activate', () => {
    it('should activate an existing theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme', 'dark', { theme: 'dark', active: false, priority: 0 });

      const result = await themeHandler.activate(
        { theme: 'dark', priority: 10 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing theme', async () => {
      const storage = createTestStorage();

      const result = await themeHandler.activate(
        { theme: 'missing', priority: 1 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('deactivate', () => {
    it('should deactivate an existing theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme', 'dark', { theme: 'dark', active: true, priority: 10 });

      const result = await themeHandler.deactivate({ theme: 'dark' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing theme', async () => {
      const storage = createTestStorage();

      const result = await themeHandler.deactivate({ theme: 'missing' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('resolve', () => {
    it('should resolve tokens from a single theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme', 'dark', {
        theme: 'dark',
        overrides: { bg: '#000', fg: '#fff' },
        base: null,
      });

      const result = await themeHandler.resolve({ theme: 'dark' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const tokens = JSON.parse(result.right.tokens);
          expect(tokens.bg).toBe('#000');
          expect(tokens.fg).toBe('#fff');
        }
      }
    });

    it('should resolve tokens through inheritance chain', async () => {
      const storage = createTestStorage();
      await storage.put('theme', 'base', {
        theme: 'base',
        overrides: { bg: '#eee', fg: '#111' },
        base: null,
      });
      await storage.put('theme', 'dark', {
        theme: 'dark',
        overrides: { bg: '#000' },
        base: 'base',
      });

      const result = await themeHandler.resolve({ theme: 'dark' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const tokens = JSON.parse(result.right.tokens);
          expect(tokens.bg).toBe('#000');
          expect(tokens.fg).toBe('#111');
        }
      }
    });

    it('should return notfound for a missing theme', async () => {
      const storage = createTestStorage();

      const result = await themeHandler.resolve({ theme: 'missing' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
