// SemanticMerge — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { semanticMergeHandler } from './handler.js';
import type { SemanticMergeStorage } from './types.js';

const createTestStorage = (): SemanticMergeStorage => {
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

const handler = semanticMergeHandler;

const toBuffer = (s: string): Buffer => Buffer.from(s, 'utf-8');

describe('SemanticMerge handler', () => {
  describe('register', () => {
    it('should return ok with semantic merge metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('semantic');
        expect(result.right.category).toBe('merge');
        expect(result.right.contentTypes).toContain('text/typescript');
        expect(result.right.contentTypes).toContain('text/javascript');
      }
    });
  });

  describe('execute', () => {
    it('should return clean merge when both sides are unchanged', async () => {
      const storage = createTestStorage();
      const base = toBuffer('const x = 1;\nconst y = 2;');
      const ours = toBuffer('const x = 1;\nconst y = 2;');
      const theirs = toBuffer('const x = 1;\nconst y = 2;');
      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
      }
    });

    it('should return clean merge when only ours changed', async () => {
      const storage = createTestStorage();
      const base = toBuffer('const x = 1;');
      const ours = toBuffer('const x = 42;');
      const theirs = toBuffer('const x = 1;');
      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          expect(result.right.result.toString('utf-8')).toContain('42');
        }
      }
    });

    it('should return clean merge when only theirs changed', async () => {
      const storage = createTestStorage();
      const base = toBuffer('const x = 1;');
      const ours = toBuffer('const x = 1;');
      const theirs = toBuffer('const x = 99;');
      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          expect(result.right.result.toString('utf-8')).toContain('99');
        }
      }
    });

    it('should return clean merge when both sides changed identically', async () => {
      const storage = createTestStorage();
      const base = toBuffer('const x = 1;');
      const ours = toBuffer('const x = 100;');
      const theirs = toBuffer('const x = 100;');
      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
      }
    });

    it('should return conflicts when both sides changed differently', async () => {
      const storage = createTestStorage();
      const base = toBuffer('const x = 1;');
      const ours = toBuffer('const x = 42;');
      const theirs = toBuffer('const x = 99;');
      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflicts');
        if (result.right.variant === 'conflicts') {
          expect(result.right.regions.length).toBeGreaterThan(0);
          const region = result.right.regions[0].toString('utf-8');
          expect(region).toContain('<<<<<<< ours');
          expect(region).toContain('>>>>>>> theirs');
        }
      }
    });

    it('should merge independently added imports cleanly', async () => {
      const storage = createTestStorage();
      const base = toBuffer('import { a } from "mod";');
      const ours = toBuffer('import { a } from "mod";\nimport { b } from "other";');
      const theirs = toBuffer('import { a } from "mod";\nimport { c } from "third";');
      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).toContain('import { b }');
          expect(merged).toContain('import { c }');
        }
      }
    });

    it('should handle both sides deleting the same declaration', async () => {
      const storage = createTestStorage();
      const base = toBuffer('const x = 1;\nconst y = 2;');
      const ours = toBuffer('const y = 2;');
      const theirs = toBuffer('const y = 2;');
      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).not.toContain('const x');
        }
      }
    });
  });
});
