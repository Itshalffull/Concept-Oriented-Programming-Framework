// Collection — handler.test.ts
// Unit tests for collection handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { collectionHandler } from './handler.js';
import type { CollectionStorage } from './types.js';

const handler = collectionHandler;

const createTestStorage = (): CollectionStorage => {
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

const createFailingStorage = (): CollectionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Collection handler', () => {
  describe('create', () => {
    it('should create a new collection', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when collection already exists', async () => {
      const storage = createTestStorage();
      await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      const result = await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addMember', () => {
    it('should add a member to an existing collection', async () => {
      const storage = createTestStorage();
      await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      const result = await handler.addMember(
        { collection: 'test-col', member: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when collection does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.addMember(
        { collection: 'nonexistent', member: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.addMember(
        { collection: 'test-col', member: 'item-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeMember', () => {
    it('should remove a member from an existing collection', async () => {
      const storage = createTestStorage();
      await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      await handler.addMember({ collection: 'test-col', member: 'item-1' }, storage)();
      const result = await handler.removeMember(
        { collection: 'test-col', member: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when collection does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.removeMember(
        { collection: 'nonexistent', member: 'item-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.removeMember(
        { collection: 'test-col', member: 'item-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getMembers', () => {
    it('should return members of an existing collection', async () => {
      const storage = createTestStorage();
      await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      await handler.addMember({ collection: 'test-col', member: 'item-1' }, storage)();
      await handler.addMember({ collection: 'test-col', member: 'item-2' }, storage)();
      const result = await handler.getMembers({ collection: 'test-col' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.members).toContain('item-1');
          expect(result.right.members).toContain('item-2');
        }
      }
    });

    it('should return notfound when collection does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.getMembers({ collection: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getMembers({ collection: 'test-col' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setSchema', () => {
    it('should update schema on an existing collection', async () => {
      const storage = createTestStorage();
      await handler.create(
        { collection: 'test-col', type: 'article', schema: '{}' },
        storage,
      )();
      const result = await handler.setSchema(
        { collection: 'test-col', schema: '{"title":"string"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when collection does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.setSchema(
        { collection: 'nonexistent', schema: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.setSchema(
        { collection: 'test-col', schema: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
