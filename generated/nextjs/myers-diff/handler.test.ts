// MyersDiff — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { myersDiffHandler } from './handler.js';
import type { MyersDiffStorage } from './types.js';

const createTestStorage = (): MyersDiffStorage => {
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

const handler = myersDiffHandler;

describe('MyersDiff handler', () => {
  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('myers');
        expect(result.right.category).toBe('diff');
        expect(result.right.contentTypes).toContain('text/plain');
      }
    });
  });

  describe('compute', () => {
    it('should compute zero distance for identical content', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('line1\nline2\nline3', 'utf-8');
      const result = await handler.compute(
        { contentA: content, contentB: content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBe(0);
        }
      }
    });

    it('should compute edit distance for simple changes', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('line1\nline2\nline3', 'utf-8');
      const contentB = Buffer.from('line1\nmodified\nline3', 'utf-8');
      const result = await handler.compute(
        { contentA, contentB },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
          const ops = JSON.parse(result.right.editScript.toString('utf-8'));
          expect(Array.isArray(ops)).toBe(true);
        }
      }
    });

    it('should handle insertion of new lines', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('a\nb', 'utf-8');
      const contentB = Buffer.from('a\nnew\nb', 'utf-8');
      const result = await handler.compute(
        { contentA, contentB },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
          const ops = JSON.parse(result.right.editScript.toString('utf-8'));
          const inserts = ops.filter((op: { t: string }) => op.t === 'i');
          expect(inserts.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle deletion of lines', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('a\nb\nc', 'utf-8');
      const contentB = Buffer.from('a\nc', 'utf-8');
      const result = await handler.compute(
        { contentA, contentB },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
          const ops = JSON.parse(result.right.editScript.toString('utf-8'));
          const deletes = ops.filter((op: { t: string }) => op.t === 'd');
          expect(deletes.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle completely different content', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('alpha\nbeta', 'utf-8');
      const contentB = Buffer.from('gamma\ndelta', 'utf-8');
      const result = await handler.compute(
        { contentA, contentB },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
        }
      }
    });

    it('should handle empty content', async () => {
      const storage = createTestStorage();
      const contentA = Buffer.from('', 'utf-8');
      const contentB = Buffer.from('new content', 'utf-8');
      const result = await handler.compute(
        { contentA, contentB },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
