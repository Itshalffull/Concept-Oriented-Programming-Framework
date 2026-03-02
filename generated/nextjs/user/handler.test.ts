// User — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { userHandler } from './handler.js';
import type { UserStorage } from './types.js';

const createTestStorage = (): UserStorage => {
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

const createFailingStorage = (): UserStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = userHandler;

describe('User handler', () => {
  describe('register', () => {
    it('should register a new user with valid inputs', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { user: 'alice', name: 'Alice Smith', email: 'alice@example.com' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.user).toBe('alice');
        }
      }
    });

    it('should persist user record to storage', async () => {
      const storage = createTestStorage();
      await handler.register(
        { user: 'bob', name: 'Bob Jones', email: 'bob@example.com' },
        storage,
      )();
      const stored = await storage.get('user', 'bob');
      expect(stored).not.toBeNull();
      expect(stored!.user).toBe('bob');
      expect(stored!.name).toBe('Bob Jones');
      expect(stored!.email).toBe('bob@example.com');
      expect(stored!.active).toBe(true);
    });

    it('should return error for duplicate username', async () => {
      const storage = createTestStorage();
      await handler.register(
        { user: 'charlie', name: 'Charlie', email: 'charlie@example.com' },
        storage,
      )();
      const result = await handler.register(
        { user: 'charlie', name: 'Charlie Two', email: 'charlie2@example.com' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('already taken');
        }
      }
    });

    it('should return error for invalid email format', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { user: 'dave', name: 'Dave', email: 'not-an-email' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('Invalid email');
        }
      }
    });

    it('should return error for username too short', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { user: 'ab', name: 'Short', email: 'short@example.com' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('3-64 characters');
        }
      }
    });

    it('should return error for username with invalid characters', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { user: 'bad user!', name: 'Bad', email: 'bad@example.com' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should accept usernames with hyphens and underscores', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { user: 'my-user_name', name: 'Hyphen', email: 'hyphen@example.com' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { user: 'fail', name: 'Fail', email: 'fail@example.com' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
