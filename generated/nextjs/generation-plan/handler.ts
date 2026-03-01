// GenerationPlan — handler.ts
// Code generation planning: begin/complete runs, record step outcomes,
// track cached vs executed steps, and provide summary and history views.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GenerationPlanStorage,
  GenerationPlanBeginInput,
  GenerationPlanBeginOutput,
  GenerationPlanRecordStepInput,
  GenerationPlanRecordStepOutput,
  GenerationPlanCompleteInput,
  GenerationPlanCompleteOutput,
  GenerationPlanStatusInput,
  GenerationPlanStatusOutput,
  GenerationPlanSummaryInput,
  GenerationPlanSummaryOutput,
  GenerationPlanHistoryInput,
  GenerationPlanHistoryOutput,
} from './types.js';

import {
  beginOk,
  recordStepOk,
  completeOk,
  statusOk,
  summaryOk,
  historyOk,
} from './types.js';

export interface GenerationPlanError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): GenerationPlanError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface GenerationPlanHandler {
  readonly begin: (
    input: GenerationPlanBeginInput,
    storage: GenerationPlanStorage,
  ) => TE.TaskEither<GenerationPlanError, GenerationPlanBeginOutput>;
  readonly recordStep: (
    input: GenerationPlanRecordStepInput,
    storage: GenerationPlanStorage,
  ) => TE.TaskEither<GenerationPlanError, GenerationPlanRecordStepOutput>;
  readonly complete: (
    input: GenerationPlanCompleteInput,
    storage: GenerationPlanStorage,
  ) => TE.TaskEither<GenerationPlanError, GenerationPlanCompleteOutput>;
  readonly status: (
    input: GenerationPlanStatusInput,
    storage: GenerationPlanStorage,
  ) => TE.TaskEither<GenerationPlanError, GenerationPlanStatusOutput>;
  readonly summary: (
    input: GenerationPlanSummaryInput,
    storage: GenerationPlanStorage,
  ) => TE.TaskEither<GenerationPlanError, GenerationPlanSummaryOutput>;
  readonly history: (
    input: GenerationPlanHistoryInput,
    storage: GenerationPlanStorage,
  ) => TE.TaskEither<GenerationPlanError, GenerationPlanHistoryOutput>;
}

// --- Implementation ---

export const generationPlanHandler: GenerationPlanHandler = {
  // Begin a new generation run, producing a unique run id
  begin: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const runId = `run::${Date.now()}`;
          await storage.put('run', runId, {
            run: runId,
            startedAt: new Date().toISOString(),
            completedAt: null,
            steps: [],
          });
          return beginOk(runId);
        },
        toError,
      ),
    ),

  // Record a step outcome (status, duration, cached, files produced) in the current run
  recordStep: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const filesProduced = pipe(input.filesProduced, O.getOrElse(() => 0));
          const duration = pipe(input.duration, O.getOrElse(() => 0));
          await storage.put('step', input.stepKey, {
            stepKey: input.stepKey,
            status: input.status,
            filesProduced,
            duration,
            cached: input.cached,
            recordedAt: new Date().toISOString(),
          });
          return recordStepOk();
        },
        toError,
      ),
    ),

  // Mark the current run as complete with a completion timestamp
  complete: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Find the most recent incomplete run
          const runs = await storage.find('run');
          const incomplete = runs.find((r) => r.completedAt === null);
          const runId = (incomplete?.run as string) ?? `run::${Date.now()}`;
          if (incomplete) {
            await storage.put('run', runId, {
              ...incomplete,
              completedAt: new Date().toISOString(),
            });
          }
          return completeOk(runId);
        },
        toError,
      ),
    ),

  // Return the list of steps recorded for a given run
  status: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allSteps = await storage.find('step');
          const steps = allSteps.map((s) => ({
            stepKey: (s.stepKey as string) ?? '',
            status: (s.status as string) ?? '',
            duration: (s.duration as number) ?? 0,
            cached: (s.cached as boolean) ?? false,
            filesProduced: (s.filesProduced as number) ?? 0,
          }));
          return statusOk(steps);
        },
        toError,
      ),
    ),

  // Summarize a run: aggregate step counts, durations, and file totals
  summary: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allSteps = await storage.find('step');
          const total = allSteps.length;
          const cached = allSteps.filter((s) => s.cached === true).length;
          const failed = allSteps.filter((s) => s.status === 'failed').length;
          const executed = total - cached;
          const totalDuration = allSteps.reduce((acc, s) => acc + ((s.duration as number) ?? 0), 0);
          const filesProduced = allSteps.reduce((acc, s) => acc + ((s.filesProduced as number) ?? 0), 0);
          return summaryOk(total, executed, cached, failed, totalDuration, filesProduced);
        },
        toError,
      ),
    ),

  // Return the history of all generation runs, optionally limited
  history: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allRuns = await storage.find('run');
          const limit = pipe(input.limit, O.getOrElse(() => 50));
          const runs = allRuns.slice(0, limit).map((r) => ({
            run: (r.run as string) ?? '',
            startedAt: new Date((r.startedAt as string) ?? 0),
            completedAt: r.completedAt
              ? O.some(new Date(r.completedAt as string))
              : O.none,
            total: (r.total as number) ?? 0,
            executed: (r.executed as number) ?? 0,
            cached: (r.cached as number) ?? 0,
            failed: (r.failed as number) ?? 0,
          }));
          return historyOk(runs);
        },
        toError,
      ),
    ),
};
