// JWT — handler.test.ts
// Unit tests for jWT handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { jWTHandler } from './handler.js';
import type { JWTStorage } from './types.js';

const createTestStorage = (): JWTStorage => {
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

const createFailingStorage = (): JWTStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('JWT handler', () => {
  describe('generate', () => {
    it('should generate a JWT token for a user', async () => {
      const storage = createTestStorage();
      const input = { user: 'alice' };

      const result = await jWTHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.token).toBeTruthy();
        // JWT has 3 parts separated by dots
        const parts = result.right.token.split('.');
        expect(parts).toHaveLength(3);
      }
    });

    it('should store the token in storage', async () => {
      const storage = createTestStorage();
      const input = { user: 'bob' };

      const result = await jWTHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const token = result.right.token;
        const stored = await storage.get('jwt', token);
        expect(stored).not.toBeNull();
        expect(stored?.user).toBe('bob');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await jWTHandler.generate({ user: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('verify', () => {
    it('should verify a valid, non-expired token', async () => {
      const storage = createTestStorage();
      const genResult = await jWTHandler.generate({ user: 'charlie' }, storage)();
      expect(E.isRight(genResult)).toBe(true);
      if (!E.isRight(genResult)) return;

      const token = genResult.right.token;
      const result = await jWTHandler.verify({ token }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.user).toBe('charlie');
        }
      }
    });

    it('should return error for malformed token', async () => {
      const storage = createTestStorage();
      const result = await jWTHandler.verify({ token: 'not.a.valid.token.here' }, storage)();
      // Malformed token should fail at parse step (left channel)
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return error for two-segment token', async () => {
      const storage = createTestStorage();
      const result = await jWTHandler.verify({ token: 'only.two' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return error for revoked token', async () => {
      const storage = createTestStorage();
      const genResult = await jWTHandler.generate({ user: 'dave' }, storage)();
      expect(E.isRight(genResult)).toBe(true);
      if (!E.isRight(genResult)) return;

      const token = genResult.right.token;
      // Mark the token as revoked in storage
      const existing = await storage.get('jwt', token);
      if (existing) {
        await storage.put('jwt', token, { ...existing, revoked: true });
      }

      const result = await jWTHandler.verify({ token }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('revoked');
        }
      }
    });

    it('should return error for unrecognized token not in storage', async () => {
      const storage = createTestStorage();
      // Generate a valid token but use a different storage for verify
      const genStorage = createTestStorage();
      const genResult = await jWTHandler.generate({ user: 'eve' }, genStorage)();
      expect(E.isRight(genResult)).toBe(true);
      if (!E.isRight(genResult)) return;

      const token = genResult.right.token;
      // Verify against empty storage
      const result = await jWTHandler.verify({ token }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('not recognized');
        }
      }
    });
  });
});
