// Transform — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { transformHandler } from './handler.js';
import type { TransformStorage } from './types.js';

const createTestStorage = (): TransformStorage => {
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

const createFailingStorage = (): TransformStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Transform handler', () => {
  describe('apply', () => {
    it('should apply an uppercase transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'upper', { kind: 'uppercase', config: {} });

      const result = await transformHandler.apply(
        { value: 'hello world', transformId: 'upper' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('HELLO WORLD');
        }
      }
    });

    it('should apply a lowercase transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'lower', { kind: 'lowercase', config: {} });

      const result = await transformHandler.apply(
        { value: 'HELLO', transformId: 'lower' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('hello');
        }
      }
    });

    it('should apply a trim transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'trim', { kind: 'trim', config: {} });

      const result = await transformHandler.apply(
        { value: '  hello  ', transformId: 'trim' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('hello');
        }
      }
    });

    it('should apply a prefix transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'prefix', {
        kind: 'prefix',
        config: { prefix: 'pre-' },
      });

      const result = await transformHandler.apply(
        { value: 'value', transformId: 'prefix' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('pre-value');
        }
      }
    });

    it('should apply a suffix transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'suffix', {
        kind: 'suffix',
        config: { suffix: '-end' },
      });

      const result = await transformHandler.apply(
        { value: 'value', transformId: 'suffix' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('value-end');
        }
      }
    });

    it('should apply a replace transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'replacer', {
        kind: 'replace',
        config: { from: 'foo', to: 'bar' },
      });

      const result = await transformHandler.apply(
        { value: 'foo is foo', transformId: 'replacer' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('bar is bar');
        }
      }
    });

    it('should apply a slice transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'slicer', {
        kind: 'slice',
        config: { start: 0, end: 5 },
      });

      const result = await transformHandler.apply(
        { value: 'hello world', transformId: 'slicer' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('hello');
        }
      }
    });

    it('should apply a json-extract transform', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'json-ext', {
        kind: 'json-extract',
        config: { path: 'user.name' },
      });

      const result = await transformHandler.apply(
        { value: JSON.stringify({ user: { name: 'Alice' } }), transformId: 'json-ext' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('Alice');
        }
      }
    });

    it('should apply identity transform for unknown kind', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'id', { kind: 'identity', config: {} });

      const result = await transformHandler.apply(
        { value: 'unchanged', transformId: 'id' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('unchanged');
        }
      }
    });

    it('should return notfound for a missing transform', async () => {
      const storage = createTestStorage();

      const result = await transformHandler.apply(
        { value: 'x', transformId: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await transformHandler.apply(
        { value: 'x', transformId: 'upper' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('chain', () => {
    it('should chain multiple transforms sequentially', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'trim', { kind: 'trim', config: {} });
      await storage.put('transforms', 'upper', { kind: 'uppercase', config: {} });

      const result = await transformHandler.chain(
        { value: '  hello  ', transformIds: 'trim,upper' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('HELLO');
        }
      }
    });

    it('should return ok with original value for empty chain', async () => {
      const storage = createTestStorage();

      const result = await transformHandler.chain(
        { value: 'hello', transformIds: '' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.result).toBe('hello');
        }
      }
    });

    it('should return error when a transform in the chain is not found', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'trim', { kind: 'trim', config: {} });

      const result = await transformHandler.chain(
        { value: 'hello', transformIds: 'trim,missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.failedAt).toBe('missing');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await transformHandler.chain(
        { value: 'x', transformIds: 'upper' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview a transform without recording history', async () => {
      const storage = createTestStorage();
      await storage.put('transforms', 'upper', { kind: 'uppercase', config: {} });

      const result = await transformHandler.preview(
        { value: 'hello', transformId: 'upper' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.before).toBe('hello');
          expect(result.right.after).toBe('HELLO');
        }
      }

      // Verify no history was written
      const history = await storage.find('transform_history');
      expect(history).toHaveLength(0);
    });

    it('should return notfound for a missing transform', async () => {
      const storage = createTestStorage();

      const result = await transformHandler.preview(
        { value: 'x', transformId: 'missing' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
