// Comment — handler.test.ts
// Unit tests for comment handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { commentHandler } from './handler.js';
import type { CommentStorage } from './types.js';

const handler = commentHandler;

const createTestStorage = (): CommentStorage => {
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

const createFailingStorage = (): CommentStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Comment handler', () => {
  describe('addComment', () => {
    it('should add a top-level comment', async () => {
      const storage = createTestStorage();
      const result = await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Great post!', author: 'user-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.comment).toBe('c-1');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Test', author: 'user-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reply', () => {
    it('should create a threaded reply to an existing comment', async () => {
      const storage = createTestStorage();
      await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Parent', author: 'user-1' },
        storage,
      )();
      const result = await handler.reply(
        { comment: 'c-2', parent: 'c-1', content: 'Reply', author: 'user-2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.comment).toBe('c-2');
      }
    });

    it('should return Left when parent does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.reply(
        { comment: 'c-2', parent: 'nonexistent', content: 'Reply', author: 'user-2' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARENT_NOT_FOUND');
      }
    });

    it('should return Left when parent is deleted', async () => {
      const storage = createTestStorage();
      await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Parent', author: 'user-1' },
        storage,
      )();
      await handler.delete({ comment: 'c-1' }, storage)();
      const result = await handler.reply(
        { comment: 'c-3', parent: 'c-1', content: 'Reply', author: 'user-2' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARENT_DELETED');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.reply(
        { comment: 'c-2', parent: 'c-1', content: 'Reply', author: 'user-2' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('publish', () => {
    it('should publish an existing comment', async () => {
      const storage = createTestStorage();
      await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Test', author: 'user-1' },
        storage,
      )();
      const result = await handler.publish({ comment: 'c-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when comment does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.publish({ comment: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.publish({ comment: 'c-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unpublish', () => {
    it('should unpublish an existing comment', async () => {
      const storage = createTestStorage();
      await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Test', author: 'user-1' },
        storage,
      )();
      const result = await handler.unpublish({ comment: 'c-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when comment does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.unpublish({ comment: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.unpublish({ comment: 'c-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should soft-delete an existing comment', async () => {
      const storage = createTestStorage();
      await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Test', author: 'user-1' },
        storage,
      )();
      const result = await handler.delete({ comment: 'c-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when comment does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.delete({ comment: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should cascade soft-delete to replies', async () => {
      const storage = createTestStorage();
      await handler.addComment(
        { comment: 'c-1', entity: 'article-1', content: 'Parent', author: 'user-1' },
        storage,
      )();
      await handler.reply(
        { comment: 'c-2', parent: 'c-1', content: 'Reply', author: 'user-2' },
        storage,
      )();
      const result = await handler.delete({ comment: 'c-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.delete({ comment: 'c-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
