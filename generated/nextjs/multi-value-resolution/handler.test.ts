// MultiValueResolution — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { multiValueResolutionHandler } from './handler.js';
import type { MultiValueResolutionStorage } from './types.js';

const createTestStorage = (): MultiValueResolutionStorage => {
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

const handler = multiValueResolutionHandler;

describe('MultiValueResolution handler', () => {
  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('multi-value');
        expect(result.right.category).toBe('conflict-resolution');
        expect(result.right.priority).toBe(30);
      }
    });
  });

  describe('attemptResolve', () => {
    it('should merge two plain buffers into a sibling set', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from('hello', 'utf-8');
      const v2 = Buffer.from('world', 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
        if (result.right.variant === 'resolved') {
          const siblings = JSON.parse(result.right.result.toString('utf-8'));
          expect(Array.isArray(siblings)).toBe(true);
          expect(siblings.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('should deduplicate identical values', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from('same', 'utf-8');
      const v2 = Buffer.from('same', 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
        if (result.right.variant === 'resolved') {
          const siblings = JSON.parse(result.right.result.toString('utf-8'));
          expect(siblings).toHaveLength(1);
        }
      }
    });

    it('should merge existing sibling collections', async () => {
      const storage = createTestStorage();
      const val1 = Buffer.from('a', 'utf-8').toString('base64');
      const val2 = Buffer.from('b', 'utf-8').toString('base64');
      const val3 = Buffer.from('c', 'utf-8').toString('base64');
      const v1 = Buffer.from(JSON.stringify([val1, val2]), 'utf-8');
      const v2 = Buffer.from(JSON.stringify([val2, val3]), 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
        if (result.right.variant === 'resolved') {
          const siblings = JSON.parse(result.right.result.toString('utf-8'));
          // Should have 3 unique values: val1, val2, val3
          expect(siblings).toHaveLength(3);
        }
      }
    });

    it('should produce commutative results (resolve(v1,v2) == resolve(v2,v1))', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from('alpha', 'utf-8');
      const v2 = Buffer.from('beta', 'utf-8');
      const result1 = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      const result2 = await handler.attemptResolve(
        { base: O.none, v1: v2, v2: v1, context: 'test' },
        storage,
      )();
      expect(E.isRight(result1)).toBe(true);
      expect(E.isRight(result2)).toBe(true);
      if (E.isRight(result1) && E.isRight(result2)) {
        if (result1.right.variant === 'resolved' && result2.right.variant === 'resolved') {
          expect(result1.right.result.toString('utf-8')).toBe(
            result2.right.result.toString('utf-8'),
          );
        }
      }
    });
  });
});
