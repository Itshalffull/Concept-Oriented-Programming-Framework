// @migrated dsl-constructs 2026-03-18
// Installer Concept Implementation (Package Distribution Suite)
// Staged transactional installation of resolved packages. Each installation
// is an immutable generation that can be atomically activated or rolled back.
// Supports generational cleanup to reclaim disk space.

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextIdVal = 1;
let nextGeneration = 1;
export function resetInstallerIds() { nextIdVal = 1; nextGeneration = 1; }

const _handler: FunctionalConceptHandler = {
  stage(input: Record<string, unknown>) {
    const lockfileEntries = input.lockfile_entries as Array<{
      module_id: string;
      version: string;
      content_hash: string;
      target_path: string;
      kind: string;
    }>;
    const projectRoot = input.project_root as string;

    let p = createProgram();
    p = find(p, 'installation', {}, 'allInstallations');

    return completeFrom(p, 'ok', (bindings) => {
      const allInstallations = bindings.allInstallations as Record<string, unknown>[];
      const currentActive = allInstallations.find(i => i.active === true);

      const id = `inst-${nextIdVal++}`;
      const generation = nextGeneration++;

      return {
        _puts: [{ relation: 'installation', key: id, value: {
          id,
          generation,
          lockfile_hash: JSON.stringify(lockfileEntries),
          staged_modules: JSON.stringify(lockfileEntries),
          active: false,
          previous_generation: currentActive ? currentActive.id as string : null,
          installed_at: null,
          project_root: projectRoot,
        }}],
        installation: id,
      };
    }) as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const installation = input.installation as string;

    let p = createProgram();
    p = get(p, 'installation', installation, 'inst');

    return branch(p,
      (bindings) => !bindings.inst,
      (bp) => complete(bp, 'error', { message: `Installation "${installation}" not found` }),
      (bp) => {
        const bp2 = find(bp, 'installation', {}, 'allInstallations');
        return completeFrom(bp2, 'ok', (bindings) => {
          const inst = bindings.inst as Record<string, unknown>;
          const allInstallations = bindings.allInstallations as Record<string, unknown>[];
          const installedAt = new Date().toISOString();

          const _puts: Array<{ relation: string; key: string; value: Record<string, unknown> }> = [];

          // Deactivate all other active installations
          for (const other of allInstallations) {
            if (other.id !== installation && other.active === true) {
              _puts.push({ relation: 'installation', key: other.id as string, value: { ...other, active: false } });
            }
          }

          // Activate the new installation
          _puts.push({ relation: 'installation', key: installation, value: {
            ...inst, active: true, installed_at: installedAt,
          }});

          return { _puts };
        });
      },
    ) as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const installation = input.installation as string;

    let p = createProgram();
    p = get(p, 'installation', installation, 'inst');

    return branch(p,
      (bindings) => !bindings.inst,
      (bp) => complete(bp, 'error', { message: `Installation "${installation}" not found` }),
      (bp) => {
        return completeFrom(bp, 'ok', (bindings) => {
          const inst = bindings.inst as Record<string, unknown>;
          const previousId = inst.previous_generation as string | null;
          if (!previousId) {
            return { variant: 'no_previous' };
          }
          return { previous: previousId };
        });
      },
    ) as StorageProgram<Result>;
  },

  clean(input: Record<string, unknown>) {
    const keepGenerations = input.keep_generations as number;

    let p = createProgram();
    p = find(p, 'installation', {}, 'allInstallations');

    return completeFrom(p, 'ok', (bindings) => {
      const allInstallations = bindings.allInstallations as Record<string, unknown>[];

      const sorted = allInstallations
        .filter(i => i.active !== true)
        .sort((a, b) => (b.generation as number) - (a.generation as number));

      const toRemove = sorted.slice(keepGenerations);

      return { removed: toRemove.length };
    }) as StorageProgram<Result>;
  },
};

export const installerHandler = autoInterpret(_handler);
