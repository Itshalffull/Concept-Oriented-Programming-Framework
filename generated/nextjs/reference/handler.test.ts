// Reference — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { referenceHandler } from './handler.js';
import type { ReferenceStorage } from './types.js';

const createTestStorage = (): ReferenceStorage => {
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

const createFailingStorage = (): ReferenceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = referenceHandler;

describe('Reference handler', () => {
  describe('addRef', () => {
    it('should add a new reference and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.addRef(
        { source: 'article-1', target: 'author-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.source).toBe('article-1');
          expect(result.right.target).toBe('author-1');
        }
      }
    });

    it('should return exists when adding a duplicate reference', async () => {
      const storage = createTestStorage();
      await handler.addRef({ source: 'a', target: 'b' }, storage)();

      const result = await handler.addRef({ source: 'a', target: 'b' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should allow multiple targets from the same source', async () => {
      const storage = createTestStorage();
      await handler.addRef({ source: 'doc', target: 'ref-1' }, storage)();
      await handler.addRef({ source: 'doc', target: 'ref-2' }, storage)();

      const refs = await handler.getRefs({ source: 'doc' }, storage)();
      expect(E.isRight(refs)).toBe(true);
      if (E.isRight(refs) && refs.right.variant === 'ok') {
        const targets = JSON.parse(refs.right.targets);
        expect(targets).toContain('ref-1');
        expect(targets).toContain('ref-2');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.addRef(
        { source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeRef', () => {
    it('should return notfound when reference does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.removeRef(
        { source: 'a', target: 'b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should remove an existing reference and return ok', async () => {
      const storage = createTestStorage();
      await handler.addRef({ source: 'a', target: 'b' }, storage)();

      const result = await handler.removeRef({ source: 'a', target: 'b' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }

      // Verify reference is gone
      const refs = await handler.getRefs({ source: 'a' }, storage)();
      expect(E.isRight(refs)).toBe(true);
      if (E.isRight(refs) && refs.right.variant === 'ok') {
        const targets = JSON.parse(refs.right.targets);
        expect(targets).not.toContain('b');
      }
    });
  });

  describe('getRefs', () => {
    it('should return notfound for source with no references', async () => {
      const storage = createTestStorage();
      const result = await handler.getRefs({ source: 'orphan' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return target list for a source with references', async () => {
      const storage = createTestStorage();
      await handler.addRef({ source: 'src', target: 't1' }, storage)();
      await handler.addRef({ source: 'src', target: 't2' }, storage)();

      const result = await handler.getRefs({ source: 'src' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const targets = JSON.parse(result.right.targets);
          expect(targets.length).toBe(2);
        }
      }
    });
  });

  describe('resolveTarget', () => {
    it('should return exists=false for unknown entity', async () => {
      const storage = createTestStorage();
      const result = await handler.resolveTarget({ target: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.exists).toBe(false);
      }
    });

    it('should return exists=true when entity exists in storage', async () => {
      const storage = createTestStorage();
      await storage.put('entities', 'real-entity', { id: 'real-entity' });

      const result = await handler.resolveTarget({ target: 'real-entity' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.exists).toBe(true);
      }
    });
  });
});
