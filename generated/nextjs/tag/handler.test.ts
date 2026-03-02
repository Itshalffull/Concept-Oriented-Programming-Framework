// Tag — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { tagHandler } from './handler.js';
import type { TagStorage } from './types.js';

const createTestStorage = (): TagStorage => {
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

const createFailingStorage = (): TagStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Tag handler', () => {
  describe('addTag', () => {
    it('should add a tag to an entity', async () => {
      const storage = createTestStorage();

      const result = await tagHandler.addTag(
        { entity: 'article-1', tag: 'featured' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should not duplicate an entity in a tag', async () => {
      const storage = createTestStorage();

      await tagHandler.addTag({ entity: 'article-1', tag: 'featured' }, storage)();
      await tagHandler.addTag({ entity: 'article-1', tag: 'featured' }, storage)();

      const tagRecord = await storage.get('tag', 'featured');
      const entities = (tagRecord as any).entities as string[];
      expect(entities.filter((e) => e === 'article-1').length).toBe(1);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await tagHandler.addTag(
        { entity: 'e1', tag: 't1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeTag', () => {
    it('should remove a tag from an entity', async () => {
      const storage = createTestStorage();
      await storage.put('tag', 'featured', { tag: 'featured', entities: ['article-1'] });

      const result = await tagHandler.removeTag(
        { entity: 'article-1', tag: 'featured' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when tag does not exist', async () => {
      const storage = createTestStorage();

      const result = await tagHandler.removeTag(
        { entity: 'article-1', tag: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getByTag', () => {
    it('should return entities associated with a tag', async () => {
      const storage = createTestStorage();
      await storage.put('tag', 'featured', { tag: 'featured', entities: ['a1', 'a2'] });

      const result = await tagHandler.getByTag({ tag: 'featured' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.entities).toBe('a1,a2');
      }
    });

    it('should return empty string when tag has no entities', async () => {
      const storage = createTestStorage();

      const result = await tagHandler.getByTag({ tag: 'unknown' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.entities).toBe('');
      }
    });
  });

  describe('getChildren', () => {
    it('should return children of a tag', async () => {
      const storage = createTestStorage();
      await storage.put('tag', 'parent', { tag: 'parent', children: ['child1', 'child2'] });

      const result = await tagHandler.getChildren({ tag: 'parent' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.children).toBe('child1,child2');
        }
      }
    });

    it('should return notfound for a missing tag', async () => {
      const storage = createTestStorage();

      const result = await tagHandler.getChildren({ tag: 'missing' }, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('rename', () => {
    it('should rename a tag', async () => {
      const storage = createTestStorage();
      await storage.put('tag', 'old-tag', { tag: 'old-tag', entities: [] });

      const result = await tagHandler.rename(
        { tag: 'old-tag', name: 'new-name' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing tag', async () => {
      const storage = createTestStorage();

      const result = await tagHandler.rename(
        { tag: 'missing', name: 'new-name' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
