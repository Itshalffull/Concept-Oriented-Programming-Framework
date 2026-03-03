// Installer Concept Implementation (Package Distribution Suite)
// Staged transactional installation of resolved packages. Each installation
// is an immutable generation that can be atomically activated or rolled back.
// Supports generational cleanup to reclaim disk space.
import type { ConceptHandler } from '@clef/runtime';

let nextId = 1;
let nextGeneration = 1;
export function resetInstallerIds() { nextId = 1; nextGeneration = 1; }

export const installerHandler: ConceptHandler = {
  async stage(input, storage) {
    const lockfileEntries = input.lockfile_entries as Array<{
      module_id: string;
      version: string;
      content_hash: string;
      target_path: string;
      kind: string;
    }>;
    const projectRoot = input.project_root as string;

    // Find the currently active installation to record as previous_generation
    const allInstallations = await storage.find('installation');
    const currentActive = allInstallations.find(i => i.active === true);

    const id = `inst-${nextId++}`;
    const generation = nextGeneration++;

    try {
      await storage.put('installation', id, {
        id,
        generation,
        lockfile_hash: JSON.stringify(lockfileEntries),
        staged_modules: JSON.stringify(lockfileEntries),
        active: false,
        previous_generation: currentActive ? currentActive.id as string : null,
        installed_at: null,
        project_root: projectRoot,
      });
    } catch {
      return { variant: 'error', message: 'Staging failed: storage write error' };
    }

    return { variant: 'ok', installation: id };
  },

  async activate(input, storage) {
    const installation = input.installation as string;

    const inst = await storage.get('installation', installation);
    if (!inst) {
      return { variant: 'error', message: `Installation "${installation}" not found` };
    }

    // Deactivate the previous active installation
    const previousId = inst.previous_generation as string | null;
    if (previousId) {
      const prev = await storage.get('installation', previousId);
      if (prev) {
        await storage.put('installation', previousId, {
          ...prev,
          active: false,
        });
      }
    }

    // Also deactivate any other active installation
    const allInstallations = await storage.find('installation');
    for (const other of allInstallations) {
      if (other.id !== installation && other.active === true) {
        await storage.put('installation', other.id as string, {
          ...other,
          active: false,
        });
      }
    }

    // Activate the new installation
    const installedAt = new Date().toISOString();
    try {
      await storage.put('installation', installation, {
        ...inst,
        active: true,
        installed_at: installedAt,
      });
    } catch {
      return { variant: 'error', message: 'Activation failed: storage write error' };
    }

    return { variant: 'ok' };
  },

  async rollback(input, storage) {
    const installation = input.installation as string;

    const inst = await storage.get('installation', installation);
    if (!inst) {
      return { variant: 'error', message: `Installation "${installation}" not found` };
    }

    const previousId = inst.previous_generation as string | null;
    if (!previousId) {
      return { variant: 'no_previous' };
    }

    const prev = await storage.get('installation', previousId);
    if (!prev) {
      return { variant: 'no_previous' };
    }

    // Deactivate current installation
    await storage.put('installation', installation, {
      ...inst,
      active: false,
    });

    // Activate previous installation
    await storage.put('installation', previousId, {
      ...prev,
      active: true,
      installed_at: new Date().toISOString(),
    });

    return { variant: 'ok', previous: previousId };
  },

  async clean(input, storage) {
    const keepGenerations = input.keep_generations as number;

    const allInstallations = await storage.find('installation');

    // Sort by generation descending
    const sorted = allInstallations
      .filter(i => i.active !== true)
      .sort((a, b) => (b.generation as number) - (a.generation as number));

    // Keep the most recent keepGenerations inactive installations
    const toRemove = sorted.slice(keepGenerations);
    let removed = 0;

    for (const inst of toRemove) {
      await storage.del('installation', inst.id as string);
      removed++;
    }

    return { variant: 'ok', removed };
  },
};
