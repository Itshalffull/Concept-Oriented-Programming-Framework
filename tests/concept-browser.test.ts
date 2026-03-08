// ConceptBrowser concept handler tests — package lifecycle management.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  conceptBrowserHandler,
  resetConceptBrowserCounter,
} from '../handlers/ts/concept-browser.handler.js';

describe('ConceptBrowser', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetConceptBrowserCounter();
  });

  describe('search', () => {
    it('finds packages matching query', async () => {
      // Seed a package
      await storage.put('package', 'pkg-1', {
        id: 'pkg-1',
        name: 'taxonomy-extra',
        version: '1.0.0',
        status: 'available',
        manifest: 'Provides taxonomy schema with hierarchical terms',
      });

      const result = await conceptBrowserHandler.search(
        { query: 'taxonomy', registry: 'all' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.results).toContain('pkg-1');
    });

    it('returns empty results for no matches', async () => {
      const result = await conceptBrowserHandler.search(
        { query: 'nonexistent', registry: 'all' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.results).toHaveLength(0);
    });

    it('returns registry_unreachable for disabled registry', async () => {
      await storage.put('registry', 'reg-1', {
        id: 'reg-1',
        name: 'custom-registry',
        url: 'https://custom.example.com',
        enabled: false,
      });

      const result = await conceptBrowserHandler.search(
        { query: 'test', registry: 'custom-registry' },
        storage,
      );
      expect(result.variant).toBe('registry_unreachable');
    });
  });

  describe('preview', () => {
    it('creates a preview for an available package', async () => {
      await storage.put('package', 'pkg-1', {
        id: 'pkg-1',
        name: 'taxonomy-extra',
        version: '1.0.0',
        status: 'available',
      });

      const result = await conceptBrowserHandler.preview(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.preview).toBeDefined();
    });

    it('returns not_found for unknown package', async () => {
      const result = await conceptBrowserHandler.preview(
        { package_name: 'nonexistent', version: '1.0.0' },
        storage,
      );
      expect(result.variant).toBe('not_found');
      expect(result.package_name).toBe('nonexistent');
    });
  });

  describe('install', () => {
    it('installs a package successfully', async () => {
      const result = await conceptBrowserHandler.install(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.installed).toBeDefined();

      // Verify package is stored as installed
      const pkg = await storage.get('package', result.installed as string);
      expect(pkg!.status).toBe('installed');
      expect(pkg!.installed_at).toBeDefined();
    });

    it('rejects already-installed packages', async () => {
      await conceptBrowserHandler.install(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );
      const result = await conceptBrowserHandler.install(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );
      expect(result.variant).toBe('already_installed');
    });

    it('allows installing different versions', async () => {
      const r1 = await conceptBrowserHandler.install(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );
      expect(r1.variant).toBe('ok');

      // Update first to allow new version
      await conceptBrowserHandler.update(
        { package_name: 'taxonomy-extra', target_version: '2.0.0' },
        storage,
      );

      // Verify updated
      const pkg = await storage.get('package', r1.installed as string);
      expect(pkg!.version).toBe('2.0.0');
    });
  });

  describe('update', () => {
    it('updates an installed package', async () => {
      await conceptBrowserHandler.install(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );

      const result = await conceptBrowserHandler.update(
        { package_name: 'taxonomy-extra', target_version: '2.0.0' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.updated).toBeDefined();

      const pkg = await storage.get('package', result.updated as string);
      expect(pkg!.version).toBe('2.0.0');
    });

    it('returns not_installed for packages not installed', async () => {
      const result = await conceptBrowserHandler.update(
        { package_name: 'nonexistent', target_version: '2.0.0' },
        storage,
      );
      expect(result.variant).toBe('not_installed');
    });
  });

  describe('remove', () => {
    it('removes an installed package', async () => {
      const installed = await conceptBrowserHandler.install(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );

      const result = await conceptBrowserHandler.remove(
        { package_name: 'taxonomy-extra' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify status changed to removed
      const pkg = await storage.get('package', installed.installed as string);
      expect(pkg!.status).toBe('removed');
    });

    it('blocks removal when other packages depend on it', async () => {
      // Install base package
      const base = await conceptBrowserHandler.install(
        { package_name: 'base-pkg', version: '1.0.0' },
        storage,
      );

      // Install dependent package with dependency on base
      const depId = 'pkg-dep';
      await storage.put('package', depId, {
        id: depId,
        name: 'dependent-pkg',
        version: '1.0.0',
        status: 'installed',
        dependencies: ['base-pkg'],
      });

      const result = await conceptBrowserHandler.remove(
        { package_name: 'base-pkg' },
        storage,
      );
      expect(result.variant).toBe('depended_upon');
      expect(result.dependents).toContain('dependent-pkg');
    });
  });

  describe('sync_registries', () => {
    it('syncs enabled registries', async () => {
      await storage.put('registry', 'reg-1', {
        id: 'reg-1',
        name: 'repertoire',
        url: 'https://repertoire.clef.dev',
        enabled: true,
        last_synced: null,
      });
      await storage.put('registry', 'reg-2', {
        id: 'reg-2',
        name: 'disabled-reg',
        url: 'https://disabled.example.com',
        enabled: false,
        last_synced: null,
      });

      const result = await conceptBrowserHandler.sync_registries({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.updated_count).toBe(1);

      // Verify the enabled registry was synced
      const reg = await storage.get('registry', 'reg-1');
      expect(reg!.last_synced).toBeDefined();

      // Verify disabled registry was not synced
      const disabledReg = await storage.get('registry', 'reg-2');
      expect(disabledReg!.last_synced).toBeNull();
    });
  });

  describe('invariant: install then remove', () => {
    it('after installing, can remove the package', async () => {
      const installed = await conceptBrowserHandler.install(
        { package_name: 'taxonomy-extra', version: '1.0.0' },
        storage,
      );
      expect(installed.variant).toBe('ok');

      const removed = await conceptBrowserHandler.remove(
        { package_name: 'taxonomy-extra' },
        storage,
      );
      expect(removed.variant).toBe('ok');
    });
  });
});
