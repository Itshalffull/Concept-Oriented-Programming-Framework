// SearchSpace concept handler tests -- scoped overlay indexes,
// tombstoning, query merging, and materialization.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { searchSpaceHandler } from '../handlers/ts/search-space.handler.js';

describe('SearchSpace', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('index', () => {
    it('indexes an entity in a scoped overlay', async () => {
      const result = await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'hello world' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.entry).toBeDefined();
    });

    it('creates scope automatically if not exists', async () => {
      await searchSpaceHandler.index(
        { scope_id: 'new-scope', provider: 'text', entity_id: 'e1', data: 'test' },
        storage,
      );
      const scope = await storage.get('scopes', 'new-scope');
      expect(scope).toBeDefined();
    });

    it('updates existing entry for same entity', async () => {
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'first' },
        storage,
      );
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'second' },
        storage,
      );

      const result = await searchSpaceHandler.query(
        { scope_id: 'vs-1', provider: 'text', query_expr: 'second' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.results).toContain('e1');
    });
  });

  describe('tombstone', () => {
    it('marks entity as absent in scope', async () => {
      const result = await searchSpaceHandler.tombstone(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('overrides previous index entry', async () => {
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'hello' },
        storage,
      );
      await searchSpaceHandler.tombstone(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1' },
        storage,
      );

      const result = await searchSpaceHandler.query(
        { scope_id: 'vs-1', provider: 'text', query_expr: 'hello' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.results).not.toContain('e1');
    });
  });

  describe('query', () => {
    it('returns matching indexed entities', async () => {
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'hello world' },
        storage,
      );
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e2', data: 'goodbye world' },
        storage,
      );

      const result = await searchSpaceHandler.query(
        { scope_id: 'vs-1', provider: 'text', query_expr: 'hello' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.results).toContain('e1');
      expect(result.results).not.toContain('e2');
    });

    it('returns no_scope for non-existent scope', async () => {
      const result = await searchSpaceHandler.query(
        { scope_id: 'nonexistent', provider: 'text', query_expr: 'test' },
        storage,
      );
      expect(result.variant).toBe('no_scope');
    });

    it('excludes tombstoned entities from results', async () => {
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'test data' },
        storage,
      );
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e2', data: 'test data' },
        storage,
      );
      await searchSpaceHandler.tombstone(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e2' },
        storage,
      );

      const result = await searchSpaceHandler.query(
        { scope_id: 'vs-1', provider: 'text', query_expr: 'test' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.results).toContain('e1');
      expect(result.results).not.toContain('e2');
    });
  });

  describe('clear', () => {
    it('removes all entries for a scope', async () => {
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'test' },
        storage,
      );
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e2', data: 'test' },
        storage,
      );

      const result = await searchSpaceHandler.clear({ scope_id: 'vs-1' }, storage);
      expect(result.variant).toBe('ok');

      // Scope should be gone
      const query = await searchSpaceHandler.query(
        { scope_id: 'vs-1', provider: 'text', query_expr: 'test' },
        storage,
      );
      expect(query.variant).toBe('no_scope');
    });
  });

  describe('materialize', () => {
    it('counts indexed entries and clears scope', async () => {
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e1', data: 'test' },
        storage,
      );
      await searchSpaceHandler.index(
        { scope_id: 'vs-1', provider: 'text', entity_id: 'e2', data: 'test' },
        storage,
      );

      const result = await searchSpaceHandler.materialize({ scope_id: 'vs-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);

      // Scope should be gone after materialization
      const query = await searchSpaceHandler.query(
        { scope_id: 'vs-1', provider: 'text', query_expr: 'test' },
        storage,
      );
      expect(query.variant).toBe('no_scope');
    });
  });
});
