// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// GenerationPlan Concept Implementation
//
// Tracks generation run lifecycle: begin, record step outcomes,
// complete, and report. Purely passive — does not dispatch
// generators or query other concepts. Observer syncs feed data
// into it; GenerationPlan stores and aggregates.
// See clef-generation-suite.md Part 1.4
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

const RUNS_RELATION = 'runs';
const STEPS_RELATION = 'steps';
const ACTIVE_RUN_RELATION = 'activeRun';

const _handler: FunctionalConceptHandler = {
  /**
   * Mark a new generation run as started.
   */
  begin(_input: Record<string, unknown>) {
    const runId = randomUUID();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RUNS_RELATION, runId, {
      id: runId,
      startedAt: now,
      completedAt: null,
    });

    p = put(p, ACTIVE_RUN_RELATION, 'current', {
      runId,
    });

    return complete(p, 'ok', { run: runId }) as StorageProgram<Result>;
  },

  /**
   * Record a step's outcome. Called by observer syncs.
   */
  recordStep(input: Record<string, unknown>) {
    const stepKey = input.stepKey as string;
    const status = input.status as string;
    const filesProduced = input.filesProduced as number | undefined;
    const duration = input.duration as number | undefined;
    const cached = input.cached as boolean;

    // Generate a unique step ID at construction time for the storage key.
    // The runId (dynamic, from bindings) is included in the value for find() filtering.
    const stepId = randomUUID();

    // Return error for failed status regardless of active run state
    if (status === 'failed') {
      return complete(createProgram(), 'error', { message: 'step failed', stepKey, status }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, ACTIVE_RUN_RELATION, 'current', 'activeRun');

    p = branch(p, 'activeRun',
      (b) => {
        let b2 = putFrom(b, STEPS_RELATION, stepId, (bindings) => {
          const activeRun = bindings.activeRun as Record<string, unknown>;
          const runId = activeRun.runId as string;
          return {
            runId,
            stepKey,
            status,
            filesProduced: filesProduced ?? 0,
            duration: duration ?? 0,
            cached,
            recordedAt: new Date().toISOString(),
          };
        });

        return complete(b2, 'ok', {});
      },
      // No active run — still ok, just record with empty runId
      (b) => {
        let b2 = put(b, STEPS_RELATION, stepId, {
          runId: '',
          stepKey,
          status,
          filesProduced: filesProduced ?? 0,
          duration: duration ?? 0,
          cached,
          recordedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Mark the active run as complete.
   */
  complete(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, ACTIVE_RUN_RELATION, 'current', 'activeRun');

    p = branch(p, 'activeRun',
      (b) => {
        let b2 = find(b, RUNS_RELATION, {}, 'allRuns');

        b2 = mapBindings(b2, (bindings) => {
          const activeRun = bindings.activeRun as Record<string, unknown>;
          const runId = activeRun.runId as string;
          const allRuns = bindings.allRuns as Array<Record<string, unknown>>;
          const run = allRuns.find(r => r.id === runId);
          return run ? { ...run, completedAt: new Date().toISOString() } : null;
        }, 'updatedRun');

        b2 = del(b2, ACTIVE_RUN_RELATION, 'current');

        return completeFrom(b2, 'ok', (bindings) => {
          const activeRun = bindings.activeRun as Record<string, unknown>;
          return { run: activeRun.runId as string };
        });
      },
      // No active run — still return ok (idempotent complete)
      (b) => complete(b, 'ok', {}),
    );

    return p as StorageProgram<Result>;
  },

  /**
   * Return current execution status for all steps in a run.
   */
  status(input: Record<string, unknown>) {
    const run = input.run as string;
    if (!run) {
      return complete(createProgram(), 'error', { message: 'run is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, STEPS_RELATION, { runId: run }, 'allSteps');

    return completeFrom(p, 'ok', (bindings) => {
      const allSteps = bindings.allSteps as Array<Record<string, unknown>>;
      const steps = allSteps.map(s => ({
        stepKey: s.stepKey as string,
        status: s.status as string,
        duration: (s.duration as number) || 0,
        cached: (s.cached as boolean) || false,
        filesProduced: (s.filesProduced as number) || 0,
      }));
      return { steps };
    }) as StorageProgram<Result>;
  },

  /**
   * Return summary statistics for a completed run.
   */
  summary(input: Record<string, unknown>) {
    const run = input.run as string;
    if (!run) {
      return complete(createProgram(), 'error', { message: 'run is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, STEPS_RELATION, { runId: run }, 'allSteps');

    return completeFrom(p, 'ok', (bindings) => {
      const allSteps = bindings.allSteps as Array<Record<string, unknown>>;

      let total = 0;
      let executed = 0;
      let cached = 0;
      let failed = 0;
      let totalDuration = 0;
      let filesProduced = 0;

      for (const step of allSteps) {
        total++;
        const status = step.status as string;
        if (status === 'done') executed++;
        else if (status === 'cached') cached++;
        else if (status === 'failed') failed++;

        totalDuration += (step.duration as number) || 0;
        filesProduced += (step.filesProduced as number) || 0;
      }

      return { variant: 'ok', total, executed, cached, failed, totalDuration, filesProduced };
    }) as StorageProgram<Result>;
  },

  /**
   * Return recent generation runs.
   */
  history(input: Record<string, unknown>) {
    const limit = (input.limit as number) || 10;

    let p = createProgram();
    p = find(p, RUNS_RELATION, {}, 'allRuns');

    // Note: The original imperative handler did per-run step lookups in a loop.
    // In the functional DSL, we return the runs without per-run step counts,
    // as iterative storage queries are not supported. Step details can be
    // fetched via the status/summary actions.
    return completeFrom(p, 'ok', (bindings) => {
      const allRuns = bindings.allRuns as Array<Record<string, unknown>>;

      const sorted = allRuns
        .sort((a, b) => {
          const aTime = a.startedAt as string;
          const bTime = b.startedAt as string;
          return bTime.localeCompare(aTime);
        })
        .slice(0, limit);

      const runs = sorted.map(run => ({
        run: run.id as string,
        startedAt: run.startedAt as string,
        completedAt: run.completedAt || null,
      }));

      return { runs };
    }) as StorageProgram<Result>;
  },
};

export const generationPlanHandler = autoInterpret(_handler);
