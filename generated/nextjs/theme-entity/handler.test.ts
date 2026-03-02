// ThemeEntity — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { themeEntityHandler } from './handler.js';
import type { ThemeEntityStorage } from './types.js';

const createTestStorage = (): ThemeEntityStorage => {
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

const createFailingStorage = (): ThemeEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ThemeEntity handler', () => {
  describe('register', () => {
    it('should register a new theme entity', async () => {
      const storage = createTestStorage();
      const ast = JSON.stringify({ colors: { primary: '#ff0000' } });

      const result = await themeEntityHandler.register(
        { name: 'dark', source: 'dark.theme.json', ast },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('dark');
        }
      }
    });

    it('should return alreadyRegistered for a duplicate', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'dark', { name: 'dark' });

      const result = await themeEntityHandler.register(
        { name: 'dark', source: 'dark.theme.json', ast: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyRegistered');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await themeEntityHandler.register(
        { name: 'dark', source: 'f.json', ast: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return ok for an existing theme entity', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'dark', { name: 'dark', ast: {} });

      const result = await themeEntityHandler.get({ name: 'dark' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing entity', async () => {
      const storage = createTestStorage();

      const result = await themeEntityHandler.get({ name: 'missing' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('resolveToken', () => {
    it('should resolve a direct token value', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'dark', {
        name: 'dark',
        ast: { colors: { primary: '#ff0000' } },
      });

      const result = await themeEntityHandler.resolveToken(
        { theme: 'dark', tokenPath: 'colors.primary' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.resolvedValue).toBe('#ff0000');
        }
      }
    });

    it('should follow token references ($-prefixed)', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'dark', {
        name: 'dark',
        ast: {
          colors: { primary: '#ff0000', accent: '$colors.primary' },
        },
      });

      const result = await themeEntityHandler.resolveToken(
        { theme: 'dark', tokenPath: 'colors.accent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.resolvedValue).toBe('#ff0000');
        }
      }
    });

    it('should return notfound for a missing theme', async () => {
      const storage = createTestStorage();

      const result = await themeEntityHandler.resolveToken(
        { theme: 'missing', tokenPath: 'colors.primary' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return brokenChain when a reference leads to null', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'dark', {
        name: 'dark',
        ast: { colors: { accent: '$colors.nonexistent' } },
      });

      const result = await themeEntityHandler.resolveToken(
        { theme: 'dark', tokenPath: 'colors.accent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('brokenChain');
      }
    });
  });

  describe('contrastAudit', () => {
    it('should return ok for an existing theme', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'dark', {
        name: 'dark',
        ast: { textColor: '#ffffff', backgroundColor: '#000000' },
      });

      const result = await themeEntityHandler.contrastAudit(
        { theme: 'dark' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('diffThemes', () => {
    it('should return same when two themes are identical', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'a', { name: 'a', ast: { bg: '#000' } });
      await storage.put('themeEntity', 'b', { name: 'b', ast: { bg: '#000' } });

      const result = await themeEntityHandler.diffThemes(
        { a: 'a', b: 'b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('same');
      }
    });

    it('should return ok with differences when themes differ', async () => {
      const storage = createTestStorage();
      await storage.put('themeEntity', 'a', { name: 'a', ast: { bg: '#000' } });
      await storage.put('themeEntity', 'b', { name: 'b', ast: { bg: '#fff' } });

      const result = await themeEntityHandler.diffThemes(
        { a: 'a', b: 'b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('affectedWidgets', () => {
    it('should return affected widgets for a changed token', async () => {
      const storage = createTestStorage();
      await storage.put('widgetBinding', 'btn-1', {
        widget: 'Button',
        theme: 'dark',
        tokens: ['colors.primary'],
      });

      const result = await themeEntityHandler.affectedWidgets(
        { theme: 'dark', changedToken: 'colors.primary' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const widgets = JSON.parse(result.right.widgets);
        expect(widgets).toContain('Button');
      }
    });
  });

  describe('generatedOutputs', () => {
    it('should return generated outputs for a theme', async () => {
      const storage = createTestStorage();

      const result = await themeEntityHandler.generatedOutputs(
        { theme: 'dark' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
