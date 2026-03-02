// Signal — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { signalHandler } from './handler.js';
import type { SignalStorage } from './types.js';

const createTestStorage = (): SignalStorage => {
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

const createFailingStorage = (): SignalStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = signalHandler;

describe('Signal handler', () => {
  describe('create', () => {
    it('should create a writable signal', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { signal: 'count', kind: 'writable', initialValue: '0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.signal).toBe('count');
        }
      }
    });

    it('should reject invalid signal kind', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { signal: 'test', kind: 'invalid', initialValue: '0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should reject empty signal name', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { signal: '', kind: 'writable', initialValue: '0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should reject duplicate signal name', async () => {
      const storage = createTestStorage();
      await handler.create(
        { signal: 'dup', kind: 'writable', initialValue: '1' },
        storage,
      )();
      const result = await handler.create(
        { signal: 'dup', kind: 'writable', initialValue: '2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
        if (result.right.variant === 'invalid') {
          expect(result.right.message).toContain('already exists');
        }
      }
    });

    it('should create computed signal', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { signal: 'derived', kind: 'computed', initialValue: '42' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('read', () => {
    it('should read value and version of existing signal', async () => {
      const storage = createTestStorage();
      await handler.create(
        { signal: 'readMe', kind: 'writable', initialValue: 'hello' },
        storage,
      )();
      const result = await handler.read({ signal: 'readMe' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('hello');
          expect(result.right.version).toBe(1);
        }
      }
    });

    it('should return notfound for missing signal', async () => {
      const storage = createTestStorage();
      const result = await handler.read({ signal: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('write', () => {
    it('should write a new value and increment version', async () => {
      const storage = createTestStorage();
      await handler.create(
        { signal: 'counter', kind: 'writable', initialValue: '0' },
        storage,
      )();
      const result = await handler.write({ signal: 'counter', value: '10' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe(2);
        }
      }
    });

    it('should reject writes to computed signals', async () => {
      const storage = createTestStorage();
      await handler.create(
        { signal: 'comp', kind: 'computed', initialValue: '0' },
        storage,
      )();
      const result = await handler.write({ signal: 'comp', value: '10' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('readonly');
      }
    });

    it('should reject writes to readonly signals', async () => {
      const storage = createTestStorage();
      await handler.create(
        { signal: 'ro', kind: 'readonly', initialValue: '0' },
        storage,
      )();
      const result = await handler.write({ signal: 'ro', value: '10' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('readonly');
      }
    });

    it('should return notfound for missing signal', async () => {
      const storage = createTestStorage();
      const result = await handler.write({ signal: 'missing', value: '10' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('batch', () => {
    it('should batch update multiple writable signals', async () => {
      const storage = createTestStorage();
      await handler.create({ signal: 'a', kind: 'writable', initialValue: '1' }, storage)();
      await handler.create({ signal: 'b', kind: 'writable', initialValue: '2' }, storage)();
      const result = await handler.batch(
        { signals: JSON.stringify([{ signal: 'a', value: '10' }, { signal: 'b', value: '20' }]) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.count).toBe(2);
        }
      }
    });

    it('should return partial when some signals fail', async () => {
      const storage = createTestStorage();
      await handler.create({ signal: 'good', kind: 'writable', initialValue: '1' }, storage)();
      await handler.create({ signal: 'bad', kind: 'readonly', initialValue: '2' }, storage)();
      const result = await handler.batch(
        { signals: JSON.stringify([{ signal: 'good', value: '10' }, { signal: 'bad', value: '20' }]) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('partial');
        if (result.right.variant === 'partial') {
          expect(result.right.succeeded).toBe(1);
          expect(result.right.failed).toBe(1);
        }
      }
    });

    it('should return partial for invalid JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.batch({ signals: 'not json' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('partial');
      }
    });

    it('should return ok(0) for empty array', async () => {
      const storage = createTestStorage();
      const result = await handler.batch({ signals: '[]' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.count).toBe(0);
        }
      }
    });
  });

  describe('dispose', () => {
    it('should dispose an existing signal', async () => {
      const storage = createTestStorage();
      await handler.create({ signal: 'disposable', kind: 'writable', initialValue: '0' }, storage)();
      const result = await handler.dispose({ signal: 'disposable' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.signal).toBe('disposable');
        }
      }
    });

    it('should return notfound for missing signal', async () => {
      const storage = createTestStorage();
      const result = await handler.dispose({ signal: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
