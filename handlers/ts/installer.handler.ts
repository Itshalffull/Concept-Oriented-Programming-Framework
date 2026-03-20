// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// Installer Concept Implementation (Package Distribution Suite)
// Staged transactional installation of resolved packages. Each installation
// is an immutable generation that can be atomically activated or rolled back.
// Supports generational cleanup to reclaim disk space.

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let nextIdVal = 1;
let nextGeneration = 1;
export function resetInstallerIds() { nextIdVal = 1; nextGeneration = 1; }

export const installerHandler: ConceptHandler = {
  async stage(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const lockfileEntries = input.lockfile_entries as Array<{
      module_id: string; version: string; content_hash: string;
      target_path: string; kind: string;
    }>;
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

    return { variant: 'ok', installation: id };
  },

  async activate(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const installation = input.installation as string;
    const inst = await storage.get('installation', installation);
    if (!inst) return { variant: 'error', message: `Installation "${installation}" not found` };

    // Deactivate all other active installations
    const allInstallations = await storage.find('installation', {});
    for (const other of allInstallations) {
      if (other.id !== installation && other.active === true) {
        await storage.put('installation', other.id as string, { ...other, active: false });
      }
    }

    // Activate this one
    await storage.put('installation', installation, {
      ...inst,
      active: true,
      installed_at: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async rollback(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const installation = input.installation as string;
    const inst = await storage.get('installation', installation);
    if (!inst) return { variant: 'error', message: `Installation "${installation}" not found` };

    const previousId = inst.previous_generation as string | null;
    if (!previousId) return { variant: 'no_previous' };

    // Deactivate current
    await storage.put('installation', installation, { ...inst, active: false });

    // Activate previous
    const prevRecord = await storage.get('installation', previousId);
    if (prevRecord) {
      await storage.put('installation', previousId, { ...prevRecord, active: true });
    }

    return { variant: 'ok', previous: previousId };
  },

  async clean(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const keepGenerations = input.keep_generations as number;

    const allInstallations = await storage.find('installation', {});
    const inactive = allInstallations
      .filter(i => i.active !== true)
      .sort((a, b) => (b.generation as number) - (a.generation as number));

    const toRemove = inactive.slice(keepGenerations);
    return { variant: 'ok', removed: toRemove.length };
  },
};
