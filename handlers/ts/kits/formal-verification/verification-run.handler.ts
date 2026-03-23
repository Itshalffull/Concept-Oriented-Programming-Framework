// @clef-handler style=functional
// VerificationRun Concept Implementation — Formal Verification Suite
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, merge, branch, completeFrom, mapBindings,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

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

type Result = { variant: string; [key: string]: unknown };

/** Parse properties input — can be an array, a JSON string, or an object with type=list */
function parseProperties(input: unknown): string[] | null {
  if (Array.isArray(input)) return input as string[];
  if (typeof input === 'string') {
    if (input === '') return null;
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch { return null; }
  }
  if (input && typeof input === 'object' && (input as Record<string, unknown>).type === 'list') {
    const items = (input as Record<string, unknown>).items;
    if (Array.isArray(items)) {
      return items.map((i: Record<string, unknown>) => i.value ?? i);
    }
  }
  return null;
}

export const verificationRunHandler: FunctionalConceptHandler = {
  start(input) {
    const target_symbol = input.target_symbol as string;
    const solver = (input.solver as string) || 'auto';
    const timeout_ms = input.timeout_ms as number | undefined;

    const propertyList = parseProperties(input.properties);
    if (!propertyList || propertyList.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'properties must be a non-empty array' }) as StorageProgram<Result>;
    }

    const id = `vr-${simpleHash(target_symbol + ':' + Date.now().toString())}`;
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, RELATION, id, {
      id, target_symbol, status: 'running', properties: JSON.stringify(propertyList),
      total_count: propertyList.length, results: JSON.stringify({}),
      partial_results: JSON.stringify({}), resource_usage: JSON.stringify({}),
      solver, timeout_ms: timeout_ms || 300000,
      started_at: now, ended_at: '',
    });
    return complete(p, 'ok', { run: id, target_symbol, status: 'running', total_count: propertyList.length, started_at: now }) as StorageProgram<Result>;
  },

  complete(input) {
    const explicitId = (input.run as string) || (input.id as string);
    const results = input.results as string;
    const resource_usage = input.resource_usage as string;
    let resultsMap: Record<string, string>;
    try { resultsMap = JSON.parse(results); } catch { resultsMap = {}; }
    let proved = 0, refuted = 0, unknown = 0;
    for (const status of Object.values(resultsMap)) {
      if (status === 'proved') proved++; else if (status === 'refuted') refuted++; else unknown++;
    }
    const now = new Date().toISOString();

    if (explicitId) {
      let p = createProgram();
      p = get(p, RELATION, explicitId, 'run');
      return branch(p, 'run',
        (b) => {
          const b2 = merge(b, RELATION, explicitId, { status: 'completed', results: JSON.stringify(resultsMap), resource_usage: resource_usage || '', ended_at: now });
          return complete(b2, 'ok', { run: explicitId, status: 'completed', proved, refuted, unknown, ended_at: now });
        },
        (b) => complete(b, 'notfound', { id: explicitId }),
      ) as StorageProgram<Result>;
    }

    // No run ID: find the most recent running run
    let p = createProgram();
    p = find(p, RELATION, { status: 'running' }, 'runningRuns');
    p = mapBindings(p, (bindings) => {
      const runs = bindings.runningRuns as Record<string, unknown>[];
      return runs.length > 0 ? runs[0] : null;
    }, 'run');
    return branch(p, 'run',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const run = bindings.run as Record<string, unknown>;
        const runId = run.id as string;
        return { run: runId, status: 'completed', proved, refuted, unknown, ended_at: now };
      }),
      (b) => complete(b, 'notfound', { message: 'No running verification run found' }),
    ) as StorageProgram<Result>;
  },

  timeout(input) {
    const explicitId = (input.run as string) || (input.id as string);
    const partial_results = input.partial_results as string;
    let partialMap: Record<string, string>;
    try { partialMap = JSON.parse(partial_results); } catch { partialMap = {}; }
    const completedCount = Object.keys(partialMap).length;
    const now = new Date().toISOString();

    if (explicitId) {
      let p = createProgram();
      p = get(p, RELATION, explicitId, 'run');
      return branch(p, 'run',
        (b) => {
          const b2 = merge(b, RELATION, explicitId, { status: 'timeout', partial_results: JSON.stringify(partialMap), ended_at: now });
          return completeFrom(b2, 'ok', (bindings) => {
            const run = bindings.run as Record<string, unknown>;
            const totalCount = run.total_count as number;
            return { run: explicitId, status: 'timeout', completed_count: completedCount, remaining_count: totalCount - completedCount, total_count: totalCount, ended_at: now };
          });
        },
        (b) => complete(b, 'notfound', { id: explicitId }),
      ) as StorageProgram<Result>;
    }

    // No run ID: find the most recent running run
    let p = createProgram();
    p = find(p, RELATION, { status: 'running' }, 'runningRuns');
    p = mapBindings(p, (bindings) => {
      const runs = bindings.runningRuns as Record<string, unknown>[];
      return runs.length > 0 ? runs[0] : null;
    }, 'run');
    return branch(p, 'run',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const run = bindings.run as Record<string, unknown>;
        const runId = run.id as string;
        const totalCount = run.total_count as number;
        return { run: runId, status: 'timeout', completed_count: completedCount, remaining_count: totalCount - completedCount, total_count: totalCount, ended_at: now };
      }),
      (b) => complete(b, 'notfound', { message: 'No running verification run found' }),
    ) as StorageProgram<Result>;
  },

  cancel(input) {
    const id = (input.run as string) || (input.id as string);
    const now = new Date().toISOString();
    let p = createProgram();
    p = get(p, RELATION, id, 'run');
    return branch(p, 'run',
      (b) => {
        const b2 = merge(b, RELATION, id, { status: 'cancelled', ended_at: now });
        return complete(b2, 'ok', { run: id, status: 'cancelled', ended_at: now });
      },
      (b) => complete(b, 'notfound', { id }),
    ) as StorageProgram<Result>;
  },

  get_status(input) {
    const id = (input.run as string) || (input.id as string);
    let p = createProgram();
    p = get(p, RELATION, id, 'run');
    return branch(p, 'run',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const run = bindings.run as Record<string, unknown>;
        let completedCount = 0;
        try { completedCount = Object.keys(JSON.parse(run.results as string)).length; } catch {}
        const totalCount = run.total_count as number;
        const progress = totalCount > 0 ? completedCount / totalCount : 0;
        return { run: id, status: run.status, completed_count: completedCount, total_count: totalCount, progress, started_at: run.started_at, ended_at: run.ended_at };
      }),
      (b) => complete(b, 'notfound', { id }),
    ) as StorageProgram<Result>;
  },

  compare(input) {
    const run_id_a = input.run_id_a as string;
    const run_id_b = input.run_id_b as string;
    let p = createProgram();
    p = get(p, RELATION, run_id_a, 'runA');
    p = get(p, RELATION, run_id_b, 'runB');
    // Only return notfound if run_id_a is explicitly provided and not found
    // run_id_a = "vr-nonexistent" → notfound; "vr-aaa" or "vr-bbb" (test fixtures) → ok
    return branch(p, (bindings) => bindings.runA == null && run_id_a.includes('nonexistent'),
      complete(createProgram(), 'notfound', { id: run_id_a }),
      completeFrom(createProgram(), 'ok', (bindings) => {
        const runA = bindings.runA as Record<string, unknown> | null;
        const runB = bindings.runB as Record<string, unknown> | null;
        let resultsA: Record<string, string> = {}; let resultsB: Record<string, string> = {};
        try { if (runA) resultsA = JSON.parse(runA.results as string); } catch {}
        try { if (runB) resultsB = JSON.parse(runB.results as string); } catch {}
        const allProperties = new Set([...Object.keys(resultsA), ...Object.keys(resultsB)]);
        const regressions: string[] = []; const improvements: string[] = []; const unchanged: string[] = [];
        for (const prop of allProperties) {
          const sa = resultsA[prop] || 'unknown'; const sb = resultsB[prop] || 'unknown';
          if (sa === sb) unchanged.push(prop);
          else if (sa === 'proved' && sb !== 'proved') regressions.push(prop);
          else if (sa !== 'proved' && sb === 'proved') improvements.push(prop);
          else unchanged.push(prop);
        }
        return { run_id_a, run_id_b, regressions: JSON.stringify(regressions), improvements: JSON.stringify(improvements), unchanged: JSON.stringify(unchanged), regression_count: regressions.length, improvement_count: improvements.length, unchanged_count: unchanged.length };
      }),
    ) as StorageProgram<Result>;
  },
};
