// Resource — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { resourceHandler } from './handler.js';
import type { ResourceStorage } from './types.js';

const createTestStorage = (): ResourceStorage => {
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

const createFailingStorage = (): ResourceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = resourceHandler;

describe('Resource handler', () => {
  describe('upsert', () => {
    it('should create a new resource when none exists', async () => {
      const storage = createTestStorage();
      const result = await handler.upsert(
        { locator: 'file://main.ts', kind: 'source', digest: 'abc123', lastModified: O.none, size: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('created');
        if (result.right.variant === 'created') {
          expect(result.right.resource).toBe('file://main.ts');
        }
      }
    });

    it('should return unchanged when digest matches', async () => {
      const storage = createTestStorage();
      await handler.upsert(
        { locator: 'file://main.ts', kind: 'source', digest: 'abc123', lastModified: O.none, size: O.none },
        storage,
      )();
      const result = await handler.upsert(
        { locator: 'file://main.ts', kind: 'source', digest: 'abc123', lastModified: O.none, size: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unchanged');
      }
    });

    it('should return changed when digest differs', async () => {
      const storage = createTestStorage();
      await handler.upsert(
        { locator: 'file://main.ts', kind: 'source', digest: 'abc123', lastModified: O.none, size: O.none },
        storage,
      )();
      const result = await handler.upsert(
        { locator: 'file://main.ts', kind: 'source', digest: 'def456', lastModified: O.none, size: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('changed');
        if (result.right.variant === 'changed') {
          expect(result.right.previousDigest).toBe('abc123');
        }
      }
    });

    it('should use provided lastModified and size', async () => {
      const storage = createTestStorage();
      const date = new Date('2026-01-01');
      const result = await handler.upsert(
        { locator: 'file://a.ts', kind: 'source', digest: 'x', lastModified: O.some(date), size: O.some(42) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.upsert(
        { locator: 'file://x.ts', kind: 'source', digest: 'abc', lastModified: O.none, size: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('get', () => {
    it('should return ok when resource exists', async () => {
      const storage = createTestStorage();
      await handler.upsert(
        { locator: 'file://main.ts', kind: 'source', digest: 'abc123', lastModified: O.none, size: O.none },
        storage,
      )();
      const result = await handler.get({ locator: 'file://main.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.kind).toBe('source');
          expect(result.right.digest).toBe('abc123');
        }
      }
    });

    it('should return notFound when resource does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ locator: 'file://missing.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get({ locator: 'file://x.ts' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('list', () => {
    it('should list all resources when kind is none', async () => {
      const storage = createTestStorage();
      await handler.upsert({ locator: 'a.ts', kind: 'source', digest: '1', lastModified: O.none, size: O.none }, storage)();
      await handler.upsert({ locator: 'b.css', kind: 'style', digest: '2', lastModified: O.none, size: O.none }, storage)();
      const result = await handler.list({ kind: O.none }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.resources.length).toBe(2);
      }
    });

    it('should filter resources by kind', async () => {
      const storage = createTestStorage();
      await handler.upsert({ locator: 'a.ts', kind: 'source', digest: '1', lastModified: O.none, size: O.none }, storage)();
      await handler.upsert({ locator: 'b.css', kind: 'style', digest: '2', lastModified: O.none, size: O.none }, storage)();
      const result = await handler.list({ kind: O.some('source') }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.resources.length).toBe(1);
        expect(result.right.resources[0].kind).toBe('source');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.list({ kind: O.none }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove an existing resource', async () => {
      const storage = createTestStorage();
      await handler.upsert({ locator: 'a.ts', kind: 'source', digest: '1', lastModified: O.none, size: O.none }, storage)();
      const result = await handler.remove({ locator: 'a.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notFound when removing non-existent resource', async () => {
      const storage = createTestStorage();
      const result = await handler.remove({ locator: 'missing.ts' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });
  });

  describe('diff', () => {
    it('should return unchanged when digests are equal', async () => {
      const storage = createTestStorage();
      await handler.upsert({ locator: 'a.ts', kind: 'source', digest: 'abc', lastModified: O.none, size: O.none }, storage)();
      const result = await handler.diff({ locator: 'a.ts', oldDigest: 'abc', newDigest: 'abc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.changeType).toBe('unchanged');
        }
      }
    });

    it('should return added when old digest is empty', async () => {
      const storage = createTestStorage();
      await handler.upsert({ locator: 'a.ts', kind: 'source', digest: 'abc', lastModified: O.none, size: O.none }, storage)();
      const result = await handler.diff({ locator: 'a.ts', oldDigest: '', newDigest: 'abc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.changeType).toBe('added');
      }
    });

    it('should return removed when new digest is empty', async () => {
      const storage = createTestStorage();
      await handler.upsert({ locator: 'a.ts', kind: 'source', digest: 'abc', lastModified: O.none, size: O.none }, storage)();
      const result = await handler.diff({ locator: 'a.ts', oldDigest: 'abc', newDigest: '' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.changeType).toBe('removed');
      }
    });

    it('should return modified when digests differ', async () => {
      const storage = createTestStorage();
      await handler.upsert({ locator: 'a.ts', kind: 'source', digest: 'abc', lastModified: O.none, size: O.none }, storage)();
      const result = await handler.diff({ locator: 'a.ts', oldDigest: 'abc', newDigest: 'def' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.changeType).toBe('modified');
      }
    });

    it('should return unknown when resource not found', async () => {
      const storage = createTestStorage();
      const result = await handler.diff({ locator: 'missing.ts', oldDigest: 'a', newDigest: 'b' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknown');
      }
    });
  });
});
