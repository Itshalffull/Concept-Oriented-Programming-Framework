// Taxonomy — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { taxonomyHandler } from './handler.js';
import type { TaxonomyStorage } from './types.js';

const createTestStorage = (): TaxonomyStorage => {
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

const createFailingStorage = (): TaxonomyStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Taxonomy handler', () => {
  describe('createVocabulary', () => {
    it('should create a new vocabulary', async () => {
      const storage = createTestStorage();

      const result = await taxonomyHandler.createVocabulary(
        { vocab: 'genre', name: 'Genre' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for a duplicate vocabulary', async () => {
      const storage = createTestStorage();
      await storage.put('vocabulary', 'genre', { vocab: 'genre', name: 'Genre' });

      const result = await taxonomyHandler.createVocabulary(
        { vocab: 'genre', name: 'Genre' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await taxonomyHandler.createVocabulary(
        { vocab: 'genre', name: 'Genre' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addTerm', () => {
    it('should add a term to an existing vocabulary', async () => {
      const storage = createTestStorage();
      await storage.put('vocabulary', 'genre', { vocab: 'genre' });

      const result = await taxonomyHandler.addTerm(
        { vocab: 'genre', term: 'rock', parent: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should add a term with a parent', async () => {
      const storage = createTestStorage();
      await storage.put('vocabulary', 'genre', { vocab: 'genre' });

      const result = await taxonomyHandler.addTerm(
        { vocab: 'genre', term: 'alternative-rock', parent: O.some('rock') },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing vocabulary', async () => {
      const storage = createTestStorage();

      const result = await taxonomyHandler.addTerm(
        { vocab: 'missing', term: 'rock', parent: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('setParent', () => {
    it('should reparent an existing term', async () => {
      const storage = createTestStorage();
      await storage.put('term', 'genre:rock', { vocab: 'genre', term: 'rock', parent: null });

      const result = await taxonomyHandler.setParent(
        { vocab: 'genre', term: 'rock', parent: 'music' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing term', async () => {
      const storage = createTestStorage();

      const result = await taxonomyHandler.setParent(
        { vocab: 'genre', term: 'missing', parent: 'music' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('tagEntity', () => {
    it('should tag an entity with an existing term', async () => {
      const storage = createTestStorage();
      await storage.put('term', 'genre:rock', { vocab: 'genre', term: 'rock' });

      const result = await taxonomyHandler.tagEntity(
        { entity: 'song-1', vocab: 'genre', term: 'rock' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when term does not exist', async () => {
      const storage = createTestStorage();

      const result = await taxonomyHandler.tagEntity(
        { entity: 'song-1', vocab: 'genre', term: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('untagEntity', () => {
    it('should untag an entity', async () => {
      const storage = createTestStorage();
      await storage.put('entity_term', 'song-1:genre:rock', {
        entity: 'song-1',
        vocab: 'genre',
        term: 'rock',
      });

      const result = await taxonomyHandler.untagEntity(
        { entity: 'song-1', vocab: 'genre', term: 'rock' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when the entity-term association does not exist', async () => {
      const storage = createTestStorage();

      const result = await taxonomyHandler.untagEntity(
        { entity: 'song-1', vocab: 'genre', term: 'rock' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
