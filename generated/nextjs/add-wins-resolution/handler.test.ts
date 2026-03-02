// AddWinsResolution — handler.test.ts
// Unit tests for addWinsResolution handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { addWinsResolutionHandler } from './handler.js';
import type { AddWinsResolutionStorage } from './types.js';

const createTestStorage = (): AddWinsResolutionStorage => {
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

const createFailingStorage = (): AddWinsResolutionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AddWinsResolution handler', () => {
  describe('register', () => {
    it('produces ok with valid input', async () => {
      const storage = createTestStorage();
      const result = await addWinsResolutionHandler.register(
        {},
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('add-wins');
        expect(result.right.category).toBe('conflict-resolution');
        expect(result.right.priority).toBe(20);
      }
    });
  });

  describe('attemptResolve', () => {
    it('resolves two valid set-like JSON arrays with union semantics', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from(JSON.stringify(['a', 'b']));
      const v2 = Buffer.from(JSON.stringify(['b', 'c']));
      const result = await addWinsResolutionHandler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
        if (result.right.variant === 'resolved') {
          const resolved = JSON.parse(result.right.result.toString('utf-8'));
          expect(resolved).toContain('a');
          expect(resolved).toContain('b');
          expect(resolved).toContain('c');
        }
      }
    });

    it('resolves with base set and computes add-wins union', async () => {
      const storage = createTestStorage();
      const base = Buffer.from(JSON.stringify(['a', 'b']));
      const v1 = Buffer.from(JSON.stringify(['a', 'b', 'c']));
      const v2 = Buffer.from(JSON.stringify(['a', 'b', 'd']));
      const result = await addWinsResolutionHandler.attemptResolve(
        { base: O.some(base), v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
        if (result.right.variant === 'resolved') {
          const resolved = JSON.parse(result.right.result.toString('utf-8'));
          expect(resolved).toContain('a');
          expect(resolved).toContain('b');
          expect(resolved).toContain('c');
          expect(resolved).toContain('d');
        }
      }
    });

    it('returns cannotResolve for non-set content', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from('not json');
      const v2 = Buffer.from(JSON.stringify(['a']));
      const result = await addWinsResolutionHandler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cannotResolve');
      }
    });

    it('returns cannotResolve for JSON objects (not arrays)', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from(JSON.stringify({ key: 'value' }));
      const v2 = Buffer.from(JSON.stringify(['a']));
      const result = await addWinsResolutionHandler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cannotResolve');
      }
    });
  });
});
