// Relation — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { relationHandler } from './handler.js';
import type { RelationStorage } from './types.js';

const createTestStorage = (): RelationStorage => {
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

const createFailingStorage = (): RelationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = relationHandler;

describe('Relation handler', () => {
  describe('defineRelation', () => {
    it('should define a new relation and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.defineRelation(
        { relation: 'authored-by', schema: 'many-to-one' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.relation).toBe('authored-by');
        }
      }
    });

    it('should return exists when relation is already defined', async () => {
      const storage = createTestStorage();
      await handler.defineRelation(
        { relation: 'dup', schema: 'one-to-one' },
        storage,
      )();

      const result = await handler.defineRelation(
        { relation: 'dup', schema: 'one-to-one' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.defineRelation(
        { relation: 'test', schema: 'many-to-many' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('link', () => {
    it('should return invalid when relation is not defined', async () => {
      const storage = createTestStorage();
      const result = await handler.link(
        { relation: 'undefined-rel', source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should link two entities in a many-to-many relation', async () => {
      const storage = createTestStorage();
      await handler.defineRelation(
        { relation: 'tagged', schema: 'many-to-many' },
        storage,
      )();

      const result = await handler.link(
        { relation: 'tagged', source: 'article-1', target: 'tag-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.source).toBe('article-1');
          expect(result.right.target).toBe('tag-1');
        }
      }
    });

    it('should return invalid for duplicate link', async () => {
      const storage = createTestStorage();
      await handler.defineRelation(
        { relation: 'likes', schema: 'many-to-many' },
        storage,
      )();
      await handler.link(
        { relation: 'likes', source: 'user-1', target: 'post-1' },
        storage,
      )();

      const result = await handler.link(
        { relation: 'likes', source: 'user-1', target: 'post-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
        if (result.right.variant === 'invalid') {
          expect(result.right.message).toContain('already exists');
        }
      }
    });

    it('should enforce one-to-one cardinality', async () => {
      const storage = createTestStorage();
      await handler.defineRelation(
        { relation: 'profile', schema: 'one-to-one' },
        storage,
      )();
      await handler.link(
        { relation: 'profile', source: 'user-1', target: 'profile-1' },
        storage,
      )();

      // Try to add a second target from the same source
      const result = await handler.link(
        { relation: 'profile', source: 'user-1', target: 'profile-2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
        if (result.right.variant === 'invalid') {
          expect(result.right.message).toContain('Cardinality violated');
        }
      }
    });
  });

  describe('unlink', () => {
    it('should return notfound when link does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.unlink(
        { relation: 'any', source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should unlink an existing link and return ok', async () => {
      const storage = createTestStorage();
      await handler.defineRelation(
        { relation: 'follows', schema: 'many-to-many' },
        storage,
      )();
      await handler.link(
        { relation: 'follows', source: 'u1', target: 'u2' },
        storage,
      )();

      const result = await handler.unlink(
        { relation: 'follows', source: 'u1', target: 'u2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('getRelated', () => {
    it('should return notfound when relation is not defined', async () => {
      const storage = createTestStorage();
      const result = await handler.getRelated(
        { relation: 'unknown', entity: 'x' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return related entities from both directions', async () => {
      const storage = createTestStorage();
      await handler.defineRelation(
        { relation: 'friends', schema: 'many-to-many' },
        storage,
      )();
      await handler.link(
        { relation: 'friends', source: 'alice', target: 'bob' },
        storage,
      )();
      await handler.link(
        { relation: 'friends', source: 'carol', target: 'alice' },
        storage,
      )();

      const result = await handler.getRelated(
        { relation: 'friends', entity: 'alice' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const related = JSON.parse(result.right.related);
          expect(related).toContain('bob');
          expect(related).toContain('carol');
        }
      }
    });

    it('should return empty related list for entity with no links', async () => {
      const storage = createTestStorage();
      await handler.defineRelation(
        { relation: 'empty-rel', schema: 'many-to-many' },
        storage,
      )();

      const result = await handler.getRelated(
        { relation: 'empty-rel', entity: 'loner' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const related = JSON.parse(result.right.related);
        expect(related).toEqual([]);
      }
    });
  });
});
