// ============================================================
// COPF Kernel - Schema Migration Support
//
// Phase 12: Version-aware concept loading, migration-required
// state, and version tracking in storage.
//
// See Architecture doc Section 16.5.
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ConceptStorage,
  ActionInvocation,
  ActionCompletion,
} from './types.js';
import { timestamp } from './types.js';

/**
 * Metadata stored in concept storage under the `_meta` relation.
 */
const META_RELATION = '_meta';
const META_KEY = 'schema';

/**
 * Read the stored schema version from a concept's storage.
 * Returns undefined if no version has been recorded (fresh storage).
 */
export async function getStoredVersion(
  storage: ConceptStorage,
): Promise<number | undefined> {
  const meta = await storage.get(META_RELATION, META_KEY);
  if (meta && typeof meta.version === 'number') {
    return meta.version;
  }
  return undefined;
}

/**
 * Write the schema version to a concept's storage.
 */
export async function setStoredVersion(
  storage: ConceptStorage,
  version: number,
): Promise<void> {
  await storage.put(META_RELATION, META_KEY, { version });
}

/**
 * Check if a concept needs migration.
 * Returns null if no migration needed, or a status object if it does.
 */
export async function checkMigrationNeeded(
  specVersion: number | undefined,
  storage: ConceptStorage,
): Promise<{ currentVersion: number; requiredVersion: number } | null> {
  // If the spec has no @version annotation, no migration tracking
  if (specVersion === undefined) return null;

  const storedVersion = await getStoredVersion(storage);

  // Fresh storage: set the version and allow normal operation
  if (storedVersion === undefined) {
    await setStoredVersion(storage, specVersion);
    return null;
  }

  // Version matches: no migration needed
  if (storedVersion >= specVersion) return null;

  // Version mismatch: migration required
  return { currentVersion: storedVersion, requiredVersion: specVersion };
}

/**
 * Wraps a ConceptTransport with migration-required gating.
 *
 * When a concept is in migration-required state:
 * - All action invocations except `migrate` return a `needsMigration` error
 * - The `migrate` action is passed through to the underlying transport
 * - After successful migration, the version is updated and the gate is lifted
 *
 * Queries are still allowed (read-only access to existing data).
 */
export function createMigrationGatedTransport(
  inner: ConceptTransport,
  storage: ConceptStorage,
  currentVersion: number,
  requiredVersion: number,
): ConceptTransport & { isMigrationRequired(): boolean; getVersionInfo(): { current: number; required: number } } {
  let migrationRequired = true;
  let current = currentVersion;

  return {
    queryMode: inner.queryMode,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      if (migrationRequired && invocation.action !== 'migrate') {
        return {
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
        };
      }

      const result = await inner.invoke(invocation);

      // If migration succeeded, update the stored version and lift the gate
      if (invocation.action === 'migrate' && result.variant === 'ok') {
        current = requiredVersion;
        await setStoredVersion(storage, requiredVersion);
        migrationRequired = false;
      }

      return result;
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      return inner.query(request);
    },

    async health() {
      const h = await inner.health();
      return {
        available: h.available,
        latency: h.latency,
        ...(migrationRequired ? { migrationRequired: true } : {}),
      };
    },

    isMigrationRequired(): boolean {
      return migrationRequired;
    },

    getVersionInfo(): { current: number; required: number } {
      return { current, required: requiredVersion };
    },
  };
}
