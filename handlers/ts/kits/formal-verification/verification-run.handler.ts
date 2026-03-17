// VerificationRun Concept Implementation — Formal Verification Suite
// Manage the lifecycle of verification runs: start, complete, timeout,
// cancel, track progress, and compare results across runs.
//
// Migrated to FunctionalConceptHandler: returns StoragePrograms for
// monadic analysis pipeline integration. Enables the FV suite to
// extract invariants from its own run lifecycle (e.g., "a completed
// run always has non-empty results", "a timed-out run preserves
// partial results").
// See Architecture doc Section 18.4

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, pure,
  type StorageProgram,
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

export const verificationRunHandler: FunctionalConceptHandler = {
  start(input) {
    const name = input.name as string;
    const property_ids = input.property_ids as string;
    const solver_provider = input.solver_provider as string | undefined;
    const timeout_ms = input.timeout_ms as number | undefined;

    let propertyList: string[];
    try {
      propertyList = JSON.parse(property_ids);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'property_ids must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(propertyList) || propertyList.length === 0) {
      return pure(createProgram(), { variant: 'invalid', message: 'property_ids must be a non-empty array' }) as StorageProgram<Result>;
    }

    const id = `vr-${simpleHash(name + ':' + Date.now().toString())}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RELATION, id, {
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

    return pure(p, {
      variant: 'ok', id, name, status: 'running',
      total_count: propertyList.length, started_at: now,
    }) as StorageProgram<Result>;
  },

  complete(input) {
    const id = input.id as string;
    const results = input.results as string;
    const resource_usage = input.resource_usage as string;

    let resultsMap: Record<string, string>;
    try {
      resultsMap = JSON.parse(results);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'results must be a valid JSON object' }) as StorageProgram<Result>;
    }

    let proved = 0, refuted = 0, unknown = 0;
    for (const status of Object.values(resultsMap)) {
      if (status === 'proved') proved++;
      else if (status === 'refuted') refuted++;
      else unknown++;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'run');
    p = branch(
      p,
      (bindings) => bindings.run == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        return branch(
          createProgram(),
          (bindings) => (bindings.run as Record<string, unknown>).status !== 'running',
          pure(createProgram(), { variant: 'invalid', id, message: 'Run is not in running state, cannot complete' }),
          (() => {
            let inner = createProgram();
            inner = put(inner, RELATION, id, {
              __merge: true,
              status: 'completed',
              results: JSON.stringify(resultsMap),
              resource_usage: resource_usage || '',
              ended_at: now,
            });
            return pure(inner, { variant: 'ok', id, status: 'completed', proved, refuted, unknown, ended_at: now });
          })(),
        );
      })(),
    );
    return p as StorageProgram<Result>;
  },

  timeout(input) {
    const id = input.id as string;
    const partial_results = input.partial_results as string;

    let partialMap: Record<string, string>;
    try {
      partialMap = JSON.parse(partial_results);
    } catch {
      partialMap = {};
    }

    const completedCount = Object.keys(partialMap).length;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'run');
    p = branch(
      p,
      (bindings) => bindings.run == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        return branch(
          createProgram(),
          (bindings) => (bindings.run as Record<string, unknown>).status !== 'running',
          pure(createProgram(), { variant: 'invalid', id, message: 'Run is not in running state, cannot timeout' }),
          (() => {
            let inner = createProgram();
            inner = put(inner, RELATION, id, {
              __merge: true,
              status: 'timeout',
              partial_results: JSON.stringify(partialMap),
              ended_at: now,
            });
            return pure(inner, {
              variant: 'ok', id, status: 'timeout',
              completed_count: completedCount,
              remaining_count: '__binding:run.total_count - ' + completedCount,
              total_count: '__binding:run.total_count',
              ended_at: now,
            });
          })(),
        );
      })(),
    );
    return p as StorageProgram<Result>;
  },

  cancel(input) {
    const id = input.id as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'run');
    p = branch(
      p,
      (bindings) => bindings.run == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        return branch(
          createProgram(),
          (bindings) => (bindings.run as Record<string, unknown>).status !== 'running',
          pure(createProgram(), { variant: 'invalid', id, message: 'Run is not in running state, cannot cancel' }),
          (() => {
            let inner = createProgram();
            inner = put(inner, RELATION, id, {
              __merge: true,
              status: 'cancelled',
              ended_at: now,
            });
            return pure(inner, { variant: 'ok', id, status: 'cancelled', ended_at: now });
          })(),
        );
      })(),
    );
    return p as StorageProgram<Result>;
  },

  get_status(input) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, RELATION, id, 'run');
    p = branch(
      p,
      (bindings) => bindings.run == null,
      pure(createProgram(), { variant: 'notfound', id }),
      pure(createProgram(), {
        variant: 'ok',
        id,
        __compute: 'run_status',
      }),
    );
    return p as StorageProgram<Result>;
  },

  compare(input) {
    const run_id_a = input.run_id_a as string;
    const run_id_b = input.run_id_b as string;

    let p = createProgram();
    p = get(p, RELATION, run_id_a, 'runA');
    p = get(p, RELATION, run_id_b, 'runB');
    p = branch(
      p,
      (bindings) => bindings.runA == null,
      pure(createProgram(), { variant: 'notfound', id: run_id_a }),
      (() => {
        return branch(
          createProgram(),
          (bindings) => bindings.runB == null,
          pure(createProgram(), { variant: 'notfound', id: run_id_b }),
          pure(createProgram(), {
            variant: 'ok',
            run_id_a,
            run_id_b,
            __compute: 'compare_runs',
          }),
        );
      })(),
    );
    return p as StorageProgram<Result>;
  },
};
