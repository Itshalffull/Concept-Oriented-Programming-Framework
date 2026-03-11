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

type PackageRecord = Record<string, unknown> & {
  id: string;
  name: string;
  version: string;
  registry: string;
  status: string;
  content_hash: string;
  manifest: string;
  dependencies: string[];
  description?: string;
  concepts?: number;
  syncs?: number;
  installed_at?: string | null;
  error?: string | null;
};

const DEFAULT_PACKAGES: Array<Omit<PackageRecord, 'id' | 'installed_at' | 'error'>> = [
  {
    name: 'app-shell',
    version: '0.1.0',
    registry: 'local',
    status: 'installed',
    content_hash: 'sha256:app-shell-0.1.0',
    manifest: 'Root shell, navigation, and destination orchestration.',
    dependencies: [],
    description: 'Root app shell and navigation chrome.',
    concepts: 3,
    syncs: 0,
  },
  {
    name: 'component-mapping',
    version: '0.1.0',
    registry: 'local',
    status: 'installed',
    content_hash: 'sha256:component-mapping-0.1.0',
    manifest: 'Widget-to-schema mapping and slot source dispatch.',
    dependencies: ['app-shell'],
    description: 'Display composition and slot binding infrastructure.',
    concepts: 10,
    syncs: 10,
  },
  {
    name: 'concept-browser',
    version: '0.1.0',
    registry: 'local',
    status: 'installed',
    content_hash: 'sha256:concept-browser-0.1.0',
    manifest: 'Runtime package discovery, preview, install, update, and remove.',
    dependencies: ['component-mapping'],
    description: 'Package discovery and installation workflow.',
    concepts: 1,
    syncs: 10,
  },
  {
    name: 'surface-integration',
    version: '0.1.0',
    registry: 'local',
    status: 'installed',
    content_hash: 'sha256:surface-integration-0.1.0',
    manifest: 'UI composition syncs for layout, graph, and shell chrome.',
    dependencies: ['component-mapping'],
    description: 'Surface syncs for composed application pages.',
    concepts: 0,
    syncs: 6,
  },
  {
    name: 'version-space-integration',
    version: '0.1.0',
    registry: 'local',
    status: 'installed',
    content_hash: 'sha256:version-space-integration-0.1.0',
    manifest: 'Version-aware save/load, alias namespace, and overlay indexing.',
    dependencies: ['surface-integration'],
    description: 'Version-space sync wiring and scoped indexing.',
    concepts: 0,
    syncs: 11,
  },
  {
    name: 'offline-first',
    version: '0.1.0',
    registry: 'hub',
    status: 'available',
    content_hash: 'sha256:offline-first-0.1.0',
    manifest: 'Replica coordination and conflict resolution syncs.',
    dependencies: ['component-mapping'],
    description: 'Offline-first replication and sync behavior.',
    concepts: 0,
    syncs: 5,
  },
  {
    name: 'web3-oracle-bridge',
    version: '0.1.0',
    registry: 'hub',
    status: 'available',
    content_hash: 'sha256:web3-oracle-bridge-0.1.0',
    manifest: 'Oracle event ingestion and writeback bridge.',
    dependencies: ['surface-integration'],
    description: 'Bridges chain state into ContentNodes.',
    concepts: 0,
    syncs: 10,
  },
  {
    name: 'editorial-theme',
    version: '0.1.0',
    registry: 'hub',
    status: 'available',
    content_hash: 'sha256:editorial-theme-0.1.0',
    manifest: 'Long-form reading theme with serif typography and calm surfaces.',
    dependencies: [],
    description: 'Editorial reading theme package.',
    concepts: 0,
    syncs: 0,
  },
];

async function ensureDefaultPackages(storage: ConceptStorage): Promise<PackageRecord[]> {
  const existing = await storage.find('package', {});
  if (existing.length > 0) {
    return existing as PackageRecord[];
  }

  const now = new Date().toISOString();
  for (const pkg of DEFAULT_PACKAGES) {
    const id = nextId('pkg');
    await storage.put('package', id, {
      id,
      ...pkg,
      installed_at: pkg.status === 'installed' ? now : null,
      error: null,
    });
  }

  return await storage.find('package', {}) as PackageRecord[];
}

async function ensureDefaultRegistries(storage: ConceptStorage): Promise<void> {
  const existing = await storage.find('registry', {});
  if (existing.length > 0) return;

  const localId = nextId('registry');
  await storage.put('registry', localId, {
    id: localId,
    url: 'local',
    name: 'Local',
    enabled: true,
    last_synced: new Date().toISOString(),
  });
  const hubId = nextId('registry');
  await storage.put('registry', hubId, {
    id: hubId,
    url: 'hub',
    name: 'Hub',
    enabled: true,
    last_synced: null,
  });
}

