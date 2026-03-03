// VerificationRun Concept Implementation — Formal Verification Suite
// Manage the lifecycle of verification runs: start, complete, timeout,
// cancel, track progress, and compare results across runs.
// See Architecture doc Section 18.4
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

const RELATION = 'verification-runs';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

export const verificationRunHandler: ConceptHandler = {
  async start(input, storage) {
    const name = input.name as string;
    const property_ids = input.property_ids as string;    // JSON array of property IDs
    const solver_provider = input.solver_provider as string | undefined;
    const timeout_ms = input.timeout_ms as number | undefined;

    let propertyList: string[];
    try {
      propertyList = JSON.parse(property_ids);
    } catch {
      return { variant: 'invalid', message: 'property_ids must be a valid JSON array' };
    }

    if (!Array.isArray(propertyList) || propertyList.length === 0) {
      return { variant: 'invalid', message: 'property_ids must be a non-empty array' };
    }

    const id = `vr-${simpleHash(name + ':' + Date.now().toString())}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
      id,
      name,
      status: 'running',
      property_ids: JSON.stringify(propertyList),
      total_count: propertyList.length,
      results: JSON.stringify({}),
      partial_results: JSON.stringify({}),
      resource_usage: JSON.stringify({}),
      solver_provider: solver_provider || '',
      timeout_ms: timeout_ms || 300000,
      started_at: now,
      ended_at: '',
    });

    return { variant: 'ok', id, name, status: 'running', total_count: propertyList.length, started_at: now };
  },

  async complete(input, storage) {
    const id = input.id as string;
    const results = input.results as string;           // JSON map: property_id -> status
    const resource_usage = input.resource_usage as string;  // JSON: { cpu_ms, memory_mb, solver_calls }

    const run = await storage.get(RELATION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    if (run.status !== 'running') {
      return { variant: 'invalid', id, message: `Run is already "${run.status}", cannot complete` };
    }

    let resultsMap: Record<string, string>;
    try {
      resultsMap = JSON.parse(results);
    } catch {
      return { variant: 'invalid', message: 'results must be a valid JSON object' };
    }

    // Count outcomes
    let proved = 0;
    let refuted = 0;
    let unknown = 0;
    for (const status of Object.values(resultsMap)) {
      if (status === 'proved') proved++;
      else if (status === 'refuted') refuted++;
      else unknown++;
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, id, {
      ...run,
      status: 'completed',
      results: JSON.stringify(resultsMap),
      resource_usage: resource_usage || run.resource_usage,
      ended_at: now,
    });

    return { variant: 'ok', id, status: 'completed', proved, refuted, unknown, ended_at: now };
  },

  async timeout(input, storage) {
    const id = input.id as string;
    const partial_results = input.partial_results as string;  // JSON map: property_id -> status

    const run = await storage.get(RELATION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    if (run.status !== 'running') {
      return { variant: 'invalid', id, message: `Run is already "${run.status}", cannot timeout` };
    }

    let partialMap: Record<string, string>;
    try {
      partialMap = JSON.parse(partial_results);
    } catch {
      partialMap = {};
    }

    const totalCount = run.total_count as number;
    const completedCount = Object.keys(partialMap).length;
    const remainingCount = totalCount - completedCount;

    const now = new Date().toISOString();
    await storage.put(RELATION, id, {
      ...run,
      status: 'timeout',
      partial_results: JSON.stringify(partialMap),
      ended_at: now,
    });

    return {
      variant: 'ok',
      id,
      status: 'timeout',
      completed_count: completedCount,
      remaining_count: remainingCount,
      total_count: totalCount,
      ended_at: now,
    };
  },

  async cancel(input, storage) {
    const id = input.id as string;

    const run = await storage.get(RELATION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    if (run.status !== 'running') {
      return { variant: 'invalid', id, message: `Run is already "${run.status}", cannot cancel` };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, id, {
      ...run,
      status: 'cancelled',
      ended_at: now,
    });

    return { variant: 'ok', id, status: 'cancelled', ended_at: now };
  },

  async get_status(input, storage) {
    const id = input.id as string;

    const run = await storage.get(RELATION, id);
    if (!run) {
      return { variant: 'notfound', id };
    }

    const status = run.status as string;
    const totalCount = run.total_count as number;

    // Compute completed count from results or partial_results
    let completedCount = 0;
    if (status === 'completed') {
      const resultsMap: Record<string, string> = JSON.parse(run.results as string);
      completedCount = Object.keys(resultsMap).length;
    } else if (status === 'timeout') {
      const partialMap: Record<string, string> = JSON.parse(run.partial_results as string);
      completedCount = Object.keys(partialMap).length;
    } else if (status === 'running') {
      // In-progress: check partial results if any
      const partialMap: Record<string, string> = JSON.parse(run.partial_results as string);
      completedCount = Object.keys(partialMap).length;
    }

    const progress = totalCount > 0 ? completedCount / totalCount : 0;

    return {
      variant: 'ok',
      id,
      status,
      completed_count: completedCount,
      total_count: totalCount,
      progress,
      started_at: run.started_at as string,
      ended_at: run.ended_at as string,
    };
  },

  async compare(input, storage) {
    const run_id_a = input.run_id_a as string;
    const run_id_b = input.run_id_b as string;

    const runA = await storage.get(RELATION, run_id_a);
    if (!runA) {
      return { variant: 'notfound', id: run_id_a };
    }

    const runB = await storage.get(RELATION, run_id_b);
    if (!runB) {
      return { variant: 'notfound', id: run_id_b };
    }

    // Use results for completed runs, partial_results for others
    const resultsA: Record<string, string> = JSON.parse(
      (runA.status === 'completed' ? runA.results : runA.partial_results) as string
    );
    const resultsB: Record<string, string> = JSON.parse(
      (runB.status === 'completed' ? runB.results : runB.partial_results) as string
    );

    const regressions: string[] = [];
    const improvements: string[] = [];
    const unchanged: string[] = [];

    // Compare per-property statuses
    const allPropertyIds = new Set([...Object.keys(resultsA), ...Object.keys(resultsB)]);
    for (const propId of allPropertyIds) {
      const statusA = resultsA[propId] || 'absent';
      const statusB = resultsB[propId] || 'absent';

      if (statusA === statusB) {
        unchanged.push(propId);
      } else if (statusA === 'proved' && statusB !== 'proved') {
        regressions.push(propId);
      } else if (statusA !== 'proved' && statusB === 'proved') {
        improvements.push(propId);
      } else {
        // Other transitions (e.g., refuted -> unknown, unknown -> refuted)
        unchanged.push(propId);
      }
    }

    return {
      variant: 'ok',
      run_id_a,
      run_id_b,
      regressions: JSON.stringify(regressions),
      improvements: JSON.stringify(improvements),
      unchanged: JSON.stringify(unchanged),
      regression_count: regressions.length,
      improvement_count: improvements.length,
      unchanged_count: unchanged.length,
    };
  },
};
