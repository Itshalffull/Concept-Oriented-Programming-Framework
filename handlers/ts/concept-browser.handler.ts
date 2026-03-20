// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConceptBrowser Handler
//
// Discover, preview, install, update, and remove packages from
// registries, managing the full lifecycle of application
// extensibility at runtime.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

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
  async search(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const query = input.query as string;
    const registry = input.registry as string;

    const registries = await storage.find('registry', {});
    const allPackages = await storage.find('package', {}) as PackageRecord[];

    if (registry && registry !== 'all') {
      const reg = registries.find(r => r.url === registry || r.name === registry);
      if (reg && !reg.enabled) {
        return { variant: 'registry_unreachable', registry };
      }
    }

    const queryLower = (query || '').toLowerCase();
    const results = allPackages.filter(pkg => {
      const name = ((pkg.name as string) || '').toLowerCase();
      const manifest = ((pkg.manifest as string) || '').toLowerCase();
      const description = ((pkg.description as string) || '').toLowerCase();
      const registryMatch = !registry || registry === 'all' || pkg.registry === registry;
      return registryMatch && (name.includes(queryLower) || manifest.includes(queryLower) || description.includes(queryLower));
    });

    return {
      variant: 'ok',
      results: results.map(pkg => pkg.id),
      details: results.map(pkg => toPackageSummary(pkg)),
    };
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const packageName = input.package_name as string;
    const version = input.version as string;

    const allPackages = await storage.find('package', {}) as PackageRecord[];
    const pkg = allPackages.find(p => p.name === packageName);
    if (!pkg) return { variant: 'not_found', package_name: packageName };

    const dependencies = pkg.dependencies ?? [];
    return {
      variant: 'ok',
      preview: `preview-${packageName}`,
      details: {
        package_name: packageName,
        version,
        new_schemas: [`${packageName}-schema`],
        new_syncs: Array.from({ length: Math.max(Number(pkg.syncs ?? 0), 1) }, (_, i) => `${packageName}-sync-${i + 1}`),
        dependency_tree: JSON.stringify({ name: packageName, dependencies }),
      },
      package: toPackageSummary(pkg),
    };
  },

  async install(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const packageName = (input.package_name ?? input.name) as string;
    const version = (input.version as string | undefined) ?? '0.1.0';

    const allPackages = await storage.find('package', {}) as PackageRecord[];
    if (allPackages.find(p => p.name === packageName && p.version === version && p.status === 'installed')) {
      return { variant: 'already_installed', package_name: packageName, version };
    }

    const pkgId = nextId('pkg');
    const now = new Date().toISOString();
    const record: PackageRecord = {
      id: pkgId, name: packageName, version, registry: 'default',
      status: 'installed', content_hash: `sha256:${packageName}-${version}`,
      manifest: '', dependencies: [], installed_at: now, error: null,
    };
    await storage.put('package', pkgId, record);

    return {
      variant: 'ok',
      installed: pkgId,
      details: toPackageSummary(record),
    };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const packageName = input.package_name as string;
    const targetVersion = input.target_version as string;

    const allPackages = await storage.find('package', {}) as PackageRecord[];
    const pkg = allPackages.find(p => p.name === packageName && p.status === 'installed');
    if (!pkg) return { variant: 'not_installed', package_name: packageName };

    // Write the updated version back to storage
    const updated = { ...pkg, version: targetVersion };
    await storage.put('package', pkg.id, updated);

    return {
      variant: 'ok',
      updated: pkg.id,
      details: toPackageSummary(updated as PackageRecord),
    };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const packageName = input.package_name as string;

    const allPackages = await storage.find('package', {}) as PackageRecord[];
    const pkg = allPackages.find(p => p.name === packageName && p.status === 'installed');
    if (!pkg) return { variant: 'ok' };

    // Check for dependents
    const dependents = allPackages.filter(p => {
      if (p.status !== 'installed') return false;
      const deps = p.dependencies || [];
      return deps.includes(packageName);
    });
    if (dependents.length > 0) {
      return { variant: 'depended_upon', dependents: dependents.map(d => d.name) };
    }

    // Write removed status back to storage
    await storage.put('package', pkg.id, { ...pkg, status: 'removed' });
    return { variant: 'ok' };
  },

  async sync_registries(_input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const registries = await storage.find('registry', {});
    const enabled = registries.filter(r => r.enabled === true);
    return { variant: 'ok', updated_count: enabled.length };
  },

  async listInstalled(_input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const packages = await storage.find('package', {}) as PackageRecord[];
    return {
      variant: 'ok',
      packages: packages
        .filter(pkg => pkg.status !== 'available' && pkg.status !== 'removed')
        .map(pkg => toPackageSummary(pkg)),
    };
  },
};
