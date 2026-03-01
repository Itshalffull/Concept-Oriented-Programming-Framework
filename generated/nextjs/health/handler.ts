// Health — Health check aggregation and diagnostics
// Registers and executes health checks for concepts, syncs, and suites.
// Measures latency, detects degradation and failures, and validates invariants.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  HealthStorage,
  HealthCheckConceptInput,
  HealthCheckConceptOutput,
  HealthCheckSyncInput,
  HealthCheckSyncOutput,
  HealthCheckKitInput,
  HealthCheckKitOutput,
  HealthCheckInvariantInput,
  HealthCheckInvariantOutput,
} from './types.js';

import {
  checkConceptOk,
  checkConceptUnreachable,
  checkConceptStorageFailed,
  checkConceptDegraded,
  checkSyncOk,
  checkSyncPartialFailure,
  checkSyncTimeout,
  checkKitOk,
  checkKitDegraded,
  checkKitFailed,
  checkInvariantOk,
  checkInvariantViolated,
} from './types.js';

export interface HealthError {
  readonly code: string;
  readonly message: string;
}

export interface HealthHandler {
  readonly checkConcept: (
    input: HealthCheckConceptInput,
    storage: HealthStorage,
  ) => TE.TaskEither<HealthError, HealthCheckConceptOutput>;
  readonly checkSync: (
    input: HealthCheckSyncInput,
    storage: HealthStorage,
  ) => TE.TaskEither<HealthError, HealthCheckSyncOutput>;
  readonly checkKit: (
    input: HealthCheckKitInput,
    storage: HealthStorage,
  ) => TE.TaskEither<HealthError, HealthCheckKitOutput>;
  readonly checkInvariant: (
    input: HealthCheckInvariantInput,
    storage: HealthStorage,
  ) => TE.TaskEither<HealthError, HealthCheckInvariantOutput>;
}

const storageError = (error: unknown): HealthError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Default latency threshold in ms; concept checks exceeding this are degraded
const LATENCY_THRESHOLD_MS = 5000;

// --- Implementation ---

export const healthHandler: HealthHandler = {
  // Check the health of a single concept by probing its storage layer.
  // Measures round-trip latency and compares against a threshold.
  checkConcept: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const startMs = Date.now();

          // Probe the concept's storage by attempting a read
          try {
            await storage.get('health_probes', input.concept);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            // Distinguish between unreachable transport vs storage failure
            if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('timeout')) {
              return checkConceptUnreachable(input.concept, input.runtime);
            }
            return checkConceptStorageFailed(input.concept, input.runtime, errorMsg);
          }

          const latencyMs = Date.now() - startMs;

          // Record the health check result
          const now = new Date().toISOString();
          await storage.put('health_results', `concept::${input.concept}`, {
            concept: input.concept,
            runtime: input.runtime,
            latencyMs,
            status: latencyMs > LATENCY_THRESHOLD_MS ? 'degraded' : 'healthy',
            checkedAt: now,
          });

          // If latency exceeds threshold, report degradation
          if (latencyMs > LATENCY_THRESHOLD_MS) {
            return checkConceptDegraded(input.concept, latencyMs, LATENCY_THRESHOLD_MS);
          }

          return checkConceptOk(`${input.concept}:${input.runtime}`, latencyMs);
        },
        storageError,
      ),
    ),

  // Check the health of a sync by probing all participating concepts.
  // Reports partial failure if some concepts are unreachable.
  checkSync: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const startMs = Date.now();
          const failed: string[] = [];

          for (const concept of input.concepts) {
            try {
              await storage.get('health_probes', concept);
            } catch {
              failed.push(concept);
            }
          }

          const roundTripMs = Date.now() - startMs;

          // Record the sync health check
          const now = new Date().toISOString();
          await storage.put('health_results', `sync::${input.sync}`, {
            sync: input.sync,
            concepts: input.concepts,
            roundTripMs,
            failedConcepts: failed,
            status: failed.length > 0 ? 'partial_failure' : 'healthy',
            checkedAt: now,
          });

          if (failed.length > 0) {
            return checkSyncPartialFailure(input.sync, failed);
          }

          // Check for timeout (if round trip exceeds generous threshold)
          if (roundTripMs > LATENCY_THRESHOLD_MS * input.concepts.length) {
            return checkSyncTimeout(input.sync, roundTripMs);
          }

          return checkSyncOk(`${input.sync}`, roundTripMs);
        },
        storageError,
      ),
    ),

  // Aggregate health across an entire suite (kit). Checks all registered
  // concepts and syncs, then classifies the overall status.
  checkKit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Retrieve the suite's registered concepts and syncs
          const kitRecord = await storage.get('health_kits', input.kit);
          const kitData = (kitRecord ?? {}) as Record<string, unknown>;

          const concepts = Array.isArray(kitData.concepts)
            ? (kitData.concepts as string[])
            : [];
          const syncs = Array.isArray(kitData.syncs)
            ? (kitData.syncs as string[])
            : [];

          const conceptResults: string[] = [];
          const syncResults: string[] = [];
          const healthy: string[] = [];
          const degradedList: string[] = [];
          const failedList: string[] = [];

          // Check each concept
          for (const concept of concepts) {
            const result = await storage.get('health_results', `concept::${concept}`);
            const status = result
              ? String((result as Record<string, unknown>).status ?? 'unknown')
              : 'unknown';

            conceptResults.push(`${concept}:${status}`);

            if (status === 'healthy') {
              healthy.push(concept);
            } else if (status === 'degraded') {
              degradedList.push(concept);
            } else {
              failedList.push(concept);
            }
          }

          // Check each sync
          for (const sync of syncs) {
            const result = await storage.get('health_results', `sync::${sync}`);
            const status = result
              ? String((result as Record<string, unknown>).status ?? 'unknown')
              : 'unknown';
            syncResults.push(`${sync}:${status}`);

            if (status !== 'healthy') {
              failedList.push(sync);
            } else {
              healthy.push(sync);
            }
          }

          const checkId = `${input.kit}:${input.environment}`;
          const now = new Date().toISOString();

          // Store the aggregated result
          await storage.put('health_results', `kit::${input.kit}`, {
            kit: input.kit,
            environment: input.environment,
            healthy,
            degraded: degradedList,
            failed: failedList,
            checkedAt: now,
          });

          if (failedList.length > 0) {
            return checkKitFailed(checkId, healthy, failedList);
          }

          if (degradedList.length > 0) {
            return checkKitDegraded(checkId, healthy, degradedList);
          }

          return checkKitOk(checkId, conceptResults, syncResults);
        },
        storageError,
      ),
    ),

  // Validate a concept's invariant by comparing expected vs actual values.
  checkInvariant: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('health_invariants', `${input.concept}::${input.invariant}`),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            // No invariant definition stored; pass by default
            () => TE.right(checkInvariantOk(`${input.concept}:${input.invariant}:default_pass`)),
            (found) => {
              const data = found as Record<string, unknown>;
              const expected = String(data.expected ?? '');
              const actual = String(data.actual ?? '');

              if (expected !== actual) {
                return TE.right(checkInvariantViolated(
                  input.concept,
                  input.invariant,
                  expected,
                  actual,
                ));
              }

              return TE.right(
                checkInvariantOk(`${input.concept}:${input.invariant}:passed`),
              );
            },
          ),
        ),
      ),
    ),
};
