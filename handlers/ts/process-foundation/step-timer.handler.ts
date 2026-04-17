// @clef-handler style=functional
// StepTimer Concept Implementation
// Watch active StepRuns that have a timeout set and complete them
// with timed_out when their deadline has passed. Decouples timeout
// enforcement from StepRun and ProcessSpec.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, del, branch, complete, completeFrom, putFrom,
  mapBindings, traverse,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `timer-${Date.now()}-${++idCounter}`;
}

/** Returns true if the string is a non-empty, parseable ISO datetime. */
function isValidIso(deadline: string): boolean {
  if (!deadline || deadline.trim() === '') return false;
  const d = new Date(deadline);
  return !isNaN(d.getTime());
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

  arm(input: Record<string, unknown>) {
    const stepRef = toString(input.step_ref);
    const deadline = toString(input.deadline);

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }
    if (!isValidIso(deadline)) {
      return complete(createProgram(), 'error', { message: 'deadline must be a valid ISO datetime' }) as StorageProgram<Result>;
    }

    // Use step_ref as the index key for O(1) lookup
    let p = createProgram();
    p = get(p, 'step-timer-by-ref', stepRef, 'existingTimer');

    return branch(p, 'existingTimer',
      // An unfired timer for this step_ref already exists — return it idempotently
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existingTimer as Record<string, unknown>;
        return { timer: existing.timer_id as string, step_ref: stepRef };
      }),
      // No existing timer — create a new one
      (b) => {
        const id = nextId();
        let b2 = put(b, 'step-timer', id, {
          id,
          step_ref: stepRef,
          deadline,
          fired: false,
        });
        // Write a step_ref → timer_id index entry for disarm and idempotent arm
        b2 = put(b2, 'step-timer-by-ref', stepRef, {
          timer_id: id,
          step_ref: stepRef,
          fired: false,
        });
        return complete(b2, 'ok', { timer: id, step_ref: stepRef });
      },
    ) as StorageProgram<Result>;
  },

  fire(input: Record<string, unknown>) {
    const timerId = input.timer as string;

    let p = createProgram();
    p = get(p, 'step-timer', timerId, 'existing');

    return branch(p, 'existing',
      (b) => {
        // Mark as fired — idempotent if already fired
        const b2 = putFrom(b, 'step-timer', timerId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          if (rec.fired) return rec as Record<string, unknown>;
          return { ...rec, fired: true } as Record<string, unknown>;
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { timer: timerId, step_ref: rec.step_ref as string };
        });
      },
      (b) => complete(b, 'not_found', { message: `No timer found with id: ${timerId}` }),
    ) as StorageProgram<Result>;
  },

  tick(_input: Record<string, unknown>) {
    const now = new Date().toISOString();

    let p = createProgram();
    // Find all unfired timer records (excluding the sentinel __registered record)
    p = find(p, 'step-timer', { fired: false }, 'unfired');

    // Filter to those whose deadline <= now (i.e. deadline has passed)
    p = mapBindings(p, (bindings) => {
      const unfired = (bindings.unfired || []) as Array<Record<string, unknown>>;
      return unfired.filter((r) => {
        if (!r.deadline) return false;
        return (r.deadline as string) <= now;
      });
    }, 'expired');

    // For each expired timer, mark fired=true and complete with the timer info
    p = traverse(p, 'expired', '_timer', (item) => {
      const entry = item as Record<string, unknown>;
      const timerId = entry.id as string;
      let sub = createProgram();
      // Mark the timer record as fired
      sub = put(sub, 'step-timer', timerId, { ...entry, fired: true } as Record<string, unknown>);
      return complete(sub, 'ok', { timer: timerId, step_ref: entry.step_ref as string });
    }, '_fired', {
      writes: ['step-timer'],
      completionVariants: ['ok'],
    });

    return completeFrom(p, 'ok', (bindings) => {
      const fired = (bindings._fired || []) as unknown[];
      return { fired_count: fired.length };
    }) as StorageProgram<Result>;
  },

  disarm(input: Record<string, unknown>) {
    const stepRef = toString(input.step_ref);

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }

    // Look up the timer by step_ref using the index
    let p = createProgram();
    p = get(p, 'step-timer-by-ref', stepRef, 'found');

    return branch(p, 'found',
      (b) => {
        // Delete the timer record and the index entry
        return completeFrom(b, 'ok', (bindings) => {
          const found = bindings.found as Record<string, unknown>;
          const timerId = found.timer_id as string;
          void timerId; // timerId used in del calls below
          return {};
        });
      },
      // No timer for this step_ref — silently succeed (idempotent)
      (b) => complete(b, 'ok', {}),
    ) as StorageProgram<Result>;
  },
};

// Override disarm to actually issue del instructions within the branch.
// We use completeFrom + a separate traversal pattern to get the timer ID
// from bindings before calling del. The technique: bind the found record
// via mapBindings into a list, then traverse that single-element list
// with del calls inside the body.
const finalHandler: FunctionalConceptHandler = {
  ...handler,

  disarm(input: Record<string, unknown>) {
    const stepRef = toString(input.step_ref);

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'step-timer-by-ref', stepRef, 'found');

    // Convert the found record into a 0-or-1 element list for traverse
    p = mapBindings(p, (bindings) => {
      const found = bindings.found as Record<string, unknown> | null;
      return found ? [found] : [];
    }, 'toDelete');

    // Traverse the list (0 or 1 items) and delete each timer + index entry
    p = traverse(p, 'toDelete', '_entry', (item) => {
      const entry = item as Record<string, unknown>;
      const timerId = entry.timer_id as string;
      let sub = createProgram();
      sub = del(sub, 'step-timer', timerId);
      sub = del(sub, 'step-timer-by-ref', stepRef);
      return complete(sub, 'ok', {});
    }, '_deleted', {
      writes: ['step-timer', 'step-timer-by-ref'],
      completionVariants: ['ok'],
    });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },
};

export const stepTimerHandler = autoInterpret(finalHandler);
