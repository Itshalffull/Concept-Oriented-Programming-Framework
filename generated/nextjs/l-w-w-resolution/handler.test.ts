// LWWResolution — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { lWWResolutionHandler } from './handler.js';
import type { LWWResolutionStorage } from './types.js';

const createTestStorage = (): LWWResolutionStorage => {
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

const handler = lWWResolutionHandler;

const lwwBuffer = (timestamp: number, value: unknown): Buffer =>
  Buffer.from(JSON.stringify({ timestamp, value }), 'utf-8');

describe('LWWResolution handler', () => {
  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('lww');
        expect(result.right.category).toBe('conflict-resolution');
        expect(result.right.priority).toBe(10);
      }
    });
  });

  describe('attemptResolve', () => {
    it('should resolve in favor of higher timestamp', async () => {
      const storage = createTestStorage();
      const v1 = lwwBuffer(100, 'old');
      const v2 = lwwBuffer(200, 'new');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
        if (result.right.variant === 'resolved') {
          const parsed = JSON.parse(result.right.result.toString('utf-8'));
          expect(parsed.value).toBe('new');
        }
      }
    });

    it('should resolve in favor of v1 when v1 has higher timestamp', async () => {
      const storage = createTestStorage();
      const v1 = lwwBuffer(500, 'winner');
      const v2 = lwwBuffer(100, 'loser');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
        if (result.right.variant === 'resolved') {
          const parsed = JSON.parse(result.right.result.toString('utf-8'));
          expect(parsed.value).toBe('winner');
        }
      }
    });

    it('should return cannotResolve when timestamps are identical', async () => {
      const storage = createTestStorage();
      const v1 = lwwBuffer(100, 'a');
      const v2 = lwwBuffer(100, 'b');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cannotResolve');
      }
    });

    it('should resolve when only v1 has a valid timestamp', async () => {
      const storage = createTestStorage();
      const v1 = lwwBuffer(100, 'valid');
      const v2 = Buffer.from('raw bytes', 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
      }
    });

    it('should resolve when only v2 has a valid timestamp', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from('raw bytes', 'utf-8');
      const v2 = lwwBuffer(100, 'valid');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
      }
    });

    it('should use deterministic tiebreaker when neither has timestamps', async () => {
      const storage = createTestStorage();
      const v1 = Buffer.from('aaa', 'utf-8');
      const v2 = Buffer.from('bbb', 'utf-8');
      const result = await handler.attemptResolve(
        { base: O.none, v1, v2, context: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('resolved');
      }
    });
  });
});
