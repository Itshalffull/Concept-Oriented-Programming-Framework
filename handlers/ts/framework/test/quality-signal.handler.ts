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

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

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

export const qualitySignalHandler: ConceptHandler = {
  async record(input, storage) {
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
      return {
        variant: 'validationError',
        message: 'target_symbol, dimension, status, and severity are required',
      };
    }

    // --- Validate dimension ---
    if (!VALID_DIMENSIONS.includes(dimension as Dimension)) {
      return {
        variant: 'validationError',
        message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
      };
    }

    // --- Validate status ---
    if (!VALID_STATUSES.includes(status as Status)) {
      return {
        variant: 'validationError',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      };
    }

    // --- Validate severity ---
    if (!VALID_SEVERITIES.includes(severity as Severity)) {
      return {
        variant: 'validationError',
        message: `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
      };
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

    await storage.put(SIGNALS, signalId, entry);

    return { variant: 'ok', id: signalId, observed_at: observedAt };
  },

  async latest(input, storage) {
    const targetSymbol = input.target_symbol as string | undefined;
    const dimension = input.dimension as string | undefined;

    if (!targetSymbol || !dimension) {
      return {
        variant: 'validationError',
        message: 'target_symbol and dimension are required',
      };
    }

    if (!VALID_DIMENSIONS.includes(dimension as Dimension)) {
      return {
        variant: 'validationError',
        message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
      };
    }

    const matches = await storage.find(SIGNALS, {
      target_symbol: targetSymbol,
      dimension,
    });

    if (matches.length === 0) {
      return { variant: 'notFound', target_symbol: targetSymbol, dimension };
    }

    // Find the most recent by observed_at
    let latest = matches[0];
    for (let i = 1; i < matches.length; i++) {
      if ((matches[i].observed_at as string) > (latest.observed_at as string)) {
        latest = matches[i];
      }
    }

    return {
      variant: 'ok',
      signal: latest,
    };
  },

  async rollup(input, storage) {
    const targetSymbols = input.target_symbols as string[] | undefined;
    const dimensions = input.dimensions as string[] | undefined;

    if (!targetSymbols || !Array.isArray(targetSymbols) || targetSymbols.length === 0) {
      return {
        variant: 'validationError',
        message: 'target_symbols must be a non-empty array',
      };
    }

    // Validate dimensions filter if provided
    if (dimensions) {
      for (const dim of dimensions) {
        if (!VALID_DIMENSIONS.includes(dim as Dimension)) {
          return {
            variant: 'validationError',
            message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
          };
        }
      }
    }

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
      const allSignals = await storage.find(SIGNALS, { target_symbol: target });

      // Group by dimension, keeping only the latest per dimension
      const latestByDimension = new Map<string, Record<string, unknown>>();
      for (const signal of allSignals) {
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

    return {
      variant: 'ok',
      blocking,
      targets: perTarget,
    };
  },

  async explain(input, storage) {
    const targetSymbol = input.target_symbol as string | undefined;
    const dimensions = input.dimensions as string[] | undefined;

    if (!targetSymbol) {
      return {
        variant: 'validationError',
        message: 'target_symbol is required',
      };
    }

    // Validate dimensions filter if provided
    if (dimensions) {
      for (const dim of dimensions) {
        if (!VALID_DIMENSIONS.includes(dim as Dimension)) {
          return {
            variant: 'validationError',
            message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
          };
        }
      }
    }

    const allSignals = await storage.find(SIGNALS, { target_symbol: targetSymbol });

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
      variant: 'ok',
      target_symbol: targetSymbol,
      signals: filtered,
    };
  },
};
