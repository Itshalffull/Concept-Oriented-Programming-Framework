// ============================================================
// Resolver Concept Conformance Tests
//
// PubGrub-based conflict-driven dependency solver. Validates
// resolve, update, and explain actions against the concept
// spec's action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  resolverHandler,
  resetResolverIds,
} from '../handlers/ts/resolver.handler.js';

describe('Resolver', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  const defaultPolicy = {
    unification_strategy: 'highest',
    feature_unification: 'union',
    prefer_locked: false,
    allowed_updates: 'major',
  };

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetResolverIds();
  });

  describe('resolve', () => {
    it('returns ok with resolved modules for simple constraints', async () => {
      const result = await resolverHandler.resolve!(
        {
          constraints: [
            {
              module_id: 'auth',
              version_range: '^1.0.0',
              edge_type: 'normal',
              environment: 'all',
              features: [],
            },
          ],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.resolution).toBe('res-1');
    });

    it('returns ok resolving multiple independent constraints', async () => {
      const result = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'auth', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: [] },
            { module_id: 'logging', version_range: '^2.0.0', edge_type: 'normal', environment: 'all', features: [] },
          ],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify the resolution was stored
      const stored = await storage.get('resolution', result.resolution as string);
      expect(stored).not.toBeNull();
      const resolved = stored!.resolvedModules as Array<{ module_id: string }>;
      expect(resolved.length).toBe(2);
    });

    it('returns unsolvable when constraints conflict', async () => {
      const result = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'auth', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: [] },
            { module_id: 'auth', version_range: '^2.0.0', edge_type: 'normal', environment: 'all', features: [] },
          ],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );
      expect(result.variant).toBe('unsolvable');
      expect(result.explanation).toContain('auth');
    });

    it('returns error when no constraints are provided', async () => {
      const result = await resolverHandler.resolve!(
        {
          constraints: [],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('No constraints');
    });

    it('returns ok using locked versions when prefer_locked is true', async () => {
      const result = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'auth', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: [] },
          ],
          policy: { ...defaultPolicy, prefer_locked: true },
          locked_versions: [
            { module_id: 'auth', version: '1.2.3', content_hash: 'sha256:locked' },
          ],
        },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.get('resolution', result.resolution as string);
      const resolved = stored!.resolvedModules as Array<{ module_id: string; resolved_version: string }>;
      expect(resolved[0].resolved_version).toBe('1.2.3');
    });

    it('returns ok with union feature unification', async () => {
      const result = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'db', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: ['postgres'] },
            { module_id: 'db', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: ['mysql'] },
          ],
          policy: { ...defaultPolicy, feature_unification: 'union' },
          locked_versions: null,
        },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.get('resolution', result.resolution as string);
      const resolved = stored!.resolvedModules as Array<{ features_enabled: string[] }>;
      expect(resolved[0].features_enabled).toContain('postgres');
      expect(resolved[0].features_enabled).toContain('mysql');
    });
  });

  describe('update', () => {
    it('returns ok when updating target modules in an existing resolution', async () => {
      const initial = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'auth', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: [] },
            { module_id: 'logging', version_range: '^2.0.0', edge_type: 'normal', environment: 'all', features: [] },
          ],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );

      const result = await resolverHandler.update!(
        {
          resolution: initial.resolution,
          targets: ['auth'],
          policy: defaultPolicy,
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.resolution).not.toBe(initial.resolution);
    });

    it('returns unsolvable when resolution does not exist', async () => {
      const result = await resolverHandler.update!(
        {
          resolution: 'res-999',
          targets: ['auth'],
          policy: defaultPolicy,
        },
        storage,
      );
      expect(result.variant).toBe('unsolvable');
    });
  });

  describe('explain', () => {
    it('returns ok with dependency path for a resolved module', async () => {
      const resolved = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'auth', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: [] },
          ],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );

      const result = await resolverHandler.explain!(
        { resolution: resolved.resolution, module_id: 'auth' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const path = result.path as string[];
      expect(path.length).toBeGreaterThan(0);
      expect(path.some((p: string) => p.includes('auth'))).toBe(true);
    });

    it('returns notfound when the module is not in the resolution', async () => {
      const resolved = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'auth', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: [] },
          ],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );

      const result = await resolverHandler.explain!(
        { resolution: resolved.resolution, module_id: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('multi-step sequences', () => {
    it('traces the dependency path after resolve then explain', async () => {
      const resolved = await resolverHandler.resolve!(
        {
          constraints: [
            { module_id: 'auth', version_range: '^1.0.0', edge_type: 'normal', environment: 'all', features: ['sso'] },
          ],
          policy: defaultPolicy,
          locked_versions: null,
        },
        storage,
      );
      expect(resolved.variant).toBe('ok');

      const explanation = await resolverHandler.explain!(
        { resolution: resolved.resolution, module_id: 'auth' },
        storage,
      );
      expect(explanation.variant).toBe('ok');
      const path = explanation.path as string[];
      expect(path.some((p: string) => p.includes('^1.0.0'))).toBe(true);
      expect(path.some((p: string) => p.includes('resolved to'))).toBe(true);
    });
  });
});
