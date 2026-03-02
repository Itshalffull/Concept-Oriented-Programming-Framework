// Version — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { versionHandler } from './handler.js';
import type { VersionStorage } from './types.js';

const createTestStorage = (): VersionStorage => {
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

const createFailingStorage = (): VersionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = versionHandler;

describe('Version handler', () => {
  describe('snapshot', () => {
    it('should create a version snapshot', async () => {
      const storage = createTestStorage();
      const result = await handler.snapshot(
        { version: 'v1', entity: 'doc-1', data: 'Hello world', author: 'alice' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.version).toBe('v1');
      }
    });

    it('should persist snapshot to storage', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'v2', entity: 'doc-1', data: 'Content here', author: 'bob' },
        storage,
      )();
      const stored = await storage.get('version', 'v2');
      expect(stored).not.toBeNull();
      expect(stored!.entity).toBe('doc-1');
      expect(stored!.data).toBe('Content here');
      expect(stored!.author).toBe('bob');
    });

    it('should maintain entity-to-versions index', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'v1', entity: 'entity-x', data: 'a', author: 'alice' },
        storage,
      )();
      await handler.snapshot(
        { version: 'v2', entity: 'entity-x', data: 'b', author: 'alice' },
        storage,
      )();
      const index = await storage.get('version_index', 'entity-x');
      expect(index).not.toBeNull();
      const versions = index!.versions as string[];
      expect(versions).toContain('v1');
      expect(versions).toContain('v2');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.snapshot(
        { version: 'fail', entity: 'e', data: 'd', author: 'a' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listVersions', () => {
    it('should list all versions for an entity', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'v1', entity: 'listing-entity', data: 'a', author: 'alice' },
        storage,
      )();
      await handler.snapshot(
        { version: 'v2', entity: 'listing-entity', data: 'b', author: 'alice' },
        storage,
      )();

      const result = await handler.listVersions(
        { entity: 'listing-entity' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.versions).toContain('v1');
        expect(result.right.versions).toContain('v2');
      }
    });

    it('should return empty string when entity has no versions', async () => {
      const storage = createTestStorage();
      const result = await handler.listVersions(
        { entity: 'no-versions' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.versions).toBe('');
      }
    });
  });

  describe('rollback', () => {
    it('should return snapshot data for an existing version', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'rollback-v1', entity: 'doc-rb', data: 'original content', author: 'alice' },
        storage,
      )();

      const result = await handler.rollback(
        { version: 'rollback-v1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.data).toBe('original content');
        }
      }
    });

    it('should return notfound for missing version', async () => {
      const storage = createTestStorage();
      const result = await handler.rollback(
        { version: 'nonexistent-v99' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
        if (result.right.variant === 'notfound') {
          expect(result.right.message).toContain('nonexistent-v99');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.rollback({ version: 'fail' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('diff', () => {
    it('should compute line-level diff between two versions', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'diff-a', entity: 'doc-diff', data: 'line1\nline2\nline3', author: 'alice' },
        storage,
      )();
      await handler.snapshot(
        { version: 'diff-b', entity: 'doc-diff', data: 'line1\nchanged\nline3', author: 'alice' },
        storage,
      )();

      const result = await handler.diff(
        { versionA: 'diff-a', versionB: 'diff-b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.changes).toContain('-line2');
          expect(result.right.changes).toContain('+changed');
        }
      }
    });

    it('should return notfound when versionA does not exist', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'exists', entity: 'e', data: 'd', author: 'a' },
        storage,
      )();
      const result = await handler.diff(
        { versionA: 'missing', versionB: 'exists' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
        if (result.right.variant === 'notfound') {
          expect(result.right.message).toContain('missing');
        }
      }
    });

    it('should return notfound when versionB does not exist', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'exists2', entity: 'e', data: 'd', author: 'a' },
        storage,
      )();
      const result = await handler.diff(
        { versionA: 'exists2', versionB: 'missing2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should show no changes for identical snapshots', async () => {
      const storage = createTestStorage();
      await handler.snapshot(
        { version: 'same-a', entity: 'e', data: 'identical', author: 'a' },
        storage,
      )();
      await handler.snapshot(
        { version: 'same-b', entity: 'e', data: 'identical', author: 'a' },
        storage,
      )();
      const result = await handler.diff(
        { versionA: 'same-a', versionB: 'same-b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        // All lines should be unchanged (prefixed with space, not +/-)
        expect(result.right.changes).not.toContain('-');
        expect(result.right.changes).not.toContain('+');
      }
    });
  });
});
