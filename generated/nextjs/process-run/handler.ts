// ProcessRun — Top-level process execution instance with parent-child relationships.
// Enforces the status lifecycle: pending -> running -> completed|failed|cancelled,
// with bidirectional running <-> suspended transitions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProcessRunStorage,
  ProcessRunStartInput,
  ProcessRunStartOutput,
  ProcessRunStartChildInput,
  ProcessRunStartChildOutput,
  ProcessRunCompleteInput,
  ProcessRunCompleteOutput,
  ProcessRunFailInput,
  ProcessRunFailOutput,
  ProcessRunCancelInput,
  ProcessRunCancelOutput,
  ProcessRunSuspendInput,
  ProcessRunSuspendOutput,
  ProcessRunResumeInput,
  ProcessRunResumeOutput,
  ProcessRunGetStatusInput,
  ProcessRunGetStatusOutput,
} from './types.js';

import {
  startOk,
  startAlreadyExists,
  startChildOk,
  startChildParentNotFound,
  startChildParentNotRunning,
  completeOk,
  completeNotFound,
  completeInvalidTransition,
  failOk,
  failNotFound,
  failInvalidTransition,
  cancelOk,
  cancelNotFound,
  cancelInvalidTransition,
  suspendOk,
  suspendNotFound,
  suspendInvalidTransition,
  resumeOk,
  resumeNotFound,
  resumeInvalidTransition,
  getStatusOk,
  getStatusNotFound,
} from './types.js';

export interface ProcessRunError {
  readonly code: string;
  readonly message: string;
}

