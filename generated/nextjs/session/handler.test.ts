// Session — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { sessionHandler } from './handler.js';
import type { SessionStorage } from './types.js';

const createTestStorage = (): SessionStorage => {
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

const createFailingStorage = (): SessionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = sessionHandler;

describe('Session handler', () => {
  describe('create', () => {
    it('should create a session and return a token', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { session: 'sess-1', userId: 'user-1', device: 'chrome' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.token).toBeTruthy();
          expect(result.right.token.length).toBe(64);
        }
      }
    });

    it('should persist session data in storage', async () => {
      const storage = createTestStorage();
      await handler.create(
        { session: 'sess-2', userId: 'user-2', device: 'firefox' },
        storage,
      )();
      const record = await storage.get('sessions', 'sess-2');
      expect(record).not.toBeNull();
      expect(record!['userId']).toBe('user-2');
      expect(record!['device']).toBe('firefox');
      expect(record!['isValid']).toBe(true);
    });

    it('should return error when max concurrent sessions exceeded', async () => {
      const storage = createTestStorage();
      for (let i = 0; i < 5; i++) {
        await handler.create(
          { session: `sess-max-${i}`, userId: 'user-max', device: `device-${i}` },
          storage,
        )();
      }
      const result = await handler.create(
        { session: 'sess-max-6', userId: 'user-max', device: 'device-6' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('Maximum concurrent sessions');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.create(
        { session: 'sess-fail', userId: 'user-fail', device: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate an active session as true', async () => {
      const storage = createTestStorage();
      await handler.create(
        { session: 'sess-val', userId: 'user-val', device: 'chrome' },
        storage,
      )();
      const result = await handler.validate({ session: 'sess-val' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.valid).toBe(true);
        }
      }
    });

    it('should return notfound for nonexistent session', async () => {
      const storage = createTestStorage();
      const result = await handler.validate({ session: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return ok(false) for invalidated session', async () => {
      const storage = createTestStorage();
      await storage.put('sessions', 'invalid-sess', {
        sessionId: 'invalid-sess',
        userId: 'u1',
        device: 'd1',
        token: 'tok',
        createdAt: Date.now(),
        expiresAt: Date.now() + 999999,
        isValid: false,
      });
      const result = await handler.validate({ session: 'invalid-sess' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.valid).toBe(false);
        }
      }
    });

    it('should return ok(false) for expired session', async () => {
      const storage = createTestStorage();
      await storage.put('sessions', 'expired-sess', {
        sessionId: 'expired-sess',
        userId: 'u1',
        device: 'd1',
        token: 'tok',
        createdAt: Date.now() - 99999999,
        expiresAt: Date.now() - 1000,
        isValid: true,
      });
      const result = await handler.validate({ session: 'expired-sess' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.valid).toBe(false);
        }
      }
    });
  });

  describe('refresh', () => {
    it('should refresh an active session with a new token', async () => {
      const storage = createTestStorage();
      const createResult = await handler.create(
        { session: 'sess-ref', userId: 'user-ref', device: 'chrome' },
        storage,
      )();
      let originalToken = '';
      if (E.isRight(createResult) && createResult.right.variant === 'ok') {
        originalToken = createResult.right.token;
      }
      const result = await handler.refresh({ session: 'sess-ref' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.token).not.toBe(originalToken);
        }
      }
    });

    it('should return notfound for nonexistent session', async () => {
      const storage = createTestStorage();
      const result = await handler.refresh({ session: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return expired for expired session', async () => {
      const storage = createTestStorage();
      await storage.put('sessions', 'exp-sess', {
        sessionId: 'exp-sess',
        userId: 'u1',
        device: 'd1',
        token: 'tok',
        createdAt: Date.now() - 99999999,
        expiresAt: Date.now() - 1000,
        isValid: true,
      });
      const result = await handler.refresh({ session: 'exp-sess' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('expired');
      }
    });
  });

  describe('destroy', () => {
    it('should destroy an existing session', async () => {
      const storage = createTestStorage();
      await handler.create(
        { session: 'sess-del', userId: 'user-del', device: 'chrome' },
        storage,
      )();
      const result = await handler.destroy({ session: 'sess-del' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.session).toBe('sess-del');
        }
      }
      const record = await storage.get('sessions', 'sess-del');
      expect(record).toBeNull();
    });

    it('should return notfound for nonexistent session', async () => {
      const storage = createTestStorage();
      const result = await handler.destroy({ session: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('destroyAll', () => {
    it('should destroy all sessions for a user', async () => {
      const storage = createTestStorage();
      await handler.create({ session: 's1', userId: 'user-all', device: 'd1' }, storage)();
      await handler.create({ session: 's2', userId: 'user-all', device: 'd2' }, storage)();
      const result = await handler.destroyAll({ userId: 'user-all' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.userId).toBe('user-all');
      }
    });
  });

  describe('getContext', () => {
    it('should return user context for an existing session', async () => {
      const storage = createTestStorage();
      await handler.create(
        { session: 'sess-ctx', userId: 'user-ctx', device: 'safari' },
        storage,
      )();
      const result = await handler.getContext({ session: 'sess-ctx' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.userId).toBe('user-ctx');
          expect(result.right.device).toBe('safari');
        }
      }
    });

    it('should return notfound for nonexistent session', async () => {
      const storage = createTestStorage();
      const result = await handler.getContext({ session: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
