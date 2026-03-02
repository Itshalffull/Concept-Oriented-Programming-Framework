// ChangeStream — handler.test.ts
// Unit tests for changeStream handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { changeStreamHandler } from './handler.js';
import type { ChangeStreamStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): ChangeStreamStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): ChangeStreamStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ChangeStream handler', () => {
  describe('append', () => {
    it('should return ok with offset and eventId for valid event type', async () => {
      const storage = createTestStorage();

      const result = await changeStreamHandler.append(
        { type: 'insert', before: O.none, after: O.some(Buffer.from('data')), source: 'test' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.offset).toBe(0);
          expect(result.right.eventId).toBeTruthy();
        }
      }
    });

    it('should increment offset on successive appends', async () => {
      const storage = createTestStorage();

      await changeStreamHandler.append(
        { type: 'insert', before: O.none, after: O.none, source: 'test' },
        storage,
      )();

      const result = await changeStreamHandler.append(
        { type: 'update', before: O.none, after: O.none, source: 'test' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.offset).toBe(1);
        }
      }
    });

    it('should return invalidType for unrecognized event type', async () => {
      const storage = createTestStorage();

      const result = await changeStreamHandler.append(
        { type: 'invalid-type', before: O.none, after: O.none, source: 'test' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidType');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await changeStreamHandler.append(
        { type: 'insert', before: O.none, after: O.none, source: 'test' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should return ok with subscriptionId', async () => {
      const storage = createTestStorage();

      const result = await changeStreamHandler.subscribe(
        { fromOffset: O.some(0) },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.subscriptionId).toBeTruthy();
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await changeStreamHandler.subscribe(
        { fromOffset: O.none },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('read', () => {
    it('should return notFound when subscription does not exist', async () => {
      const storage = createTestStorage();

      const result = await changeStreamHandler.read(
        { subscriptionId: 'nonexistent', maxCount: 10 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return endOfStream when no events exist', async () => {
      const storage = createTestStorage();
      await storage.put('subscription', 'sub-1', {
        subscriptionId: 'sub-1',
        currentOffset: 0,
      });

      const result = await changeStreamHandler.read(
        { subscriptionId: 'sub-1', maxCount: 10 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('endOfStream');
      }
    });

    it('should return ok with events when available', async () => {
      const storage = createTestStorage();

      // Append an event
      await changeStreamHandler.append(
        { type: 'insert', before: O.none, after: O.none, source: 'test' },
        storage,
      )();

      // Subscribe
      const subResult = await changeStreamHandler.subscribe(
        { fromOffset: O.some(0) },
        storage,
      )();

      expect(E.isRight(subResult)).toBe(true);
      if (E.isRight(subResult)) {
        const subId = subResult.right.subscriptionId;

        const result = await changeStreamHandler.read(
          { subscriptionId: subId, maxCount: 10 },
          storage,
        )();

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.events.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await changeStreamHandler.read(
        { subscriptionId: 'sub-1', maxCount: 10 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('acknowledge', () => {
    it('should return ok and auto-register consumer', async () => {
      const storage = createTestStorage();

      const result = await changeStreamHandler.acknowledge(
        { consumer: 'consumer-1', offset: 5 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return ok for existing consumer', async () => {
      const storage = createTestStorage();
      await storage.put('consumer', 'consumer-1', {
        consumer: 'consumer-1',
        acknowledgedOffset: 3,
      });

      const result = await changeStreamHandler.acknowledge(
        { consumer: 'consumer-1', offset: 5 },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await changeStreamHandler.acknowledge(
        { consumer: 'consumer-1', offset: 5 },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('replay', () => {
    it('should return invalidRange when from exceeds stream head', async () => {
      const storage = createTestStorage();

      const result = await changeStreamHandler.replay(
        { from: 100, to: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidRange');
      }
    });

    it('should return ok with events in range', async () => {
      const storage = createTestStorage();

      // Append two events
      await changeStreamHandler.append(
        { type: 'insert', before: O.none, after: O.none, source: 'test' },
        storage,
      )();
      await changeStreamHandler.append(
        { type: 'update', before: O.none, after: O.none, source: 'test' },
        storage,
      )();

      const result = await changeStreamHandler.replay(
        { from: 0, to: O.some(1) },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.events.length).toBe(2);
        }
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await changeStreamHandler.replay(
        { from: 0, to: O.none },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