export interface ProcessRunHandler {
  readonly start: (input: ProcessRunStartInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunStartOutput>;
  readonly startChild: (input: ProcessRunStartChildInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunStartChildOutput>;
  readonly complete: (input: ProcessRunCompleteInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunCompleteOutput>;
  readonly fail: (input: ProcessRunFailInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunFailOutput>;
  readonly cancel: (input: ProcessRunCancelInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunCancelOutput>;
  readonly suspend: (input: ProcessRunSuspendInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunSuspendOutput>;
  readonly resume: (input: ProcessRunResumeInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunResumeOutput>;
  readonly getStatus: (input: ProcessRunGetStatusInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunGetStatusOutput>;
  readonly get_status: (input: ProcessRunGetStatusInput, storage: ProcessRunStorage) => TE.TaskEither<ProcessRunError, ProcessRunGetStatusOutput>;
}

const storageError = (error: unknown): ProcessRunError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);

export const processRunHandler: ProcessRunHandler = {
  start: (input, storage) => {
    // Support both field naming conventions: spec_ref/input or spec_id/input_data
    const specRef = (input as any).spec_ref ?? (input as any).spec_id ?? '';
    const inputData = (input as any).input ?? (input as any).input_data ?? '';
    const runRef = (input as any).run_ref ?? `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return pipe(
      TE.tryCatch(
        () => storage.get('process_runs', runRef),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(async () => {
                const now = new Date().toISOString();
                const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await storage.put('process_runs', runId, {
                  run: runId,
                  run_ref: runId,
                  spec_ref: specRef,
                  spec_id: specRef,
                  status: 'running',
                  parent_run_ref: null,
                  input: inputData,
                  input_data: inputData,
                  output_data: null,
                  started_at: now,
                  updated_at: now,
                });
                return { variant: 'ok' as const, run: runId, spec_ref: specRef, status: 'running' } as any as ProcessRunStartOutput;
              }, storageError),
            () => TE.right(startAlreadyExists(runRef) as ProcessRunStartOutput),
          ),
        ),
      ),
    );
  },

  startChild: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_runs', input.parent_run_ref),
        storageError,
      ),
      TE.chain((parentRecord) =>
        pipe(
          O.fromNullable(parentRecord),
          O.fold(
            () => TE.right(startChildParentNotFound(input.parent_run_ref) as ProcessRunStartChildOutput),
            (parent) => {
              if (parent.status !== 'running') {
                return TE.right(
                  startChildParentNotRunning(input.parent_run_ref, parent.status as string) as ProcessRunStartChildOutput,
                );
              }
              return TE.tryCatch(async () => {
                const now = new Date().toISOString();
                await storage.put('process_runs', input.child_run_ref, {
                  run_ref: input.child_run_ref,
                  spec_id: input.spec_id,
                  status: 'running',
                  parent_run_ref: input.parent_run_ref,
                  input_data: input.input_data,
                  output_data: null,
                  started_at: now,
                  updated_at: now,
                });
                return startChildOk(input.child_run_ref, input.parent_run_ref, 'running') as ProcessRunStartChildOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  complete: (input, storage) => {
    const runId = (input as any).run ?? (input as any).run_ref ?? '';
    const outputData = (input as any).output ?? (input as any).output_data ?? '';

    return pipe(
      TE.tryCatch(
        () => storage.get('process_runs', runId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(completeNotFound(runId) as ProcessRunCompleteOutput),
            (rec) => {
              if (rec.status !== 'running') {
                return TE.right(completeInvalidTransition(runId, rec.status as string) as ProcessRunCompleteOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('process_runs', runId, {
                  ...rec,
                  status: 'completed',
                  output: outputData,
                  output_data: outputData,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return { variant: 'ok' as const, run: runId, status: 'completed' } as any as ProcessRunCompleteOutput;
              }, storageError);
            },
          ),
        ),
      ),
    );
  },

  fail: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_runs', input.run_ref),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(failNotFound(input.run_ref) as ProcessRunFailOutput),
            (run) => {
              if (run.status !== 'running') {
                return TE.right(failInvalidTransition(input.run_ref, run.status as string) as ProcessRunFailOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('process_runs', input.run_ref, {
                  ...run,
                  status: 'failed',
                  error_code: input.error_code,
                  error_message: input.error_message,
                  failed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return failOk(input.run_ref, 'failed') as ProcessRunFailOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  cancel: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_runs', input.run_ref),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(cancelNotFound(input.run_ref) as ProcessRunCancelOutput),
            (run) => {
              // Cancel is allowed from running or suspended states
              if (run.status !== 'running' && run.status !== 'suspended') {
                return TE.right(cancelInvalidTransition(input.run_ref, run.status as string) as ProcessRunCancelOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('process_runs', input.run_ref, {
                  ...run,
                  status: 'cancelled',
                  cancel_reason: input.reason,
                  cancelled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return cancelOk(input.run_ref, 'cancelled') as ProcessRunCancelOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  suspend: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_runs', input.run_ref),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(suspendNotFound(input.run_ref) as ProcessRunSuspendOutput),
            (run) => {
              if (run.status !== 'running') {
                return TE.right(suspendInvalidTransition(input.run_ref, run.status as string) as ProcessRunSuspendOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('process_runs', input.run_ref, {
                  ...run,
                  status: 'suspended',
                  suspend_reason: input.reason,
                  suspended_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return suspendOk(input.run_ref, 'suspended') as ProcessRunSuspendOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  resume: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('process_runs', input.run_ref),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resumeNotFound(input.run_ref) as ProcessRunResumeOutput),
            (run) => {
              if (run.status !== 'suspended') {
                return TE.right(resumeInvalidTransition(input.run_ref, run.status as string) as ProcessRunResumeOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('process_runs', input.run_ref, {
                  ...run,
                  status: 'running',
                  resumed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return resumeOk(input.run_ref, 'running') as ProcessRunResumeOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  getStatus: (input, storage) => {
    const runId = (input as any).run ?? (input as any).run_ref ?? '';
    return pipe(
      TE.tryCatch(
        () => storage.get('process_runs', runId),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getStatusNotFound(runId),
            (rec) => ({
              variant: 'ok' as const,
              run: runId,
              spec_ref: String(rec.spec_ref ?? rec.spec_id ?? ''),
              status: String(rec.status ?? ''),
            } as any),
          ),
        ),
      ),
    );
  },

  get_status: (input, storage) => {
    const runId = (input as any).run ?? (input as any).run_ref ?? '';
    return pipe(
      TE.tryCatch(
        () => storage.get('process_runs', runId),
        storageError,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getStatusNotFound(runId),
            (rec) => ({
              variant: 'ok' as const,
              run: runId,
              spec_ref: String(rec.spec_ref ?? rec.spec_id ?? ''),
              status: String(rec.status ?? ''),
            } as any),
          ),
        ),
      ),
    );
  },
};
