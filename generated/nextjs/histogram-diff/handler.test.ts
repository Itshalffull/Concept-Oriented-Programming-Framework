// HistogramDiff — handler.test.ts
// Unit tests for histogramDiff handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { histogramDiffHandler } from './handler.js';
import type { HistogramDiffStorage } from './types.js';

const createTestStorage = (): HistogramDiffStorage => {
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

describe('HistogramDiff handler', () => {
  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const input = {};

      const result = await histogramDiffHandler.register(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('histogram');
        expect(result.right.category).toBe('diff');
        expect(result.right.contentTypes).toContain('text/plain');
      }
    });
  });

  describe('compute', () => {
    it('should compute zero distance for identical content', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('line1\nline2\nline3', 'utf-8');
      const input = { contentA: content, contentB: content };

      const result = await histogramDiffHandler.compute(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBe(0);
        }
      }
    });

    it('should detect insertions', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('line1\nline3', 'utf-8');
      const contentB = Buffer.from('line1\nline2\nline3', 'utf-8');
      const input = { contentA, contentB };

      const result = await histogramDiffHandler.compute(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
          const ops = JSON.parse(result.right.editScript.toString('utf-8'));
          expect(ops.some((op: { t: string }) => op.t === 'i')).toBe(true);
        }
      }
    });

    it('should detect deletions', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('line1\nline2\nline3', 'utf-8');
      const contentB = Buffer.from('line1\nline3', 'utf-8');
      const input = { contentA, contentB };

      const result = await histogramDiffHandler.compute(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
          const ops = JSON.parse(result.right.editScript.toString('utf-8'));
          expect(ops.some((op: { t: string }) => op.t === 'd')).toBe(true);
        }
      }
    });

    it('should handle completely different content', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('alpha\nbeta', 'utf-8');
      const contentB = Buffer.from('gamma\ndelta', 'utf-8');
      const input = { contentA, contentB };

      const result = await histogramDiffHandler.compute(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
        }
      }
    });

    it('should handle empty buffers', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('', 'utf-8');
      const contentB = Buffer.from('', 'utf-8');
      const input = { contentA, contentB };

      const result = await histogramDiffHandler.compute(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
