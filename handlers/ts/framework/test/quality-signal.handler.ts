// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// QualitySignal Concept Implementation
//
// Unified quality signal aggregation for the Test suite.
// Records pass/fail/warn signals across multiple verification
// dimensions (snapshot, conformance, contract, unit, flaky,
// selection, formal), then rolls them up into a single
// blocking/non-blocking gate verdict per target symbol.
// See Architecture doc Section 3.8
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const SIGNALS = 'quality-signals';

const VALID_DIMENSIONS = [
  'snapshot',
  'conformance',
  'contract',
  'unit',
  'flaky',
  'selection',
  'formal',
] as const;

const VALID_STATUSES = ['pass', 'fail', 'warn', 'unknown', 'skipped'] as const;

const VALID_SEVERITIES = ['gate', 'warn', 'info'] as const;

type Dimension = (typeof VALID_DIMENSIONS)[number];
type Status = (typeof VALID_STATUSES)[number];
type Severity = (typeof VALID_SEVERITIES)[number];

/** Status ordering for worst-of rollup: lower index = worse. */
const STATUS_RANK: Record<Status, number> = {
  fail: 0,
  unknown: 1,
  warn: 2,
  pass: 3,
  skipped: 4,
};

let counter = 0;

function generateSignalId(): string {
  counter += 1;
  return `qs-${Date.now()}-${counter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  record(input: Record<string, unknown>) {
    let p = createProgram();
    const targetSymbol = input.target_symbol as string | undefined;
    const dimension = input.dimension as string | undefined;
    const status = input.status as string | undefined;
    const severity = input.severity as string | undefined;
    const summary = input.summary as string | undefined;
    const artifactPath = input.artifact_path as string | undefined;
    const artifactHash = input.artifact_hash as string | undefined;
    const runRef = input.run_ref as string | undefined;

    // --- Validate required fields ---
    if (!targetSymbol || !dimension || !status || !severity) {
      return complete(p, 'validationError', {
        message: 'target_symbol, dimension, status, and severity are required',
      }) as StorageProgram<Result>;
    }

    // --- Validate dimension ---
    if (!VALID_DIMENSIONS.includes(dimension as Dimension)) {
      return complete(p, 'validationError', {
        message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // --- Validate status ---
    if (!VALID_STATUSES.includes(status as Status)) {
      return complete(p, 'validationError', {
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // --- Validate severity ---
    if (!VALID_SEVERITIES.includes(severity as Severity)) {
      return complete(p, 'validationError', {
        message: `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // --- Store signal ---
    const signalId = generateSignalId();
    const observedAt = new Date().toISOString();

    const entry: Record<string, unknown> = {
      id: signalId,
      target_symbol: targetSymbol,
      dimension,
      status,
      severity,
      observed_at: observedAt,
    };

    if (summary !== undefined) entry.summary = summary;
    if (artifactPath !== undefined) entry.artifact_path = artifactPath;
    if (artifactHash !== undefined) entry.artifact_hash = artifactHash;
    if (runRef !== undefined) entry.run_ref = runRef;

    p = put(p, SIGNALS, signalId, entry);

    return complete(p, 'ok', { id: signalId, observed_at: observedAt }) as StorageProgram<Result>;
  },

  latest(input: Record<string, unknown>) {
    let p = createProgram();
    const targetSymbol = input.target_symbol as string | undefined;
    const dimension = input.dimension as string | undefined;

    if (!targetSymbol || !dimension) {
      return complete(p, 'validationError', {
        message: 'target_symbol and dimension are required',
      }) as StorageProgram<Result>;
    }

    if (!VALID_DIMENSIONS.includes(dimension as Dimension)) {
      return complete(p, 'validationError', {
        message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    p = find(p, SIGNALS, {
      target_symbol: targetSymbol,
      dimension,
    }, 'matches');

    p = branch(p,
      (bindings) => {
        const matches = (bindings.matches || []) as Array<Record<string, unknown>>;
        return matches.length === 0;
      },
      (b) => complete(b, 'notFound', { target_symbol: targetSymbol, dimension }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const matches = bindings.matches as Array<Record<string, unknown>>;
        let latest = matches[0];
        for (let i = 1; i < matches.length; i++) {
          if ((matches[i].observed_at as string) > (latest.observed_at as string)) {
            latest = matches[i];
          }
        }
        return { signal: latest };
      }),
    );

    return p as StorageProgram<Result>;
  },

  rollup(input: Record<string, unknown>) {
    let p = createProgram();
    const targetSymbols = input.target_symbols as string[] | undefined;
    const dimensions = input.dimensions as string[] | undefined;

    if (!targetSymbols || !Array.isArray(targetSymbols) || targetSymbols.length === 0) {
      return complete(p, 'validationError', {
        message: 'target_symbols must be a non-empty array',
      }) as StorageProgram<Result>;
    }

    // Validate dimensions filter if provided
    if (dimensions) {
      for (const dim of dimensions) {
        if (!VALID_DIMENSIONS.includes(dim as Dimension)) {
          return complete(p, 'validationError', {
            message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
          }) as StorageProgram<Result>;
        }
      }
    }

    // Collect all signals for all targets in one query, then compute rollup in completeFrom
    p = find(p, SIGNALS, {}, 'allSignalsGlobal');

    return completeFrom(p, 'ok', (bindings) => {
      const allSignalsGlobal = (bindings.allSignalsGlobal || []) as Array<Record<string, unknown>>;

      let blocking = false;
      const perTarget: Array<{
        target_symbol: string;
        worst_status: string;
        dimensions: Array<{
          dimension: string;
          status: string;
          severity: string;
          observed_at: string;
        }>;
      }> = [];

      for (const target of targetSymbols) {
        const targetSignals = allSignalsGlobal.filter(s => s.target_symbol === target);

        // Group by dimension, keeping only the latest per dimension
        const latestByDimension = new Map<string, Record<string, unknown>>();
        for (const signal of targetSignals) {
          const dim = signal.dimension as string;

          // Filter by requested dimensions if provided
          if (dimensions && !dimensions.includes(dim)) continue;

          const existing = latestByDimension.get(dim);
          if (!existing || (signal.observed_at as string) > (existing.observed_at as string)) {
            latestByDimension.set(dim, signal);
          }
        }

        // Compute worst-of status and check for blocking
        let worstRank = STATUS_RANK.skipped; // start at best (skipped)
        const dimEntries: Array<{
          dimension: string;
          status: string;
          severity: string;
          observed_at: string;
        }> = [];

        for (const [dim, signal] of latestByDimension) {
          const st = signal.status as Status;
          const sev = signal.severity as Severity;
          const rank = STATUS_RANK[st];

          if (rank < worstRank) {
            worstRank = rank;
          }

          // Gate-severity signals with fail or unknown are blocking
          if (sev === 'gate' && (st === 'fail' || st === 'unknown')) {
            blocking = true;
          }

          dimEntries.push({
            dimension: dim,
            status: st,
            severity: sev,
            observed_at: signal.observed_at as string,
          });
        }

        // Map rank back to status name
        let worstStatus = 'skipped';
        for (const [status, rank] of Object.entries(STATUS_RANK)) {
          if (rank === worstRank) {
            worstStatus = status;
            break;
          }
        }

        perTarget.push({
          target_symbol: target,
          worst_status: worstStatus,
          dimensions: dimEntries,
        });
      }

      return { blocking, targets: perTarget };
    }) as StorageProgram<Result>;
  },

  explain(input: Record<string, unknown>) {
    let p = createProgram();
    const targetSymbol = input.target_symbol as string | undefined;
    const dimensions = input.dimensions as string[] | undefined;

    if (!targetSymbol) {
      return complete(p, 'validationError', {
        message: 'target_symbol is required',
      }) as StorageProgram<Result>;
    }

    // Validate dimensions filter if provided
    if (dimensions) {
      for (const dim of dimensions) {
        if (!VALID_DIMENSIONS.includes(dim as Dimension)) {
          return complete(p, 'validationError', {
            message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
          }) as StorageProgram<Result>;
        }
      }
    }

    p = find(p, SIGNALS, { target_symbol: targetSymbol }, 'allSignals');

    return completeFrom(p, 'ok', (bindings) => {
      const allSignals = (bindings.allSignals || []) as Array<Record<string, unknown>>;

      // Filter by dimensions if provided
      let filtered = allSignals;
      if (dimensions && dimensions.length > 0) {
        filtered = allSignals.filter(s => dimensions.includes(s.dimension as string));
      }

      // Sort by observed_at descending (most recent first)
      filtered.sort((a, b) =>
        (b.observed_at as string).localeCompare(a.observed_at as string),
      );

      return {
        target_symbol: targetSymbol,
        signals: filtered,
      };
    }) as StorageProgram<Result>;
  },
};

export const qualitySignalHandler = autoInterpret(_handler);
