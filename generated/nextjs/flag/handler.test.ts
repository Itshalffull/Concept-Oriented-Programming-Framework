// Flag — handler.test.ts
// Unit tests for flag handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { flagHandler } from './handler.js';
import type { FlagStorage } from './types.js';

const createTestStorage = (): FlagStorage => {
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

const createFailingStorage = (): FlagStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Flag handler', () => {
  describe('flag', () => {
    it('should create a flag successfully', async () => {
      const storage = createTestStorage();
      const result = await flagHandler.flag(
        { flagging: 'f1', flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for a duplicate flag', async () => {
      const storage = createTestStorage();
      const input = { flagging: 'f1', flagType: 'spam', entity: 'post-1', user: 'user-a' };
      await flagHandler.flag(input, storage)();
      const result = await flagHandler.flag(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should increment the aggregate count', async () => {
      const storage = createTestStorage();
      await flagHandler.flag(
        { flagging: 'f1', flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      await flagHandler.flag(
        { flagging: 'f2', flagType: 'spam', entity: 'post-1', user: 'user-b' },
        storage,
      )();
      const countResult = await flagHandler.getCount(
        { flagType: 'spam', entity: 'post-1' },
        storage,
      )();
      expect(E.isRight(countResult)).toBe(true);
      if (E.isRight(countResult)) {
        expect(countResult.right.count).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flagHandler.flag(
        { flagging: 'f1', flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unflag', () => {
    it('should remove an existing flag', async () => {
      const storage = createTestStorage();
      await flagHandler.flag(
        { flagging: 'f1', flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      const result = await flagHandler.unflag({ flagging: 'f1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing flag', async () => {
      const storage = createTestStorage();
      const result = await flagHandler.unflag({ flagging: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should decrement the aggregate count', async () => {
      const storage = createTestStorage();
      await flagHandler.flag(
        { flagging: 'f1', flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      await flagHandler.flag(
        { flagging: 'f2', flagType: 'spam', entity: 'post-1', user: 'user-b' },
        storage,
      )();
      await flagHandler.unflag({ flagging: 'f1' }, storage)();
      const countResult = await flagHandler.getCount(
        { flagType: 'spam', entity: 'post-1' },
        storage,
      )();
      expect(E.isRight(countResult)).toBe(true);
      if (E.isRight(countResult)) {
        expect(countResult.right.count).toBe(1);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flagHandler.unflag({ flagging: 'f1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('isFlagged', () => {
    it('should return true when flagged', async () => {
      const storage = createTestStorage();
      await flagHandler.flag(
        { flagging: 'f1', flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      const result = await flagHandler.isFlagged(
        { flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.flagged).toBe(true);
      }
    });

    it('should return false when not flagged', async () => {
      const storage = createTestStorage();
      const result = await flagHandler.isFlagged(
        { flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.flagged).toBe(false);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flagHandler.isFlagged(
        { flagType: 'spam', entity: 'post-1', user: 'user-a' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getCount', () => {
    it('should return zero when no flags exist', async () => {
      const storage = createTestStorage();
      const result = await flagHandler.getCount(
        { flagType: 'spam', entity: 'post-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.count).toBe(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flagHandler.getCount(
        { flagType: 'spam', entity: 'post-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
