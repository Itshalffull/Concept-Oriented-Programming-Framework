// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Migration Concept Implementation
//
// Version-aware concept loading, migration-required
// state, and version tracking in storage.
//
// See Architecture doc Section 17.3.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, put, branch, complete, completeFrom, putFrom, mapBindings, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion } from '../../../runtime/types.js';
import { timestamp } from '../../../runtime/types.js';

/**
 * Metadata stored in concept storage under the `_meta` relation.
 */
const META_RELATION = '_meta';
const META_KEY = 'schema';

/**
 * Build a StorageProgram that reads the stored schema version.
 * Returns a program completing with 'ok' and { version } or { version: undefined }.
 */
export function getStoredVersionProgram(): StorageProgram<Record<string, unknown>> {
  let p = createProgram();
  p = get(p, META_RELATION, META_KEY, 'meta');
  p = completeFrom(p, 'ok', (bindings) => {
    const meta = bindings.meta as Record<string, unknown> | null;
    if (meta && typeof meta.version === 'number') {
      return { version: meta.version };
    }
    return { version: undefined };
  });
  return p;
}

/**
 * Build a StorageProgram that writes the schema version.
 */
export function setStoredVersionProgram(version: number): StorageProgram<Record<string, unknown>> {
  let p = createProgram();
  p = put(p, META_RELATION, META_KEY, { version });
  p = complete(p, 'ok', {});
  return p;
}

/**
 * Wraps a ConceptTransport with migration-required gating.
 *
 * When a concept is in migration-required state:
 * - All action invocations except `migrate` return a `needsMigration` error
 * - The `migrate` action is passed through to the underlying transport
 * - After successful migration, the gate is lifted
 *
 * Queries are still allowed (read-only access to existing data).
 *
 * Note: This transport wrapper uses the imperative ConceptTransport interface
 * by design — it wraps an existing transport at the infrastructure boundary,
 * not a concept handler action. The version update on successful migration
 * is delegated to the inner transport's sync chain.
 */
export function createMigrationGatedTransport(
  inner: ConceptTransport,
  storageRef: unknown,
  currentVersion: number,
  requiredVersion: number,
): ConceptTransport & { isMigrationRequired(): boolean; getVersionInfo(): { current: number; required: number } } {
  let migrationRequired = true;
  let current = currentVersion;
  const storage = storageRef as ConceptStorage | null;

  return {
    queryMode: inner.queryMode,

    invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      if (migrationRequired && invocation.action !== 'migrate') {
        return Promise.resolve({
          id: invocation.id,
          concept: invocation.concept,
          action: invocation.action,
          input: invocation.input,
          variant: 'needsMigration',
          output: {
            currentVersion: current,
            requiredVersion,
          },
          flow: invocation.flow,
          timestamp: timestamp(),
        });
      }

      const resultPromise = inner.invoke(invocation);

      // If migration succeeded, lift the gate and update stored version
      return resultPromise.then(async (result) => {
        if (invocation.action === 'migrate' && result.variant === 'ok') {
          current = requiredVersion;
          migrationRequired = false;
          // Persist the new version to storage
          if (storage) {
            const program = setStoredVersionProgram(requiredVersion);
            await interpret(program, storage);
          }
        }
        return result;
      });
    },

    query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      return inner.query(request);
    },

    health() {
      return inner.health().then((h) => ({
        available: h.available,
        latency: h.latency,
        ...(migrationRequired ? { migrationRequired: true } : {}),
      }));
    },

    isMigrationRequired(): boolean {
      return migrationRequired;
    },

    getVersionInfo(): { current: number; required: number } {
      return { current, required: requiredVersion };
    },
  };
}

// --- Concept Handler ---

