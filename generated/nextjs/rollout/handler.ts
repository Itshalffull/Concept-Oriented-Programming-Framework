// Rollout — Progressive rollout with canary/blue-green strategies, stage tracking, and rollback
// Manages rollout lifecycle: begin with strategy validation, advance through weight steps,
// pause/resume for observation periods, abort to roll back traffic.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RolloutStorage,
  RolloutBeginInput,
  RolloutBeginOutput,
  RolloutAdvanceInput,
  RolloutAdvanceOutput,
  RolloutPauseInput,
  RolloutPauseOutput,
  RolloutResumeInput,
  RolloutResumeOutput,
  RolloutAbortInput,
  RolloutAbortOutput,
  RolloutStatusInput,
  RolloutStatusOutput,
} from './types.js';

import {
  beginOk,
  beginInvalidStrategy,
  advanceOk,
  advanceComplete,
  advancePaused,
  pauseOk,
  resumeOk,
  abortOk,
  abortAlreadyComplete,
  statusOk,
} from './types.js';

export interface RolloutError {
  readonly code: string;
  readonly message: string;
}

export interface RolloutHandler {
  readonly begin: (
    input: RolloutBeginInput,
    storage: RolloutStorage,
  ) => TE.TaskEither<RolloutError, RolloutBeginOutput>;
  readonly advance: (
    input: RolloutAdvanceInput,
    storage: RolloutStorage,
  ) => TE.TaskEither<RolloutError, RolloutAdvanceOutput>;
  readonly pause: (
    input: RolloutPauseInput,
    storage: RolloutStorage,
  ) => TE.TaskEither<RolloutError, RolloutPauseOutput>;
  readonly resume: (
    input: RolloutResumeInput,
    storage: RolloutStorage,
  ) => TE.TaskEither<RolloutError, RolloutResumeOutput>;
  readonly abort: (
    input: RolloutAbortInput,
    storage: RolloutStorage,
  ) => TE.TaskEither<RolloutError, RolloutAbortOutput>;
  readonly status: (
    input: RolloutStatusInput,
    storage: RolloutStorage,
  ) => TE.TaskEither<RolloutError, RolloutStatusOutput>;
}

const VALID_STRATEGIES: readonly string[] = ['canary', 'blue-green', 'linear', 'exponential'];

const toError = (error: unknown): RolloutError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const rolloutHandler: RolloutHandler = {
  begin: (input, storage) => {
    // Validate the rollout strategy
    if (!VALID_STRATEGIES.includes(input.strategy)) {
      return TE.right(
        beginInvalidStrategy(
          `Strategy "${input.strategy}" is not supported. Valid: ${VALID_STRATEGIES.join(', ')}`,
        ),
      );
    }

    if (input.steps.length === 0) {
      return TE.right(
        beginInvalidStrategy('At least one rollout step is required'),
      );
    }

    const rolloutId = `rollout-${input.plan}-${Date.now().toString(36)}`;

    return pipe(
      TE.tryCatch(
        async () => {
          await storage.put('rollouts', rolloutId, {
            rollout: rolloutId,
            plan: input.plan,
            strategy: input.strategy,
            steps: input.steps,
            currentStep: 0,
            weight: 0,
            status: 'active',
            startedAt: new Date().toISOString(),
          });
          return beginOk(rolloutId);
        },
        toError,
      ),
    );
  },

  advance: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rollouts', input.rollout),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<RolloutError, RolloutAdvanceOutput>({
              code: 'ROLLOUT_NOT_FOUND',
              message: `Rollout ${input.rollout} does not exist`,
            }),
            (existing) => {
              const status = String((existing as Record<string, unknown>).status ?? '');

              // Cannot advance a paused rollout
              if (status === 'paused') {
                const reason = String((existing as Record<string, unknown>).pauseReason ?? 'Paused by operator');
                return TE.right<RolloutError, RolloutAdvanceOutput>(
                  advancePaused(input.rollout, reason),
                );
              }

              const steps = ((existing as Record<string, unknown>).steps as readonly string[] | undefined) ?? [];
              const currentStep = Number((existing as Record<string, unknown>).currentStep ?? 0);

              // Already at the end of all steps
              if (currentStep >= steps.length) {
                return TE.right<RolloutError, RolloutAdvanceOutput>(
                  advanceComplete(input.rollout),
                );
              }

              const nextStep = currentStep + 1;
              // Compute weight: linearly scale from 0 to 100 across steps
              const newWeight = Math.min(100, Math.round((nextStep / steps.length) * 100));

              return TE.tryCatch(
                async () => {
                  const isComplete = nextStep >= steps.length;
                  await storage.put('rollouts', input.rollout, {
                    ...existing,
                    currentStep: nextStep,
                    weight: newWeight,
                    status: isComplete ? 'complete' : 'active',
                    advancedAt: new Date().toISOString(),
                  });

                  if (isComplete) {
                    return advanceComplete(input.rollout);
                  }
                  return advanceOk(input.rollout, newWeight, nextStep);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  pause: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rollouts', input.rollout),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<RolloutError, RolloutPauseOutput>({
              code: 'ROLLOUT_NOT_FOUND',
              message: `Rollout ${input.rollout} does not exist`,
            }),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('rollouts', input.rollout, {
                    ...existing,
                    status: 'paused',
                    pauseReason: input.reason,
                    pausedAt: new Date().toISOString(),
                  });
                  return pauseOk(input.rollout);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  resume: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rollouts', input.rollout),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<RolloutError, RolloutResumeOutput>({
              code: 'ROLLOUT_NOT_FOUND',
              message: `Rollout ${input.rollout} does not exist`,
            }),
            (existing) => {
              const currentWeight = Number((existing as Record<string, unknown>).weight ?? 0);
              return TE.tryCatch(
                async () => {
                  await storage.put('rollouts', input.rollout, {
                    ...existing,
                    status: 'active',
                    pauseReason: undefined,
                    resumedAt: new Date().toISOString(),
                  });
                  return resumeOk(input.rollout, currentWeight);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  abort: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rollouts', input.rollout),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<RolloutError, RolloutAbortOutput>({
              code: 'ROLLOUT_NOT_FOUND',
              message: `Rollout ${input.rollout} does not exist`,
            }),
            (existing) => {
              const status = String((existing as Record<string, unknown>).status ?? '');

              if (status === 'complete') {
                return TE.right<RolloutError, RolloutAbortOutput>(
                  abortAlreadyComplete(input.rollout),
                );
              }

              return TE.tryCatch(
                async () => {
                  await storage.put('rollouts', input.rollout, {
                    ...existing,
                    status: 'aborted',
                    weight: 0,
                    abortedAt: new Date().toISOString(),
                  });
                  return abortOk(input.rollout);
                },
                toError,
              );
            },
          ),
        ),
      ),
    ),

  status: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rollouts', input.rollout),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.left<RolloutError, RolloutStatusOutput>({
              code: 'ROLLOUT_NOT_FOUND',
              message: `Rollout ${input.rollout} does not exist`,
            }),
            (existing) => {
              const step = Number((existing as Record<string, unknown>).currentStep ?? 0);
              const weight = Number((existing as Record<string, unknown>).weight ?? 0);
              const status = String((existing as Record<string, unknown>).status ?? 'unknown');
              const startedAt = String((existing as Record<string, unknown>).startedAt ?? new Date().toISOString());
              const elapsed = Date.now() - new Date(startedAt).getTime();

              return TE.right<RolloutError, RolloutStatusOutput>(
                statusOk(input.rollout, step, weight, status, elapsed),
              );
            },
          ),
        ),
      ),
    ),
};
