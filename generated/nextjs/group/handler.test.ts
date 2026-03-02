// Group — handler.test.ts
// Unit tests for group handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { groupHandler } from './handler.js';
import type { GroupStorage } from './types.js';

const createTestStorage = (): GroupStorage => {
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

const createFailingStorage = (): GroupStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const seedGroup = async (storage: GroupStorage, groupId = 'team-1', name = 'Engineering') => {
  await groupHandler.createGroup({ group: groupId, name }, storage)();
};

describe('Group handler', () => {
  describe('createGroup', () => {
    it('should create a new group', async () => {
      const storage = createTestStorage();
      const result = await groupHandler.createGroup(
        { group: 'team-1', name: 'Engineering' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for duplicate group', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      const result = await groupHandler.createGroup(
        { group: 'team-1', name: 'Different Name' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await groupHandler.createGroup(
        { group: 'g', name: 'n' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addMember', () => {
    it('should add a member to an existing group', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      const result = await groupHandler.addMember(
        { group: 'team-1', user: 'alice', role: 'member' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing group', async () => {
      const storage = createTestStorage();
      const result = await groupHandler.addMember(
        { group: 'missing', user: 'alice', role: 'member' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await groupHandler.addMember(
        { group: 'g', user: 'u', role: 'r' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('assignGroupRole', () => {
    it('should reassign a member role', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      await groupHandler.addMember({ group: 'team-1', user: 'alice', role: 'member' }, storage)();
      const result = await groupHandler.assignGroupRole(
        { group: 'team-1', user: 'alice', role: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing group', async () => {
      const storage = createTestStorage();
      const result = await groupHandler.assignGroupRole(
        { group: 'missing', user: 'alice', role: 'admin' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await groupHandler.assignGroupRole(
        { group: 'g', user: 'u', role: 'r' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addContent', () => {
    it('should add content to a group', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      const result = await groupHandler.addContent(
        { group: 'team-1', content: 'doc-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing group', async () => {
      const storage = createTestStorage();
      const result = await groupHandler.addContent(
        { group: 'missing', content: 'doc-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await groupHandler.addContent(
        { group: 'g', content: 'c' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('checkGroupAccess', () => {
    it('should grant access for admin role', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      await groupHandler.addMember({ group: 'team-1', user: 'alice', role: 'admin' }, storage)();
      const result = await groupHandler.checkGroupAccess(
        { group: 'team-1', user: 'alice', permission: 'write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.granted).toBe(true);
        }
      }
    });

    it('should grant read access for member role', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      await groupHandler.addMember({ group: 'team-1', user: 'bob', role: 'member' }, storage)();
      const result = await groupHandler.checkGroupAccess(
        { group: 'team-1', user: 'bob', permission: 'read' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.granted).toBe(true);
      }
    });

    it('should deny write access for member role', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      await groupHandler.addMember({ group: 'team-1', user: 'bob', role: 'member' }, storage)();
      const result = await groupHandler.checkGroupAccess(
        { group: 'team-1', user: 'bob', permission: 'write' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.granted).toBe(false);
      }
    });

    it('should deny access for non-member', async () => {
      const storage = createTestStorage();
      await seedGroup(storage);
      const result = await groupHandler.checkGroupAccess(
        { group: 'team-1', user: 'stranger', permission: 'read' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.granted).toBe(false);
      }
    });

    it('should return notfound for missing group', async () => {
      const storage = createTestStorage();
      const result = await groupHandler.checkGroupAccess(
        { group: 'missing', user: 'alice', permission: 'read' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await groupHandler.checkGroupAccess(
        { group: 'g', user: 'u', permission: 'p' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
