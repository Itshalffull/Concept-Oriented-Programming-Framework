// Query — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { queryHandler } from './handler.js';
import type { QueryStorage } from './types.js';

const createTestStorage = (): QueryStorage => {
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

const createFailingStorage = (): QueryStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = queryHandler;

describe('Query handler', () => {
  describe('parse', () => {
    it('should parse a valid expression and return ok', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { query: 'q1', expression: "status = 'active'" },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.query).toBe('q1');
        }
      }
    });

    it('should return error for invalid expression syntax', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { query: 'q2', expression: 'nonsense gibberish' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should parse multi-clause AND expressions', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { query: 'q3', expression: "status = 'active' AND priority > 5" },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should parse contains operator', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { query: 'q4', expression: "title contains 'hello'" },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('execute', () => {
    it('should return notfound for unparsed query', async () => {
      const storage = createTestStorage();
      const result = await handler.execute({ query: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should execute a parsed query and filter content', async () => {
      const storage = createTestStorage();
      // Parse a query
      await handler.parse(
        { query: 'q1', expression: "status = 'active'" },
        storage,
      )();

      // Seed content
      await storage.put('content', 'c1', { status: 'active', title: 'A' });
      await storage.put('content', 'c2', { status: 'inactive', title: 'B' });
      await storage.put('content', 'c3', { status: 'active', title: 'C' });

      const result = await handler.execute({ query: 'q1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const results = JSON.parse(result.right.results);
          expect(results.length).toBe(2);
        }
      }
    });
  });

  describe('subscribe', () => {
    it('should return notfound for unparsed query', async () => {
      const storage = createTestStorage();
      const result = await handler.subscribe({ query: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should subscribe to a parsed query and return subscription id', async () => {
      const storage = createTestStorage();
      await handler.parse(
        { query: 'live-q', expression: "type = 'event'" },
        storage,
      )();

      const result = await handler.subscribe({ query: 'live-q' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.subscriptionId).toContain('sub-live-q');
        }
      }
    });
  });

  describe('addFilter', () => {
    it('should return notfound for unparsed query', async () => {
      const storage = createTestStorage();
      const result = await handler.addFilter(
        { query: 'missing', filter: "x = '1'" },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should add a filter to an existing query', async () => {
      const storage = createTestStorage();
      await handler.parse(
        { query: 'fq', expression: "status = 'active'" },
        storage,
      )();

      const result = await handler.addFilter(
        { query: 'fq', filter: "priority > 5" },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('addSort', () => {
    it('should return notfound for unparsed query', async () => {
      const storage = createTestStorage();
      const result = await handler.addSort(
        { query: 'missing', sort: 'name:asc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should add a sort to an existing query', async () => {
      const storage = createTestStorage();
      await handler.parse(
        { query: 'sq', expression: "type = 'post'" },
        storage,
      )();

      const result = await handler.addSort(
        { query: 'sq', sort: 'createdAt:desc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('setScope', () => {
    it('should return notfound for unparsed query', async () => {
      const storage = createTestStorage();
      const result = await handler.setScope(
        { query: 'missing', scope: 'tenant-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should set scope on an existing query', async () => {
      const storage = createTestStorage();
      await handler.parse(
        { query: 'scq', expression: "status = 'draft'" },
        storage,
      )();

      const result = await handler.setScope(
        { query: 'scq', scope: 'workspace-a' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
