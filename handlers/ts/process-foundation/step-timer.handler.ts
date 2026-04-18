// @clef-handler style=functional
// StepTimer Concept Implementation
// Schedule and fire timeout completions for timed process steps.
// Parses ISO 8601 durations, computes deadlines, and fires timed_out signals.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, del, branch, complete, completeFrom,
  mapBindings, traverse,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `timer-${Date.now()}-${++idCounter}`;
}

/**
 * Parse an ISO 8601 duration string and return the number of milliseconds.
 * Supports common forms: PTxS, PTxM, PTxH, PxDTxHxMxS, P1D, etc.
 * Returns null for unrecognised formats.
 */
function parseIso8601Duration(duration: string): number | null {
  if (!duration || typeof duration !== 'string') return null;

  // ISO 8601 duration regex: P[n]Y[n]M[n]DT[n]H[n]M[n]S
  const re = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
  const match = re.exec(duration);
  if (!match) return null;

  const [, years, months, weeks, days, hours, minutes, seconds] = match;

  // All components are optional — check that at least one is present
  if (!years && !months && !weeks && !days && !hours && !minutes && !seconds) return null;

  const ms =
    (parseFloat(years   || '0') * 365.25 * 24 * 3600 * 1000) +
    (parseFloat(months  || '0') * 30.44  * 24 * 3600 * 1000) +
    (parseFloat(weeks   || '0') * 7      * 24 * 3600 * 1000) +
    (parseFloat(days    || '0') *          24 * 3600 * 1000) +
    (parseFloat(hours   || '0') *               3600 * 1000) +
    (parseFloat(minutes || '0') *                 60 * 1000) +
    (parseFloat(seconds || '0') *                      1000);

  return ms;
}

/** Add an ISO 8601 duration to an ISO datetime string and return the result. */
function addDuration(startedAt: string, durationMs: number): string | null {
  const d = new Date(startedAt);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + durationMs).toISOString();
}

/** Coerce an input value to a string safely. */
function toString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

const handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'step-timer', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'StepTimer' }),
      (b) => {
        const b2 = put(b, 'step-timer', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'StepTimer' });
      },
    ) as StorageProgram<Result>;
  },

  // register(stepRunId, startedAt, timeout) -> ok(stepRunId, deadline) | already_registered | invalid_duration
  // We shadow the PluginRegistry `register` with this method name; the PluginRegistry
  // register is handled above. The concept action named "register" is routed here.
  // NOTE: Because both PluginRegistry and the concept action are named "register",
  // the handler exports a single `register` method. We use the presence of `input.stepRunId`
  // to distinguish the concept action call from the no-arg PluginRegistry call.
};