function toPackageSummary(pkg: PackageRecord): Record<string, unknown> {
  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    registry: pkg.registry,
    status: pkg.status,
    manifest: pkg.manifest,
    description: pkg.description ?? pkg.manifest,
    dependencies: pkg.dependencies,
    concepts: pkg.concepts ?? 0,
    syncs: pkg.syncs ?? 0,
    installedAt: pkg.installed_at ?? null,
    contentHash: pkg.content_hash,
    error: pkg.error ?? null,
  };
}

export const conceptBrowserHandler: ConceptHandler = {
  async search(input: Record<string, unknown>, storage: ConceptStorage) {
    const query = input.query as string;
    const registry = input.registry as string;
    await ensureDefaultRegistries(storage);

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
    const allPackages = await ensureDefaultPackages(storage);
    const queryLower = (query || '').toLowerCase();
    const results = allPackages.filter((pkg: Record<string, unknown>) => {
      const name = ((pkg.name as string) || '').toLowerCase();
      const manifest = ((pkg.manifest as string) || '').toLowerCase();
      const description = ((pkg.description as string) || '').toLowerCase();
      const registryMatch = !registry || registry === 'all' || pkg.registry === registry;
      return registryMatch && (name.includes(queryLower) || manifest.includes(queryLower) || description.includes(queryLower));
    });

    return {
      variant: 'ok',
      results: results.map((pkg) => toPackageSummary(pkg as PackageRecord)),
    };
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = input.package_name as string;
    const version = input.version as string;

    // Find the package in available packages
    const allPackages = await ensureDefaultPackages(storage);
    const pkg = allPackages.find(
      (p: Record<string, unknown>) => p.name === packageName,
    );

    if (!pkg) {
      return { variant: 'not_found', package_name: packageName };
    }

    // Create a preview entry
    const previewId = nextId('preview');
    const dependencies = ((pkg as Record<string, unknown>).dependencies as string[]) ?? [];
    await storage.put('preview', previewId, {
      id: previewId,
      package_id: (pkg as Record<string, unknown>).id,
      package_name: packageName,
      version,
      new_schemas: [`${packageName}-schema`],
      new_syncs: Array.from({ length: Math.max(Number((pkg as Record<string, unknown>).syncs ?? 0), 1) }, (_, index) => `${packageName}-sync-${index + 1}`),
      new_providers: pkg.name === 'offline-first' ? ['ReplicaProvider'] : [],
      new_widgets: pkg.name?.toString().includes('theme') ? ['theme-preview-card'] : ['package-card'],
      dependency_tree: JSON.stringify({ name: packageName, dependencies }),
      conflicts: [],
      size_impact: 24 + dependencies.length * 8,
    });

    // Update package status to previewing
    const pkgData = pkg as Record<string, unknown>;
    await storage.put('package', pkgData.id as string, {
      ...pkgData,
      status: 'previewing',
    });

    const preview = await storage.get('preview', previewId);
    return {
      variant: 'ok',
      preview: previewId,
      details: preview,
      package: toPackageSummary(pkg as PackageRecord),
    };
  },

  async install(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = (input.package_name ?? input.name) as string;
    const version = (input.version as string | undefined) ?? '0.1.0';

    // Check if already installed
    const allPackages = await ensureDefaultPackages(storage);
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

    const installed = await storage.get('package', pkgId);
    return { variant: 'ok', installed: toPackageSummary(installed as PackageRecord) };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = input.package_name as string;
    const targetVersion = input.target_version as string;

    // Find installed package
    const allPackages = await ensureDefaultPackages(storage);
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

    const updated = await storage.get('package', pkgId);
    return { variant: 'ok', updated: toPackageSummary(updated as PackageRecord) };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const packageName = input.package_name as string;

    // Find installed package
    const allPackages = await ensureDefaultPackages(storage);
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
    await ensureDefaultRegistries(storage);
    await ensureDefaultPackages(storage);
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

  async listInstalled(_input: Record<string, unknown>, storage: ConceptStorage) {
    const packages = await ensureDefaultPackages(storage);
    return {
      variant: 'ok',
      packages: packages
        .filter((pkg) => pkg.status !== 'available' && pkg.status !== 'removed')
        .map((pkg) => toPackageSummary(pkg)),
    };
  },
};
