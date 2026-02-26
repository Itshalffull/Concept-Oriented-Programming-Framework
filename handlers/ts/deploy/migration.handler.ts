// Migration Concept Implementation
// Schema migration via expand-migrate-contract pattern. Plans, executes,
// and tracks multi-step schema evolution across concept versions.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'migration';

export const migrationHandler: ConceptHandler = {
  async plan(input, storage) {
    const concept = input.concept as string;
    const fromVersion = input.fromVersion as number;
    const toVersion = input.toVersion as number;

    if (fromVersion === toVersion) {
      return { variant: 'noMigrationNeeded', concept };
    }

    if (toVersion < fromVersion) {
      return { variant: 'incompatible', concept, reason: 'Cannot downgrade version' };
    }

    const migrationId = `mig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const steps: string[] = [];
    for (let v = fromVersion; v < toVersion; v++) {
      steps.push(`v${v}-to-v${v + 1}`);
    }

    await storage.put(RELATION, migrationId, {
      migration: migrationId,
      concept,
      fromVersion,
      toVersion,
      steps: JSON.stringify(steps),
      phase: 'planned',
      progress: 0,
      estimatedRecords: 100,
      recordsMigrated: 0,
    });

    return { variant: 'ok', migration: migrationId, steps, estimatedRecords: 100 };
  },

  async expand(input, storage) {
    const migration = input.migration as string;

    const record = await storage.get(RELATION, migration);
    if (!record) {
      return { variant: 'failed', migration, reason: 'Migration not found' };
    }

    await storage.put(RELATION, migration, {
      ...record,
      phase: 'expanded',
      progress: 0.33,
    });

    return { variant: 'ok', migration };
  },

  async migrate(input, storage) {
    const migration = input.migration as string;

    const record = await storage.get(RELATION, migration);
    if (!record) {
      return { variant: 'partial', migration, migrated: 0, failed: 0, errors: ['Migration not found'] };
    }

    const estimatedRecords = record.estimatedRecords as number;

    await storage.put(RELATION, migration, {
      ...record,
      phase: 'migrated',
      progress: 0.66,
      recordsMigrated: estimatedRecords,
    });

    return { variant: 'ok', migration, recordsMigrated: estimatedRecords };
  },

  async contract(input, storage) {
    const migration = input.migration as string;

    const record = await storage.get(RELATION, migration);
    if (!record) {
      return { variant: 'rollback', migration };
    }

    await storage.put(RELATION, migration, {
      ...record,
      phase: 'contracted',
      progress: 1.0,
    });

    return { variant: 'ok', migration };
  },

  async status(input, storage) {
    const migration = input.migration as string;

    const record = await storage.get(RELATION, migration);
    const phase = record ? (record.phase as string) : 'unknown';
    const progress = record ? (record.progress as number) : 0;

    return { variant: 'ok', migration, phase, progress };
  },
};
