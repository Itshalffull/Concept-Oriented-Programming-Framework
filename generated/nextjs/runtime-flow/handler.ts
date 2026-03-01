// RuntimeFlow — Runtime execution flow correlation, call graphs, and hot path analysis
// Correlates flow IDs into execution traces, finds flows by action/sync/variant, detects deviations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RuntimeFlowStorage,
  RuntimeFlowCorrelateInput,
  RuntimeFlowCorrelateOutput,
  RuntimeFlowFindByActionInput,
  RuntimeFlowFindByActionOutput,
  RuntimeFlowFindBySyncInput,
  RuntimeFlowFindBySyncOutput,
  RuntimeFlowFindByVariantInput,
  RuntimeFlowFindByVariantOutput,
  RuntimeFlowFindFailuresInput,
  RuntimeFlowFindFailuresOutput,
  RuntimeFlowCompareToStaticInput,
  RuntimeFlowCompareToStaticOutput,
  RuntimeFlowSourceLocationsInput,
  RuntimeFlowSourceLocationsOutput,
  RuntimeFlowGetInput,
  RuntimeFlowGetOutput,
} from './types.js';

import {
  correlateOk,
  correlatePartial,
  correlateNotfound,
  findByActionOk,
  findBySyncOk,
  findByVariantOk,
  findFailuresOk,
  compareToStaticMatches,
  compareToStaticDeviates,
  compareToStaticNoStaticPath,
  sourceLocationsOk,
  getOk,
  getNotfound,
} from './types.js';

