// CompensationPlan — Saga-style compensating actions for rollback.
// Compensations are registered as forward steps complete and executed in LIFO
// (reverse) order when triggered. Status lifecycle: dormant -> triggered -> executing -> completed | failed.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CompensationPlanStorage,
  CompensationPlanStatus,
  CompensationPlanRegisterInput,
  CompensationPlanRegisterOutput,
  CompensationPlanTriggerInput,
  CompensationPlanTriggerOutput,
  CompensationPlanExecuteNextInput,
  CompensationPlanExecuteNextOutput,
  CompensationPlanMarkFailedInput,
  CompensationPlanMarkFailedOutput,
} from './types.js';

import {
  registerOk,
  triggerOk,
  triggerEmpty,
  triggerAlreadyTriggered,
  executeNextOk,
  executeNextAllDone,
  executeNextNotFound,
  markFailedOk,
  markFailedNotFound,
} from './types.js';

export interface CompensationPlanError {
  readonly code: string;
  readonly message: string;
}

export interface CompensationPlanHandler {
  readonly register: (input: CompensationPlanRegisterInput, storage: CompensationPlanStorage) => TE.TaskEither<CompensationPlanError, CompensationPlanRegisterOutput>;
  readonly trigger: (input: CompensationPlanTriggerInput, storage: CompensationPlanStorage) => TE.TaskEither<CompensationPlanError, CompensationPlanTriggerOutput>;
  readonly execute_next: (input: CompensationPlanExecuteNextInput, storage: CompensationPlanStorage) => TE.TaskEither<CompensationPlanError, CompensationPlanExecuteNextOutput>;
  readonly mark_compensation_failed: (input: CompensationPlanMarkFailedInput, storage: CompensationPlanStorage) => TE.TaskEither<CompensationPlanError, CompensationPlanMarkFailedOutput>;
}

const storageError = (error: unknown): CompensationPlanError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export const compensationPlanHandler: CompensationPlanHandler = {
  /**
   * Register a compensating action for a step. Creates the plan if none exists
   * for this run_ref. Appends to the compensations list. The plan_id is keyed by run_ref.
   */
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compensation_plans', input.run_ref),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(async () => {
                const now = new Date().toISOString();
                const compensation = {
                  step_key: input.step_key,
                  action_descriptor: input.action_descriptor,
                  registered_at: now,
                };
                await storage.put('compensation_plans', input.run_ref, {
                  plan_id: input.run_ref,
                  run_ref: input.run_ref,
                  status: 'dormant' as CompensationPlanStatus,
                  compensations: [compensation],
                  current_index: -1,
                  created_at: now,
                  updated_at: now,
                });
                return registerOk(input.run_ref) as CompensationPlanRegisterOutput;
              }, storageError),
            (plan) =>
              TE.tryCatch(async () => {
                const compensations = (plan.compensations as Array<Record<string, unknown>>) ?? [];
                compensations.push({
                  step_key: input.step_key,
                  action_descriptor: input.action_descriptor,
                  registered_at: new Date().toISOString(),
                });
                await storage.put('compensation_plans', input.run_ref, {
                  ...plan,
                  compensations,
                  updated_at: new Date().toISOString(),
                });
                return registerOk(input.run_ref) as CompensationPlanRegisterOutput;
              }, storageError),
          ),
        ),
      ),
    ),

  /**
   * Begin compensation. Transitions from dormant to triggered.
   * Sets current_index to the last registered compensation (LIFO start).
   */
  trigger: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compensation_plans', input.run_ref),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(triggerEmpty(input.run_ref) as CompensationPlanTriggerOutput),
            (plan) => {
              const status = plan.status as CompensationPlanStatus;
              if (status !== 'dormant') {
                return TE.right(triggerAlreadyTriggered(input.run_ref) as CompensationPlanTriggerOutput);
              }
              const compensations = (plan.compensations as Array<Record<string, unknown>>) ?? [];
              if (compensations.length === 0) {
                return TE.right(triggerEmpty(input.run_ref) as CompensationPlanTriggerOutput);
              }
              return TE.tryCatch(async () => {
                const lastIndex = compensations.length - 1;
                await storage.put('compensation_plans', input.run_ref, {
                  ...plan,
                  status: 'triggered' as CompensationPlanStatus,
                  current_index: lastIndex,
                  triggered_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return triggerOk(input.run_ref) as CompensationPlanTriggerOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  /**
   * Return the next compensation to execute in LIFO (reverse) order.
   * Decrements current_index. When all compensations are done, transitions to completed.
   */
  execute_next: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compensation_plans', input.plan_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(executeNextNotFound(input.plan_id) as CompensationPlanExecuteNextOutput),
            (plan) => {
              const status = plan.status as CompensationPlanStatus;
              if (status !== 'triggered' && status !== 'executing') {
                return TE.right(executeNextNotFound(input.plan_id) as CompensationPlanExecuteNextOutput);
              }

              const currentIndex = plan.current_index as number;
              const compensations = (plan.compensations as Array<Record<string, unknown>>) ?? [];

              if (currentIndex < 0) {
                // All compensations executed
                return TE.tryCatch(async () => {
                  await storage.put('compensation_plans', input.plan_id, {
                    ...plan,
                    status: 'completed' as CompensationPlanStatus,
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                  return executeNextAllDone(input.plan_id) as CompensationPlanExecuteNextOutput;
                }, storageError);
              }

              const compensation = compensations[currentIndex];
              return TE.tryCatch(async () => {
                await storage.put('compensation_plans', input.plan_id, {
                  ...plan,
                  status: 'executing' as CompensationPlanStatus,
                  current_index: currentIndex - 1,
                  updated_at: new Date().toISOString(),
                });
                return executeNextOk(
                  input.plan_id,
                  compensation.step_key as string,
                  compensation.action_descriptor as string,
                ) as CompensationPlanExecuteNextOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  /**
   * Record that a compensating action failed. Transitions the plan to failed status.
   */
  mark_compensation_failed: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('compensation_plans', input.plan_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(markFailedNotFound(input.plan_id) as CompensationPlanMarkFailedOutput),
            (plan) =>
              TE.tryCatch(async () => {
                await storage.put('compensation_plans', input.plan_id, {
                  ...plan,
                  status: 'failed' as CompensationPlanStatus,
                  failed_step_key: input.step_key,
                  failure_error: input.error,
                  failed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return markFailedOk(input.plan_id) as CompensationPlanMarkFailedOutput;
              }, storageError),
          ),
        ),
      ),
    ),
};
