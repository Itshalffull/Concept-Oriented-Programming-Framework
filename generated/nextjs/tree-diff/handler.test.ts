// TreeDiff — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { treeDiffHandler } from './handler.js';
import type { TreeDiffStorage } from './types.js';

const createTestStorage = (): TreeDiffStorage => {
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

const handler = treeDiffHandler;

describe('TreeDiff handler', () => {
  describe('register', () => {
    it('should return registration with supported content types', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('tree');
        expect(result.right.category).toBe('diff');
        expect(result.right.contentTypes).toContain('application/json');
      }
    });
  });

  describe('compute', () => {
    it('should compute zero distance for identical trees', async () => {
      const storage = createTestStorage();
      const json = JSON.stringify({ a: 1, b: 2 });
      const result = await handler.compute(
        {
          contentA: Buffer.from(json, 'utf-8'),
          contentB: Buffer.from(json, 'utf-8'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBe(0);
        }
      }
    });

    it('should detect differences between different trees', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        {
          contentA: Buffer.from(JSON.stringify({ a: 1 }), 'utf-8'),
          contentB: Buffer.from(JSON.stringify({ a: 2 }), 'utf-8'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
          expect(result.right.editScript).toBeInstanceOf(Buffer);
        }
      }
    });

    it('should handle array trees', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        {
          contentA: Buffer.from(JSON.stringify([1, 2, 3]), 'utf-8'),
          contentB: Buffer.from(JSON.stringify([1, 2, 4]), 'utf-8'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
        }
      }
    });

    it('should handle nested objects', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        {
          contentA: Buffer.from(JSON.stringify({ a: { b: 1 } }), 'utf-8'),
          contentB: Buffer.from(JSON.stringify({ a: { b: 2, c: 3 } }), 'utf-8'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.distance).toBeGreaterThan(0);
        }
      }
    });

    it('should return left for invalid JSON in contentA', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        {
          contentA: Buffer.from('not json', 'utf-8'),
          contentB: Buffer.from(JSON.stringify({ a: 1 }), 'utf-8'),
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARSE_ERROR');
      }
    });

    it('should return left for invalid JSON in contentB', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        {
          contentA: Buffer.from(JSON.stringify({ a: 1 }), 'utf-8'),
          contentB: Buffer.from('not valid json', 'utf-8'),
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARSE_ERROR');
      }
    });

    it('should produce a parseable edit script', async () => {
      const storage = createTestStorage();
      const result = await handler.compute(
        {
          contentA: Buffer.from(JSON.stringify({ x: 1 }), 'utf-8'),
          contentB: Buffer.from(JSON.stringify({ x: 2 }), 'utf-8'),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const ops = JSON.parse(result.right.editScript.toString('utf-8'));
        expect(Array.isArray(ops)).toBe(true);
      }
    });
  });
});
