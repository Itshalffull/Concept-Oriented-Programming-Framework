// PerformanceProfile — Performance profiling with timing aggregation and regression detection
// Aggregates invocation timings, identifies hotspots, detects slow chains, and compares windows.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PerformanceProfileStorage,
  PerformanceProfileAggregateInput,
  PerformanceProfileAggregateOutput,
  PerformanceProfileHotspotsInput,
  PerformanceProfileHotspotsOutput,
  PerformanceProfileSlowChainsInput,
  PerformanceProfileSlowChainsOutput,
  PerformanceProfileCompareWindowsInput,
  PerformanceProfileCompareWindowsOutput,
  PerformanceProfileGetInput,
  PerformanceProfileGetOutput,
} from './types.js';

import {
  aggregateOk,
  aggregateInsufficientData,
  hotspotsOk,
  slowChainsOk,
  compareWindowsOk,
  compareWindowsInsufficientData,
  getOk,
  getNotfound,
} from './types.js';

export interface PerformanceProfileError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): PerformanceProfileError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const MIN_DATA_POINTS = 5;

/** Compute percentile from a sorted array of numbers. */
const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

export interface PerformanceProfileHandler {
  readonly aggregate: (
    input: PerformanceProfileAggregateInput,
    storage: PerformanceProfileStorage,
  ) => TE.TaskEither<PerformanceProfileError, PerformanceProfileAggregateOutput>;
  readonly hotspots: (
    input: PerformanceProfileHotspotsInput,
    storage: PerformanceProfileStorage,
  ) => TE.TaskEither<PerformanceProfileError, PerformanceProfileHotspotsOutput>;
  readonly slowChains: (
    input: PerformanceProfileSlowChainsInput,
    storage: PerformanceProfileStorage,
  ) => TE.TaskEither<PerformanceProfileError, PerformanceProfileSlowChainsOutput>;
  readonly compareWindows: (
    input: PerformanceProfileCompareWindowsInput,
    storage: PerformanceProfileStorage,
  ) => TE.TaskEither<PerformanceProfileError, PerformanceProfileCompareWindowsOutput>;
  readonly get: (
    input: PerformanceProfileGetInput,
    storage: PerformanceProfileStorage,
  ) => TE.TaskEither<PerformanceProfileError, PerformanceProfileGetOutput>;
}

// --- Implementation ---

export const performanceProfileHandler: PerformanceProfileHandler = {
  aggregate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const timings = await storage.find('timing', {
            symbol: input.symbol,
            window: input.window,
          });

          if (timings.length < MIN_DATA_POINTS) {
            return aggregateInsufficientData(timings.length);
          }

          const durations = timings
            .map((t) => Number(t['durationMs'] ?? 0))
            .sort((a, b) => a - b);

          const errors = timings.filter((t) => t['error'] === true).length;
          const profileId = `profile_${input.symbol}_${input.window}`;

          const profile = {
            id: profileId,
            symbol: input.symbol,
            window: input.window,
            invocationCount: timings.length,
            p50: percentile(durations, 50),
            p95: percentile(durations, 95),
            p99: percentile(durations, 99),
            mean: durations.reduce((a, b) => a + b, 0) / durations.length,
            errorRate: (errors / timings.length * 100).toFixed(2) + '%',
          };

          await storage.put('profile', profileId, {
            ...profile,
            entitySymbol: input.symbol,
            entityKind: 'action',
            createdAt: new Date().toISOString(),
          });

          return aggregateOk(profileId);
        },
        storageError,
      ),
    ),

  hotspots: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const profiles = await storage.find('profile', { entityKind: input.kind });
          const sorted = [...profiles]
            .sort((a, b) => Number(b[input.metric] ?? b['p95'] ?? 0) - Number(a[input.metric] ?? a['p95'] ?? 0))
            .slice(0, input.topN);
          const hotspots = sorted.map((p) => ({
            symbol: String(p['entitySymbol'] ?? p['symbol']),
            value: Number(p[input.metric] ?? p['p95'] ?? 0),
            invocationCount: Number(p['invocationCount'] ?? 0),
          }));
          return hotspotsOk(JSON.stringify(hotspots));
        },
        storageError,
      ),
    ),

  slowChains: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const flows = await storage.find('flow');
          const slowFlows = flows.filter((f) => Number(f['totalMs'] ?? 0) > input.thresholdMs);
          const chains = slowFlows.map((f) => ({
            flowId: String(f['flowId'] ?? f['id']),
            totalMs: Number(f['totalMs'] ?? 0),
            steps: Number(f['stepCount'] ?? 0),
          }));
          return slowChainsOk(JSON.stringify(chains));
        },
        storageError,
      ),
    ),

  compareWindows: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const timingsA = await storage.find('timing', { symbol: input.symbol, window: input.windowA });
          const timingsB = await storage.find('timing', { symbol: input.symbol, window: input.windowB });

          if (timingsA.length < MIN_DATA_POINTS) {
            return compareWindowsInsufficientData(input.windowA, timingsA.length);
          }
          if (timingsB.length < MIN_DATA_POINTS) {
            return compareWindowsInsufficientData(input.windowB, timingsB.length);
          }

          const durA = timingsA.map((t) => Number(t['durationMs'] ?? 0)).sort((a, b) => a - b);
          const durB = timingsB.map((t) => Number(t['durationMs'] ?? 0)).sort((a, b) => a - b);

          const meanA = durA.reduce((a, b) => a + b, 0) / durA.length;
          const meanB = durB.reduce((a, b) => a + b, 0) / durB.length;
          const p95A = percentile(durA, 95);
          const p95B = percentile(durB, 95);
          const changePct = meanA === 0 ? 0 : ((meanB - meanA) / meanA * 100);

          const comparison = {
            windowA: { mean: meanA, p95: p95A, count: timingsA.length },
            windowB: { mean: meanB, p95: p95B, count: timingsB.length },
            changePercent: Number(changePct.toFixed(2)),
            regression: changePct > 10,
          };

          return compareWindowsOk(JSON.stringify(comparison));
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('profile', input.profile),
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
                  String(found['entitySymbol']),
                  String(found['entityKind']),
                  Number(found['invocationCount'] ?? 0),
                  String(found['errorRate'] ?? '0%'),
                ),
              ),
          ),
        ),
      ),
    ),
};
