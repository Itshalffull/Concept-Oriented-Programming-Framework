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
import { createProgram, get, put, branch, complete, completeFrom, type StorageProgram } from '../../../runtime/storage-program.ts';
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
  _storageUnused: unknown,
  currentVersion: number,
  requiredVersion: number,
): ConceptTransport & { isMigrationRequired(): boolean; getVersionInfo(): { current: number; required: number } } {
  let migrationRequired = true;
  let current = currentVersion;

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

      // If migration succeeded, lift the gate
      return resultPromise.then((result) => {
        if (invocation.action === 'migrate' && result.variant === 'ok') {
          current = requiredVersion;
          migrationRequired = false;
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

const _handler: FunctionalConceptHandler = {
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
            return { variant: 'ok' };
          }

          if (storedVersion >= specVersion) {
            return {}; // no migration needed
          }

          return { variant: 'needsMigration', from: storedVersion, to: specVersion };
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
