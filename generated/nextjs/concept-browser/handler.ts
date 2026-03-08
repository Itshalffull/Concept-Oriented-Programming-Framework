// ConceptBrowser — Discover, preview, install, update, and remove packages from registries,
// managing the full lifecycle of application extensibility at runtime.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  ConceptBrowserStorage,
  ConceptBrowserSearchInput,
  ConceptBrowserSearchOutput,
  ConceptBrowserPreviewInput,
  ConceptBrowserPreviewOutput,
  ConceptBrowserInstallInput,
  ConceptBrowserInstallOutput,
  ConceptBrowserUpdateInput,
  ConceptBrowserUpdateOutput,
  ConceptBrowserRemoveInput,
  ConceptBrowserRemoveOutput,
  ConceptBrowserRollbackInput,
  ConceptBrowserRollbackOutput,
  ConceptBrowserPinInput,
  ConceptBrowserPinOutput,
  ConceptBrowserConfigureInput,
  ConceptBrowserConfigureOutput,
  ConceptBrowserListInput,
  ConceptBrowserListOutput,
  ConceptBrowserListInstalledInput,
  ConceptBrowserListInstalledOutput,
} from './types.js';

import {
  searchOk,
  searchRegistryUnreachable,
  previewOk,
  previewNotFound,
  installOk,
  installAlreadyInstalled,
  updateOk,
  updateNotInstalled,
  removeOk,
  removeDependedUpon,
  rollbackOk,
  rollbackNotInstalled,
  rollbackNoPreviousVersion,
  pinOk,
  pinNotInstalled,
  configureOk,
  configureNotInstalled,
  configureInvalidConfig,
  listOk,
  listInstalledOk,
} from './types.js';

