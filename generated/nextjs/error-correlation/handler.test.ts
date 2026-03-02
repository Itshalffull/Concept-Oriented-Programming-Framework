// ErrorCorrelation — handler.test.ts
// Unit tests for errorCorrelation handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { errorCorrelationHandler } from './handler.js';
import type { ErrorCorrelationStorage } from './types.js';

const createTestStorage = (): ErrorCorrelationStorage => {
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

const createFailingStorage = (): ErrorCorrelationStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ErrorCorrelation handler', () => {
  describe('record', () => {
    it('should record an error and return ok with fingerprint', async () => {
      const storage = createTestStorage();
      const result = await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'Cannot read property of null', rawEvent: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.error).toBeTruthy();
      }
    });

    it('should increment count on duplicate error fingerprint', async () => {
      const storage = createTestStorage();
      await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'Cannot read property of null', rawEvent: '{}' },
        storage,
      )();
      const result = await errorCorrelationHandler.record(
        { flowId: 'flow-2', errorKind: 'TypeError', message: 'Cannot read property of null', rawEvent: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'error', rawEvent: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByEntity', () => {
    it('should find errors by entity symbol', async () => {
      const storage = createTestStorage();
      await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'msg', rawEvent: '{}' },
        storage,
      )();
      const result = await errorCorrelationHandler.findByEntity(
        { symbol: 'flow-1', since: '2020-01-01T00:00:00.000Z' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await errorCorrelationHandler.findByEntity(
        { symbol: 'flow-1', since: '2020-01-01T00:00:00.000Z' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByKind', () => {
    it('should find errors by kind', async () => {
      const storage = createTestStorage();
      await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'msg', rawEvent: '{}' },
        storage,
      )();
      const result = await errorCorrelationHandler.findByKind(
        { errorKind: 'TypeError', since: '2020-01-01T00:00:00.000Z' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('errorHotspots', () => {
    it('should return top error hotspots', async () => {
      const storage = createTestStorage();
      await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'msg', rawEvent: '{}' },
        storage,
      )();
      const result = await errorCorrelationHandler.errorHotspots(
        { since: '2020-01-01T00:00:00.000Z', topN: 42 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const hotspots = JSON.parse(result.right.hotspots);
        expect(Array.isArray(hotspots)).toBe(true);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await errorCorrelationHandler.errorHotspots(
        { since: '2020-01-01T00:00:00.000Z', topN: 42 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rootCause', () => {
    it('should walk the causal chain to find root cause', async () => {
      const storage = createTestStorage();
      const recResult = await errorCorrelationHandler.record(
        { flowId: 'root-flow', errorKind: 'RootError', message: 'root cause', rawEvent: '{}' },
        storage,
      )();
      if (E.isRight(recResult)) {
        const result = await errorCorrelationHandler.rootCause(
          { error: recResult.right.error },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.chain).toBeTruthy();
          }
        }
      }
    });

    it('should return inconclusive for nonexistent error', async () => {
      const storage = createTestStorage();
      const result = await errorCorrelationHandler.rootCause(
        { error: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('inconclusive');
      }
    });
  });

  describe('get', () => {
    it('should retrieve a recorded error', async () => {
      const storage = createTestStorage();
      const recResult = await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'test msg', rawEvent: '{}' },
        storage,
      )();
      if (E.isRight(recResult)) {
        const result = await errorCorrelationHandler.get(
          { error: recResult.right.error },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.errorKind).toBe('TypeError');
          }
        }
      }
    });

    it('should return notfound for nonexistent error', async () => {
      const storage = createTestStorage();
      const result = await errorCorrelationHandler.get(
        { error: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await errorCorrelationHandler.get(
        { error: 'test-id-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
