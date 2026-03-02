// Merge — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { mergeHandler } from './handler.js';
import type { MergeStorage } from './types.js';

const createTestStorage = (): MergeStorage => {
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

const createFailingStorage = (): MergeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = mergeHandler;

describe('Merge handler', () => {
  describe('registerStrategy', () => {
    it('should register a new strategy', async () => {
      const storage = createTestStorage();
      const result = await handler.registerStrategy(
        { name: 'text-merge', contentTypes: ['text/plain'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return duplicate for existing strategy', async () => {
      const storage = createTestStorage();
      await handler.registerStrategy(
        { name: 'dup-merge', contentTypes: ['text/plain'] },
        storage,
      )();
      const result = await handler.registerStrategy(
        { name: 'dup-merge', contentTypes: ['text/plain'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerStrategy(
        { name: 'fail', contentTypes: ['text/plain'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('merge', () => {
    it('should produce clean merge when no conflicts', async () => {
      const storage = createTestStorage();
      await handler.registerStrategy(
        { name: 'default', contentTypes: ['text/plain'] },
        storage,
      )();
      const base = 'line1\nline2\nline3';
      const ours = 'line1\nchanged-ours\nline3';
      const theirs = 'line1\nline2\nchanged-theirs';
      const result = await handler.merge(
        { base, ours, theirs, strategy: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          expect(result.right.result).toContain('changed-ours');
          expect(result.right.result).toContain('changed-theirs');
        }
      }
    });

    it('should detect conflicts when both sides change the same line', async () => {
      const storage = createTestStorage();
      await handler.registerStrategy(
        { name: 'default', contentTypes: ['text/plain'] },
        storage,
      )();
      const base = 'common';
      const ours = 'ours-version';
      const theirs = 'theirs-version';
      const result = await handler.merge(
        { base, ours, theirs, strategy: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflicts');
        if (result.right.variant === 'conflicts') {
          expect(result.right.conflictCount).toBeGreaterThan(0);
        }
      }
    });

    it('should return noStrategy when named strategy not found', async () => {
      const storage = createTestStorage();
      const result = await handler.merge(
        {
          base: 'a',
          ours: 'b',
          theirs: 'c',
          strategy: O.some('nonexistent'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noStrategy');
      }
    });

    it('should return noStrategy when no strategies registered', async () => {
      const storage = createTestStorage();
      const result = await handler.merge(
        { base: 'a', ours: 'b', theirs: 'c', strategy: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noStrategy');
      }
    });
  });

  describe('resolveConflict', () => {
    it('should resolve a conflict by index', async () => {
      const storage = createTestStorage();
      await handler.registerStrategy(
        { name: 'default', contentTypes: ['text/plain'] },
        storage,
      )();
      const mergeResult = await handler.merge(
        {
          base: 'original',
          ours: 'ours',
          theirs: 'theirs',
          strategy: O.none,
        },
        storage,
      )();
      expect(E.isRight(mergeResult)).toBe(true);
      if (E.isRight(mergeResult) && mergeResult.right.variant === 'conflicts') {
        const mergeId = mergeResult.right.mergeId;
        const result = await handler.resolveConflict(
          {
            mergeId,
            conflictIndex: 0,
            resolution: Buffer.from('resolved-content', 'utf-8'),
          },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.remaining).toBe(0);
          }
        }
      }
    });

    it('should return invalidIndex for out-of-range conflict index', async () => {
      const storage = createTestStorage();
      await handler.registerStrategy(
        { name: 'default', contentTypes: ['text/plain'] },
        storage,
      )();
      const mergeResult = await handler.merge(
        {
          base: 'base',
          ours: 'ours',
          theirs: 'theirs',
          strategy: O.none,
        },
        storage,
      )();
      if (E.isRight(mergeResult) && mergeResult.right.variant === 'conflicts') {
        const result = await handler.resolveConflict(
          {
            mergeId: mergeResult.right.mergeId,
            conflictIndex: 999,
            resolution: Buffer.from('fix', 'utf-8'),
          },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('invalidIndex');
        }
      }
    });
  });

  describe('finalize', () => {
    it('should finalize after all conflicts are resolved', async () => {
      const storage = createTestStorage();
      await handler.registerStrategy(
        { name: 'default', contentTypes: ['text/plain'] },
        storage,
      )();
      const mergeResult = await handler.merge(
        {
          base: 'original',
          ours: 'ours-change',
          theirs: 'theirs-change',
          strategy: O.none,
        },
        storage,
      )();
      if (E.isRight(mergeResult) && mergeResult.right.variant === 'conflicts') {
        const mergeId = mergeResult.right.mergeId;
        await handler.resolveConflict(
          {
            mergeId,
            conflictIndex: 0,
            resolution: Buffer.from('final-content', 'utf-8'),
          },
          storage,
        )();
        const result = await handler.finalize({ mergeId }, storage)();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.result).toContain('final-content');
          }
        }
      }
    });

    it('should return unresolvedConflicts when conflicts remain', async () => {
      const storage = createTestStorage();
      await handler.registerStrategy(
        { name: 'default', contentTypes: ['text/plain'] },
        storage,
      )();
      const mergeResult = await handler.merge(
        {
          base: 'base',
          ours: 'ours',
          theirs: 'theirs',
          strategy: O.none,
        },
        storage,
      )();
      if (E.isRight(mergeResult) && mergeResult.right.variant === 'conflicts') {
        const result = await handler.finalize(
          { mergeId: mergeResult.right.mergeId },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('unresolvedConflicts');
        }
      }
    });
  });
});
