// ActionLog — handler.test.ts
// Unit tests for actionLog handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { actionLogHandler } from './handler.js';
import type { ActionLogStorage } from './types.js';

const createTestStorage = (): ActionLogStorage => {
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

const createFailingStorage = (): ActionLogStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ActionLog handler', () => {
  describe('append', () => {
    it('appends successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await actionLogHandler.append(
        { record: { action: 'user.create', userId: 'u1' } },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.id).toBeTruthy();
      }
    });

    it('handles primitive record values', async () => {
      const storage = createTestStorage();
      const result = await actionLogHandler.append(
        { record: 'simple-string' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionLogHandler.append(
        { record: { action: 'test' } },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addEdge', () => {
    it('adds edge successfully between two existing entries', async () => {
      const storage = createTestStorage();
      const r1 = await actionLogHandler.append({ record: { step: 1 } }, storage)();
      const r2 = await actionLogHandler.append({ record: { step: 2 } }, storage)();
      expect(E.isRight(r1)).toBe(true);
      expect(E.isRight(r2)).toBe(true);
      if (E.isRight(r1) && E.isRight(r2)) {
        const result = await actionLogHandler.addEdge(
          { from: r1.right.id, to: r2.right.id, sync: 'test-flow' },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('returns error for missing source entry', async () => {
      const storage = createTestStorage();
      const r2 = await actionLogHandler.append({ record: { step: 2 } }, storage)();
      expect(E.isRight(r2)).toBe(true);
      if (E.isRight(r2)) {
        const result = await actionLogHandler.addEdge(
          { from: 'nonexistent', to: r2.right.id, sync: 'test-flow' },
          storage,
        )();
        expect(E.isLeft(result)).toBe(true);
      }
    });

    it('returns error for missing target entry', async () => {
      const storage = createTestStorage();
      const r1 = await actionLogHandler.append({ record: { step: 1 } }, storage)();
      expect(E.isRight(r1)).toBe(true);
      if (E.isRight(r1)) {
        const result = await actionLogHandler.addEdge(
          { from: r1.right.id, to: 'nonexistent', sync: 'test-flow' },
          storage,
        )();
        expect(E.isLeft(result)).toBe(true);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionLogHandler.addEdge(
        { from: 'a', to: 'b', sync: 'test-flow' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('query', () => {
    it('returns empty results for unknown flow', async () => {
      const storage = createTestStorage();
      const result = await actionLogHandler.query(
        { flow: 'nonexistent-flow' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionLogHandler.query(
        { flow: 'test-flow' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
