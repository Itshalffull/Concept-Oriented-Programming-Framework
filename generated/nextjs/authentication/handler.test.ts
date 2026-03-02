// Authentication — handler.test.ts
// Unit tests for authentication handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { authenticationHandler } from './handler.js';
import type { AuthenticationStorage } from './types.js';

const createTestStorage = (): AuthenticationStorage => {
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

const createFailingStorage = (): AuthenticationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Authentication handler', () => {
  describe('register', () => {
    it('registers successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'password123' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.user).toBe('user-1');
        }
      }
    });

    it('returns exists when registering same user twice', async () => {
      const storage = createTestStorage();
      await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'password123' },
        storage,
      )();
      const result = await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'different' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'password' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('login', () => {
    it('returns invalid for nonexistent user', async () => {
      const storage = createTestStorage();
      const result = await authenticationHandler.login(
        { user: 'nonexistent', credentials: 'password' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('logs in successfully with correct credentials', async () => {
      const storage = createTestStorage();
      await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'password123' },
        storage,
      )();
      const result = await authenticationHandler.login(
        { user: 'user-1', credentials: 'password123' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.token).toBeTruthy();
        }
      }
    });

    it('returns invalid for wrong credentials', async () => {
      const storage = createTestStorage();
      await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'password123' },
        storage,
      )();
      const result = await authenticationHandler.login(
        { user: 'user-1', credentials: 'wrong-password' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authenticationHandler.login(
        { user: 'user-1', credentials: 'password' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('logout', () => {
    it('returns notfound for user with no active session', async () => {
      const storage = createTestStorage();
      const result = await authenticationHandler.logout(
        { user: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('logs out successfully after login', async () => {
      const storage = createTestStorage();
      await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'password123' },
        storage,
      )();
      const loginResult = await authenticationHandler.login(
        { user: 'user-1', credentials: 'password123' },
        storage,
      )();
      expect(E.isRight(loginResult)).toBe(true);
      // The find method in our simple storage doesn't filter, so we need to
      // ensure the token is stored with matching properties for the handler to find it
      if (E.isRight(loginResult) && loginResult.right.variant === 'ok') {
        const result = await authenticationHandler.logout(
          { user: 'user-1' },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          // Our simple storage find() returns all tokens, so the handler will find them
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authenticationHandler.logout(
        { user: 'user-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('authenticate', () => {
    it('returns invalid for malformed token', async () => {
      const storage = createTestStorage();
      const result = await authenticationHandler.authenticate(
        { token: 'invalid-token-format' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('authenticates valid token after login', async () => {
      const storage = createTestStorage();
      await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'password123' },
        storage,
      )();
      const loginResult = await authenticationHandler.login(
        { user: 'user-1', credentials: 'password123' },
        storage,
      )();
      expect(E.isRight(loginResult)).toBe(true);
      if (E.isRight(loginResult) && loginResult.right.variant === 'ok') {
        const result = await authenticationHandler.authenticate(
          { token: loginResult.right.token },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.user).toBe('user-1');
          }
        }
      }
    });
  });

  describe('resetPassword', () => {
    it('returns notfound for nonexistent user', async () => {
      const storage = createTestStorage();
      const result = await authenticationHandler.resetPassword(
        { user: 'nonexistent', newCredentials: 'new-password' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('resets password successfully after register', async () => {
      const storage = createTestStorage();
      await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'old-password' },
        storage,
      )();
      const result = await authenticationHandler.resetPassword(
        { user: 'user-1', newCredentials: 'new-password' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.user).toBe('user-1');
        }
      }
    });

    it('can login with new credentials after reset', async () => {
      const storage = createTestStorage();
      await authenticationHandler.register(
        { user: 'user-1', provider: 'local', credentials: 'old-password' },
        storage,
      )();
      await authenticationHandler.resetPassword(
        { user: 'user-1', newCredentials: 'new-password' },
        storage,
      )();
      const result = await authenticationHandler.login(
        { user: 'user-1', credentials: 'new-password' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authenticationHandler.resetPassword(
        { user: 'user-1', newCredentials: 'new-password' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