export interface ConceptBrowserError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ConceptBrowserError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ConceptBrowserHandler {
  readonly search: (
    input: ConceptBrowserSearchInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserSearchOutput>;
  readonly preview: (
    input: ConceptBrowserPreviewInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserPreviewOutput>;
  readonly install: (
    input: ConceptBrowserInstallInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserInstallOutput>;
  readonly update: (
    input: ConceptBrowserUpdateInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserUpdateOutput>;
  readonly remove: (
    input: ConceptBrowserRemoveInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserRemoveOutput>;
  readonly rollback: (
    input: ConceptBrowserRollbackInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserRollbackOutput>;
  readonly pin: (
    input: ConceptBrowserPinInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserPinOutput>;
  readonly configure: (
    input: ConceptBrowserConfigureInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserConfigureOutput>;
  readonly list: (
    input: ConceptBrowserListInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserListOutput>;
  readonly listInstalled: (
    input: ConceptBrowserListInstalledInput,
    storage: ConceptBrowserStorage,
  ) => TE.TaskEither<ConceptBrowserError, ConceptBrowserListInstalledOutput>;
}

// --- Implementation ---

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export const conceptBrowserHandler: ConceptBrowserHandler = {
  search: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('registry', {}),
        toStorageError,
      ),
      TE.chain((registries) => {
        // Check if specific registry is reachable
        if (input.registry && input.registry !== 'all') {
          const reg = registries.find(
            (r) => r.url === input.registry || r.name === input.registry,
          );
          if (reg && !reg.enabled) {
            return TE.right(searchRegistryUnreachable(input.registry));
          }
        }

        return pipe(
          TE.tryCatch(
            () => storage.find('package', {}),
            toStorageError,
          ),
          TE.map((allPackages) => {
            const queryLower = (input.query || '').toLowerCase();
            const results = allPackages.filter((pkg) => {
              const name = ((pkg.name as string) || '').toLowerCase();
              const manifest = ((pkg.manifest as string) || '').toLowerCase();
              return name.includes(queryLower) || manifest.includes(queryLower);
            });
            return searchOk(results.map((r) => r.id as string));
          }),
        );
      }),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.chain((allPackages) => {
        const pkg = allPackages.find((p) => p.name === input.package_name);

        if (!pkg) {
          return TE.right(previewNotFound(input.package_name));
        }

        const previewId = nextId('preview');
        return TE.tryCatch(
          async () => {
            await storage.put('preview', previewId, {
              id: previewId,
              package_id: pkg.id,
              package_name: input.package_name,
              version: input.version,
              new_schemas: [],
              new_syncs: [],
              new_providers: [],
              new_widgets: [],
              dependency_tree: '{}',
              conflicts: [],
              size_impact: 0,
            });

            // Update package status to previewing
            await storage.put('package', pkg.id as string, {
              ...pkg,
              status: 'previewing',
            });

            return previewOk(previewId);
          },
          toStorageError,
        );
      }),
    ),

  install: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.chain((allPackages) => {
        const existing = allPackages.find(
          (p) =>
            p.name === input.package_name &&
            p.version === input.version &&
            p.status === 'installed',
        );

        if (existing) {
          return TE.right(
            installAlreadyInstalled(input.package_name, input.version),
          );
        }

        const existingPkg = allPackages.find(
          (p) => p.name === input.package_name,
        );

        const pkgId = existingPkg
          ? (existingPkg.id as string)
          : nextId('pkg');

        return TE.tryCatch(
          async () => {
            const now = new Date().toISOString();
            await storage.put('package', pkgId, {
              id: pkgId,
              name: input.package_name,
              version: input.version,
              registry: 'default',
              status: 'installed',
              content_hash: `sha256:${input.package_name}-${input.version}`,
              manifest: '',
              dependencies: [],
              installed_at: now,
              error: null,
            });
            return installOk(pkgId);
          },
          toStorageError,
        );
      }),
    ),

  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.chain((allPackages) => {
        const pkg = allPackages.find(
          (p) => p.name === input.package_name && p.status === 'installed',
        );

        if (!pkg) {
          return TE.right(updateNotInstalled(input.package_name));
        }

        const pkgId = pkg.id as string;

        return TE.tryCatch(
          async () => {
            const now = new Date().toISOString();
            await storage.put('package', pkgId, {
              ...pkg,
              status: 'installed',
              version: input.target_version,
              installed_at: now,
              content_hash: `sha256:${input.package_name}-${input.target_version}`,
            });
            return updateOk(pkgId);
          },
          toStorageError,
        );
      }),
    ),

  remove: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.chain((allPackages) => {
        const pkg = allPackages.find(
          (p) => p.name === input.package_name && p.status === 'installed',
        );

        if (!pkg) {
          // Not installed — treat as successful removal
          return TE.right(removeOk());
        }

        // Check for dependents
        const dependents = allPackages.filter((p) => {
          if (p.status !== 'installed') return false;
          const deps = (p.dependencies as string[]) || [];
          return deps.includes(input.package_name);
        });

        if (dependents.length > 0) {
          return TE.right(
            removeDependedUpon(
              dependents.map((d) => d.name as string),
            ),
          );
        }

        const pkgId = pkg.id as string;

        return TE.tryCatch(
          async () => {
            await storage.put('package', pkgId, {
              ...pkg,
              status: 'removed',
              installed_at: null,
            });
            return removeOk();
          },
          toStorageError,
        );
      }),
    ),

  rollback: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.chain((allPackages) => {
        const pkg = allPackages.find(
          (p) => p.name === input.package_name && p.status === 'installed',
        );

        if (!pkg) {
          return TE.right(rollbackNotInstalled(input.package_name));
        }

        const previousVersion = pkg.previous_version as string | undefined;
        if (!previousVersion) {
          return TE.right(rollbackNoPreviousVersion(input.package_name));
        }

        const pkgId = pkg.id as string;

        return TE.tryCatch(
          async () => {
            const now = new Date().toISOString();
            await storage.put('package', pkgId, {
              ...pkg,
              version: previousVersion,
              previous_version: pkg.version,
              installed_at: now,
              content_hash: `sha256:${input.package_name}-${previousVersion}`,
            });
            return rollbackOk(previousVersion);
          },
          toStorageError,
        );
      }),
    ),

  pin: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.chain((allPackages) => {
        const pkg = allPackages.find(
          (p) => p.name === input.package_name && p.status === 'installed',
        );

        if (!pkg) {
          return TE.right(pinNotInstalled(input.package_name));
        }

        const pkgId = pkg.id as string;

        return TE.tryCatch(
          async () => {
            await storage.put('package', pkgId, {
              ...pkg,
              pinned: true,
              pinned_version: input.version,
            });
            return pinOk(pkgId);
          },
          toStorageError,
        );
      }),
    ),

  configure: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.chain((allPackages) => {
        const pkg = allPackages.find(
          (p) => p.name === input.package_name && p.status === 'installed',
        );

        if (!pkg) {
          return TE.right(configureNotInstalled(input.package_name));
        }

        // Validate config JSON
        try {
          JSON.parse(input.config);
        } catch {
          return TE.right(configureInvalidConfig(`Invalid config JSON: ${input.config}`));
        }

        const pkgId = pkg.id as string;

        return TE.tryCatch(
          async () => {
            await storage.put('package', pkgId, {
              ...pkg,
              config: input.config,
            });
            return configureOk();
          },
          toStorageError,
        );
      }),
    ),

  list: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.map((allPackages) => {
        let filtered = allPackages;
        if (input.registry && input.registry !== 'all') {
          filtered = allPackages.filter((p) => p.registry === input.registry);
        }
        return listOk(filtered.map((p) => p.id as string));
      }),
    ),

  listInstalled: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('package', {}),
        toStorageError,
      ),
      TE.map((allPackages) => {
        const installed = allPackages.filter((p) => p.status === 'installed');
        return listInstalledOk(installed.map((p) => p.id as string));
      }),
    ),
};
