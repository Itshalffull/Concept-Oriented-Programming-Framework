// SpatialLayout concept handler tests -- register and apply actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { spatialLayoutHandler } from '../handlers/ts/spatial-layout.handler.js';

describe('SpatialLayout', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers an algorithm with a provider', async () => {
      const result = await spatialLayoutHandler.register(
        { algorithm: 'force-directed', provider: 'd3-force' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const record = await storage.get('layout_algorithm', 'force-directed');
      expect(record!.algorithm).toBe('force-directed');
      expect(record!.provider).toBe('d3-force');
    });

    it('registers multiple algorithms', async () => {
      await spatialLayoutHandler.register({ algorithm: 'force-directed', provider: 'd3-force' }, storage);
      await spatialLayoutHandler.register({ algorithm: 'tree', provider: 'dagre' }, storage);

      const r1 = await storage.get('layout_algorithm', 'force-directed');
      const r2 = await storage.get('layout_algorithm', 'tree');
      expect(r1!.provider).toBe('d3-force');
      expect(r2!.provider).toBe('dagre');
    });

    it('overwrites an existing algorithm registration', async () => {
      await spatialLayoutHandler.register({ algorithm: 'grid', provider: 'v1' }, storage);
      await spatialLayoutHandler.register({ algorithm: 'grid', provider: 'v2' }, storage);

      const record = await storage.get('layout_algorithm', 'grid');
      expect(record!.provider).toBe('v2');
    });
  });

  describe('apply', () => {
    it('returns ok with provider for a registered algorithm', async () => {
      await spatialLayoutHandler.register({ algorithm: 'force-directed', provider: 'd3-force' }, storage);

      const result = await spatialLayoutHandler.apply({ algorithm: 'force-directed' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.provider).toBe('d3-force');
    });

    it('returns unknown_algorithm for unregistered algorithm', async () => {
      const result = await spatialLayoutHandler.apply({ algorithm: 'nonexistent' }, storage);
      expect(result.variant).toBe('unknown_algorithm');
    });

    it('returns correct provider after overwrite', async () => {
      await spatialLayoutHandler.register({ algorithm: 'grid', provider: 'v1' }, storage);
      await spatialLayoutHandler.register({ algorithm: 'grid', provider: 'v2' }, storage);

      const result = await spatialLayoutHandler.apply({ algorithm: 'grid' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.provider).toBe('v2');
    });
  });

  describe('multi-step sequences', () => {
    it('register -> apply -> register new provider -> apply returns updated', async () => {
      await spatialLayoutHandler.register({ algorithm: 'tree', provider: 'dagre' }, storage);

      const r1 = await spatialLayoutHandler.apply({ algorithm: 'tree' }, storage);
      expect(r1.variant).toBe('ok');
      expect(r1.provider).toBe('dagre');

      await spatialLayoutHandler.register({ algorithm: 'tree', provider: 'elkjs' }, storage);

      const r2 = await spatialLayoutHandler.apply({ algorithm: 'tree' }, storage);
      expect(r2.variant).toBe('ok');
      expect(r2.provider).toBe('elkjs');
    });

    it('apply unknown -> register -> apply succeeds', async () => {
      const r1 = await spatialLayoutHandler.apply({ algorithm: 'radial' }, storage);
      expect(r1.variant).toBe('unknown_algorithm');

      await spatialLayoutHandler.register({ algorithm: 'radial', provider: 'custom-radial' }, storage);

      const r2 = await spatialLayoutHandler.apply({ algorithm: 'radial' }, storage);
      expect(r2.variant).toBe('ok');
      expect(r2.provider).toBe('custom-radial');
    });
  });
});
