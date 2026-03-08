// ============================================================
// VerificationRun Handler — Formal Verification Suite
//
// Manages verification run lifecycle: starting, completing,
// timeout handling, cancellation, status tracking with progress,
// and cross-run comparison for regressions and improvements.
// See Architecture doc Section 18.4
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';

const COLLECTION = 'verification-runs';

export const verificationRunHandler: ConceptHandler = {
  async start(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const property_ids_raw = input.property_ids as string;
    const solver_provider = (input.solver_provider as string) || undefined;
    const timeout_ms = (input.timeout_ms as number) || undefined;

    // Validate property_ids JSON
    let property_ids: string[];
    try {
      property_ids = JSON.parse(property_ids_raw);
    } catch {
      return {
        variant: 'invalid',
        message: 'property_ids must be valid JSON array',
      };
    }

    if (!Array.isArray(property_ids) || property_ids.length === 0) {
      return {
        variant: 'invalid',
        message: 'property_ids must be a non-empty array',
      };
    }

    const id = `vr-${randomUUID()}`;
    const started_at = new Date().toISOString();

    await storage.put(COLLECTION, id, {
      id,
      name,
      property_ids: JSON.stringify(property_ids),
      solver_provider,
      timeout_ms,
      status: 'running',
      total_count: property_ids.length,
      started_at,
    });

    return {
      variant: 'ok',
      id,
      status: 'running',
      total_count: property_ids.length,
      started_at,
    };
  },

  async complete(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;
    const results_raw = input.results as string;
    const resource_usage = (input.resource_usage as string) || undefined;

    const run = await storage.get(COLLECTION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    if (run.status !== 'running') {
      return {
        variant: 'invalid',
        message: `Run ${id} has already been ${run.status}`,
      };
    }

    const results = JSON.parse(results_raw) as Record<string, string>;
    const ended_at = new Date().toISOString();

    const proved = Object.values(results).filter(r => r === 'proved').length;
    const refuted = Object.values(results).filter(r => r === 'refuted').length;
    const unknown = Object.values(results).filter(r => r === 'unknown').length;

    await storage.put(COLLECTION, id, {
      ...run,
      status: 'completed',
      results: results_raw,
      resource_usage,
      proved,
      refuted,
      unknown,
      ended_at,
    });

    return {
      variant: 'ok',
      id,
      status: 'completed',
      proved,
      refuted,
      unknown,
      ended_at,
    };
  },

  async timeout(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;
    const partial_results_raw = (input.partial_results as string) || '{}';

    const run = await storage.get(COLLECTION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    if (run.status !== 'running') {
      return {
        variant: 'invalid',
        message: `Run ${id} has already been ${run.status}`,
      };
    }

    const partial_results = JSON.parse(partial_results_raw) as Record<string, string>;
    const completed_count = Object.keys(partial_results).length;
    const total_count = run.total_count as number;
    const remaining_count = total_count - completed_count;
    const ended_at = new Date().toISOString();

    await storage.put(COLLECTION, id, {
      ...run,
      status: 'timeout',
      partial_results: partial_results_raw,
      completed_count,
      remaining_count,
      ended_at,
    });

    return {
      variant: 'ok',
      id,
      status: 'timeout',
      completed_count,
      remaining_count,
      total_count,
      ended_at,
    };
  },

  async cancel(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;

    const run = await storage.get(COLLECTION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    if (run.status !== 'running') {
      return {
        variant: 'invalid',
        message: `Run ${id} has already been ${run.status}`,
      };
    }

    const ended_at = new Date().toISOString();

    await storage.put(COLLECTION, id, {
      ...run,
      status: 'cancelled',
      ended_at,
    });

    return {
      variant: 'ok',
      id,
      status: 'cancelled',
      ended_at,
    };
  },

  async get_status(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;

    const run = await storage.get(COLLECTION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    const total_count = run.total_count as number;
    let completed_count = 0;
    let progress = 0;

    if (run.status === 'completed') {
      const results = JSON.parse(run.results as string) as Record<string, string>;
      completed_count = Object.keys(results).length;
      progress = total_count > 0 ? completed_count / total_count : 0;
    } else if (run.status === 'timeout') {
      completed_count = run.completed_count as number;
      progress = total_count > 0 ? completed_count / total_count : 0;
    }

    return {
      variant: 'ok',
      id,
      status: run.status,
      completed_count,
      total_count,
      progress,
      started_at: run.started_at,
      ended_at: run.ended_at,
    };
  },

  async compare(input: Record<string, unknown>, storage: ConceptStorage) {
    const run_id_a = input.run_id_a as string;
    const run_id_b = input.run_id_b as string;

    const runA = await storage.get(COLLECTION, run_id_a);
    const runB = await storage.get(COLLECTION, run_id_b);

    if (!runA) return { variant: 'notfound', id: run_id_a };
    if (!runB) return { variant: 'notfound', id: run_id_b };

    const resultsA = JSON.parse(runA.results as string) as Record<string, string>;
    const resultsB = JSON.parse(runB.results as string) as Record<string, string>;

    const allProps = new Set([...Object.keys(resultsA), ...Object.keys(resultsB)]);

    const regressions: string[] = [];
    const improvements: string[] = [];
    const unchanged: string[] = [];

    for (const prop of allProps) {
      const a = resultsA[prop];
      const b = resultsB[prop];

      if (a === b) {
        unchanged.push(prop);
      } else if (a === 'proved' && b !== 'proved') {
        regressions.push(prop);
      } else if (a !== 'proved' && b === 'proved') {
        improvements.push(prop);
      } else {
        // e.g. unknown -> refuted or refuted -> unknown
        unchanged.push(prop);
      }
    }

    return {
      variant: 'ok',
      regression_count: regressions.length,
      improvement_count: improvements.length,
      unchanged_count: unchanged.length,
      regressions: JSON.stringify(regressions),
      improvements: JSON.stringify(improvements),
      unchanged: JSON.stringify(unchanged),
    };
  },
};
