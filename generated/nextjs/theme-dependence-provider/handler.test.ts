// ThemeDependenceProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { themeDependenceProviderHandler } from './handler.js';
import type { ThemeDependenceProviderStorage } from './types.js';

const createTestStorage = (): ThemeDependenceProviderStorage => {
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

const createFailingStorage = (): ThemeDependenceProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ThemeDependenceProvider handler', () => {
  describe('initialize', () => {
    it('should initialize successfully and return an instance id', async () => {
      const storage = createTestStorage();

      const result = await themeDependenceProviderHandler.initialize({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toMatch(/^tdp-/);
        }
      }
    });

    it('should return loadError on storage failure (handled via orElse)', async () => {
      const storage = createFailingStorage();

      const result = await themeDependenceProviderHandler.initialize({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('addThemeSpec', () => {
    it('should extract and store dependency edges from a theme spec', async () => {
      const storage = createTestStorage();
      const spec = JSON.stringify({
        name: 'dark',
        extends: 'base',
        imports: ['shared-tokens'],
        tokens: { colors: { primary: '{base.colors.accent}' } },
        aliases: { textPrimary: 'colors.primary' },
      });

      const result = await themeDependenceProviderHandler.addThemeSpec(
        { specBody: spec },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBeGreaterThan(0);
      }
    });

    it('should return 0 edges for an empty or invalid spec', async () => {
      const storage = createTestStorage();

      const result = await themeDependenceProviderHandler.addThemeSpec(
        { specBody: 'not-json' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.edgesAdded).toBe(0);
      }
    });
  });

  describe('getDependencies', () => {
    it('should return direct dependencies for a theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme_edges', 'dark:dark:base:extends', {
        themeName: 'dark',
        from: 'dark',
        to: 'base',
        kind: 'extends',
      });
      await storage.put('theme_edges', 'dark:dark:shared:imports', {
        themeName: 'dark',
        from: 'dark',
        to: 'shared',
        kind: 'imports',
      });

      const result = await themeDependenceProviderHandler.getDependencies(
        { theme: 'dark' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies).toContain('base');
        expect(result.right.dependencies).toContain('shared');
      }
    });
  });

  describe('getInheritanceChain', () => {
    it('should return the chain from child to root', async () => {
      const storage = createTestStorage();
      await storage.put('theme_edges', 'child:child:parent:extends', {
        themeName: 'child',
        from: 'child',
        to: 'parent',
        kind: 'extends',
      });
      await storage.put('theme_edges', 'parent:parent:root:extends', {
        themeName: 'parent',
        from: 'parent',
        to: 'root',
        kind: 'extends',
      });

      const result = await themeDependenceProviderHandler.getInheritanceChain(
        { theme: 'child' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.chain).toEqual(['parent', 'root']);
      }
    });
  });

  describe('getTokenReferences', () => {
    it('should return token-ref and alias edges for a theme', async () => {
      const storage = createTestStorage();
      await storage.put('theme_edges', 'dark:dark.fg:base.fg:token-ref', {
        themeName: 'dark',
        from: 'dark.fg',
        to: 'base.fg',
        kind: 'token-ref',
      });

      const result = await themeDependenceProviderHandler.getTokenReferences(
        { theme: 'dark' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.references.length).toBeGreaterThan(0);
        expect(result.right.references[0].from).toBe('dark.fg');
        expect(result.right.references[0].to).toBe('base.fg');
      }
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return transitive dependencies via BFS', async () => {
      const storage = createTestStorage();
      await storage.put('theme_edges', 'a:a:b:extends', {
        themeName: 'a',
        from: 'a',
        to: 'b',
        kind: 'extends',
      });
      await storage.put('theme_edges', 'b:b:c:extends', {
        themeName: 'b',
        from: 'b',
        to: 'c',
        kind: 'extends',
      });

      const result = await themeDependenceProviderHandler.getTransitiveDependencies(
        { theme: 'a' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.dependencies).toContain('b');
        expect(result.right.dependencies).toContain('c');
      }
    });
  });
});
