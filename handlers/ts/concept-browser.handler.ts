// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConceptBrowser Handler
//
// Discover, preview, install, update, and remove packages from
// registries, managing the full lifecycle of application
// extensibility at runtime.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
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

const DEFAULT_PACKAGES: Array<Omit<PackageRecord, 'id' | 'installed_at' | 'error'>> = [
  { name: 'app-shell', version: '0.1.0', registry: 'local', status: 'installed', content_hash: 'sha256:app-shell-0.1.0', manifest: 'Root shell, navigation, and destination orchestration.', dependencies: [], description: 'Root app shell and navigation chrome.', concepts: 3, syncs: 0 },
  { name: 'component-mapping', version: '0.1.0', registry: 'local', status: 'installed', content_hash: 'sha256:component-mapping-0.1.0', manifest: 'Widget-to-schema mapping and slot source dispatch.', dependencies: ['app-shell'], description: 'Display composition and slot binding infrastructure.', concepts: 10, syncs: 10 },
  { name: 'concept-browser', version: '0.1.0', registry: 'local', status: 'installed', content_hash: 'sha256:concept-browser-0.1.0', manifest: 'Runtime package discovery, preview, install, update, and remove.', dependencies: ['component-mapping'], description: 'Package discovery and installation workflow.', concepts: 1, syncs: 10 },
  { name: 'surface-integration', version: '0.1.0', registry: 'local', status: 'installed', content_hash: 'sha256:surface-integration-0.1.0', manifest: 'UI composition syncs for layout, graph, and shell chrome.', dependencies: ['component-mapping'], description: 'Surface syncs for composed application pages.', concepts: 0, syncs: 6 },
  { name: 'version-space-integration', version: '0.1.0', registry: 'local', status: 'installed', content_hash: 'sha256:version-space-integration-0.1.0', manifest: 'Version-aware save/load, alias namespace, and overlay indexing.', dependencies: ['surface-integration'], description: 'Version-space sync wiring and scoped indexing.', concepts: 0, syncs: 11 },
  { name: 'offline-first', version: '0.1.0', registry: 'hub', status: 'available', content_hash: 'sha256:offline-first-0.1.0', manifest: 'Replica coordination and conflict resolution syncs.', dependencies: ['component-mapping'], description: 'Offline-first replication and sync behavior.', concepts: 0, syncs: 5 },
  { name: 'web3-oracle-bridge', version: '0.1.0', registry: 'hub', status: 'available', content_hash: 'sha256:web3-oracle-bridge-0.1.0', manifest: 'Oracle event ingestion and writeback bridge.', dependencies: ['surface-integration'], description: 'Bridges chain state into ContentNodes.', concepts: 0, syncs: 10 },
  { name: 'editorial-theme', version: '0.1.0', registry: 'hub', status: 'available', content_hash: 'sha256:editorial-theme-0.1.0', manifest: 'Long-form reading theme with serif typography and calm surfaces.', dependencies: [], description: 'Editorial reading theme package.', concepts: 0, syncs: 0 },
];

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

    return completeFrom(p, 'dynamic', (bindings) => {
      const registries = bindings.registries as Record<string, unknown>[];
      let allPackages = bindings.allPackages as PackageRecord[];

      // Check registry reachability
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
    }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const packageName = input.package_name as string;
    const version = input.version as string;

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (bindings) => {
        const allPackages = bindings.allPackages as PackageRecord[];
        return !allPackages.find(pkg => pkg.name === packageName);
      },
      (thenP) => complete(thenP, 'not_found', { package_name: packageName }),
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => {
          const allPackages = bindings.allPackages as PackageRecord[];
          const pkg = allPackages.find(p => p.name === packageName)!;
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
        });
      },
    ) as StorageProgram<Result>;
  },

  install(input: Record<string, unknown>) {
    const packageName = (input.package_name ?? input.name) as string;
    const version = (input.version as string | undefined) ?? '0.1.0';

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (bindings) => {
        const allPackages = bindings.allPackages as PackageRecord[];
        return !!allPackages.find(p => p.name === packageName && p.version === version && p.status === 'installed');
      },
      (thenP) => complete(thenP, 'already_installed', { package_name: packageName, version }),
      (elseP) => {
        const pkgId = nextId('pkg');
        const now = new Date().toISOString();
        elseP = put(elseP, 'package', pkgId, {
          id: pkgId,
          name: packageName,
          version,
          registry: 'default',
          status: 'installed',
          content_hash: `sha256:${packageName}-${version}`,
          manifest: '',
          dependencies: [],
          installed_at: now,
          error: null,
        });
        return complete(elseP, 'ok', {
          installed: pkgId,
          details: toPackageSummary({
            id: pkgId, name: packageName, version, registry: 'default',
            status: 'installed', content_hash: `sha256:${packageName}-${version}`,
            manifest: '', dependencies: [], installed_at: now, error: null,
          }),
        });
      },
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const packageName = input.package_name as string;
    const targetVersion = input.target_version as string;

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (bindings) => {
        const allPackages = bindings.allPackages as PackageRecord[];
        return !allPackages.find(p => p.name === packageName && p.status === 'installed');
      },
      (thenP) => complete(thenP, 'not_installed', { package_name: packageName }),
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => {
          const allPackages = bindings.allPackages as PackageRecord[];
          const pkg = allPackages.find(p => p.name === packageName && p.status === 'installed')!;
          return {
            updated: pkg.id,
            details: toPackageSummary({ ...pkg, version: targetVersion }),
          };
        });
      },
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const packageName = input.package_name as string;

    let p = createProgram();
    p = find(p, 'package', {}, 'allPackages');

    return branch(p,
      (bindings) => {
        const allPackages = bindings.allPackages as PackageRecord[];
        return !allPackages.find(p => p.name === packageName && p.status === 'installed');
      },
      (thenP) => complete(thenP, 'ok', {}),
      (elseP) => {
        return branch(elseP,
          (bindings) => {
            const allPackages = bindings.allPackages as PackageRecord[];
            const dependents = allPackages.filter(p => {
              if (p.status !== 'installed') return false;
              const deps = p.dependencies || [];
              return deps.includes(packageName);
            });
            return dependents.length > 0;
          },
          (depP) => completeFrom(depP, 'depended_upon', (bindings) => {
            const allPackages = bindings.allPackages as PackageRecord[];
            const dependents = allPackages
              .filter(p => p.status === 'installed' && (p.dependencies || []).includes(packageName))
              .map(d => d.name);
            return { dependents };
          }),
          (okP) => complete(okP, 'ok', {}),
        );
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
