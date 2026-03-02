// ContentNode — handler.test.ts
// Unit tests for contentNode handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { contentNodeHandler } from './handler.js';
import type { ContentNodeStorage } from './types.js';

const handler = contentNodeHandler;

const createTestStorage = (): ContentNodeStorage => {
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

const createFailingStorage = (): ContentNodeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ContentNode handler', () => {
  describe('create', () => {
    it('should create a new content node', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { node: 'node-1', type: 'article', content: 'Hello world', createdBy: 'user-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.node).toBe('node-1');
        }
      }
    });

    it('should return exists when node already exists', async () => {
      const storage = createTestStorage();
      await handler.create(
        { node: 'node-1', type: 'article', content: 'Hello', createdBy: 'user-1' },
        storage,
      )();
      const result = await handler.create(
        { node: 'node-1', type: 'article', content: 'Hello', createdBy: 'user-1' },
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
        { node: 'node-1', type: 'article', content: 'Hello', createdBy: 'user-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update content of an existing node', async () => {
      const storage = createTestStorage();
      await handler.create(
        { node: 'node-1', type: 'article', content: 'Original', createdBy: 'user-1' },
        storage,
      )();
      const result = await handler.update(
        { node: 'node-1', content: 'Updated' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.node).toBe('node-1');
        }
      }
    });

    it('should return notfound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.update(
        { node: 'nonexistent', content: 'Updated' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.update(
        { node: 'node-1', content: 'Updated' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete an existing node', async () => {
      const storage = createTestStorage();
      await handler.create(
        { node: 'node-1', type: 'article', content: 'Delete me', createdBy: 'user-1' },
        storage,
      )();
      const result = await handler.delete({ node: 'node-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.node).toBe('node-1');
        }
      }
    });

    it('should return notfound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.delete({ node: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.delete({ node: 'node-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve an existing node with its content', async () => {
      const storage = createTestStorage();
      await handler.create(
        { node: 'node-1', type: 'article', content: 'Hello world', createdBy: 'user-1' },
        storage,
      )();
      const result = await handler.get({ node: 'node-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.node).toBe('node-1');
          expect(result.right.type).toBe('article');
          expect(result.right.content).toBe('Hello world');
        }
      }
    });

    it('should return notfound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ node: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get({ node: 'node-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setMetadata', () => {
    it('should set metadata on an existing node', async () => {
      const storage = createTestStorage();
      await handler.create(
        { node: 'node-1', type: 'article', content: 'Hello', createdBy: 'user-1' },
        storage,
      )();
      const result = await handler.setMetadata(
        { node: 'node-1', metadata: JSON.stringify({ tags: ['test'] }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.setMetadata(
        { node: 'nonexistent', metadata: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.setMetadata(
        { node: 'node-1', metadata: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('changeType', () => {
    it('should change the type of an existing node', async () => {
      const storage = createTestStorage();
      await handler.create(
        { node: 'node-1', type: 'article', content: 'Hello', createdBy: 'user-1' },
        storage,
      )();
      const result = await handler.changeType(
        { node: 'node-1', type: 'page' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when node does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.changeType(
        { node: 'nonexistent', type: 'page' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.changeType(
        { node: 'node-1', type: 'page' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
