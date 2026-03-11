// SearchSpace — handler.test.ts
// fp-ts handler tests for scoped overlay indexes.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { searchSpaceHandler } from './handler.js';
import type { SearchSpaceStorage } from './types.js';

const createTestStorage = (): SearchSpaceStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): SearchSpaceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('SearchSpace handler (fp-ts)', () => {
  describe('index', () => {
    it('indexes entity in scope with ok variant', async () => {
      const storage = createTestStorage();
      const result = await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'hello world' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('creates scope if it does not exist', async () => {
      const storage = createTestStorage();
      await searchSpaceHandler.index(
        { scope_id: 'new-scope', provider: 'text', entity_id: 'e1', data: 'data' },
        storage,
      )();

      // Verify scope was created
      const scope = await storage.get('scopes', 'new-scope');
      expect(scope).not.toBeNull();
    });

    it('updates existing entry on re-index', async () => {
      const storage = createTestStorage();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'old data' },
        storage,
      )();
      const result = await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'new data' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'data' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('tombstone', () => {
    it('tombstones an existing entry', async () => {
      const storage = createTestStorage();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'data' },
        storage,
      )();

      const result = await searchSpaceHandler.tombstone(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('creates tombstone entry even without prior index', async () => {
      const storage = createTestStorage();
      const result = await searchSpaceHandler.tombstone(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e-new' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await searchSpaceHandler.tombstone(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('query', () => {
    it('returns matching results with ok variant', async () => {
      const storage = createTestStorage();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'hello world' },
        storage,
      )();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e2', data: 'goodbye' },
        storage,
      )();

      const result = await searchSpaceHandler.query(
        { scope_id: 'scope-1', provider: 'text', query_expr: 'hello' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).results).toContain('e1');
        expect((result.right as any).results).not.toContain('e2');
      }
    });

    it('excludes tombstoned entries from results', async () => {
      const storage = createTestStorage();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'findme' },
        storage,
      )();
      await searchSpaceHandler.tombstone(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1' },
        storage,
      )();

      const result = await searchSpaceHandler.query(
        { scope_id: 'scope-1', provider: 'text', query_expr: 'findme' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect((result.right as any).results).not.toContain('e1');
      }
    });

    it('returns no_scope for non-existent scope', async () => {
      const storage = createTestStorage();
      const result = await searchSpaceHandler.query(
        { scope_id: 'nonexistent', provider: 'text', query_expr: 'hello' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('no_scope');
      }
    });
  });

  describe('clear', () => {
    it('clears all entries in scope', async () => {
      const storage = createTestStorage();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'data' },
        storage,
      )();

      const result = await searchSpaceHandler.clear(
        { scope_id: 'scope-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }

      // Verify scope is gone
      const queryResult = await searchSpaceHandler.query(
        { scope_id: 'scope-1', provider: 'text', query_expr: 'data' },
        storage,
      )();
      if (E.isRight(queryResult)) {
        expect(queryResult.right.variant).toBe('no_scope');
      }
    });

    it('succeeds even for empty scope', async () => {
      const storage = createTestStorage();
      const result = await searchSpaceHandler.clear(
        { scope_id: 'empty-scope' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await searchSpaceHandler.clear(
        { scope_id: 'scope-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('materialize', () => {
    it('materializes indexed entries and returns count', async () => {
      const storage = createTestStorage();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'a' },
        storage,
      )();
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e2', data: 'b' },
        storage,
      )();

      const result = await searchSpaceHandler.materialize(
        { scope_id: 'scope-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).count).toBe(2);
      }
    });

    it('returns zero count for empty scope', async () => {
      const storage = createTestStorage();
      const result = await searchSpaceHandler.materialize(
        { scope_id: 'empty-scope' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect((result.right as any).count).toBe(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await searchSpaceHandler.materialize(
        { scope_id: 'scope-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('multi-step sequence: index -> query -> tombstone -> query', () => {
    it('indexes, queries, tombstones, then queries again', async () => {
      const storage = createTestStorage();

      // Index
      await searchSpaceHandler.index(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1', data: 'searchable content' },
        storage,
      )();

      // Query finds it
      const q1 = await searchSpaceHandler.query(
        { scope_id: 'scope-1', provider: 'text', query_expr: 'searchable' },
        storage,
      )();
      expect(E.isRight(q1)).toBe(true);
      if (E.isRight(q1)) {
        expect((q1.right as any).results).toContain('e1');
      }

      // Tombstone
      await searchSpaceHandler.tombstone(
        { scope_id: 'scope-1', provider: 'text', entity_id: 'e1' },
        storage,
      )();

      // Query no longer finds it
      const q2 = await searchSpaceHandler.query(
        { scope_id: 'scope-1', provider: 'text', query_expr: 'searchable' },
        storage,
      )();
      expect(E.isRight(q2)).toBe(true);
      if (E.isRight(q2)) {
        expect((q2.right as any).results).not.toContain('e1');
      }
    });
  });
});
