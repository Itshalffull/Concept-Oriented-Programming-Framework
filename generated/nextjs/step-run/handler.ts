// StepRun — Individual step execution within a process run.
// Enforces the status lifecycle: pending -> ready -> active -> completed|failed|cancelled|skipped.
// Terminal states (completed, failed, cancelled, skipped) cannot transition further.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  StepRunStorage,
  StepRunStartInput,
  StepRunStartOutput,
  StepRunCompleteInput,
  StepRunCompleteOutput,
  StepRunFailInput,
  StepRunFailOutput,
  StepRunCancelInput,
  StepRunCancelOutput,
  StepRunSkipInput,
  StepRunSkipOutput,
  StepRunGetInput,
  StepRunGetOutput,
} from './types.js';

import {
  startOk,
  startAlreadyActive,
  completeOk,
  completeNotFound,
  completeInvalidTransition,
  failOk,
  failNotFound,
  failInvalidTransition,
  cancelOk,
  cancelNotFound,
  cancelInvalidTransition,
  skipOk,
  skipNotFound,
  skipInvalidTransition,
  getOk,
  getNotFound,
} from './types.js';

export interface StepRunError {
  readonly code: string;
  readonly message: string;
}

export interface StepRunHandler {
  readonly start: (input: StepRunStartInput, storage: StepRunStorage) => TE.TaskEither<StepRunError, StepRunStartOutput>;
  readonly complete: (input: StepRunCompleteInput, storage: StepRunStorage) => TE.TaskEither<StepRunError, StepRunCompleteOutput>;
  readonly fail: (input: StepRunFailInput, storage: StepRunStorage) => TE.TaskEither<StepRunError, StepRunFailOutput>;
  readonly cancel: (input: StepRunCancelInput, storage: StepRunStorage) => TE.TaskEither<StepRunError, StepRunCancelOutput>;
  readonly skip: (input: StepRunSkipInput, storage: StepRunStorage) => TE.TaskEither<StepRunError, StepRunSkipOutput>;
  readonly get: (input: StepRunGetInput, storage: StepRunStorage) => TE.TaskEither<StepRunError, StepRunGetOutput>;
}

const storageError = (error: unknown): StepRunError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const generateStepRunId = (run_ref: string, step_id: string): string =>
  `${run_ref}::${step_id}`;

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled', 'skipped']);

export const stepRunHandler: StepRunHandler = {
  start: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('step_runs', generateStepRunId(input.run_ref, input.step_id)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(async () => {
                const stepRunId = generateStepRunId(input.run_ref, input.step_id);
                const now = new Date().toISOString();
                await storage.put('step_runs', stepRunId, {
                  step_run_id: stepRunId,
                  run_ref: input.run_ref,
                  step_id: input.step_id,
                  step_name: input.step_name,
                  status: 'active',
                  input_data: input.input_data,
                  output_data: null,
                  started_at: now,
                  updated_at: now,
                });
                return startOk(stepRunId, 'active') as StepRunStartOutput;
              }, storageError),
            (record) => {
              if (record.status === 'active') {
                return TE.right(startAlreadyActive(record.step_run_id as string) as StepRunStartOutput);
              }
              // If in a terminal state, allow restart by creating a new run
              if (TERMINAL_STATES.has(record.status as string)) {
                return TE.tryCatch(async () => {
                  const stepRunId = generateStepRunId(input.run_ref, input.step_id);
                  const now = new Date().toISOString();
                  await storage.put('step_runs', stepRunId, {
                    step_run_id: stepRunId,
                    run_ref: input.run_ref,
                    step_id: input.step_id,
                    step_name: input.step_name,
                    status: 'active',
                    input_data: input.input_data,
                    output_data: null,
                    started_at: now,
                    updated_at: now,
                  });
                  return startOk(stepRunId, 'active') as StepRunStartOutput;
                }, storageError);
              }
              return TE.right(startAlreadyActive(record.step_run_id as string) as StepRunStartOutput);
            },
          ),
        ),
      ),
    ),

  complete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('step_runs', input.step_run_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(completeNotFound(input.step_run_id) as StepRunCompleteOutput),
            (step) => {
              if (step.status !== 'active') {
                return TE.right(completeInvalidTransition(input.step_run_id, step.status as string) as StepRunCompleteOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('step_runs', input.step_run_id, {
                  ...step,
                  status: 'completed',
                  output_data: input.output_data,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return completeOk(input.step_run_id, 'completed') as StepRunCompleteOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  fail: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('step_runs', input.step_run_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(failNotFound(input.step_run_id) as StepRunFailOutput),
            (step) => {
              if (step.status !== 'active') {
                return TE.right(failInvalidTransition(input.step_run_id, step.status as string) as StepRunFailOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('step_runs', input.step_run_id, {
                  ...step,
                  status: 'failed',
                  error_code: input.error_code,
                  error_message: input.error_message,
                  failed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return failOk(input.step_run_id, 'failed') as StepRunFailOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  cancel: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('step_runs', input.step_run_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(cancelNotFound(input.step_run_id) as StepRunCancelOutput),
            (step) => {
              if (step.status !== 'active') {
                return TE.right(cancelInvalidTransition(input.step_run_id, step.status as string) as StepRunCancelOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('step_runs', input.step_run_id, {
                  ...step,
                  status: 'cancelled',
                  cancel_reason: input.reason,
                  cancelled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return cancelOk(input.step_run_id, 'cancelled') as StepRunCancelOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  skip: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('step_runs', input.step_run_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(skipNotFound(input.step_run_id) as StepRunSkipOutput),
            (step) => {
              // Skip is allowed from pending, ready, or active states
              if (TERMINAL_STATES.has(step.status as string)) {
                return TE.right(skipInvalidTransition(input.step_run_id, step.status as string) as StepRunSkipOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('step_runs', input.step_run_id, {
                  ...step,
                  status: 'skipped',
                  skip_reason: input.reason,
                  skipped_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return skipOk(input.step_run_id, 'skipped') as StepRunSkipOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('step_runs', input.step_run_id),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getNotFound(input.step_run_id),
            (step) =>
              getOk(
                step.step_run_id as string,
                step.run_ref as string,
                step.step_id as string,
                step.step_name as string,
                step.status as string,
                step.input_data as string,
                (step.output_data as string | null) ?? null,
              ),
          ),
        ),
      ),
    ),
};
