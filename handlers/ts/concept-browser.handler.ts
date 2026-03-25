// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// ============================================================
// ConceptBrowser Handler
//
// Discover, preview, install, update, and remove packages from
// registries, managing the full lifecycle of application
// extensibility at runtime.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  putFrom, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

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

    // Check for registry_unreachable before returning results
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

  install(input: Record<string, unknown>) {
    const packageName = (input.package_name ?? input.name) as string;
    const version = (input.version as string | undefined) ?? '0.1.0';

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (b) => {
        const pkgs = b.allPackages as PackageRecord[];
        return !!pkgs.find(pkg => pkg.name === packageName && pkg.version === version && pkg.status === 'installed');
      },
      (b) => complete(b, 'already_installed', { package_name: packageName, version }) as StorageProgram<Result>,
      (b) => {
        const pkgId = nextId('pkg');
        const now = new Date().toISOString();
        const record: PackageRecord = {
          id: pkgId, name: packageName, version, registry: 'default',
          status: 'installed', content_hash: `sha256:${packageName}-${version}`,
          manifest: '', dependencies: [], installed_at: now, error: null,
        };
        let b2 = put(b, 'package', pkgId, record as Record<string, unknown>);
        return complete(b2, 'ok', {
          installed: pkgId,
          details: toPackageSummary(record),
        }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const packageName = input.package_name as string;
    const targetVersion = input.target_version as string;

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (b) => {
        const pkgs = b.allPackages as PackageRecord[];
        return !pkgs.find(pkg => pkg.name === packageName && pkg.status === 'installed');
      },
      (b) => complete(b, 'not_installed', { package_name: packageName }) as StorageProgram<Result>,
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const pkgs = bindings.allPackages as PackageRecord[];
          return pkgs.find(pkg => pkg.name === packageName && pkg.status === 'installed')!;
        }, '_pkg');
        b2 = putFrom(b2, 'package', '_dynamic', (bindings) => {
          const pkg = bindings._pkg as PackageRecord;
          return { ...pkg, version: targetVersion };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const pkg = bindings._pkg as PackageRecord;
          const updated = { ...pkg, version: targetVersion };
          return { updated: pkg.id, details: toPackageSummary(updated as PackageRecord) };
        }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const packageName = input.package_name as string;

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (b) => {
        const pkgs = b.allPackages as PackageRecord[];
        return !pkgs.find(pkg => pkg.name === packageName && pkg.status === 'installed');
      },
      (b) => complete(b, 'ok', {}) as StorageProgram<Result>,
      (b) => {
        // Check dependents
        let b2 = mapBindings(b, (bindings) => {
          const pkgs = bindings.allPackages as PackageRecord[];
          return pkgs.filter(p2 => {
            if (p2.status !== 'installed') return false;
            const deps = p2.dependencies || [];
            return deps.includes(packageName);
          });
        }, '_dependents');

        return branch(b2,
          (bindings) => (bindings._dependents as unknown[]).length > 0,
          (b3) => completeFrom(b3, 'depended_upon', (bindings) => ({
            dependents: (bindings._dependents as PackageRecord[]).map(d => d.name),
          })) as StorageProgram<Result>,
          (b3) => {
            let b4 = mapBindings(b3, (bindings) => {
              const pkgs = bindings.allPackages as PackageRecord[];
              return pkgs.find(pkg => pkg.name === packageName && pkg.status === 'installed')!;
            }, '_pkg');
            b4 = putFrom(b4, 'package', '_dynamic', (bindings) => {
              const pkg = bindings._pkg as PackageRecord;
              return { ...pkg, status: 'removed' };
            });
            return complete(b4, 'ok', {}) as StorageProgram<Result>;
          },
        ) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
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

export const conceptBrowserHandler = autoInterpret(_handler);
