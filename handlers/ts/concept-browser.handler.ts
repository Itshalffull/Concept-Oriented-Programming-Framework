// ============================================================
// ConceptBrowser Handler
//
// Discover, preview, install, update, and remove packages from
// registries, managing the full lifecycle of application
// extensibility at runtime.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export function resetConceptBrowserCounter(): void {
  idCounter = 0;
}

export const conceptBrowserHandler: ConceptHandler = {
  async search(input: Record<string, unknown>, storage: ConceptStorage) {
    const query = input.query as string;
    const registry = input.registry as string;

    // Check if specific registry is reachable
    if (registry && registry !== 'all') {
      const registries = await storage.find('registry', {});
      const reg = registries.find(
        (r: Record<string, unknown>) => r.url === registry || r.name === registry,
      );
      if (reg && !(reg as Record<string, unknown>).enabled) {
        return { variant: 'registry_unreachable', registry };
      }
    }

    // Search packages matching the query
    const allPackages = await storage.find('package', {});
    const queryLower = (query || '').toLowerCase();
    const results = allPackages.filter((pkg: Record<string, unknown>) => {
      const name = ((pkg.name as string) || '').toLowerCase();
      const manifest = ((pkg.manifest as string) || '').toLowerCase();
      return name.includes(queryLower) || manifest.includes(queryLower);
    });

    return {
      variant: 'ok',
      results: results.map((r: Record<string, unknown>) => r.id),
    };
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = input.package_name as string;
    const version = input.version as string;

    // Find the package in available packages
    const allPackages = await storage.find('package', {});
    const pkg = allPackages.find(
      (p: Record<string, unknown>) => p.name === packageName,
    );

    if (!pkg) {
      return { variant: 'not_found', package_name: packageName };
    }

    // Create a preview entry
    const previewId = nextId('preview');
    await storage.put('preview', previewId, {
      id: previewId,
      package_id: (pkg as Record<string, unknown>).id,
      package_name: packageName,
      version,
      new_schemas: [],
      new_syncs: [],
      new_providers: [],
      new_widgets: [],
      dependency_tree: '{}',
      conflicts: [],
      size_impact: 0,
    });

    // Update package status to previewing
    const pkgData = pkg as Record<string, unknown>;
    await storage.put('package', pkgData.id as string, {
      ...pkgData,
      status: 'previewing',
    });

    return { variant: 'ok', preview: previewId };
  },

  async install(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = input.package_name as string;
    const version = input.version as string;

    // Check if already installed
    const allPackages = await storage.find('package', {});
    const existing = allPackages.find(
      (p: Record<string, unknown>) =>
        p.name === packageName && p.version === version && p.status === 'installed',
    );

    if (existing) {
      return {
        variant: 'already_installed',
        package_name: packageName,
        version,
      };
    }

    // Find or create the package entry
    let pkg = allPackages.find(
      (p: Record<string, unknown>) => p.name === packageName,
    );

    const pkgId = pkg
      ? (pkg as Record<string, unknown>).id as string
      : nextId('pkg');

    // Update status to installing
    const installData = {
      id: pkgId,
      name: packageName,
      version,
      registry: 'default',
      status: 'installing',
      content_hash: '',
      manifest: '',
      dependencies: [],
      installed_at: null,
      error: null,
    };

    await storage.put('package', pkgId, installData);

    // Simulate installation steps
    // Step 1: Download package
    // Step 2: Resolve dependencies
    // Step 3: Validate package
    // Step 4: Create Schemas
    // Step 5: Register providers
    // Step 6: Activate syncs
    // Step 7: Generate widgets
    // Step 8: Regenerate Bind targets
    // Step 9: Update state

    const now = new Date().toISOString();
    await storage.put('package', pkgId, {
      ...installData,
      status: 'installed',
      installed_at: now,
      content_hash: `sha256:${packageName}-${version}`,
    });

    return { variant: 'ok', installed: pkgId };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = input.package_name as string;
    const targetVersion = input.target_version as string;

    // Find installed package
    const allPackages = await storage.find('package', {});
    const pkg = allPackages.find(
      (p: Record<string, unknown>) =>
        p.name === packageName && p.status === 'installed',
    );

    if (!pkg) {
      return { variant: 'not_installed', package_name: packageName };
    }

    const pkgData = pkg as Record<string, unknown>;
    const pkgId = pkgData.id as string;

    // Update status to updating
    await storage.put('package', pkgId, {
      ...pkgData,
      status: 'updating',
    });

    // Simulate update with migration
    const now = new Date().toISOString();
    await storage.put('package', pkgId, {
      ...pkgData,
      status: 'installed',
      version: targetVersion,
      installed_at: now,
      content_hash: `sha256:${packageName}-${targetVersion}`,
    });

    return { variant: 'ok', updated: pkgId };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = input.package_name as string;

    // Find installed package
    const allPackages = await storage.find('package', {});
    const pkg = allPackages.find(
      (p: Record<string, unknown>) =>
        p.name === packageName && p.status === 'installed',
    );

    if (!pkg) {
      // If not found as installed, treat as not installed
      return { variant: 'ok' };
    }

    const pkgData = pkg as Record<string, unknown>;
    const pkgId = pkgData.id as string;

    // Check for dependents
    const dependents = allPackages.filter((p: Record<string, unknown>) => {
      if (p.status !== 'installed') return false;
      const deps = (p.dependencies as string[]) || [];
      return deps.includes(packageName);
    });

    if (dependents.length > 0) {
      return {
        variant: 'depended_upon',
        dependents: dependents.map((d: Record<string, unknown>) => d.name as string),
      };
    }

    // Update status to removing, then remove
    await storage.put('package', pkgId, {
      ...pkgData,
      status: 'removed',
      installed_at: null,
    });

    return { variant: 'ok' };
  },

  async sync_registries(input: Record<string, unknown>, storage: ConceptStorage) {
    const registries = await storage.find('registry', {});
    const enabled = registries.filter(
      (r: Record<string, unknown>) => r.enabled === true,
    );

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const reg of enabled) {
      const regData = reg as Record<string, unknown>;
      await storage.put('registry', regData.id as string, {
        ...regData,
        last_synced: now,
      });
      updatedCount++;
    }

    return { variant: 'ok', updated_count: updatedCount };
  },
};
