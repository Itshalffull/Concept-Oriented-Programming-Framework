// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// ============================================================
// ConceptBrowser Handler
//
// Discover, preview, install, update, and remove packages from
// registries, managing the full lifecycle of application
// extensibility at runtime.
//
// install, update, and remove use imperative overrides because
// they require dynamic storage keys derived from find results
// (the DSL's putFrom takes a static key).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
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

const _handler: FunctionalConceptHandler = {
  search(input: Record<string, unknown>) {
    const query = input.query as string;
    const registry = input.registry as string;

    let p = createProgram();
    p = find(p, 'registry', {}, 'registries');
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (b) => {
        if (!registry || registry === 'all') return false;
        const registries = b.registries as Record<string, unknown>[];
        const reg = registries.find(r => r.url === registry || r.name === registry);
        return !!(reg && !reg.enabled);
      },
      (b) => complete(b, 'registry_unreachable', { registry }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const allPackages = bindings.allPackages as PackageRecord[];
        const queryLower = (query || '').toLowerCase();
        const results = allPackages.filter(pkg => {
          const name = ((pkg.name as string) || '').toLowerCase();
          const manifest = ((pkg.manifest as string) || '').toLowerCase();
          const description = ((pkg.description as string) || '').toLowerCase();
          const registryMatch = !registry || registry === 'all' || pkg.registry === registry;
          return registryMatch && (name.includes(queryLower) || manifest.includes(queryLower) || description.includes(queryLower));
        });
        return {
          results: results.map(pkg => pkg.id),
          details: results.map(pkg => toPackageSummary(pkg)),
        };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const packageName = input.package_name as string;
    const version = input.version as string;

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (b) => {
        const pkgs = b.allPackages as PackageRecord[];
        return !pkgs.find(pkg => pkg.name === packageName);
      },
      (b) => complete(b, 'not_found', { package_name: packageName }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const allPackages = bindings.allPackages as PackageRecord[];
        const pkg = allPackages.find(p2 => p2.name === packageName)!;
        const dependencies = pkg.dependencies ?? [];
        return {
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
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  // Placeholder — overridden imperatively (dynamic storage key from nextId)
  install(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
  },
  // Placeholder — overridden imperatively (dynamic storage key from find results)
  update(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
  },
  // Placeholder — overridden imperatively (dynamic storage key from find results)
  remove(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
  },

  sync_registries(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'registry', {}, 'registries');
    return completeFrom(p, 'ok', (bindings) => {
      const registries = bindings.registries as Record<string, unknown>[];
      const enabled = registries.filter(r => r.enabled === true);
      return { updated_count: enabled.length };
    }) as StorageProgram<Result>;
  },

  listInstalled(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'package', {}, 'packages');
    return completeFrom(p, 'ok', (bindings) => {
      const packages = bindings.packages as PackageRecord[];
      return {
        packages: packages
          .filter(pkg => pkg.status !== 'available' && pkg.status !== 'removed')
          .map(pkg => toPackageSummary(pkg)),
      };
    }) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

// Imperative overrides for actions requiring dynamic storage keys

const _install: ConceptHandler['install'] = async (
  input: Record<string, unknown>,
  storage: ConceptStorage,
) => {
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
  return { variant: 'ok', installed: pkgId, details: toPackageSummary(record) };
};

const _update: ConceptHandler['update'] = async (
  input: Record<string, unknown>,
  storage: ConceptStorage,
) => {
  const packageName = input.package_name as string;
  const targetVersion = input.target_version as string;
  const allPackages = await storage.find('package', {}) as PackageRecord[];
  const pkg = allPackages.find(p => p.name === packageName && p.status === 'installed');
  if (!pkg) return { variant: 'not_installed', package_name: packageName };
  const updated = { ...pkg, version: targetVersion };
  await storage.put('package', pkg.id, updated);
  return { variant: 'ok', updated: pkg.id, details: toPackageSummary(updated as PackageRecord) };
};

const _remove: ConceptHandler['remove'] = async (
  input: Record<string, unknown>,
  storage: ConceptStorage,
) => {
  const packageName = input.package_name as string;
  const allPackages = await storage.find('package', {}) as PackageRecord[];
  const pkg = allPackages.find(p => p.name === packageName && p.status === 'installed');
  if (!pkg) return { variant: 'ok' };
  const dependents = allPackages.filter(p => {
    if (p.status !== 'installed') return false;
    return (p.dependencies || []).includes(packageName);
  });
  if (dependents.length > 0) {
    return { variant: 'depended_upon', dependents: dependents.map(d => d.name) };
  }
  await storage.put('package', pkg.id, { ...pkg, status: 'removed' });
  return { variant: 'ok' };
};

export const conceptBrowserHandler: FunctionalConceptHandler & ConceptHandler = {
  ..._base,
  install: _install,
  update: _update,
  remove: _remove,
} as FunctionalConceptHandler & ConceptHandler;
