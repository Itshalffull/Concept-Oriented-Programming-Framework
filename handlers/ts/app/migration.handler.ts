// Migration Concept Implementation (Deploy Kit)
// Orchestrate storage schema migrations using the expand/contract pattern.
import type { ConceptHandler } from '@clef/runtime';

export const migrationHandler: ConceptHandler = {
  async plan(input, storage) {
    const concept = input.concept as string;
    const fromVersion = input.fromVersion as number;
    const toVersion = input.toVersion as number;

    // No migration needed if versions are the same
    if (fromVersion === toVersion) {
      return { variant: 'noMigrationNeeded', concept };
    }

    // Incompatible if version goes backwards
    if (toVersion < fromVersion) {
      return {
        variant: 'incompatible',
        concept,
        reason: `Cannot migrate backwards from v${fromVersion} to v${toVersion}`,
      };
    }

    const migrationId = `mig-${concept}-${fromVersion}-${toVersion}-${Date.now()}`;
    const startedAt = new Date().toISOString();

    // Generate migration steps
    const steps: string[] = [];
    for (let v = fromVersion; v < toVersion; v++) {
      steps.push(`expand-v${v}-to-v${v + 1}`);
      steps.push(`migrate-v${v}-to-v${v + 1}`);
      steps.push(`contract-v${v}-to-v${v + 1}`);
    }

    const estimatedRecords = 1000;

    await storage.put('migration', migrationId, {
      migrationId,
      concept,
      fromVersion,
      toVersion,
      phase: 'planned',
      recordsMigrated: 0,
      recordsTotal: estimatedRecords,
      startedAt,
      errors: JSON.stringify([]),
    });

    return {
      variant: 'ok',
      migration: migrationId,
      steps: JSON.stringify(steps),
      estimatedRecords,
    };
  },

  async expand(input, storage) {
    const migration = input.migration as string;

    const existing = await storage.get('migration', migration);
    if (!existing) {
      return { variant: 'failed', migration, reason: 'Migration not found' };
    }

    const phase = existing.phase as string;
    if (phase !== 'planned') {
      return { variant: 'failed', migration, reason: `Cannot expand from phase: ${phase}` };
    }

    await storage.put('migration', migration, {
      ...existing,
      phase: 'expanded',
    });

    return { variant: 'ok', migration };
  },

  async migrate(input, storage) {
    const migration = input.migration as string;

    const existing = await storage.get('migration', migration);
    if (!existing) {
      return {
        variant: 'partial',
        migration,
        migrated: 0,
        failed: 0,
        errors: JSON.stringify(['Migration not found']),
      };
    }

    const phase = existing.phase as string;
    if (phase !== 'expanded') {
      return {
        variant: 'partial',
        migration,
        migrated: 0,
        failed: 0,
        errors: JSON.stringify([`Cannot migrate from phase: ${phase}`]),
      };
    }

    const recordsTotal = existing.recordsTotal as number;
    const recordsMigrated = recordsTotal;

    await storage.put('migration', migration, {
      ...existing,
      phase: 'migrated',
      recordsMigrated,
    });

    return { variant: 'ok', migration, recordsMigrated };
  },

  async contract(input, storage) {
    const migration = input.migration as string;

    const existing = await storage.get('migration', migration);
    if (!existing) {
      return { variant: 'rollback', migration };
    }

    const phase = existing.phase as string;
    if (phase !== 'migrated') {
      return { variant: 'rollback', migration };
    }

    await storage.put('migration', migration, {
      ...existing,
      phase: 'completed',
    });

    return { variant: 'ok', migration };
  },

  async status(input, storage) {
    const migration = input.migration as string;

    const existing = await storage.get('migration', migration);
    if (!existing) {
      return { variant: 'ok', migration, phase: 'unknown', progress: 0 };
    }

    const recordsTotal = existing.recordsTotal as number;
    const recordsMigrated = existing.recordsMigrated as number;
    const progress = recordsTotal > 0 ? recordsMigrated / recordsTotal : 0;

    return {
      variant: 'ok',
      migration,
      phase: existing.phase as string,
      progress,
    };
  },
};
