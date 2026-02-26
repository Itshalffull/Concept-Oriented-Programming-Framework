// ============================================================
// GenerationPlan Concept Implementation
//
// Tracks generation run lifecycle: begin, record step outcomes,
// complete, and report. Purely passive — does not dispatch
// generators or query other concepts. Observer syncs feed data
// into it; GenerationPlan stores and aggregates.
// See copf-generation-kit.md Part 1.4
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';
import { randomUUID } from 'crypto';

const RUNS_RELATION = 'runs';
const STEPS_RELATION = 'steps';
const ACTIVE_RUN_RELATION = 'activeRun';

export const generationPlanHandler: ConceptHandler = {
  /**
   * Mark a new generation run as started.
   */
  async begin(
    _input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const runId = randomUUID();
    const now = new Date().toISOString();

    await storage.put(RUNS_RELATION, runId, {
      id: runId,
      startedAt: now,
      completedAt: null,
    });

    await storage.put(ACTIVE_RUN_RELATION, 'current', {
      runId,
    });

    return { variant: 'ok', run: runId };
  },

  /**
   * Record a step's outcome. Called by observer syncs.
   */
  async recordStep(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const stepKey = input.stepKey as string;
    const status = input.status as string;
    const filesProduced = input.filesProduced as number | undefined;
    const duration = input.duration as number | undefined;
    const cached = input.cached as boolean;

    // Get active run
    const activeRun = await storage.get(ACTIVE_RUN_RELATION, 'current');
    if (!activeRun) {
      // No active run — silently succeed
      return { variant: 'ok' };
    }

    const runId = activeRun.runId as string;
    const stepId = `${runId}:${stepKey}`;

    await storage.put(STEPS_RELATION, stepId, {
      runId,
      stepKey,
      status,
      filesProduced: filesProduced ?? 0,
      duration: duration ?? 0,
      cached,
      recordedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  /**
   * Mark the active run as complete.
   */
  async complete(
    _input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const activeRun = await storage.get(ACTIVE_RUN_RELATION, 'current');
    if (!activeRun) {
      return { variant: 'ok', run: null };
    }

    const runId = activeRun.runId as string;
    const runRecord = await storage.get(RUNS_RELATION, runId);

    if (runRecord) {
      await storage.put(RUNS_RELATION, runId, {
        ...runRecord,
        completedAt: new Date().toISOString(),
      });
    }

    await storage.del(ACTIVE_RUN_RELATION, 'current');

    return { variant: 'ok', run: runId };
  },

  /**
   * Return current execution status for all steps in a run.
   */
  async status(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const run = input.run as string;

    const allSteps = await storage.find(STEPS_RELATION, { runId: run });
    const steps = allSteps.map(s => ({
      stepKey: s.stepKey as string,
      status: s.status as string,
      duration: (s.duration as number) || 0,
      cached: (s.cached as boolean) || false,
      filesProduced: (s.filesProduced as number) || 0,
    }));

    return { variant: 'ok', steps };
  },

  /**
   * Return summary statistics for a completed run.
   */
  async summary(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const run = input.run as string;

    const allSteps = await storage.find(STEPS_RELATION, { runId: run });

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

    return {
      variant: 'ok',
      total,
      executed,
      cached,
      failed,
      totalDuration,
      filesProduced,
    };
  },

  /**
   * Return recent generation runs.
   */
  async history(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const limit = (input.limit as number) || 10;

    const allRuns = await storage.find(RUNS_RELATION);

    // Sort by startedAt descending
    const sorted = allRuns
      .sort((a, b) => {
        const aTime = a.startedAt as string;
        const bTime = b.startedAt as string;
        return bTime.localeCompare(aTime);
      })
      .slice(0, limit);

    const runs: Array<Record<string, unknown>> = [];

    for (const run of sorted) {
      const runId = run.id as string;
      const steps = await storage.find(STEPS_RELATION, { runId });

      let total = 0;
      let executed = 0;
      let cached = 0;
      let failed = 0;

      for (const step of steps) {
        total++;
        const status = step.status as string;
        if (status === 'done') executed++;
        else if (status === 'cached') cached++;
        else if (status === 'failed') failed++;
      }

      runs.push({
        run: runId,
        startedAt: run.startedAt as string,
        completedAt: run.completedAt || null,
        total,
        executed,
        cached,
        failed,
      });
    }

    return { variant: 'ok', runs };
  },
};
