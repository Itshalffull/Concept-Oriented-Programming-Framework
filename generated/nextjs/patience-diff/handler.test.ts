// PatienceDiff — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { patienceDiffHandler } from './handler.js';
import type { PatienceDiffStorage } from './types.js';

const createTestStorage = (): PatienceDiffStorage => {
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

describe('PatienceDiff handler', () => {
  describe('register', () => {
    it('should return provider metadata', async () => {
      const storage = createTestStorage();

      const result = await patienceDiffHandler.register({}, storage)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('patience');
        expect(result.right.category).toBe('diff');
        expect(result.right.contentTypes).toContain('text/plain');
      }
    });
  });

  describe('compute', () => {
    it('should compute diff for identical content (distance 0)', async () => {
      const storage = createTestStorage();
      const content = Buffer.from('line1\nline2\nline3', 'utf-8');

      const result = await patienceDiffHandler.compute(
        { contentA: content, contentB: Buffer.from(content) },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.distance).toBe(0);
      }
    });

    it('should detect insertions', async () => {
      const storage = createTestStorage();
      const a = Buffer.from('line1\nline3', 'utf-8');
      const b = Buffer.from('line1\nline2\nline3', 'utf-8');

      const result = await patienceDiffHandler.compute(
        { contentA: a, contentB: b },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.distance).toBeGreaterThan(0);
        const script = JSON.parse(result.right.editScript.toString('utf-8'));
        const insertOps = script.filter((op: { t: string }) => op.t === 'i');
        expect(insertOps.length).toBeGreaterThan(0);
      }
    });

    it('should detect deletions', async () => {
      const storage = createTestStorage();
      const a = Buffer.from('line1\nline2\nline3', 'utf-8');
      const b = Buffer.from('line1\nline3', 'utf-8');

      const result = await patienceDiffHandler.compute(
        { contentA: a, contentB: b },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.distance).toBeGreaterThan(0);
        const script = JSON.parse(result.right.editScript.toString('utf-8'));
        const deleteOps = script.filter((op: { t: string }) => op.t === 'd');
        expect(deleteOps.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty to non-empty diff', async () => {
      const storage = createTestStorage();
      const a = Buffer.from('', 'utf-8');
      const b = Buffer.from('new content', 'utf-8');

      const result = await patienceDiffHandler.compute(
        { contentA: a, contentB: b },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.distance).toBeGreaterThan(0);
      }
    });

    it('should handle non-empty to empty diff', async () => {
      const storage = createTestStorage();
      const a = Buffer.from('existing content', 'utf-8');
      const b = Buffer.from('', 'utf-8');

      const result = await patienceDiffHandler.compute(
        { contentA: a, contentB: b },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.distance).toBeGreaterThan(0);
      }
    });

    it('should handle complex refactoring-style diffs', async () => {
      const storage = createTestStorage();
      const a = Buffer.from('function foo() {\n  return 1;\n}\nfunction bar() {\n  return 2;\n}', 'utf-8');
      const b = Buffer.from('function bar() {\n  return 2;\n}\nfunction foo() {\n  return 1;\n}', 'utf-8');

      const result = await patienceDiffHandler.compute(
        { contentA: a, contentB: b },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
