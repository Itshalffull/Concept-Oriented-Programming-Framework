// EventBus — handler.test.ts
// Unit tests for eventBus handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { eventBusHandler } from './handler.js';
import type { EventBusStorage } from './types.js';

const createTestStorage = (): EventBusStorage => {
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

const createFailingStorage = (): EventBusStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('EventBus handler', () => {
  describe('registerEventType', () => {
    it('should register a new event type', async () => {
      const storage = createTestStorage();
      const result = await eventBusHandler.registerEventType(
        { name: 'user.created', schema: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when event type already registered', async () => {
      const storage = createTestStorage();
      await eventBusHandler.registerEventType({ name: 'user.created', schema: '{}' }, storage)();
      const result = await eventBusHandler.registerEventType(
        { name: 'user.created', schema: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await eventBusHandler.registerEventType(
        { name: 'user.created', schema: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should subscribe a handler and return a subscription ID', async () => {
      const storage = createTestStorage();
      const result = await eventBusHandler.subscribe(
        { event: 'user.created', handler: 'notifyUser', priority: 42 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.subscriptionId).toContain('sub_');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await eventBusHandler.subscribe(
        { event: 'user.created', handler: 'notifyUser', priority: 42 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe an existing subscription', async () => {
      const storage = createTestStorage();
      const subResult = await eventBusHandler.subscribe(
        { event: 'user.created', handler: 'notifyUser', priority: 42 },
        storage,
      )();
      if (E.isRight(subResult)) {
        const result = await eventBusHandler.unsubscribe(
          { subscriptionId: subResult.right.subscriptionId },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return notfound for nonexistent subscription', async () => {
      const storage = createTestStorage();
      const result = await eventBusHandler.unsubscribe(
        { subscriptionId: 'sub_nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await eventBusHandler.unsubscribe(
        { subscriptionId: 'sub_test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('dispatch', () => {
    it('should dispatch to subscribers and return results', async () => {
      const storage = createTestStorage();
      await eventBusHandler.subscribe(
        { event: 'user.created', handler: 'notifyUser', priority: 42 },
        storage,
      )();
      const result = await eventBusHandler.dispatch(
        { event: 'user.created', data: '{"userId":"test-id-1"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const results = JSON.parse(result.right.results);
          expect(Array.isArray(results)).toBe(true);
          expect(results[0].status).toBe('dispatched');
        }
      }
    });

    it('should return error when no subscribers exist', async () => {
      const storage = createTestStorage();
      const result = await eventBusHandler.dispatch(
        { event: 'no.subscribers', data: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await eventBusHandler.dispatch(
        { event: 'user.created', data: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('dispatchAsync', () => {
    it('should enqueue an async dispatch job', async () => {
      const storage = createTestStorage();
      const result = await eventBusHandler.dispatchAsync(
        { event: 'user.created', data: '{"userId":"test-id-1"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.jobId).toContain('job_');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await eventBusHandler.dispatchAsync(
        { event: 'user.created', data: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return dispatch history entries', async () => {
      const storage = createTestStorage();
      await eventBusHandler.subscribe(
        { event: 'user.created', handler: 'handler-a', priority: 42 },
        storage,
      )();
      await eventBusHandler.dispatch(
        { event: 'user.created', data: '{}' },
        storage,
      )();
      const result = await eventBusHandler.getHistory(
        { event: 'user.created', limit: 42 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const entries = JSON.parse(result.right.entries);
        expect(Array.isArray(entries)).toBe(true);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await eventBusHandler.getHistory(
        { event: 'user.created', limit: 42 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
