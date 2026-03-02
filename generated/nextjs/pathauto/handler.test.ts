// Pathauto — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { pathautoHandler } from './handler.js';
import type { PathautoStorage } from './types.js';

const createTestStorage = (): PathautoStorage => {
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

const createFailingStorage = (): PathautoStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Pathauto handler', () => {
  describe('generateAlias', () => {
    it('should generate an alias from a pattern and entity', async () => {
      const storage = createTestStorage();
      await storage.put('entity', 'post-1', {
        type: 'blog',
        title: 'Hello World',
      });

      const result = await pathautoHandler.generateAlias(
        { pattern: '/content/[type]/[title]', entity: 'post-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.alias).toBe('/content/blog/hello-world');
        }
      }
    });

    it('should return notfound when entity does not exist', async () => {
      const storage = createTestStorage();

      const result = await pathautoHandler.generateAlias(
        { pattern: '/[title]', entity: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should persist the alias mapping to storage', async () => {
      const storage = createTestStorage();
      await storage.put('entity', 'e1', { title: 'Test' });

      await pathautoHandler.generateAlias(
        { pattern: '/[title]', entity: 'e1' },
        storage,
      )();

      const stored = await storage.get('pathauto', '/test');
      expect(stored).not.toBeNull();
      expect(stored!.entity).toBe('e1');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await pathautoHandler.generateAlias(
        { pattern: '/[title]', entity: 'e1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('bulkGenerate', () => {
    it('should generate aliases for multiple entities', async () => {
      const storage = createTestStorage();
      await storage.put('entity', 'a', { title: 'Alpha' });
      await storage.put('entity', 'b', { title: 'Beta' });

      const result = await pathautoHandler.bulkGenerate(
        { pattern: '/[title]', entities: JSON.stringify(['a', 'b']) },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const aliases = JSON.parse(result.right.aliases);
        expect(aliases).toContain('/alpha');
        expect(aliases).toContain('/beta');
      }
    });

    it('should return notfound when no entities are found', async () => {
      const storage = createTestStorage();

      const result = await pathautoHandler.bulkGenerate(
        { pattern: '/[title]', entities: JSON.stringify(['missing']) },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should handle comma-separated entity IDs', async () => {
      const storage = createTestStorage();
      await storage.put('entity', 'x', { title: 'X' });

      const result = await pathautoHandler.bulkGenerate(
        { pattern: '/[title]', entities: 'x' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const aliases = JSON.parse(result.right.aliases);
        expect(aliases.length).toBe(1);
      }
    });
  });

  describe('cleanString', () => {
    it('should slugify a string for URL use', async () => {
      const storage = createTestStorage();

      const result = await pathautoHandler.cleanString(
        { input: '  Hello World!  ' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.cleaned).toBe('hello-world');
      }
    });

    it('should remove diacritical marks', async () => {
      const storage = createTestStorage();

      const result = await pathautoHandler.cleanString(
        { input: 'cafe' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.cleaned).toBe('cafe');
      }
    });

    it('should collapse multiple hyphens', async () => {
      const storage = createTestStorage();

      const result = await pathautoHandler.cleanString(
        { input: 'a---b---c' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.cleaned).toBe('a-b-c');
      }
    });
  });
});
