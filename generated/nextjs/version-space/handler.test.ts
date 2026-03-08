// VersionSpace — handler.test.ts
// fp-ts handler tests for parallel overlay management, copy-on-write overrides,
// merge, archive, and resolution chain.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { versionSpaceHandler } from './handler.js';
import type { VersionSpaceStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): VersionSpaceStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

// Failing storage for error propagation tests
const createFailingStorage = (): VersionSpaceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('VersionSpace handler (fp-ts)', () => {
  describe('fork', () => {
    it('creates a new version space with ok variant', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.fork(
        { name: 'redesign', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).space).toBeDefined();
      }
    });

    it('creates a nested sub-space from parent', async () => {
      const storage = createTestStorage();
      const parentResult = await versionSpaceHandler.fork(
        { name: 'parent', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      expect(E.isRight(parentResult)).toBe(true);
      const parentSpace = (parentResult as any).right.space;

      const childResult = await versionSpaceHandler.fork(
        { name: 'child', parent: parentSpace, scope: null, visibility: 'private' },
        storage,
      )();
      expect(E.isRight(childResult)).toBe(true);
      if (E.isRight(childResult)) {
        expect(childResult.right.variant).toBe('ok');
      }
    });

    it('returns parent_not_found for non-existent parent', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.fork(
        { name: 'child', parent: 'nonexistent', scope: null, visibility: 'private' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('parent_not_found');
      }
    });

    it('returns parent_not_found for archived parent', async () => {
      const storage = createTestStorage();
      const parentResult = await versionSpaceHandler.fork(
        { name: 'parent', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const parentSpace = (parentResult as any).right.space;
      await versionSpaceHandler.archive({ space: parentSpace }, storage)();

      const result = await versionSpaceHandler.fork(
        { name: 'child', parent: parentSpace, scope: null, visibility: 'private' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('parent_not_found');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('enter', () => {
    it('allows entering a public space', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'public', parent: null, scope: null, visibility: 'public' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.enter(
        { space, user: 'anyone' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('denies entry to non-members of private space', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'private', parent: null, scope: null, visibility: 'private', user: 'owner' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.enter(
        { space, user: 'stranger' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('access_denied');
      }
    });

    it('returns archived for archived space', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'to-archive', parent: null, scope: null, visibility: 'public' },
        storage,
      )();
      const space = (forkResult as any).right.space;
      await versionSpaceHandler.archive({ space }, storage)();

      const result = await versionSpaceHandler.enter(
        { space, user: 'anyone' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('archived');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionSpaceHandler.enter(
        { space: 'test', user: 'user' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('leave', () => {
    it('returns ok variant', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.leave(
        { space: 'any', user: 'user' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('write', () => {
    it('writes an override with ok variant', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"New"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns read_only for non-existent space', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.write(
        { space: 'nonexistent', entity_id: 'e1', fields: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('read_only');
      }
    });

    it('updates existing override on second write', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"First"}' },
        storage,
      )();
      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Second"}' },
        storage,
      )();

      const resolve = await versionSpaceHandler.resolve(
        { space, entity_id: 'e1' },
        storage,
      )();
      expect(E.isRight(resolve)).toBe(true);
      if (E.isRight(resolve)) {
        expect((resolve.right as any).fields).toBe('{"title":"Second"}');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionSpaceHandler.write(
        { space: 'test', entity_id: 'e1', fields: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('resolves override from the space', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Changed"}' },
        storage,
      )();

      const result = await versionSpaceHandler.resolve(
        { space, entity_id: 'e1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).fields).toBe('{"title":"Changed"}');
      }
    });

    it('returns base when no override exists', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.resolve(
        { space, entity_id: 'unmodified' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).source).toBe('base');
      }
    });

    it('returns not_found for deleted entity', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Gone"}' },
        storage,
      )();
      await versionSpaceHandler.deleteInSpace(
        { space, entity_id: 'e1' },
        storage,
      )();

      const result = await versionSpaceHandler.resolve(
        { space, entity_id: 'e1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('not_found');
      }
    });
  });

  describe('propose', () => {
    it('transitions space to proposed with ok variant', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'proposal', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.propose(
        { space, target: null, message: 'Ready' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns already_proposed on double proposal', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'proposal', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      await versionSpaceHandler.propose(
        { space, target: null, message: 'First' },
        storage,
      )();
      const result = await versionSpaceHandler.propose(
        { space, target: null, message: 'Second' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_proposed');
      }
    });

    it('returns already_proposed for non-existent space', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.propose(
        { space: 'nonexistent', target: null, message: 'X' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_proposed');
      }
    });
  });

  describe('merge', () => {
    it('merges overrides and returns ok with count', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'to-merge', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Changed"}' },
        storage,
      )();

      const result = await versionSpaceHandler.merge(
        { space, target: null, strategy: 'field_merge' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).merged_count).toBe(1);
      }
    });

    it('returns conflicts for non-existent space', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.merge(
        { space: 'nonexistent', target: null, strategy: 'field_merge' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflicts');
      }
    });

    it('reports zero merged_count for empty space', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'empty', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.merge(
        { space, target: null, strategy: 'field_merge' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).merged_count).toBe(0);
      }
    });
  });

  describe('diff', () => {
    it('returns structured changeset of overrides', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'to-diff', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Changed"}' },
        storage,
      )();

      const result = await versionSpaceHandler.diff({ space }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const changes = JSON.parse((result.right as any).changes);
        expect(changes).toHaveLength(1);
        expect(changes[0].entity_id).toBe('e1');
      }
    });

    it('returns empty changeset for space with no overrides', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'empty', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.diff({ space }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const changes = JSON.parse((result.right as any).changes);
        expect(changes).toHaveLength(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionSpaceHandler.diff(
        { space: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('archive', () => {
    it('transitions space to archived with ok variant', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'to-archive', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.archive(
        { space },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns ok even for non-existent space', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.archive(
        { space: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await versionSpaceHandler.archive(
        { space: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('executeInSpace', () => {
    it('returns ok for active space', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'exec', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;

      const result = await versionSpaceHandler.executeInSpace(
        { space, action: 'test', params: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns space_not_found for non-existent space', async () => {
      const storage = createTestStorage();
      const result = await versionSpaceHandler.executeInSpace(
        { space: 'nonexistent', action: 'test', params: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('space_not_found');
      }
    });

    it('returns space_not_found for archived space', async () => {
      const storage = createTestStorage();
      const forkResult = await versionSpaceHandler.fork(
        { name: 'archived', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      const space = (forkResult as any).right.space;
      await versionSpaceHandler.archive({ space }, storage)();

      const result = await versionSpaceHandler.executeInSpace(
        { space, action: 'test', params: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('space_not_found');
      }
    });
  });

  describe('multi-step sequence: fork -> write -> resolve -> merge', () => {
    it('completes full lifecycle', async () => {
      const storage = createTestStorage();

      // Fork
      const forkResult = await versionSpaceHandler.fork(
        { name: 'lifecycle', parent: null, scope: null, visibility: 'shared' },
        storage,
      )();
      expect(E.isRight(forkResult)).toBe(true);
      const space = (forkResult as any).right.space;

      // Write
      const writeResult = await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"status":"draft"}' },
        storage,
      )();
      expect(E.isRight(writeResult)).toBe(true);

      // Resolve
      const resolveResult = await versionSpaceHandler.resolve(
        { space, entity_id: 'e1' },
        storage,
      )();
      expect(E.isRight(resolveResult)).toBe(true);
      if (E.isRight(resolveResult)) {
        expect((resolveResult.right as any).fields).toBe('{"status":"draft"}');
      }

      // Merge
      const mergeResult = await versionSpaceHandler.merge(
        { space, target: null, strategy: 'field_merge' },
        storage,
      )();
      expect(E.isRight(mergeResult)).toBe(true);
      if (E.isRight(mergeResult)) {
        expect(mergeResult.right.variant).toBe('ok');
      }
    });
  });
});
