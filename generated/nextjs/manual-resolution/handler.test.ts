// ManualResolution — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { manualResolutionHandler } from './handler.js';
import type { ManualResolutionStorage } from './types.js';

const createTestStorage = (): ManualResolutionStorage => {
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

const handler = manualResolutionHandler;

describe('ManualResolution handler', () => {
  describe('register', () => {
    it('should return registration metadata with lowest priority', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('manual');
        expect(result.right.category).toBe('conflict-resolution');
        expect(result.right.priority).toBe(99);
      }
    });
  });

  describe('attemptResolve', () => {
    it('should always return cannotResolve', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from('value1', 'utf-8');
      const v2 = Buffer.from('value2', 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test-context' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cannotResolve');
        expect(result.right.reason).toContain('human review');
      }
    });

    it('should always escalate regardless of input values', async () => {
      const storage = createTestStorage();
      const identical = Buffer.from('same', 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.some(identical), v1: identical, v2: identical, context: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cannotResolve');
      }
    });

    it('should never return resolved variant', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from(JSON.stringify({ timestamp: 100 }), 'utf-8');
      const v2 = Buffer.from(JSON.stringify({ timestamp: 200 }), 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'any' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).not.toBe('resolved');
      }
    });
  });
});
