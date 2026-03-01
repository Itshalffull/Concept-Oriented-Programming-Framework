// EvaluationRun — Manages evaluation run lifecycle with metric logging, scoring, and pass/fail determination.
// Runs transition through pending, running, and terminal states (passed/failed).
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EvaluationRunStorage,
  EvaluationRunRunEvalInput,
  EvaluationRunRunEvalOutput,
  EvaluationRunLogMetricInput,
  EvaluationRunLogMetricOutput,
  EvaluationRunPassInput,
  EvaluationRunPassOutput,
  EvaluationRunFailInput,
  EvaluationRunFailOutput,
  EvaluationRunGetResultInput,
  EvaluationRunGetResultOutput,
} from './types.js';

import {
  runEvalOk,
  logMetricOk,
  logMetricNotfound,
  logMetricInvalidStatus,
  passOk,
  passBelowThreshold,
  passNotfound,
  passInvalidStatus,
  failOk,
  failNotfound,
  failInvalidStatus,
  getResultOk,
  getResultNotfound,
} from './types.js';

export interface EvaluationRunError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): EvaluationRunError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface EvaluationRunHandler {
  readonly runEval: (
    input: EvaluationRunRunEvalInput,
    storage: EvaluationRunStorage,
  ) => TE.TaskEither<EvaluationRunError, EvaluationRunRunEvalOutput>;
  readonly logMetric: (
    input: EvaluationRunLogMetricInput,
    storage: EvaluationRunStorage,
  ) => TE.TaskEither<EvaluationRunError, EvaluationRunLogMetricOutput>;
  readonly pass: (
    input: EvaluationRunPassInput,
    storage: EvaluationRunStorage,
  ) => TE.TaskEither<EvaluationRunError, EvaluationRunPassOutput>;
  readonly fail: (
    input: EvaluationRunFailInput,
    storage: EvaluationRunStorage,
  ) => TE.TaskEither<EvaluationRunError, EvaluationRunFailOutput>;
  readonly getResult: (
    input: EvaluationRunGetResultInput,
    storage: EvaluationRunStorage,
  ) => TE.TaskEither<EvaluationRunError, EvaluationRunGetResultOutput>;
}

// --- Implementation ---

export const evaluationRunHandler: EvaluationRunHandler = {
  runEval: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const now = new Date().toISOString();
          await storage.put('evaluation_run', input.run_id, {
            run_id: input.run_id,
            eval_name: input.eval_name,
            threshold: input.threshold,
            metadata: input.metadata ?? null,
            status: 'running',
            score: 0,
            metrics: '[]',
            reason: null,
            createdAt: now,
            updatedAt: now,
          });
          return runEvalOk(input.run_id);
        },
        toStorageError,
      ),
    ),

  logMetric: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('evaluation_run', input.run_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                logMetricNotfound(`Evaluation run '${input.run_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'running') {
                return TE.right(
                  logMetricInvalidStatus(
                    `Cannot log metric: run is in '${status}' status, expected 'running'`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const existingMetrics: readonly Record<string, unknown>[] =
                    existing['metrics'] ? JSON.parse(String(existing['metrics'])) : [];
                  const newMetric = {
                    metric_name: input.metric_name,
                    value: input.value,
                    labels: input.labels ?? null,
                    timestamp: now,
                  };
                  const updatedMetrics = [...existingMetrics, newMetric];
                  await storage.put('evaluation_run', input.run_id, {
                    ...existing,
                    metrics: JSON.stringify(updatedMetrics),
                    updatedAt: now,
                  });
                  return logMetricOk(input.run_id, updatedMetrics.length);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  pass: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('evaluation_run', input.run_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                passNotfound(`Evaluation run '${input.run_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'running') {
                return TE.right(
                  passInvalidStatus(
                    `Cannot pass: run is in '${status}' status, expected 'running'`,
                  ),
                );
              }
              const threshold = Number(existing['threshold'] ?? 0);
              if (input.score < threshold) {
                return TE.tryCatch(
                  async () => {
                    const now = new Date().toISOString();
                    await storage.put('evaluation_run', input.run_id, {
                      ...existing,
                      score: input.score,
                      status: 'failed',
                      reason: `Score ${input.score} is below threshold ${threshold}`,
                      updatedAt: now,
                    });
                    return passBelowThreshold(input.run_id, input.score, threshold);
                  },
                  toStorageError,
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('evaluation_run', input.run_id, {
                    ...existing,
                    score: input.score,
                    status: 'passed',
                    updatedAt: now,
                  });
                  return passOk(input.run_id, input.score);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  fail: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('evaluation_run', input.run_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                failNotfound(`Evaluation run '${input.run_id}' not found`),
              ),
            (existing) => {
              const status = String(existing['status']);
              if (status !== 'running') {
                return TE.right(
                  failInvalidStatus(
                    `Cannot fail: run is in '${status}' status, expected 'running'`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('evaluation_run', input.run_id, {
                    ...existing,
                    score: input.score,
                    status: 'failed',
                    reason: input.reason,
                    updatedAt: now,
                  });
                  return failOk(input.run_id, input.score, input.reason);
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  getResult: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('evaluation_run', input.run_id),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                getResultNotfound(`Evaluation run '${input.run_id}' not found`),
              ),
            (found) =>
              TE.right(
                getResultOk(
                  String(found['run_id']),
                  String(found['eval_name']),
                  String(found['status']),
                  Number(found['score'] ?? 0),
                  Number(found['threshold'] ?? 0),
                  String(found['metrics'] ?? '[]'),
                ),
              ),
          ),
        ),
      ),
    ),
};