// Build the final handler with all concept actions implemented.
const finalHandler: FunctionalConceptHandler = {
  // PluginRegistry self-registration (no-arg call, no stepRunId present)
  register(input: Record<string, unknown>) {
    if (!input.stepRunId) {
      // PluginRegistry registration — return static metadata
      let p = createProgram();
      p = get(p, 'step-timer', '__registered', 'existing');
      return branch(p, 'existing',
        (b) => complete(b, 'ok', { name: 'StepTimer' }),
        (b) => {
          const b2 = put(b, 'step-timer', '__registered', { value: true });
          return complete(b2, 'ok', { name: 'StepTimer' });
        },
      ) as StorageProgram<Result>;
    }

    // Concept action: register(stepRunId, startedAt, timeout)
    const stepRunId = toString(input.stepRunId);
    const startedAt  = toString(input.startedAt);
    const timeout    = toString(input.timeout);

    if (!stepRunId || stepRunId.trim() === '') {
      return complete(createProgram(), 'invalid_duration', { message: 'stepRunId is required' }) as StorageProgram<Result>;
    }

    const durationMs = parseIso8601Duration(timeout);
    if (durationMs === null) {
      return complete(createProgram(), 'invalid_duration', {
        message: `Unrecognised ISO 8601 duration: "${timeout}". Supported forms: PT30S, PT5M, PT2H, P1D.`,
      }) as StorageProgram<Result>;
    }

    const deadline = addDuration(startedAt, durationMs);
    if (!deadline) {
      return complete(createProgram(), 'invalid_duration', {
        message: `Invalid startedAt datetime: "${startedAt}".`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Check for duplicate registration by stepRunId
    p = get(p, 'step-timer-by-run', stepRunId, 'existing');

    return branch(p, 'existing',
      // Timer for this stepRunId already exists
      (b) => complete(b, 'already_registered', { stepRunId }),
      // No existing timer — create a new one
      (b) => {
        const id = nextId();
        let b2 = put(b, 'step-timer', id, {
          id,
          stepRunId,
          deadline,
          fired: false,
        });
        // Secondary index: stepRunId → timer record for O(1) lookup
        b2 = put(b2, 'step-timer-by-run', stepRunId, {
          timer_id: id,
          stepRunId,
          deadline,
          fired: false,
        });
        return complete(b2, 'ok', { stepRunId, deadline });
      },
    ) as StorageProgram<Result>;
  },

  // tick(now) -> ok(fired: list String) | noop
  tick(input: Record<string, unknown>) {
    const now = toString(input.now);

    let p = createProgram();
    // Find all unfired timers (sentinel __registered record is never fired=false with a real deadline)
    p = find(p, 'step-timer', { fired: false }, 'unfired');

    // Filter: deadline <= now, and exclude the sentinel record (no stepRunId)
    p = mapBindings(p, (bindings) => {
      const unfired = (bindings.unfired || []) as Array<Record<string, unknown>>;
      return unfired.filter((r) => {
        if (!r.stepRunId || !r.deadline) return false; // skip sentinel
        if (!now) return false;
        return (r.deadline as string) <= now;
      });
    }, 'expired');

    // If nothing expired, return noop — but we still need to check the count
    // We do this by checking after mapBindings via a second mapBindings pass
    // that converts the array into a count, then branch on that.
    p = mapBindings(p, (bindings) => {
      const expired = (bindings.expired || []) as unknown[];
      return expired.length;
    }, '_expiredCount');

    return branch(p, '_expiredCount',
      // Branch condition: count > 0
      (b) => {
        // Mark each expired timer as fired and collect their stepRunIds
        let b2 = traverse(b, 'expired', '_timer', (item) => {
          const entry = item as Record<string, unknown>;
          const timerId = entry.id as string;
          const stepRunId = entry.stepRunId as string;
          let sub = createProgram();
          // Update the main timer record
          sub = put(sub, 'step-timer', timerId, { ...entry, fired: true } as Record<string, unknown>);
          // Update the secondary index too
          sub = put(sub, 'step-timer-by-run', stepRunId, { ...entry, fired: true } as Record<string, unknown>);
          return complete(sub, 'ok', { stepRunId });
        }, '_fired', {
          writes: ['step-timer', 'step-timer-by-run'],
          completionVariants: ['ok'],
        });

        return completeFrom(b2, 'ok', (bindings) => {
          const fired = (bindings._fired || []) as Array<{ output?: { stepRunId?: string } }>;
          const firedIds = fired.map((r) => {
            const out = r?.output ?? (r as Record<string, unknown>);
            return (out as Record<string, unknown>).stepRunId as string;
          }).filter(Boolean);
          return { fired: firedIds };
        });
      },
      // count === 0 — no timers due
      (b) => complete(b, 'noop', {}),
    ) as StorageProgram<Result>;
  },

  // cancel(stepRunId) -> ok | not_found
  cancel(input: Record<string, unknown>) {
    const stepRunId = toString(input.stepRunId);

    if (!stepRunId || stepRunId.trim() === '') {
      return complete(createProgram(), 'not_found', { message: 'stepRunId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'step-timer-by-run', stepRunId, 'found');

    // Branch on the found record — truthy means a timer exists, falsy means not_found
    return branch(p, 'found',
      // Timer found — delete it and the secondary index entry
      (b) => {
        // Convert the found record into a single-element list for traverse-based delete
        let b2 = mapBindings(b, (bindings) => {
          const found = bindings.found as Record<string, unknown>;
          return [found];
        }, 'toDelete');

        b2 = traverse(b2, 'toDelete', '_entry', (item) => {
          const entry = item as Record<string, unknown>;
          const timerId = entry.timer_id as string;
          let sub = createProgram();
          sub = del(sub, 'step-timer', timerId);
          sub = del(sub, 'step-timer-by-run', stepRunId);
          return complete(sub, 'ok', {});
        }, '_deleted', {
          writes: ['step-timer', 'step-timer-by-run'],
          completionVariants: ['ok'],
        });

        return complete(b2, 'ok', {});
      },
      // No timer found for this stepRunId
      (b) => complete(b, 'not_found', { message: `No active timer for stepRunId: "${stepRunId}"` }),
    ) as StorageProgram<Result>;
  },
};

export const stepTimerHandler = autoInterpret(finalHandler);
