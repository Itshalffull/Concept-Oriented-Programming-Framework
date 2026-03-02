// Password — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { passwordHandler } from './handler.js';
import type { PasswordStorage } from './types.js';

const createTestStorage = (): PasswordStorage => {
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

const createFailingStorage = (): PasswordStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const VALID_PASSWORD = 'SecurePass1';

describe('Password handler', () => {
  describe('set', () => {
    it('should set a password for a user', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.set(
        { user: 'alice', password: VALID_PASSWORD },
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

    it('should return invalid for password that is too short', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.set(
        { user: 'bob', password: 'Ab1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for password without uppercase', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.set(
        { user: 'carol', password: 'lowercase1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for password without lowercase', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.set(
        { user: 'dave', password: 'UPPERCASE1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for password without digit', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.set(
        { user: 'eve', password: 'NoDigitsHere' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await passwordHandler.set(
        { user: 'fail', password: VALID_PASSWORD },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('check', () => {
    it('should verify a correct password', async () => {
      const storage = createTestStorage();
      await passwordHandler.set({ user: 'alice', password: VALID_PASSWORD }, storage)();

      const result = await passwordHandler.check(
        { user: 'alice', password: VALID_PASSWORD },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.valid).toBe(true);
      }
    });

    it('should reject an incorrect password', async () => {
      const storage = createTestStorage();
      await passwordHandler.set({ user: 'alice', password: VALID_PASSWORD }, storage)();

      const result = await passwordHandler.check(
        { user: 'alice', password: 'WrongPass1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.valid).toBe(false);
      }
    });

    it('should return notfound for user without password', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.check(
        { user: 'unknown', password: 'AnyPass1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('validate', () => {
    it('should validate a strong password', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.validate(
        { password: VALID_PASSWORD },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.valid).toBe(true);
      }
    });

    it('should reject a weak password', async () => {
      const storage = createTestStorage();

      const result = await passwordHandler.validate(
        { password: 'weak' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.valid).toBe(false);
      }
    });
  });
});
