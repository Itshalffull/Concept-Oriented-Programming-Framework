// ============================================================
// FeatureFlag Concept Conformance Tests
//
// Additive compile-time feature toggles for modules. Validates
// enable, disable, and unify actions against the concept spec's
// action outcomes and mutual-exclusion invariants.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  featureFlagHandler,
  resetFeatureFlagIds,
} from '../handlers/ts/feature-flag.handler.js';

describe('FeatureFlag', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  /** Helper to seed a feature flag record in storage. */
  async function seedFlag(
    s: ReturnType<typeof createInMemoryStorage>,
    id: string,
    moduleId: string,
    name: string,
    opts: {
      enabled?: boolean;
      mutually_exclusive_with?: string[];
      additional_deps?: string[];
    } = {},
  ) {
    await s.put('featureFlag', id, {
      flagId: id,
      module_id: moduleId,
      name,
      default: false,
      additional_deps: opts.additional_deps || [],
      mutually_exclusive_with: opts.mutually_exclusive_with || [],
      enabled: opts.enabled ?? false,
    });
  }

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetFeatureFlagIds();
  });

  describe('enable', () => {
    it('returns ok when enabling a disabled feature flag', async () => {
      await seedFlag(storage, 'flag-1', 'db', 'postgres');

      const result = await featureFlagHandler.enable!(
        { flag: 'flag-1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify state changed
      const stored = await storage.get('featureFlag', 'flag-1');
      expect(stored!.enabled).toBe(true);
    });

    it('returns conflict when enabling a mutually exclusive feature', async () => {
      await seedFlag(storage, 'flag-pg', 'db', 'postgres', {
        enabled: true,
        mutually_exclusive_with: ['mysql'],
      });
      await seedFlag(storage, 'flag-mysql', 'db', 'mysql', {
        enabled: false,
        mutually_exclusive_with: ['postgres'],
      });

      const result = await featureFlagHandler.enable!(
        { flag: 'flag-mysql' },
        storage,
      );
      expect(result.variant).toBe('conflict');
      expect(result.conflicting_flag).toBe('postgres');
    });

    it('returns notfound when the flag does not exist', async () => {
      const result = await featureFlagHandler.enable!(
        { flag: 'flag-nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns ok as a no-op when enabling an already enabled flag', async () => {
      await seedFlag(storage, 'flag-1', 'db', 'postgres', { enabled: true });

      const result = await featureFlagHandler.enable!(
        { flag: 'flag-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  describe('disable', () => {
    it('returns ok when disabling an enabled feature flag', async () => {
      await seedFlag(storage, 'flag-1', 'db', 'postgres', { enabled: true });

      const result = await featureFlagHandler.disable!(
        { flag: 'flag-1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.get('featureFlag', 'flag-1');
      expect(stored!.enabled).toBe(false);
    });

    it('returns notfound when the flag does not exist', async () => {
      const result = await featureFlagHandler.disable!(
        { flag: 'flag-nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('unify', () => {
    it('returns ok with unified flags when no mutual exclusion conflicts', async () => {
      await seedFlag(storage, 'flag-pg', 'db', 'postgres');
      await seedFlag(storage, 'flag-json', 'db', 'json');

      const result = await featureFlagHandler.unify!(
        { flags: ['flag-pg', 'flag-json'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      const unified = result.unified as string[];
      expect(unified).toContain('flag-pg');
      expect(unified).toContain('flag-json');

      // Verify both are now enabled
      const pg = await storage.get('featureFlag', 'flag-pg');
      const json = await storage.get('featureFlag', 'flag-json');
      expect(pg!.enabled).toBe(true);
      expect(json!.enabled).toBe(true);
    });

    it('returns conflict when unification would enable mutually exclusive features', async () => {
      await seedFlag(storage, 'flag-pg', 'db', 'postgres', {
        mutually_exclusive_with: ['mysql'],
      });
      await seedFlag(storage, 'flag-mysql', 'db', 'mysql', {
        mutually_exclusive_with: ['postgres'],
      });

      const result = await featureFlagHandler.unify!(
        { flags: ['flag-pg', 'flag-mysql'] },
        storage,
      );
      expect(result.variant).toBe('conflict');
      expect(result.module_id).toBe('db');
    });

    it('returns ok when unifying flags across different modules', async () => {
      await seedFlag(storage, 'flag-pg', 'db', 'postgres');
      await seedFlag(storage, 'flag-verbose', 'logging', 'verbose');

      const result = await featureFlagHandler.unify!(
        { flags: ['flag-pg', 'flag-verbose'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect((result.unified as string[]).length).toBe(2);
    });
  });

  describe('multi-step sequences', () => {
    it('round-trips through enable then disable', async () => {
      await seedFlag(storage, 'flag-1', 'db', 'postgres');

      await featureFlagHandler.enable!({ flag: 'flag-1' }, storage);
      const afterEnable = await storage.get('featureFlag', 'flag-1');
      expect(afterEnable!.enabled).toBe(true);

      await featureFlagHandler.disable!({ flag: 'flag-1' }, storage);
      const afterDisable = await storage.get('featureFlag', 'flag-1');
      expect(afterDisable!.enabled).toBe(false);
    });

    it('detects conflict when enabling mutually exclusive features sequentially', async () => {
      await seedFlag(storage, 'flag-pg', 'db', 'postgres', {
        mutually_exclusive_with: ['mysql'],
      });
      await seedFlag(storage, 'flag-mysql', 'db', 'mysql', {
        mutually_exclusive_with: ['postgres'],
      });

      const first = await featureFlagHandler.enable!(
        { flag: 'flag-pg' },
        storage,
      );
      expect(first.variant).toBe('ok');

      const second = await featureFlagHandler.enable!(
        { flag: 'flag-mysql' },
        storage,
      );
      expect(second.variant).toBe('conflict');
      expect(second.conflicting_flag).toBe('postgres');
    });
  });
});
