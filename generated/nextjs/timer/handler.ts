// Timer — Time-based triggers for process execution.
// Supports date, duration, and cycle timer types.
// Status lifecycle: set -> active -> fired | cancelled.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TimerStorage,
  TimerStatus,
  TimerType,
  TimerSetTimerInput,
  TimerSetTimerOutput,
  TimerFireInput,
  TimerFireOutput,
  TimerCancelInput,
  TimerCancelOutput,
  TimerResetInput,
  TimerResetOutput,
} from './types.js';

import {
  setTimerOk,
  setTimerInvalidSpec,
  fireOk,
  fireNotActive,
  cancelOk,
  cancelNotActive,
  resetOk,
  resetNotFound,
} from './types.js';

export interface TimerError {
  readonly code: string;
  readonly message: string;
}

export interface TimerHandler {
  readonly set_timer: (input: TimerSetTimerInput, storage: TimerStorage) => TE.TaskEither<TimerError, TimerSetTimerOutput>;
  readonly fire: (input: TimerFireInput, storage: TimerStorage) => TE.TaskEither<TimerError, TimerFireOutput>;
  readonly cancel: (input: TimerCancelInput, storage: TimerStorage) => TE.TaskEither<TimerError, TimerCancelOutput>;
  readonly reset: (input: TimerResetInput, storage: TimerStorage) => TE.TaskEither<TimerError, TimerResetOutput>;
}

const storageError = (error: unknown): TimerError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/**
 * Compute the next fire time from a specification and timer type.
 * - date: ISO 8601 absolute date string (e.g., "2025-12-31T23:59:59Z")
 * - duration: ISO 8601 duration string (e.g., "PT30M", "P1D")
 * - cycle: ISO 8601 duration used as a repeating interval
 * Returns null if the specification cannot be parsed.
 */
const computeNextFireAt = (timer_type: TimerType, specification: string): string | null => {
  if (timer_type === 'date') {
    const d = new Date(specification);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  // Parse ISO 8601 duration for duration and cycle types
  const match = specification.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );
  if (!match) return null;

  const days = parseInt(match[1] ?? '0', 10);
  const hours = parseInt(match[2] ?? '0', 10);
  const minutes = parseInt(match[3] ?? '0', 10);
  const seconds = parseInt(match[4] ?? '0', 10);

  if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) return null;

  const totalMs =
    ((days * 24 + hours) * 60 + minutes) * 60 * 1000 +
    seconds * 1000;

  return new Date(Date.now() + totalMs).toISOString();
};

let timerCounter = 0;
const generateTimerId = (): string => `timer-${Date.now()}-${++timerCounter}`;

export const timerHandler: TimerHandler = {
  /**
   * Create a timer. Computes next_fire_at from the specification.
   * Timer starts in active status immediately.
   */
  set_timer: (input, storage) => {
    const next_fire_at = computeNextFireAt(input.timer_type, input.specification);
    if (next_fire_at === null) {
      return TE.right(setTimerInvalidSpec(input.specification) as TimerSetTimerOutput);
    }

    const timer_id = generateTimerId();
    return TE.tryCatch(
      async () => {
        const now = new Date().toISOString();
        await storage.put('timers', timer_id, {
          timer_id,
          run_ref: input.run_ref,
          purpose_tag: input.purpose_tag,
          timer_type: input.timer_type,
          specification: input.specification,
          status: 'active' as TimerStatus,
          fire_count: 0,
          next_fire_at,
          context_ref: input.context_ref,
          created_at: now,
          updated_at: now,
        });
        return setTimerOk(timer_id, input.run_ref, next_fire_at) as TimerSetTimerOutput;
      },
      storageError,
    );
  },

  /**
   * Fire a timer. Increments fire_count. For cycle timers, computes next_fire_at
   * and remains active. For date/duration timers, transitions to fired.
   */
  fire: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('timers', input.timer_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(fireNotActive(input.timer_id) as TimerFireOutput),
            (timer) => {
              if (timer.status !== 'active') {
                return TE.right(fireNotActive(input.timer_id) as TimerFireOutput);
              }
              return TE.tryCatch(async () => {
                const newFireCount = (timer.fire_count as number) + 1;
                const timerType = timer.timer_type as TimerType;

                if (timerType === 'cycle') {
                  // Cycle timers remain active, compute next fire time
                  const nextFire = computeNextFireAt('duration', timer.specification as string);
                  await storage.put('timers', input.timer_id, {
                    ...timer,
                    fire_count: newFireCount,
                    next_fire_at: nextFire,
                    last_fired_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                } else {
                  // Date/duration timers transition to fired
                  await storage.put('timers', input.timer_id, {
                    ...timer,
                    status: 'fired' as TimerStatus,
                    fire_count: newFireCount,
                    next_fire_at: null,
                    last_fired_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                }

                return fireOk(
                  input.timer_id,
                  timer.run_ref as string,
                  timer.purpose_tag as string,
                  timer.context_ref as string,
                ) as TimerFireOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  /**
   * Cancel an active timer. Transitions to cancelled.
   */
  cancel: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('timers', input.timer_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(cancelNotActive(input.timer_id) as TimerCancelOutput),
            (timer) => {
              if (timer.status !== 'active') {
                return TE.right(cancelNotActive(input.timer_id) as TimerCancelOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('timers', input.timer_id, {
                  ...timer,
                  status: 'cancelled' as TimerStatus,
                  next_fire_at: null,
                  cancelled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return cancelOk(input.timer_id) as TimerCancelOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),

  /**
   * Reset a timer with a new specification. Works on active or fired timers.
   * Reactivates the timer with a new next_fire_at.
   */
  reset: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('timers', input.timer_id),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resetNotFound(input.timer_id) as TimerResetOutput),
            (timer) => {
              const timerType = timer.timer_type as TimerType;
              const nextFire = computeNextFireAt(
                timerType === 'cycle' ? 'duration' : timerType,
                input.specification,
              );
              if (nextFire === null) {
                return TE.right(resetNotFound(input.timer_id) as TimerResetOutput);
              }
              return TE.tryCatch(async () => {
                await storage.put('timers', input.timer_id, {
                  ...timer,
                  status: 'active' as TimerStatus,
                  specification: input.specification,
                  next_fire_at: nextFire,
                  fire_count: timer.fire_count as number,
                  updated_at: new Date().toISOString(),
                });
                return resetOk(input.timer_id, nextFire) as TimerResetOutput;
              }, storageError);
            },
          ),
        ),
      ),
    ),
};