export interface RuntimeFlowError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): RuntimeFlowError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface RuntimeFlowHandler {
  readonly correlate: (
    input: RuntimeFlowCorrelateInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowCorrelateOutput>;
  readonly findByAction: (
    input: RuntimeFlowFindByActionInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowFindByActionOutput>;
  readonly findBySync: (
    input: RuntimeFlowFindBySyncInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowFindBySyncOutput>;
  readonly findByVariant: (
    input: RuntimeFlowFindByVariantInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowFindByVariantOutput>;
  readonly findFailures: (
    input: RuntimeFlowFindFailuresInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowFindFailuresOutput>;
  readonly compareToStatic: (
    input: RuntimeFlowCompareToStaticInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowCompareToStaticOutput>;
  readonly sourceLocations: (
    input: RuntimeFlowSourceLocationsInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowSourceLocationsOutput>;
  readonly get: (
    input: RuntimeFlowGetInput,
    storage: RuntimeFlowStorage,
  ) => TE.TaskEither<RuntimeFlowError, RuntimeFlowGetOutput>;
}

// --- Implementation ---

export const runtimeFlowHandler: RuntimeFlowHandler = {
  correlate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Gather all flow steps with this flowId
          const steps = await storage.find('flow_step', { flowId: input.flowId });
          if (steps.length === 0) {
            return correlateNotfound();
          }

          // Check for unresolved symbols in the flow
          const unresolved = steps.filter((s) => String(s['resolved']) === 'false');

          const flowKey = `flow_${input.flowId}`;
          const status = unresolved.length > 0 ? 'partial' : 'complete';
          const deviationCount = steps.filter((s) => String(s['deviated']) === 'true').length;

          await storage.put('flow', flowKey, {
            id: flowKey,
            flowId: input.flowId,
            status,
            stepCount: steps.length,
            deviationCount,
            correlatedAt: new Date().toISOString(),
          });

          if (unresolved.length > 0) {
            const unresolvedSymbols = unresolved.map((u) => String(u['symbol'] ?? u['id']));
            return correlatePartial(flowKey, JSON.stringify(unresolvedSymbols));
          }
          return correlateOk(flowKey);
        },
        storageError,
      ),
    ),

  findByAction: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const steps = await storage.find('flow_step', { action: input.action });
          const flowIds = [...new Set(steps.map((s) => String(s['flowId'])))];
          const flows = await Promise.all(
            flowIds.map(async (fid) => {
              const flow = await storage.get('flow', `flow_${fid}`);
              return flow ? { flowId: fid, status: String(flow['status'] ?? 'unknown') } : null;
            }),
          );
          const filtered = flows.filter((f) => f !== null);
          return findByActionOk(JSON.stringify(filtered));
        },
        storageError,
      ),
    ),

  findBySync: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const steps = await storage.find('flow_step', { sync: input.sync });
          const flowIds = [...new Set(steps.map((s) => String(s['flowId'])))];
          const flows = flowIds.map((fid) => ({ flowId: fid }));
          return findBySyncOk(JSON.stringify(flows));
        },
        storageError,
      ),
    ),

  findByVariant: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const steps = await storage.find('flow_step', { variant: input.variant });
          const flowIds = [...new Set(steps.map((s) => String(s['flowId'])))];
          const flows = flowIds.map((fid) => ({ flowId: fid }));
          return findByVariantOk(JSON.stringify(flows));
        },
        storageError,
      ),
    ),

  findFailures: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allFlows = await storage.find('flow');
          const failures = allFlows.filter((f) => String(f['status']) === 'failed');
          const results = failures.map((f) => ({
            flowId: String(f['flowId'] ?? f['id']),
            stepCount: Number(f['stepCount'] ?? 0),
            deviationCount: Number(f['deviationCount'] ?? 0),
          }));
          return findFailuresOk(JSON.stringify(results));
        },
        storageError,
      ),
    ),

  compareToStatic: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const flow = await storage.get('flow', input.flow);
          if (!flow) {
            return compareToStaticNoStaticPath();
          }

          const flowId = String(flow['flowId'] ?? '');
          const steps = await storage.find('flow_step', { flowId });

          // Look up the static trace for the triggering action
          const firstStep = steps[0];
          if (!firstStep) {
            return compareToStaticNoStaticPath();
          }

          const action = String(firstStep['action'] ?? '');
          const staticTrace = await storage.get('static_trace', action);
          if (!staticTrace) {
            return compareToStaticNoStaticPath();
          }

          // Compare step sequence
          const staticSteps: readonly string[] = JSON.parse(String(staticTrace['steps'] ?? '[]'));
          const runtimeSteps = steps.map((s) => String(s['action'] ?? s['symbol'] ?? ''));

          const deviations: string[] = [];
          const maxLen = Math.max(staticSteps.length, runtimeSteps.length);
          for (let i = 0; i < maxLen; i++) {
            if (i >= staticSteps.length) {
              deviations.push(`Extra runtime step at ${i}: ${runtimeSteps[i]}`);
            } else if (i >= runtimeSteps.length) {
              deviations.push(`Missing runtime step at ${i}: ${staticSteps[i]}`);
            } else if (staticSteps[i] !== runtimeSteps[i]) {
              deviations.push(`Deviation at ${i}: expected ${staticSteps[i]}, got ${runtimeSteps[i]}`);
            }
          }

          if (deviations.length === 0) {
            return compareToStaticMatches(steps.length);
          }
          return compareToStaticDeviates(JSON.stringify(deviations));
        },
        storageError,
      ),
    ),

  sourceLocations: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const flow = await storage.get('flow', input.flow);
          if (!flow) {
            return sourceLocationsOk(JSON.stringify([]));
          }
          const flowId = String(flow['flowId'] ?? '');
          const steps = await storage.find('flow_step', { flowId });
          const locations = steps.map((s) => ({
            symbol: String(s['symbol'] ?? s['action'] ?? ''),
            file: String(s['file'] ?? ''),
            line: Number(s['line'] ?? 0),
          }));
          return sourceLocationsOk(JSON.stringify(locations));
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('flow', input.flow),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  String(found['id']),
                  String(found['flowId']),
                  String(found['status']),
                  Number(found['stepCount'] ?? 0),
                  Number(found['deviationCount'] ?? 0),
                ),
              ),
          ),
        ),
      ),
    ),
};
