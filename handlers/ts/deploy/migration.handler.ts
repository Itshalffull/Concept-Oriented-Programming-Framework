// @migrated dsl-constructs 2026-03-18
// Migration Concept Implementation
// Schema migration via expand-migrate-contract pattern. Plans, executes,
// and tracks multi-step schema evolution across concept versions.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'migration';

const _handler: FunctionalConceptHandler = {
  plan(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const fromVersion = input.fromVersion as number;
    const toVersion = input.toVersion as number;

    if (fromVersion === toVersion) {
      let p = createProgram();
      return complete(p, 'noMigrationNeeded', { concept }) as StorageProgram<Result>;
    }

    if (toVersion < fromVersion) {
      let p = createProgram();
      return complete(p, 'incompatible', { concept, reason: 'Cannot downgrade version' }) as StorageProgram<Result>;
    }

    const migrationId = `mig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const steps: string[] = [];
    for (let v = fromVersion; v < toVersion; v++) {
      steps.push(`v${v}-to-v${v + 1}`);
    }

    let p = createProgram();
    p = put(p, RELATION, migrationId, {
      migration: migrationId,
      concept,
      fromVersion,
      toVersion,
      steps: JSON.stringify(steps),
      phase: 'planned',
      progress: 0,
      estimatedRecords: 1000,
      recordsMigrated: 0,
    });

    return complete(p, 'ok', { migration: migrationId, steps, estimatedRecords: 1000 }) as StorageProgram<Result>;
  },

  expand(input: Record<string, unknown>) {
    const migration = input.migration as string;

    let p = createProgram();
    p = get(p, RELATION, migration, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, migration, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, phase: 'expanded', progress: 0.33 };
        });
        return complete(b2, 'ok', { migration });
      },
      (b) => complete(b, 'failed', { migration, reason: 'Migration not found' }),
    );

    return p as StorageProgram<Result>;
  },

  migrate(input: Record<string, unknown>) {
    const migration = input.migration as string;

    let p = createProgram();
    p = get(p, RELATION, migration, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.estimatedRecords as number;
        }, 'estimatedRecords');

        b2 = putFrom(b2, RELATION, migration, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            phase: 'migrated',
            progress: 0.66,
            recordsMigrated: bindings.estimatedRecords as number,
          };
        });

        return completeFrom(b2, 'ok', (bindings) => ({
          migration,
          recordsMigrated: bindings.estimatedRecords as number,
        }));
      },
      (b) => complete(b, 'partial', { migration, migrated: 0, failed: 0, errors: ['Migration not found'] }),
    );

    return p as StorageProgram<Result>;
  },

  contract(input: Record<string, unknown>) {
    const migration = input.migration as string;

    let p = createProgram();
    p = get(p, RELATION, migration, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, RELATION, migration, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, phase: 'contracted', progress: 1.0 };
        });
        return complete(b2, 'ok', { migration });
      },
      (b) => complete(b, 'rollback', { migration }),
    );

    return p as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const migration = input.migration as string;

    let p = createProgram();
    p = get(p, RELATION, migration, 'record');

    return completeFrom(p, 'ok', (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      const phase = record ? (record.phase as string) : 'unknown';
      const progress = record ? (record.progress as number) : 0;
      return { migration, phase, progress };
    }) as StorageProgram<Result>;
  },
};

export const migrationHandler = autoInterpret(_handler);
