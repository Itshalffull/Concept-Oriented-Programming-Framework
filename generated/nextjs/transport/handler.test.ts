// Transport — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { transportHandler } from './handler.js';
import type { TransportStorage } from './types.js';

const createTestStorage = (): TransportStorage => {
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

const createFailingStorage = (): TransportStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = transportHandler;

describe('Transport handler', () => {
  describe('configure', () => {
    it('should configure a valid http transport', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        {
          transport: 'my-api',
          kind: 'http',
          baseUrl: O.some('https://api.example.com'),
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.transport).toBe('my-api');
        }
      }
    });

    it('should reject invalid transport kind', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        {
          transport: 'my-api',
          kind: 'invalid-kind',
          baseUrl: O.none,
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should reject empty transport name', async () => {
      const storage = createTestStorage();
      const result = await handler.configure(
        {
          transport: '',
          kind: 'http',
          baseUrl: O.none,
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should accept all valid transport kinds', async () => {
      const kinds = ['http', 'grpc', 'websocket', 'memory', 'queue'];
      for (const kind of kinds) {
        const storage = createTestStorage();
        const result = await handler.configure(
          {
            transport: `transport-${kind}`,
            kind,
            baseUrl: O.none,
            auth: O.none,
            retryPolicy: O.none,
          },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.configure(
        {
          transport: 'my-api',
          kind: 'http',
          baseUrl: O.none,
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('fetch', () => {
    it('should return error when transport not configured', async () => {
      const storage = createTestStorage();
      const result = await handler.fetch(
        { transport: 'nonexistent', query: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.status).toBe(404);
        }
      }
    });

    it('should fetch fresh data from a configured transport', async () => {
      const storage = createTestStorage();
      await handler.configure(
        {
          transport: 'api',
          kind: 'http',
          baseUrl: O.some('https://api.example.com'),
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();

      const result = await handler.fetch(
        { transport: 'api', query: 'users' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.transport).toBe('api');
          expect(result.right.data).toBeTruthy();
        }
      }
    });

    it('should return cached data on second fetch', async () => {
      const storage = createTestStorage();
      await handler.configure(
        {
          transport: 'api',
          kind: 'http',
          baseUrl: O.none,
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();

      await handler.fetch({ transport: 'api', query: 'q1' }, storage)();
      const result = await handler.fetch({ transport: 'api', query: 'q1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
        if (result.right.variant === 'cached') {
          expect(result.right.transport).toBe('api');
          expect(typeof result.right.age).toBe('number');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.fetch(
        { transport: 'api', query: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('mutate', () => {
    it('should return error when transport not configured', async () => {
      const storage = createTestStorage();
      const result = await handler.mutate(
        { transport: 'nonexistent', action: 'create', input: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.status).toBe(404);
        }
      }
    });

    it('should execute mutation on a configured online transport', async () => {
      const storage = createTestStorage();
      await handler.configure(
        {
          transport: 'api',
          kind: 'http',
          baseUrl: O.none,
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();

      const result = await handler.mutate(
        { transport: 'api', action: 'create', input: '{"name":"test"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.transport).toBe('api');
        }
      }
    });

    it('should queue mutation when transport is offline', async () => {
      const storage = createTestStorage();
      // Manually set up an offline transport
      await storage.put('transports', 'api', {
        transport: 'api',
        kind: 'http',
        status: 'offline',
        queueSize: 0,
      });

      const result = await handler.mutate(
        { transport: 'api', action: 'create', input: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('queued');
        if (result.right.variant === 'queued') {
          expect(result.right.queuePosition).toBe(1);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.mutate(
        { transport: 'api', action: 'create', input: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('flushQueue', () => {
    it('should return partial when transport does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.flushQueue(
        { transport: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('partial');
      }
    });

    it('should return ok with zero flushed when queue is empty', async () => {
      const storage = createTestStorage();
      await handler.configure(
        {
          transport: 'api',
          kind: 'http',
          baseUrl: O.none,
          auth: O.none,
          retryPolicy: O.none,
        },
        storage,
      )();

      const result = await handler.flushQueue({ transport: 'api' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.flushed).toBe(0);
        }
      }
    });

    it('should flush queued mutations', async () => {
      const storage = createTestStorage();
      // Set up an offline transport, queue a mutation, then flush
      await storage.put('transports', 'api', {
        transport: 'api',
        kind: 'http',
        status: 'offline',
        queueSize: 0,
      });

      await handler.mutate(
        { transport: 'api', action: 'create', input: '{}' },
        storage,
      )();

      // Change status back to configured so flush can proceed
      const transportRec = await storage.get('transports', 'api');
      if (transportRec) {
        await storage.put('transports', 'api', { ...transportRec, status: 'configured' });
      }

      const result = await handler.flushQueue({ transport: 'api' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.flushed).toBe(1);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.flushQueue(
        { transport: 'api' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
