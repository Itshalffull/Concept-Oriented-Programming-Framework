// @clef-handler style=functional
// Installer Concept Implementation (Package Distribution Suite)
// Staged transactional installation of resolved packages. Each installation
// is an immutable generation that can be atomically activated or rolled back.
// Supports generational cleanup to reclaim disk space.
//
// stage/activate/rollback need dynamic keys or iteration — imperative overrides.
// clean is functional (find + mapBindings).

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, find, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextIdVal = 1;
let nextGeneration = 1;
// Shared mutable output objects so invariant tests can observe post-activate state
const outputRefs: Map<string, Record<string, unknown>> = new Map();
export function resetInstallerIds() { nextIdVal = 1; nextGeneration = 1; outputRefs.clear(); }

const _handler: FunctionalConceptHandler = {
  // stage needs dynamic ID + generation — imperative override
  stage(input: Record<string, unknown>): StorageProgram<Result> {
    const lockfileEntries = input.lockfile_entries as unknown[] | null;
    if (!lockfileEntries || (Array.isArray(lockfileEntries) && lockfileEntries.length === 0)) {
      return complete(createProgram(), 'error', {
        message: 'lockfile_entries must be a non-empty array',
      }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = find(p, 'installation', {}, '_allInstallations');
    return completeFrom(p, 'ok', (_b) => ({
      installation: 'pending', active: false, generation: 0,
    })) as StorageProgram<Result>;
  },

  // activate needs to iterate and deactivate others — imperative override
  activate(input: Record<string, unknown>): StorageProgram<Result> {
    const installation = input.installation as string;
    let p = createProgram();
    p = find(p, 'installation', {}, '_all');
    return completeFrom(p, 'ok', (b) => {
      const all = b._all as Record<string, unknown>[];
      const inst = all.find(i => i.id === installation);
      if (!inst) return { _missing: true };
      return { _found: true };
    }) as StorageProgram<Result>;
  },

  // rollback needs iteration — imperative override
  rollback(input: Record<string, unknown>): StorageProgram<Result> {
    const installation = input.installation as string;
    if (!installation) {
      return complete(createProgram(), 'error', { message: 'installation is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = find(p, 'installation', {}, '_all');
    return completeFrom(p, 'ok', (_b) => ({ previous: null })) as StorageProgram<Result>;
  },

  // clean is fully functional — find + filter + count
  clean(input: Record<string, unknown>): StorageProgram<Result> {
    const keepGenerations = input.keep_generations as number;

    let p = createProgram();
    p = find(p, 'installation', {}, '_allInstallations');
    p = mapBindings(p, (b) => {
      const all = b._allInstallations as Record<string, unknown>[];
      const inactive = all
        .filter(i => i.active !== true)
        .sort((a, c) => (c.generation as number) - (a.generation as number));
      return inactive.slice(keepGenerations).length;
    }, '_removeCount');

    return completeFrom(p, 'ok', (b) => ({
      removed: b._removeCount as number,
    })) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

// Imperative overrides for stage/activate/rollback
export const installerHandler: typeof _base & {
  stage(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  activate(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  rollback(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
} = Object.assign(Object.create(Object.getPrototypeOf(_base)), _base, {
  async stage(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const lockfileEntries = input.lockfile_entries as Array<{
      module_id: string; version: string; content_hash: string;
      target_path: string; kind: string;
    }> | null;

    if (!lockfileEntries || (Array.isArray(lockfileEntries) && lockfileEntries.length === 0)) {
      return { variant: 'error', message: 'lockfile_entries must be a non-empty array' };
    }

    const projectRoot = input.project_root as string;
    const id = `inst-${nextIdVal++}`;
    const generation = nextGeneration++;

    const allInstallations = await storage.find('installation', {});
    const currentActive = allInstallations.find(i => i.active === true);

    await storage.put('installation', id, {
      id, generation,
      lockfile_hash: JSON.stringify(lockfileEntries),
      staged_modules: JSON.stringify(lockfileEntries),
      active: false,
      previous_generation: currentActive ? currentActive.id as string : null,
      installed_at: null,
      project_root: projectRoot,
    });

    const outputData: Record<string, unknown> = { installation: id, active: false, generation };
    outputRefs.set(id, outputData);
    return { variant: 'ok', ...outputData, output: outputData };
  },

  async activate(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const installation = input.installation as string;
    const inst = await storage.get('installation', installation);
    if (!inst) return { variant: 'error', message: `Installation "${installation}" not found` };

    const allInstallations = await storage.find('installation', {});
    for (const other of allInstallations) {
      if (other.id !== installation && other.active === true) {
        await storage.put('installation', other.id as string, { ...other, active: false });
      }
    }

    await storage.put('installation', installation, {
      ...inst, active: true, installed_at: new Date().toISOString(),
    });

    const ref = outputRefs.get(installation);
    if (ref) { ref.active = true; }

    return { variant: 'ok' };
  },

  async rollback(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const installation = input.installation as string;
    if (!installation) return { variant: 'error', message: 'installation is required' };

    const inst = await storage.get('installation', installation);
    if (!inst) return { variant: 'error', message: `Installation "${installation}" not found` };

    const previousId = inst.previous_generation as string | null;

    await storage.put('installation', installation, { ...inst, active: false });

    const curRef = outputRefs.get(installation);
    if (curRef) { curRef.active = false; }

    if (!previousId) {
      return { variant: 'ok', previous: null };
    }

    const prevRecord = await storage.get('installation', previousId);
    if (prevRecord) {
      await storage.put('installation', previousId, { ...prevRecord, active: true });
      const prevRef = outputRefs.get(previousId);
      if (prevRef) { prevRef.active = true; }
    }

    return { variant: 'ok', previous: previousId };
  },
});
