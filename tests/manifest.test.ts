// ============================================================
// Manifest Concept Conformance Tests
//
// Declarative project configuration file. Validates add, remove,
// override, disable, enable, merge, and validate actions against
// the concept spec's action outcomes and invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  manifestHandler,
  resetManifestIds,
} from '../handlers/ts/manifest.handler.js';

describe('Manifest', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetManifestIds();
  });

  describe('add', () => {
    it('returns ok when adding a valid dependency', async () => {
      const result = await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns exists when adding a duplicate dependency', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      const result = await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^2.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      expect(result.variant).toBe('exists');
    });

    it('returns invalid when module_id contains whitespace', async () => {
      const result = await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'invalid module',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('whitespace');
    });

    it('returns invalid when version_range is malformed', async () => {
      const result = await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: 'not-a-version',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('version range');
    });
  });

  describe('remove', () => {
    it('returns ok when removing an existing dependency', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );

      const result = await manifestHandler.remove!(
        { project: 'my-project', module_id: 'auth' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound when removing a non-existent dependency', async () => {
      const result = await manifestHandler.remove!(
        { project: 'my-project', module_id: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('override', () => {
    it('returns ok when adding a version pin override', async () => {
      const result = await manifestHandler.override!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_pin: '1.2.3',
        },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns invalid when no override fields are provided', async () => {
      const result = await manifestHandler.override!(
        {
          project: 'my-project',
          module_id: 'auth',
        },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('replacement_id');
    });
  });

  describe('disable / enable', () => {
    it('returns ok when disabling an existing dependency', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );

      const result = await manifestHandler.disable!(
        { project: 'my-project', module_id: 'auth' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound when disabling a module not in the dependency graph', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );

      const result = await manifestHandler.disable!(
        { project: 'my-project', module_id: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns ok when enabling a previously disabled dependency', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      await manifestHandler.disable!(
        { project: 'my-project', module_id: 'auth' },
        storage,
      );

      const result = await manifestHandler.enable!(
        { project: 'my-project', module_id: 'auth' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound when enabling a module not in the disabled set', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );

      const result = await manifestHandler.enable!(
        { project: 'my-project', module_id: 'auth' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('merge', () => {
    it('returns ok when merging two compatible manifests', async () => {
      // Create base manifest
      await manifestHandler.add!(
        {
          project: 'base',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      // Create overlay manifest
      await manifestHandler.add!(
        {
          project: 'overlay',
          module_id: 'logging',
          version_range: '^2.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );

      const result = await manifestHandler.merge!(
        { base: 'base', overlay: 'overlay' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.merged).toBeDefined();
    });

    it('returns conflict when manifests have contradictory overrides', async () => {
      // Create base with an override
      await manifestHandler.add!(
        {
          project: 'base',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      await manifestHandler.override!(
        { project: 'base', module_id: 'auth', replacement_id: 'auth-fork-a' },
        storage,
      );

      // Create overlay with a contradictory override
      await manifestHandler.add!(
        {
          project: 'overlay',
          module_id: 'logging',
          version_range: '^2.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      await manifestHandler.override!(
        { project: 'overlay', module_id: 'auth', replacement_id: 'auth-fork-b' },
        storage,
      );

      const result = await manifestHandler.merge!(
        { base: 'base', overlay: 'overlay' },
        storage,
      );
      expect(result.variant).toBe('conflict');
      expect(result.message).toContain('auth');
    });
  });

  describe('validate', () => {
    it('returns ok for a valid manifest', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );

      const result = await manifestHandler.validate!(
        { project: 'my-project' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns invalid for a non-existent project', async () => {
      const result = await manifestHandler.validate!(
        { project: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('invalid');
    });
  });

  describe('multi-step sequences', () => {
    it('validates successfully after add', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );

      const result = await manifestHandler.validate!(
        { project: 'my-project' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('validates successfully after add then remove', async () => {
      await manifestHandler.add!(
        {
          project: 'my-project',
          module_id: 'auth',
          version_range: '^1.0.0',
          edge_type: 'normal',
          environment: 'all',
          features: [],
          optional: false,
        },
        storage,
      );
      await manifestHandler.remove!(
        { project: 'my-project', module_id: 'auth' },
        storage,
      );

      const result = await manifestHandler.validate!(
        { project: 'my-project' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });
});
