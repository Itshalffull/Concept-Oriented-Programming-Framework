// @clef-handler style=functional
// Timer Concept Implementation
// Introduce time-based triggers into process execution: absolute dates,
// relative durations, and recurring cycles.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * Compute the next fire time from an ISO 8601 specification.
 * For 'date' type: the spec is the fire time itself.
 * For 'duration' type: add duration to now.
 * For 'cycle' type: add one period to now (or to the provided base time).
 */
function computeNextFireAt(timerType: string, specification: string, baseTime?: string): string | null {
  try {
    if (timerType === 'date') {
      const d = new Date(specification);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    }
    // For duration and cycle, parse ISO 8601 duration (simplified: PTnHnMnS, PnD, PnW, etc.)
    const base = baseTime ? new Date(baseTime) : new Date();
    const match = specification.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!match) return null;
    const [, years, months, weeks, days, hours, minutes, seconds] = match;
    const result = new Date(base);
    if (years) result.setFullYear(result.getFullYear() + parseInt(years));
    if (months) result.setMonth(result.getMonth() + parseInt(months));
    if (weeks) result.setDate(result.getDate() + parseInt(weeks) * 7);
    if (days) result.setDate(result.getDate() + parseInt(days));
    if (hours) result.setHours(result.getHours() + parseInt(hours));
    if (minutes) result.setMinutes(result.getMinutes() + parseInt(minutes));
    if (seconds) result.setSeconds(result.getSeconds() + parseInt(seconds));
    return result.toISOString();
  } catch {
    return null;
  }
}

const _timerHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Timer' }) as StorageProgram<Result>;
  },

  set_timer(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const timerType = input.timer_type as string;
    const specification = input.specification as string;
    const purposeTag = input.purpose_tag as string;
    const contextRef = input.context_ref as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const nextFireAt = computeNextFireAt(timerType, specification);
    if (!nextFireAt) {
      return complete(createProgram(), 'ok', { specification }) as StorageProgram<Result>;
    }

    const timerId = `timer-${runRef}-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'timer', timerId, {
      timer: timerId,
      run_ref: runRef,
      purpose_tag: purposeTag,
      timer_type: timerType,
      specification,
      status: 'active',
      fire_count: 0,
      next_fire_at: nextFireAt,
      context_ref: contextRef || null,
    });
    return complete(p, 'ok', { timer: timerId, run_ref: runRef, next_fire_at: nextFireAt }) as StorageProgram<Result>;
  },

  fire(input: Record<string, unknown>) {
    const timer = input.timer as string;

    let p = createProgram();
    p = spGet(p, 'timer', timer, 'existing');

    return branch(p,
      (bindings) => {
        const rec = bindings.existing as Record<string, unknown> | null;
        return rec != null && rec.status === 'active';
      },
      (() => {
        let b = createProgram();
        b = putFrom(b, 'timer', timer, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const timerType = rec.timer_type as string;
          const specification = rec.specification as string;
          const fireCount = (rec.fire_count as number) + 1;

          if (timerType === 'cycle') {
            // Cycle timers remain active and compute next fire time
            const nextFireAt = computeNextFireAt('duration', specification);
            return {
              ...rec,
              status: 'active',
              fire_count: fireCount,
              next_fire_at: nextFireAt,
            };
          }
          // Date and duration timers transition to fired
          return {
            ...rec,
            status: 'fired',
            fire_count: fireCount,
            next_fire_at: null,
          };
        });
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            timer,
            run_ref: rec.run_ref as string,
            purpose_tag: rec.purpose_tag as string,
            context_ref: (rec.context_ref as string) || '',
          };
        });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { timer });
      })(),
    ) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const timer = input.timer as string;

    let p = createProgram();
    p = spGet(p, 'timer', timer, 'existing');

    return branch(p,
      (bindings) => {
        const rec = bindings.existing as Record<string, unknown> | null;
        return rec != null && rec.status === 'active';
      },
      (() => {
        let b = createProgram();
        b = putFrom(b, 'timer', timer, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            status: 'cancelled',
            next_fire_at: null,
          };
        });
        return complete(b, 'ok', { timer });
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { timer });
      })(),
    ) as StorageProgram<Result>;
  },

  reset(input: Record<string, unknown>) {
    const timer = input.timer as string;
    const specification = input.specification as string;

    let p = createProgram();
    p = spGet(p, 'timer', timer, 'existing');

    return branch(p,
      (bindings) => bindings.existing != null,
      (() => {
        let b = createProgram();
        b = putFrom(b, 'timer', timer, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const timerType = rec.timer_type as string;
          const nextFireAt = computeNextFireAt(timerType, specification);
          return {
            ...rec,
            specification,
            status: 'active',
            next_fire_at: nextFireAt,
          };
        });
        b = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const timerType = rec.timer_type as string;
          return computeNextFireAt(timerType, specification) || '';
        }, 'computedNextFire');
        return completeFrom(b, 'ok', (bindings) => ({
          timer,
          next_fire_at: bindings.computedNextFire as string,
        }));
      })(),
      (() => {
        const b = createProgram();
        return complete(b, 'ok', { timer });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const timerHandler = autoInterpret(_timerHandler);
