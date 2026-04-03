// @clef-handler style=functional concept=SyntheticBenchmarkProvider
// ============================================================
// SyntheticBenchmarkProvider Handler
//
// EnergyProfile provider that measures wall-clock execution time
// of a target function or script and estimates energy consumption
// using a configurable Thermal Design Power (TDP) watts figure.
//
// Energy estimation formula:
//   energy_joules = (duration_ms / 1000) * tdp_watts
//
// Delegates the actual benchmark execution to the runtime via
// perform('local-process', 'run', ...) so the handler stays pure
// and fully observable.
//
// Inputs (measure):
//   target  — file path or module:function reference to benchmark
//             (e.g. "src/utils/sort.ts:quickSort")
//   config  — JSON string with benchmark parameters:
//             {
//               iterations?: number,   // default: 10
//               warmup?:     number,   // default: 3
//               tdpWatts?:   number    // default: 15 (laptop CPU)
//             }
//
// Output (measure ok):
//   duration_ms             — mean wall-clock time across iterations
//   estimated_energy_joules — energy_joules as described above
//   iterations              — actual iterations executed (warmup excluded)
//
// Perform contract (local-process):
//   endpoint: "benchmark-runtime"
//   command:  "run"
//   args:     { target, iterations, warmup }
//   returns:  { duration_ms: number, rawTimings: number[] }
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, perform, branch,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'SyntheticBenchmarkProvider';
const PROVIDER_KIND  = 'energy-profile';

const DEFAULT_ITERATIONS = 10;
const DEFAULT_WARMUP     = 3;
const DEFAULT_TDP_WATTS  = 15; // Typical laptop CPU TDP

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface BenchmarkConfig {
  iterations?: number;
  warmup?: number;
  tdpWatts?: number;
}

// ──────────────────────────────────────────────────────────────
// Energy estimation
// ──────────────────────────────────────────────────────────────

/**
 * Estimate energy in joules from duration and TDP.
 * Uses the formula: energy_joules = (duration_ms / 1000) * tdp_watts
 */
function estimateEnergy(durationMs: number, tdpWatts: number): number {
  return (durationMs / 1000) * tdpWatts;
}

/**
 * Extract duration_ms from the benchmark-runtime perform result.
 * Accepts either a direct { duration_ms } field or derives from rawTimings.
 */
function extractDuration(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj['duration_ms'] === 'number') {
    return obj['duration_ms'] as number;
  }

  // Derive mean from rawTimings if direct duration is absent
  if (Array.isArray(obj['rawTimings']) && obj['rawTimings'].length > 0) {
    const timings = obj['rawTimings'] as number[];
    const sum = timings.reduce((acc: number, t: number) => acc + t, 0);
    return sum / timings.length;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: PROVIDER_NAME,
      kind: PROVIDER_KIND,
    }) as StorageProgram<Result>;
  },

  measure(input: Record<string, unknown>) {
    const target    = (input.target as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    // ── Input validation ──────────────────────────────────────

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target is required',
      }) as StorageProgram<Result>;
    }

    // config is optional; if provided it must be a valid JSON object
    let config: BenchmarkConfig = {};
    if (configRaw && configRaw.trim() !== '') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(configRaw);
      } catch {
        return complete(createProgram(), 'error', {
          message: 'config must be valid JSON',
        }) as StorageProgram<Result>;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return complete(createProgram(), 'error', {
          message: 'config must be a JSON object',
        }) as StorageProgram<Result>;
      }
      config = parsed as BenchmarkConfig;
    }

    const iterations = typeof config.iterations === 'number' && config.iterations > 0
      ? config.iterations
      : DEFAULT_ITERATIONS;
    const warmup = typeof config.warmup === 'number' && config.warmup >= 0
      ? config.warmup
      : DEFAULT_WARMUP;
    const tdpWatts = typeof config.tdpWatts === 'number' && config.tdpWatts > 0
      ? config.tdpWatts
      : DEFAULT_TDP_WATTS;

    // ── Delegate to benchmark-runtime via perform() ───────────
    //
    // Routes through: EffectHandler → LocalProcess
    // → BenchmarkProvider → instance. The provider receives:
    //   { target, iterations, warmup }
    // and returns:
    //   { duration_ms: number, rawTimings: number[] }
    //
    // The TDP-based energy estimate is computed here rather than
    // in the runtime so the formula remains auditable without
    // reading runtime code.

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'benchmark-runtime',
      command: 'run',
      args: { target, iterations, warmup },
    }, '_benchmarkResult');

    // ── Map perform result → duration + energy estimate ───────

    return branch(
      p,
      (b) => {
        const result = b['_benchmarkResult'] as Record<string, unknown> | undefined;
        return result != null && typeof result === 'object' && !('error' in result);
      },
      (b) => {
        const result = b['_benchmarkResult'] as Record<string, unknown>;
        const durationMs = extractDuration(result) ?? 0;
        const estimatedEnergyJoules = estimateEnergy(durationMs, tdpWatts);

        return complete(createProgram(), 'ok', {
          duration_ms: durationMs,
          estimated_energy_joules: estimatedEnergyJoules,
          iterations,
        }) as StorageProgram<Result>;
      },
      (b) => {
        const result = b['_benchmarkResult'] as Record<string, unknown> | undefined;
        const message = result && typeof result['error'] === 'string'
          ? result['error']
          : 'benchmark-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const syntheticBenchmarkHandler = autoInterpret(_handler);

export default syntheticBenchmarkHandler;
