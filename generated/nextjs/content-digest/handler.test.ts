// ContentDigest — handler.test.ts
// Unit tests for contentDigest handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { contentDigestHandler } from './handler.js';
import type { ContentDigestStorage } from './types.js';

const handler = contentDigestHandler;

const createTestStorage = (): ContentDigestStorage => {
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

const createFailingStorage = (): ContentDigestStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ContentDigest handler', () => {
  describe('compute', () => {
    it('should compute a digest using sha256', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        { unit: 'hello world', algorithm: 'sha256' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.digest).toContain('sha256:');
        }
      }
    });

    it('should compute deterministic digests', async () => {
      const storage = createTestStorage();
      const result1 = await handler.compute(
        { unit: 'test-content', algorithm: 'sha256' },
        storage,
      )();
      const result2 = await handler.compute(
        { unit: 'test-content', algorithm: 'sha256' },
        storage,
      )();
      expect(E.isRight(result1)).toBe(true);
      expect(E.isRight(result2)).toBe(true);
      if (E.isRight(result1) && E.isRight(result2) &&
          result1.right.variant === 'ok' && result2.right.variant === 'ok') {
        expect(result1.right.digest).toBe(result2.right.digest);
      }
    });

    it('should return unsupportedAlgorithm for unknown algorithm', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        { unit: 'test', algorithm: 'unknown-algo' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupportedAlgorithm');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.compute(
        { unit: 'test', algorithm: 'sha256' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('lookup', () => {
    it('should find units associated with a computed digest', async () => {
      const storage = createTestStorage();
      const computeResult = await handler.compute(
        { unit: 'lookup-content', algorithm: 'sha256' },
        storage,
      )();
      if (E.isRight(computeResult) && computeResult.right.variant === 'ok') {
        const result = await handler.lookup(
          { hash: computeResult.right.digest },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            const units = JSON.parse(result.right.units);
            expect(units).toContain('lookup-content');
          }
        }
      }
    });

    it('should return notfound when hash does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.lookup({ hash: 'nonexistent-hash' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.lookup({ hash: 'test-hash' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('equivalent', () => {
    it('should return yes for identical content', async () => {
      const storage = createTestStorage();
      const result = await handler.equivalent(
        { a: 'same-content', b: 'same-content' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('yes');
      }
    });

    it('should return no for different content', async () => {
      const storage = createTestStorage();
      const result = await handler.equivalent(
        { a: 'content-a', b: 'content-b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('no');
        if (result.right.variant === 'no') {
          expect(result.right.diffSummary).toContain('digest_a=');
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.equivalent(
        { a: 'content-a', b: 'content-b' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
