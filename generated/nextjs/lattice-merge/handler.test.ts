// LatticeMerge — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { latticeMergeHandler } from './handler.js';
import type { LatticeMergeStorage } from './types.js';

const createTestStorage = (): LatticeMergeStorage => {
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

const handler = latticeMergeHandler;

const toBuffer = (obj: unknown): Buffer =>
  Buffer.from(JSON.stringify(obj), 'utf-8');

describe('LatticeMerge handler', () => {
  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('lattice');
        expect(result.right.category).toBe('merge');
        expect(result.right.contentTypes).toContain('application/crdt+json');
      }
    });
  });

  describe('execute', () => {
    it('should join two G-Counters with pointwise max', async () => {
      const storage = createTestStorage();
      const ours = toBuffer({ type: 'g-counter', counters: { a: 3, b: 1 } });
      const theirs = toBuffer({ type: 'g-counter', counters: { a: 1, b: 5, c: 2 } });
      const base = toBuffer({ type: 'g-counter', counters: { a: 0 } });

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const joined = JSON.parse(result.right.result.toString('utf-8'));
          expect(joined.type).toBe('g-counter');
          expect(joined.counters.a).toBe(3);
          expect(joined.counters.b).toBe(5);
          expect(joined.counters.c).toBe(2);
        }
      }
    });

    it('should join two PN-Counters', async () => {
      const storage = createTestStorage();
      const ours = toBuffer({ type: 'pn-counter', positive: { a: 5 }, negative: { a: 1 } });
      const theirs = toBuffer({ type: 'pn-counter', positive: { a: 3, b: 2 }, negative: { a: 2 } });
      const base = toBuffer({ type: 'pn-counter', positive: {}, negative: {} });

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const joined = JSON.parse(result.right.result.toString('utf-8'));
          expect(joined.positive.a).toBe(5);
          expect(joined.positive.b).toBe(2);
          expect(joined.negative.a).toBe(2);
        }
      }
    });

    it('should join two OR-Sets by unioning tags', async () => {
      const storage = createTestStorage();
      const ours = toBuffer({ type: 'or-set', elements: { x: ['t1', 't2'], y: ['t3'] } });
      const theirs = toBuffer({ type: 'or-set', elements: { x: ['t2', 't4'], z: ['t5'] } });
      const base = toBuffer({ type: 'or-set', elements: {} });

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const joined = JSON.parse(result.right.result.toString('utf-8'));
          expect(joined.elements.x).toContain('t1');
          expect(joined.elements.x).toContain('t2');
          expect(joined.elements.x).toContain('t4');
          expect(joined.elements.z).toContain('t5');
        }
      }
    });

    it('should join LWW-Registers by highest timestamp', async () => {
      const storage = createTestStorage();
      const ours = toBuffer({ type: 'lww-register', value: 'hello', timestamp: 100 });
      const theirs = toBuffer({ type: 'lww-register', value: 'world', timestamp: 200 });
      const base = toBuffer({ type: 'lww-register', value: '', timestamp: 0 });

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const joined = JSON.parse(result.right.result.toString('utf-8'));
          expect(joined.value).toBe('world');
          expect(joined.timestamp).toBe(200);
        }
      }
    });

    it('should join MV-Registers and keep non-dominated values', async () => {
      const storage = createTestStorage();
      const ours = toBuffer({
        type: 'mv-register',
        values: [{ value: 'a', vclock: { r1: 2, r2: 1 } }],
      });
      const theirs = toBuffer({
        type: 'mv-register',
        values: [{ value: 'b', vclock: { r1: 1, r2: 2 } }],
      });
      const base = toBuffer({ type: 'mv-register', values: [] });

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('clean');
        if (result.right.variant === 'clean') {
          const joined = JSON.parse(result.right.result.toString('utf-8'));
          expect(joined.values).toHaveLength(2);
        }
      }
    });

    it('should return left for mismatched CRDT types', async () => {
      const storage = createTestStorage();
      const ours = toBuffer({ type: 'g-counter', counters: {} });
      const theirs = toBuffer({ type: 'or-set', elements: {} });
      const base = toBuffer({});

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left for invalid JSON', async () => {
      const storage = createTestStorage();
      const ours = Buffer.from('not json', 'utf-8');
      const theirs = toBuffer({ type: 'g-counter', counters: {} });
      const base = toBuffer({});

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left for unsupported CRDT type', async () => {
      const storage = createTestStorage();
      const ours = toBuffer({ type: 'unknown-crdt' });
      const theirs = toBuffer({ type: 'unknown-crdt' });
      const base = toBuffer({});

      const result = await handler.execute({ base, ours, theirs }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
