// ThreeWayMerge — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { threeWayMergeHandler } from './handler.js';
import type { ThreeWayMergeStorage } from './types.js';

const createTestStorage = (): ThreeWayMergeStorage => {
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

describe('ThreeWayMerge handler', () => {
  describe('register', () => {
    it('should register the merge strategy', async () => {
      const storage = createTestStorage();

      const result = await threeWayMergeHandler.register({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('three-way');
        expect(result.right.category).toBe('merge');
        expect(result.right.contentTypes).toContain('text/plain');
      }
    });
  });

  describe('execute', () => {
    it('should merge cleanly when only ours changed', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('line1\nline2\nline3', 'utf-8');
      const ours = Buffer.from('line1\nmodified\nline3', 'utf-8');
      const theirs = Buffer.from('line1\nline2\nline3', 'utf-8');

      const result = await threeWayMergeHandler.execute(
        { base, ours, theirs },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).toContain('modified');
        }
      }
    });

    it('should merge cleanly when only theirs changed', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('line1\nline2\nline3', 'utf-8');
      const ours = Buffer.from('line1\nline2\nline3', 'utf-8');
      const theirs = Buffer.from('line1\nline2\nline3-modified', 'utf-8');

      const result = await threeWayMergeHandler.execute(
        { base, ours, theirs },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).toContain('line3-modified');
        }
      }
    });

    it('should merge cleanly when both sides make the same change', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('line1\nline2\nline3', 'utf-8');
      const ours = Buffer.from('line1\nSAME\nline3', 'utf-8');
      const theirs = Buffer.from('line1\nSAME\nline3', 'utf-8');

      const result = await threeWayMergeHandler.execute(
        { base, ours, theirs },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
      }
    });

    it('should report conflicts when both sides change the same line differently', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('line1\nline2\nline3', 'utf-8');
      const ours = Buffer.from('line1\nOUR-CHANGE\nline3', 'utf-8');
      const theirs = Buffer.from('line1\nTHEIR-CHANGE\nline3', 'utf-8');

      const result = await threeWayMergeHandler.execute(
        { base, ours, theirs },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflicts');
        if (result.right.variant === 'conflicts') {
          expect(result.right.regions.length).toBeGreaterThan(0);
          const conflictText = result.right.regions[0].toString('utf-8');
          expect(conflictText).toContain('<<<<<<< ours');
          expect(conflictText).toContain('>>>>>>> theirs');
          expect(conflictText).toContain('OUR-CHANGE');
          expect(conflictText).toContain('THEIR-CHANGE');
        }
      }
    });

    it('should merge cleanly when changes are in non-overlapping regions', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('line1\nline2\nline3\nline4\nline5', 'utf-8');
      const ours = Buffer.from('line1-changed\nline2\nline3\nline4\nline5', 'utf-8');
      const theirs = Buffer.from('line1\nline2\nline3\nline4\nline5-changed', 'utf-8');

      const result = await threeWayMergeHandler.execute(
        { base, ours, theirs },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).toContain('line1-changed');
          expect(merged).toContain('line5-changed');
        }
      }
    });

    it('should handle empty inputs cleanly', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('', 'utf-8');
      const ours = Buffer.from('', 'utf-8');
      const theirs = Buffer.from('', 'utf-8');

      const result = await threeWayMergeHandler.execute(
        { base, ours, theirs },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
      }
    });
  });
});
