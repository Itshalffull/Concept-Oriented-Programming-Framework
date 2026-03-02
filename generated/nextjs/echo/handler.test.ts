// Echo — handler.test.ts
// Unit tests for echo handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { echoHandler } from './handler.js';
import type { EchoStorage } from './types.js';

const createTestStorage = (): EchoStorage => {
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

const createFailingStorage = (): EchoStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Echo handler', () => {
  describe('send', () => {
    it('should echo back the text with the same id', async () => {
      const storage = createTestStorage();
      const result = await echoHandler.send(
        { id: 'test-id-1', text: 'hello world' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.id).toBe('test-id-1');
        expect(result.right.echo).toBe('hello world');
      }
    });

    it('should persist the echo in storage', async () => {
      const storage = createTestStorage();
      await echoHandler.send({ id: 'test-id-1', text: 'hello' }, storage)();
      const record = await storage.get('echo', 'test-id-1');
      expect(record).not.toBeNull();
      expect(record?.text).toBe('hello');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await echoHandler.send(
        { id: 'test-id-1', text: 'hello' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
