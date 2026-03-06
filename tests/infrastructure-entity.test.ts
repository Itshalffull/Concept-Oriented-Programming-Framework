// ============================================================
// InfrastructureEntity Handler Tests
//
// Tests for adapter registration, retrieval, backend/concept/
// runtime queries, shared backend analysis, and network
// topology graph construction.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { infrastructureEntityHandler } from '../handlers/ts/score/infrastructure-entity.handler.js';

describe('InfrastructureEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new adapter', async () => {
      const result = await infrastructureEntityHandler.register(
        {
          name: 'postgres-main',
          kind: 'storage',
          sourceFile: 'adapters/postgres.ts',
          backend: 'postgres',
          config: JSON.stringify({ boundConcepts: ['Todo', 'User'], boundRuntime: 'api' }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.adapter).toBeDefined();
    });

    it('returns alreadyRegistered for duplicate name+kind', async () => {
      await infrastructureEntityHandler.register(
        { name: 'pg', kind: 'storage', sourceFile: 'a.ts', backend: 'postgres', config: '{}' },
        storage,
      );
      const result = await infrastructureEntityHandler.register(
        { name: 'pg', kind: 'storage', sourceFile: 'b.ts', backend: 'postgres', config: '{}' },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });

    it('registers same name with different kinds', async () => {
      const s = await infrastructureEntityHandler.register(
        { name: 'redis', kind: 'storage', sourceFile: 'a.ts', backend: 'redis', config: '{}' },
        storage,
      );
      const t = await infrastructureEntityHandler.register(
        { name: 'redis', kind: 'transport', sourceFile: 'b.ts', backend: 'redis', config: '{}' },
        storage,
      );
      expect(s.adapter).not.toBe(t.adapter);
    });
  });

  describe('get', () => {
    it('retrieves by name and kind', async () => {
      const reg = await infrastructureEntityHandler.register(
        { name: 'pg', kind: 'storage', sourceFile: 'a.ts', backend: 'postgres', config: '{}' },
        storage,
      );
      const result = await infrastructureEntityHandler.get(
        { name: 'pg', kind: 'storage' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.adapter).toBe(reg.adapter);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await infrastructureEntityHandler.get(
        { name: 'nope', kind: 'storage' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('findByBackend', () => {
    it('returns adapters for a backend', async () => {
      await infrastructureEntityHandler.register(
        { name: 'pg1', kind: 'storage', sourceFile: 'a.ts', backend: 'postgres', config: '{}' },
        storage,
      );
      await infrastructureEntityHandler.register(
        { name: 'pg2', kind: 'storage', sourceFile: 'b.ts', backend: 'postgres', config: '{}' },
        storage,
      );
      await infrastructureEntityHandler.register(
        { name: 'redis', kind: 'transport', sourceFile: 'c.ts', backend: 'redis', config: '{}' },
        storage,
      );
      const result = await infrastructureEntityHandler.findByBackend(
        { backend: 'postgres' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const adapters = JSON.parse(result.adapters as string);
      expect(adapters).toHaveLength(2);
    });
  });

  describe('findByConcept', () => {
    it('returns adapters bound to a concept', async () => {
      await infrastructureEntityHandler.register(
        {
          name: 'pg',
          kind: 'storage',
          sourceFile: 'a.ts',
          backend: 'postgres',
          config: JSON.stringify({ boundConcepts: ['Todo', 'User'] }),
        },
        storage,
      );
      await infrastructureEntityHandler.register(
        {
          name: 'redis',
          kind: 'storage',
          sourceFile: 'b.ts',
          backend: 'redis',
          config: JSON.stringify({ boundConcepts: ['Session'] }),
        },
        storage,
      );
      const result = await infrastructureEntityHandler.findByConcept(
        { concept: 'Todo' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const adapters = JSON.parse(result.adapters as string);
      expect(adapters).toHaveLength(1);
      expect(adapters[0].name).toBe('pg');
    });
  });

  describe('findByRuntime', () => {
    it('returns adapters for a runtime', async () => {
      await infrastructureEntityHandler.register(
        {
          name: 'pg',
          kind: 'storage',
          sourceFile: 'a.ts',
          backend: 'postgres',
          config: JSON.stringify({ boundRuntime: 'api' }),
        },
        storage,
      );
      const result = await infrastructureEntityHandler.findByRuntime(
        { runtime: 'api' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const adapters = JSON.parse(result.adapters as string);
      expect(adapters).toHaveLength(1);
    });
  });

  describe('sharedBackends', () => {
    it('groups adapters by backend+kind', async () => {
      await infrastructureEntityHandler.register(
        {
          name: 'pg1',
          kind: 'storage',
          sourceFile: 'a.ts',
          backend: 'postgres',
          config: JSON.stringify({ boundConcepts: ['Todo'] }),
        },
        storage,
      );
      await infrastructureEntityHandler.register(
        {
          name: 'pg2',
          kind: 'storage',
          sourceFile: 'b.ts',
          backend: 'postgres',
          config: JSON.stringify({ boundConcepts: ['User'] }),
        },
        storage,
      );
      const result = await infrastructureEntityHandler.sharedBackends({}, storage);
      expect(result.variant).toBe('ok');
      const groups = JSON.parse(result.groups as string);
      expect(groups).toHaveLength(2);
      expect(groups.every((g: { backend: string }) => g.backend === 'postgres')).toBe(true);
    });
  });

  describe('networkTopology', () => {
    it('builds a graph from transport adapters', async () => {
      await infrastructureEntityHandler.register(
        {
          name: 'api-to-worker',
          kind: 'transport',
          sourceFile: 'a.ts',
          backend: 'redis',
          config: JSON.stringify({ from: 'api', to: 'worker' }),
        },
        storage,
      );
      await infrastructureEntityHandler.register(
        {
          name: 'api-to-mobile',
          kind: 'transport',
          sourceFile: 'b.ts',
          backend: 'websocket',
          config: JSON.stringify({ from: 'api', to: 'mobile' }),
        },
        storage,
      );
      const result = await infrastructureEntityHandler.networkTopology({}, storage);
      expect(result.variant).toBe('ok');
      const graph = JSON.parse(result.graph as string);
      expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
      expect(graph.edges).toHaveLength(2);
    });

    it('returns empty graph when no transport adapters exist', async () => {
      await infrastructureEntityHandler.register(
        { name: 'pg', kind: 'storage', sourceFile: 'a.ts', backend: 'postgres', config: '{}' },
        storage,
      );
      const result = await infrastructureEntityHandler.networkTopology({}, storage);
      expect(result.variant).toBe('ok');
      const graph = JSON.parse(result.graph as string);
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });
  });
});
