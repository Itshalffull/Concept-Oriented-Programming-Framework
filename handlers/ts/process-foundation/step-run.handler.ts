// @clef-handler style=functional
// StepRun Concept Implementation
// Track per-step execution state within a process run, including
// step type dispatch, attempt counting, and input/output capture.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom, putFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `step-${Date.now()}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'step-run', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'StepRun' }),
      (b) => {
        let b2 = put(b, 'step-run', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'StepRun' });
      },
    ) as StorageProgram<Result>;
  },

  start(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const stepKey = input.step_key as string;
    const stepType = input.step_type as string;
    const inputData = input.input as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    // Check for existing active step with same run_ref+step_key
    const compositeKey = `${runRef}:${stepKey}`;
    let p = createProgram();
    p = get(p, 'step-run-index', compositeKey, 'existingIndex');
    return branch(p, 'existingIndex',
      (b) => {
        // Check if the existing step is failed (retry scenario) or still active
        return completeFrom(b, 'ok', (bindings) => {
          const idx = bindings.existingIndex as Record<string, unknown>;
          const existingStatus = idx.status as string;
          if (existingStatus === 'active') {
            // Already active, return existing step
            return { step: idx.step_id as string };
          }
          // Failed step - would be a retry, but return new step
          return { step: idx.step_id as string, run_ref: runRef, step_key: stepKey, step_type: stepType };
        });
      },
      (b) => {
        const id = nextId();
        const now = new Date().toISOString();
        let b2 = put(b, 'step-run', id, {
          id,
          run_ref: runRef,
          step_key: stepKey,
          step_type: stepType,
          status: 'active',
          attempt: 1,
          input: inputData,
          output: null,
          error: null,
          started_at: now,
          ended_at: null,
        });
        b2 = put(b2, 'step-run-index', compositeKey, {
          step_id: id,
          status: 'active',
        });
        return complete(b2, 'ok', { step: id, run_ref: runRef, step_key: stepKey, step_type: stepType });
      },
    ) as StorageProgram<Result>;
  },

  complete(input: Record<string, unknown>) {
    const stepId = input.step as string;
    const outputData = input.output as string;
    let p = createProgram();
    p = get(p, 'step-run', stepId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'step-run', stepId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'active') {
            return rec;
          }
          return {
            ...rec,
            status: 'completed',
            output: outputData,
            ended_at: new Date().toISOString(),
          };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'active') {
            return { step: stepId };
          }
          return {
            step: stepId,
            run_ref: rec.run_ref as string,
            step_key: rec.step_key as string,
            output: outputData,
          };
        });
      },
      (b) => complete(b, 'not_found', { step: stepId }),
    ) as StorageProgram<Result>;
  },

  fail(input: Record<string, unknown>) {
    const stepId = input.step as string;
    const error = input.error as string;

    if (!error || error.trim() === '') {
      return complete(createProgram(), 'error', { message: 'error is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'step-run', stepId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'step-run', stepId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'active') {
            return rec;
          }
          return {
            ...rec,
            status: 'failed',
            error,
            ended_at: new Date().toISOString(),
          };
        });
        return completeFrom(b2, 'error', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'active') {
            return { step: stepId, run_ref: '', step_key: '', message: 'Step is not in active status' };
          }
          return {
            step: stepId,
            run_ref: rec.run_ref as string,
            step_key: rec.step_key as string,
            message: error,
          };
        });
      },
      (b) => complete(b, 'not_found', { step: stepId }),
    ) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const stepId = input.step as string;
    let p = createProgram();
    p = get(p, 'step-run', stepId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'step-run', stepId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'active' && status !== 'pending') {
            return rec;
          }
          return { ...rec, status: 'cancelled', ended_at: new Date().toISOString() };
        });
        return complete(b2, 'ok', { step: stepId });
      },
      (b) => complete(b, 'not_found', { step: stepId }),
    ) as StorageProgram<Result>;
  },

  skip(input: Record<string, unknown>) {
    const stepId = input.step as string;
    let p = createProgram();
    p = get(p, 'step-run', stepId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'step-run', stepId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'pending') {
            return rec;
          }
          return { ...rec, status: 'skipped', ended_at: new Date().toISOString() };
        });
        return complete(b2, 'ok', { step: stepId });
      },
      (b) => complete(b, 'not_found', { step: stepId }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const stepId = input.step as string;
    let p = createProgram();
    p = get(p, 'step-run', stepId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            step: stepId,
            run_ref: rec.run_ref as string,
            step_key: rec.step_key as string,
            status: rec.status as string,
            attempt: rec.attempt as number,
          };
        });
      },
      (b) => complete(b, 'not_found', { step: stepId }),
    ) as StorageProgram<Result>;
  },
};

export const stepRunHandler = autoInterpret(_handler);