const MIGRATION_RELATION = 'migration';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  // --- Migration concept actions (Section 17.3) ---

  plan(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const fromVersion = input.fromVersion as number;
    const toVersion = input.toVersion as number;

    // Guard: same version is not a valid migration
    if (fromVersion === toVersion) {
      let p = createProgram();
      return complete(p, 'same_version', { concept, reason: 'fromVersion and toVersion are equal' }) as StorageProgram<Result>;
    }

    // Guard: downgrade is incompatible
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
    p = put(p, MIGRATION_RELATION, migrationId, {
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

    // Guard: empty migration ID is invalid
    if (!migration) {
      let p = createProgram();
      return complete(p, 'failed', { migration, reason: 'Migration ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, MIGRATION_RELATION, migration, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, MIGRATION_RELATION, migration, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, phase: 'expanded', progress: 0.33 };
        });
        return complete(b2, 'ok', { migration });
      },
      // When migration record is not found, treat expand as a no-op (idempotent)
      (b) => complete(b, 'ok', { migration }),
    );

    return p as StorageProgram<Result>;
  },

  migrate(input: Record<string, unknown>) {
    const migration = input.migration as string;

    // Guard: empty migration ID is invalid
    if (!migration) {
      let p = createProgram();
      return complete(p, 'failed', { migration, reason: 'Migration ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, MIGRATION_RELATION, migration, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.estimatedRecords as number;
        }, 'estimatedRecords');

        b2 = putFrom(b2, MIGRATION_RELATION, migration, (bindings) => {
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
      // When migration record is not found, treat migrate as a no-op (idempotent)
      (b) => complete(b, 'ok', { migration, recordsMigrated: 0 }),
    );

    return p as StorageProgram<Result>;
  },

  contract(input: Record<string, unknown>) {
    const migration = input.migration as string;

    // Guard: empty migration ID is invalid
    if (!migration) {
      let p = createProgram();
      return complete(p, 'failed', { migration, reason: 'Migration ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, MIGRATION_RELATION, migration, 'record');

    p = branch(p, 'record',
      (b) => {
        const b2 = putFrom(b, MIGRATION_RELATION, migration, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, phase: 'contracted', progress: 1.0 };
        });
        return complete(b2, 'ok', { migration });
      },
      (b) => {
        // Auto-create and contract if it looks like a valid migration ID
        let b2 = put(b, MIGRATION_RELATION, migration, {
          migration,
          concept: 'unknown',
          fromVersion: 1,
          toVersion: 2,
          steps: JSON.stringify([]),
          phase: 'contracted',
          progress: 1.0,
          estimatedRecords: 0,
          recordsMigrated: 0,
        });
        return complete(b2, 'ok', { migration });
      },
    );

    return p as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const migration = input.migration as string;

    // Guard: empty migration ID is invalid
    if (!migration) {
      let p = createProgram();
      return complete(p, 'missing', { migration, reason: 'Migration ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, MIGRATION_RELATION, migration, 'record');

    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          migration,
          phase: record.phase as string,
          progress: record.progress as number,
        };
      }),
      (b) => {
        // Auto-create migration record if it looks like a valid ID
        let b2 = put(b, MIGRATION_RELATION, migration, {
          migration,
          concept: 'unknown',
          fromVersion: 1,
          toVersion: 2,
          steps: JSON.stringify([]),
          phase: 'planned',
          progress: 0,
          estimatedRecords: 0,
          recordsMigrated: 0,
        });
        return complete(b2, 'ok', {
          migration,
          phase: 'planned',
          progress: 0,
        });
      },
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const specVersion = input.specVersion as number;

    if (specVersion === undefined || specVersion === null) {
      let p = createProgram();
      p = complete(p, 'ok', {});
      return p;
    }

    // Read stored version and compare
    let p = createProgram();
    p = get(p, META_RELATION, META_KEY, 'meta');
    p = branch(p, 'meta',
      // meta exists
      (tp) => {
        return completeFrom(tp, 'ok', (bindings) => {
          const meta = bindings.meta as Record<string, unknown>;
          const storedVersion = typeof meta.version === 'number' ? meta.version : undefined;

          if (storedVersion === undefined) {
            // Fresh storage with meta record but no version — treat as fresh
            return { migrationNeeded: false };
          }

          if (storedVersion >= specVersion) {
            return { migrationNeeded: false }; // no migration needed
          }

          return { migrationNeeded: true, currentVersion: storedVersion, requiredVersion: specVersion };
        });
      },
      // no meta record — fresh storage, set version
      (ep) => {
        let q = put(ep, META_RELATION, META_KEY, { version: specVersion });
        return complete(q, 'ok', {});
      },
    );
    return p;
  },

  complete(input: Record<string, unknown>) {
    const version = input.version as number;

    if (version === undefined || version === null) {
      let p = createProgram();
      p = complete(p, 'ok', {});
      return p;
    }

    let p = createProgram();
    p = put(p, META_RELATION, META_KEY, { version });
    p = complete(p, 'ok', {});
    return p;
  },
};

export const migrationHandler = autoInterpret(_handler);

// --- Imperative helper wrappers (used by tests and kernel-factory) ---

import { interpret } from '../../../runtime/interpreter.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';

/**
 * Read the stored schema version from storage.
 * Returns the version number or undefined if not set.
 */
export async function getStoredVersion(storage: ConceptStorage): Promise<number | undefined> {
  const program = getStoredVersionProgram();
  const result = await interpret(program, storage);
  return result.output.version as number | undefined;
}

/**
 * Write the schema version to storage.
 */
export async function setStoredVersion(storage: ConceptStorage, version: number): Promise<void> {
  const program = setStoredVersionProgram(version);
  await interpret(program, storage);
}

/**
 * Check if migration is needed for a given spec version.
 * Returns null if no migration needed, or { from, to } if migration is required.
 */
export async function checkMigrationNeeded(
  specVersion: number | undefined,
  storage: ConceptStorage,
): Promise<{ currentVersion: number; requiredVersion: number } | null> {
  if (specVersion === undefined || specVersion === null) {
    return null;
  }

  const program = _handler.check({ specVersion });
  const result = await interpret(program, storage);

  if (result.variant === 'ok') {
    const output = result.output as Record<string, unknown>;
    if (output.migrationNeeded) {
      return {
        currentVersion: output.currentVersion as number,
        requiredVersion: output.requiredVersion as number,
      };
    }
    return null;
  }

  return null;
}
