// Authorization — handler.test.ts
// Unit tests for authorization handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { authorizationHandler } from './handler.js';
import type { AuthorizationStorage } from './types.js';

const createTestStorage = (): AuthorizationStorage => {
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

const createFailingStorage = (): AuthorizationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Authorization handler', () => {
  describe('grantPermission', () => {
    it('grants permission successfully (creates role)', async () => {
      const storage = createTestStorage();
      const result = await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.role).toBe('admin');
          expect(result.right.permission).toBe('users.write');
        }
      }
    });

    it('grants additional permission to existing role', async () => {
      const storage = createTestStorage();
      await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.read' },
        storage,
      )();
      const result = await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('revokePermission', () => {
    it('returns notfound for nonexistent role', async () => {
      const storage = createTestStorage();
      const result = await authorizationHandler.revokePermission(
        { role: 'nonexistent', permission: 'users.write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns notfound when permission is not on role', async () => {
      const storage = createTestStorage();
      await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.read' },
        storage,
      )();
      const result = await authorizationHandler.revokePermission(
        { role: 'admin', permission: 'users.delete' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('revokes permission successfully', async () => {
      const storage = createTestStorage();
      await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      const result = await authorizationHandler.revokePermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.role).toBe('admin');
          expect(result.right.permission).toBe('users.write');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authorizationHandler.revokePermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('assignRole', () => {
    it('returns notfound when role does not exist', async () => {
      const storage = createTestStorage();
      const result = await authorizationHandler.assignRole(
        { user: 'user-1', role: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('assigns role successfully after grant', async () => {
      const storage = createTestStorage();
      await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      const result = await authorizationHandler.assignRole(
        { user: 'user-1', role: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.user).toBe('user-1');
          expect(result.right.role).toBe('admin');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authorizationHandler.assignRole(
        { user: 'user-1', role: 'admin' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkPermission', () => {
    it('returns granted false for user with no roles', async () => {
      const storage = createTestStorage();
      const result = await authorizationHandler.checkPermission(
        { user: 'user-1', permission: 'users.write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.granted).toBe(false);
      }
    });

    it('returns granted true after role assignment with permission', async () => {
      const storage = createTestStorage();
      await authorizationHandler.grantPermission(
        { role: 'admin', permission: 'users.write' },
        storage,
      )();
      await authorizationHandler.assignRole(
        { user: 'user-1', role: 'admin' },
        storage,
      )();
      const result = await authorizationHandler.checkPermission(
        { user: 'user-1', permission: 'users.write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.granted).toBe(true);
      }
    });

    it('returns granted false for permission not in role', async () => {
      const storage = createTestStorage();
      await authorizationHandler.grantPermission(
        { role: 'viewer', permission: 'users.read' },
        storage,
      )();
      await authorizationHandler.assignRole(
        { user: 'user-1', role: 'viewer' },
        storage,
      )();
      const result = await authorizationHandler.checkPermission(
        { user: 'user-1', permission: 'users.delete' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.granted).toBe(false);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await authorizationHandler.checkPermission(
        { user: 'user-1', permission: 'users.write' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
