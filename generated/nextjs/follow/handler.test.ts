// Follow — handler.test.ts
// Unit tests for follow handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { followHandler } from './handler.js';
import type { FollowStorage } from './types.js';

const createTestStorage = (): FollowStorage => {
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

const createFailingStorage = (): FollowStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Follow handler', () => {
  describe('follow', () => {
    it('should create a follow relationship', async () => {
      const storage = createTestStorage();
      const result = await followHandler.follow(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.user).toBe('alice');
        expect(result.right.target).toBe('bob');
      }
    });

    it('should be idempotent for duplicate follows', async () => {
      const storage = createTestStorage();
      await followHandler.follow({ user: 'alice', target: 'bob' }, storage)();
      const result = await followHandler.follow({ user: 'alice', target: 'bob' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should reject self-following with left', async () => {
      const storage = createTestStorage();
      const result = await followHandler.follow(
        { user: 'alice', target: 'alice' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('SELF_FOLLOW');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await followHandler.follow(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unfollow', () => {
    it('should remove a follow relationship', async () => {
      const storage = createTestStorage();
      await followHandler.follow({ user: 'alice', target: 'bob' }, storage)();
      const result = await followHandler.unfollow(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.user).toBe('alice');
        expect(result.right.target).toBe('bob');
      }
    });

    it('should succeed even if not following', async () => {
      const storage = createTestStorage();
      const result = await followHandler.unfollow(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await followHandler.unfollow(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('isFollowing', () => {
    it('should return true when following', async () => {
      const storage = createTestStorage();
      await followHandler.follow({ user: 'alice', target: 'bob' }, storage)();
      const result = await followHandler.isFollowing(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.following).toBe(true);
      }
    });

    it('should return false when not following', async () => {
      const storage = createTestStorage();
      const result = await followHandler.isFollowing(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.following).toBe(false);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await followHandler.isFollowing(
        { user: 'alice', target: 'bob' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
