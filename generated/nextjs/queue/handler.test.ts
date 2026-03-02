// Queue — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { queueHandler } from './handler.js';
import type { QueueStorage } from './types.js';

const createTestStorage = (): QueueStorage => {
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

const createFailingStorage = (): QueueStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = queueHandler;

describe('Queue handler', () => {
  describe('enqueue', () => {
    it('should auto-create queue and enqueue item, returning ok', async () => {
      const storage = createTestStorage();
      const result = await handler.enqueue(
        { queue: 'tasks', item: 'task-data', priority: 5 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.itemId).toContain('tasks:');
        }
      }
    });

    it('should enqueue into an existing queue and increment depth', async () => {
      const storage = createTestStorage();
      await handler.enqueue({ queue: 'q1', item: 'a', priority: 1 }, storage)();
      await handler.enqueue({ queue: 'q1', item: 'b', priority: 2 }, storage)();

      const meta = await storage.get('queue_meta', 'q1');
      expect(meta).not.toBeNull();
      if (meta) {
        expect(meta.depth).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.enqueue(
        { queue: 'q', item: 'x', priority: 1 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('claim', () => {
    it('should return empty when queue has no pending items', async () => {
      const storage = createTestStorage();
      const result = await handler.claim(
        { queue: 'empty-q', worker: 'w1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('empty');
      }
    });

    it('should claim the highest-priority pending item', async () => {
      const storage = createTestStorage();
      await handler.enqueue({ queue: 'pq', item: 'low', priority: 1 }, storage)();
      await handler.enqueue({ queue: 'pq', item: 'high', priority: 10 }, storage)();

      const result = await handler.claim({ queue: 'pq', worker: 'w1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.item).toBe('high');
        }
      }
    });
  });

  describe('process', () => {
    it('should return notfound for unknown item', async () => {
      const storage = createTestStorage();
      const result = await handler.process(
        { queue: 'q', itemId: 'missing', result: 'done' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should mark a claimed item as processed', async () => {
      const storage = createTestStorage();
      const enqResult = await handler.enqueue(
        { queue: 'pq', item: 'work', priority: 5 },
        storage,
      )();
      expect(E.isRight(enqResult)).toBe(true);
      if (!E.isRight(enqResult) || enqResult.right.variant !== 'ok') return;
      const itemId = enqResult.right.itemId;

      // Claim the item
      await handler.claim({ queue: 'pq', worker: 'w1' }, storage)();

      // Process it
      const result = await handler.process(
        { queue: 'pq', itemId, result: 'success' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('release', () => {
    it('should return notfound for unknown item', async () => {
      const storage = createTestStorage();
      const result = await handler.release(
        { queue: 'q', itemId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should release a claimed item back to pending', async () => {
      const storage = createTestStorage();
      const enqResult = await handler.enqueue(
        { queue: 'rq', item: 'data', priority: 3 },
        storage,
      )();
      expect(E.isRight(enqResult)).toBe(true);
      if (!E.isRight(enqResult) || enqResult.right.variant !== 'ok') return;
      const itemId = enqResult.right.itemId;

      await handler.claim({ queue: 'rq', worker: 'w1' }, storage)();

      const result = await handler.release({ queue: 'rq', itemId }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('delete', () => {
    it('should return notfound for unknown item', async () => {
      const storage = createTestStorage();
      const result = await handler.delete(
        { queue: 'q', itemId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should delete a queue item', async () => {
      const storage = createTestStorage();
      const enqResult = await handler.enqueue(
        { queue: 'dq', item: 'del-me', priority: 1 },
        storage,
      )();
      expect(E.isRight(enqResult)).toBe(true);
      if (!E.isRight(enqResult) || enqResult.right.variant !== 'ok') return;

      const result = await handler.delete(
        { queue: 'dq', itemId: enqResult.right.itemId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
