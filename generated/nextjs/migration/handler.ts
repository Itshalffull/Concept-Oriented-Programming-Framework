// Migration concept handler — schema migration lifecycle with plan, expand, migrate,
// contract, and status tracking. Implements version diffing, step generation, and
// progress tracking through expand-and-contract migration pattern.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MigrationStorage,
  MigrationPlanInput,
  MigrationPlanOutput,
  MigrationExpandInput,
  MigrationExpandOutput,
  MigrationMigrateInput,
  MigrationMigrateOutput,
  MigrationContractInput,
  MigrationContractOutput,
  MigrationStatusInput,
  MigrationStatusOutput,
} from './types.js';

import {
  planOk,
  planNoMigrationNeeded,
  planIncompatible,
  expandOk,
  expandFailed,
  migrateOk,
  migratePartial,
  contractOk,
  contractRollback,
  statusOk,
} from './types.js';

export interface MigrationError {
  readonly code: string;
  readonly message: string;
}

export interface MigrationHandler {
  readonly plan: (
    input: MigrationPlanInput,
    storage: MigrationStorage,
  ) => TE.TaskEither<MigrationError, MigrationPlanOutput>;
  readonly expand: (
    input: MigrationExpandInput,
    storage: MigrationStorage,
  ) => TE.TaskEither<MigrationError, MigrationExpandOutput>;
  readonly migrate: (
    input: MigrationMigrateInput,
    storage: MigrationStorage,
  ) => TE.TaskEither<MigrationError, MigrationMigrateOutput>;
  readonly contract: (
    input: MigrationContractInput,
    storage: MigrationStorage,
  ) => TE.TaskEither<MigrationError, MigrationContractOutput>;
  readonly status: (
    input: MigrationStatusInput,
    storage: MigrationStorage,
  ) => TE.TaskEither<MigrationError, MigrationStatusOutput>;
}

// --- Pure helpers ---

const MAX_VERSION_JUMP = 10;

const generateMigrationId = (concept: string, from: number, to: number): string =>
  `mig_${concept}_v${from}_to_v${to}`;

const generateSteps = (fromVersion: number, toVersion: number): readonly string[] => {
  const steps: string[] = [];
  if (toVersion > fromVersion) {
    for (let v = fromVersion; v < toVersion; v++) {
      steps.push(`upgrade_v${v}_to_v${v + 1}`);
    }
  } else {
    for (let v = fromVersion; v > toVersion; v--) {
      steps.push(`downgrade_v${v}_to_v${v - 1}`);
    }
  }
  return steps;
};

const estimateRecords = (versionDiff: number): number =>
  Math.abs(versionDiff) * 100; // Rough estimate per version step

const toStorageError = (error: unknown): MigrationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const migrationHandler: MigrationHandler = {
  plan: (input, storage) => {
    // No migration needed if versions are the same
    if (input.fromVersion === input.toVersion) {
      return TE.right(planNoMigrationNeeded(input.concept));
    }

    // Reject incompatible version jumps
    const versionDiff = Math.abs(input.toVersion - input.fromVersion);
    if (versionDiff > MAX_VERSION_JUMP) {
      return TE.right(
        planIncompatible(
          input.concept,
          `Version jump of ${versionDiff} exceeds maximum allowed (${MAX_VERSION_JUMP})`,
        ),
      );
    }

    // Reject negative versions
    if (input.fromVersion < 0 || input.toVersion < 0) {
      return TE.right(
        planIncompatible(input.concept, 'Version numbers must be non-negative'),
      );
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const migrationId = generateMigrationId(
            input.concept,
            input.fromVersion,
            input.toVersion,
          );
          const steps = generateSteps(input.fromVersion, input.toVersion);
          const estimated = estimateRecords(versionDiff);
          const now = new Date().toISOString();

          await storage.put('migration', migrationId, {
            id: migrationId,
            concept: input.concept,
            fromVersion: input.fromVersion,
            toVersion: input.toVersion,
            steps,
            estimatedRecords: estimated,
            phase: 'planned',
            progress: 0,
            createdAt: now,
            updatedAt: now,
          });

          return planOk(migrationId, steps, estimated);
        },
        toStorageError,
      ),
    );
  },

  expand: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('migration', input.migration),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                expandFailed(input.migration, `Migration '${input.migration}' not found`),
              ),
            (found) => {
              const phase = found['phase'] as string;
              // Can only expand from 'planned' phase
              if (phase !== 'planned') {
                return TE.right(
                  expandFailed(
                    input.migration,
                    `Cannot expand migration in '${phase}' phase, must be 'planned'`,
                  ),
                );
              }

              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const updated = {
                    ...found,
                    phase: 'expanded',
                    progress: 0,
                    updatedAt: now,
                  };
                  await storage.put('migration', input.migration, updated);
                  return expandOk(input.migration);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  migrate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('migration', input.migration),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.left({
                code: 'NOT_FOUND',
                message: `Migration '${input.migration}' not found`,
              } as MigrationError),
            (found) => {
              const phase = found['phase'] as string;
              if (phase !== 'expanded') {
                return TE.left({
                  code: 'INVALID_PHASE',
                  message: `Cannot run migration in '${phase}' phase, must be 'expanded'`,
                } as MigrationError);
              }

              const estimated = typeof found['estimatedRecords'] === 'number'
                ? found['estimatedRecords'] as number
                : 0;

              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const updated = {
                    ...found,
                    phase: 'migrated',
                    progress: 100,
                    recordsMigrated: estimated,
                    updatedAt: now,
                  };
                  await storage.put('migration', input.migration, updated);
                  return migrateOk(input.migration, estimated);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  contract: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('migration', input.migration),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.left({
                code: 'NOT_FOUND',
                message: `Migration '${input.migration}' not found`,
              } as MigrationError),
            (found) => {
              const phase = found['phase'] as string;

              // If migration was not completed, trigger rollback
              if (phase !== 'migrated') {
                return TE.tryCatch(
                  async () => {
                    const now = new Date().toISOString();
                    const updated = {
                      ...found,
                      phase: 'rolled_back',
                      progress: 0,
                      updatedAt: now,
                    };
                    await storage.put('migration', input.migration, updated);
                    return contractRollback(input.migration);
                  },
                  toStorageError,
                );
              }

              // Migration was successful, finalize contract
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const updated = {
                    ...found,
                    phase: 'contracted',
                    progress: 100,
                    updatedAt: now,
                  };
                  await storage.put('migration', input.migration, updated);
                  return contractOk(input.migration);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  status: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('migration', input.migration),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.left({
                code: 'NOT_FOUND',
                message: `Migration '${input.migration}' not found`,
              } as MigrationError),
            (found) =>
              TE.right(
                statusOk(
                  input.migration,
                  typeof found['phase'] === 'string' ? found['phase'] as string : 'unknown',
                  typeof found['progress'] === 'number' ? found['progress'] as number : 0,
                ),
              ),
          ),
        ),
      ),
    ),
};
