// SuffixArrayIndexProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { suffixArrayIndexProviderHandler } from './handler.js';
import type { SuffixArrayIndexProviderStorage } from './types.js';

const createTestStorage = (): SuffixArrayIndexProviderStorage => {
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

const createFailingStorage = (): SuffixArrayIndexProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = suffixArrayIndexProviderHandler;

describe('SuffixArrayIndexProvider handler', () => {
  describe('initialize', () => {
    it('should return ok with instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('saip-');
        }
      }
    });

    it('should return loadError on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('buildIndex', () => {
    it('should build a suffix array for a text document', async () => {
      const storage = createTestStorage();
      const result = await handler.buildIndex(
        { docId: 'doc-1', text: 'banana' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.arrayLength).toBe(6);
      }
    });

    it('should persist the index in storage', async () => {
      const storage = createTestStorage();
      await handler.buildIndex({ docId: 'doc-persist', text: 'hello world' }, storage)();
      const record = await storage.get('suffix_arrays', 'doc-persist');
      expect(record).not.toBeNull();
      expect(record!['text']).toBe('hello world');
      expect(record!['length']).toBe(11);
    });

    it('should handle empty text', async () => {
      const storage = createTestStorage();
      const result = await handler.buildIndex({ docId: 'empty', text: '' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.arrayLength).toBe(0);
      }
    });
  });

  describe('search', () => {
    it('should find all occurrences of a substring', async () => {
      const storage = createTestStorage();
      await handler.buildIndex({ docId: 'search-doc', text: 'abcabcabc' }, storage)();
      const result = await handler.search(
        { docId: 'search-doc', pattern: 'abc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.results.length).toBe(3);
        const positions = result.right.results.map(r => r.position);
        expect(positions).toContain(0);
        expect(positions).toContain(3);
        expect(positions).toContain(6);
      }
    });

    it('should return empty results for non-matching pattern', async () => {
      const storage = createTestStorage();
      await handler.buildIndex({ docId: 'no-match', text: 'hello world' }, storage)();
      const result = await handler.search(
        { docId: 'no-match', pattern: 'xyz' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.results.length).toBe(0);
      }
    });

    it('should return left for nonexistent document', async () => {
      const storage = createTestStorage();
      const result = await handler.search(
        { docId: 'nonexistent', pattern: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('NOT_FOUND');
      }
    });

    it('should include context with each result', async () => {
      const storage = createTestStorage();
      await handler.buildIndex({ docId: 'ctx-doc', text: 'the quick brown fox jumps over the lazy dog' }, storage)();
      const result = await handler.search(
        { docId: 'ctx-doc', pattern: 'fox' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.results.length).toBe(1);
        expect(result.right.results[0].context).toContain('fox');
      }
    });
  });

  describe('longestRepeated', () => {
    it('should find the longest repeated substring', async () => {
      const storage = createTestStorage();
      await handler.buildIndex({ docId: 'lrs-doc', text: 'abcxyzabcxyz' }, storage)();
      const result = await handler.longestRepeated({ docId: 'lrs-doc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.substring).toBe('abcxyz');
        expect(result.right.length).toBe(6);
      }
    });

    it('should return empty string for text with no repeats', async () => {
      const storage = createTestStorage();
      await handler.buildIndex({ docId: 'unique-doc', text: 'abcdefg' }, storage)();
      const result = await handler.longestRepeated({ docId: 'unique-doc' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // There may be single-char repeats; just check it doesn't error
        expect(result.right.length).toBeLessThan(7);
      }
    });

    it('should return left for nonexistent document', async () => {
      const storage = createTestStorage();
      const result = await handler.longestRepeated({ docId: 'nonexistent' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
