// ConceptEntity — handler.test.ts
// Unit tests for conceptEntity handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { conceptEntityHandler } from './handler.js';
import type { ConceptEntityStorage } from './types.js';

const handler = conceptEntityHandler;

const createTestStorage = (): ConceptEntityStorage => {
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

const createFailingStorage = (): ConceptEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ConceptEntity handler', () => {
  describe('register', () => {
    it('should register a new concept entity', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { name: 'Article', source: 'article.concept', ast: '{"typeParams":["T"]}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('Article');
        }
      }
    });

    it('should return alreadyRegistered when entity exists', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'Article', source: 'article.concept', ast: '{}' },
        storage,
      )();
      const result = await handler.register(
        { name: 'Article', source: 'article.concept', ast: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyRegistered');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { name: 'Article', source: 'article.concept', ast: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve a registered entity', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'Article', source: 'article.concept', ast: '{}' },
        storage,
      )();
      const result = await handler.get({ name: 'Article' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('Article');
        }
      }
    });

    it('should return notfound when entity does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ name: 'Nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get({ name: 'Article' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByCapability', () => {
    it('should find entities matching a capability', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'Article', source: 'article.concept', ast: '{"capabilities":["publish"]}' },
        storage,
      )();
      const result = await handler.findByCapability({ capability: 'publish' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findByCapability({ capability: 'publish' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByKit', () => {
    it('should return ok with entities for a kit', async () => {
      const storage = createTestStorage();
      const result = await handler.findByKit({ kit: 'content' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findByKit({ kit: 'content' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('generatedArtifacts', () => {
    it('should return ok with artifacts list', async () => {
      const storage = createTestStorage();
      const result = await handler.generatedArtifacts({ entity: 'Article' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generatedArtifacts({ entity: 'Article' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('participatingSyncs', () => {
    it('should return ok with syncs list', async () => {
      const storage = createTestStorage();
      const result = await handler.participatingSyncs({ entity: 'Article' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.participatingSyncs({ entity: 'Article' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkCompatibility', () => {
    it('should return compatible when both entities have no type params', async () => {
      const storage = createTestStorage();
      await handler.register({ name: 'A', source: 'a.concept', ast: '{}' }, storage)();
      await handler.register({ name: 'B', source: 'b.concept', ast: '{}' }, storage)();
      const result = await handler.checkCompatibility({ a: 'A', b: 'B' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('compatible');
      }
    });

    it('should return compatible when entities share type params', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'A', source: 'a.concept', ast: '{"typeParams":["T"]}' },
        storage,
      )();
      await handler.register(
        { name: 'B', source: 'b.concept', ast: '{"typeParams":["T","U"]}' },
        storage,
      )();
      const result = await handler.checkCompatibility({ a: 'A', b: 'B' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('compatible');
      }
    });

    it('should return incompatible when entity not found', async () => {
      const storage = createTestStorage();
      const result = await handler.checkCompatibility({ a: 'A', b: 'B' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.checkCompatibility({ a: 'A', b: 'B' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
