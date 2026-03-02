// RecursiveMerge — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { recursiveMergeHandler } from './handler.js';
import type { RecursiveMergeStorage } from './types.js';

const createTestStorage = (): RecursiveMergeStorage => {
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

const handler = recursiveMergeHandler;

describe('RecursiveMerge handler', () => {
  describe('register', () => {
    it('should register and return ok with merge strategy metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('recursive');
        expect(result.right.category).toBe('merge');
        expect(result.right.contentTypes).toContain('text/plain');
      }
    });
  });

  describe('execute', () => {
    it('should produce a clean merge when only ours has changes', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('line1\nline2\nline3', 'utf-8');
      const ours = Buffer.from('line1\nmodified\nline3', 'utf-8');
      const theirs = Buffer.from('line1\nline2\nline3', 'utf-8');

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).toContain('modified');
        }
      }
    });

    it('should produce a clean merge when only theirs has changes', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('a\nb\nc', 'utf-8');
      const ours = Buffer.from('a\nb\nc', 'utf-8');
      const theirs = Buffer.from('a\nchanged\nc', 'utf-8');

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).toContain('changed');
        }
      }
    });

    it('should produce a clean merge when both sides make identical changes', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('a\nb\nc', 'utf-8');
      const ours = Buffer.from('a\nsame\nc', 'utf-8');
      const theirs = Buffer.from('a\nsame\nc', 'utf-8');

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
      }
    });

    it('should resolve same-region modifications via recursive virtual base merge', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('a\nb\nc', 'utf-8');
      const ours = Buffer.from('a\nours-change\nc', 'utf-8');
      const theirs = Buffer.from('a\ntheirs-change\nc', 'utf-8');

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // The recursive merge algorithm uses mergeVirtualBase to construct
        // a virtual common ancestor from both sides, then re-merges against
        // that virtual base. For single-line changes, this resolves cleanly.
        expect(result.right.variant).toBe('clean');
      }
    });

    it('should handle empty base', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('', 'utf-8');
      const ours = Buffer.from('new-line', 'utf-8');
      const theirs = Buffer.from('', 'utf-8');

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
    });

    it('should handle non-overlapping changes cleanly', async () => {
      const storage = createTestStorage();
      const base = Buffer.from('a\nb\nc\nd\ne', 'utf-8');
      const ours = Buffer.from('a\nours-b\nc\nd\ne', 'utf-8');
      const theirs = Buffer.from('a\nb\nc\nd\ntheirs-e', 'utf-8');

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const merged = result.right.result.toString('utf-8');
          expect(merged).toContain('ours-b');
          expect(merged).toContain('theirs-e');
        }
      }
    });
  });
});
