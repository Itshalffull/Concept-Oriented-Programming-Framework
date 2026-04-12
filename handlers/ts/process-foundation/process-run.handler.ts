// @clef-handler style=functional
// ProcessRun Concept Implementation
// Track the lifecycle of a running process instance from start to completion,
// failure, or cancellation, including parent-child relationships for subprocess nesting.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `run-${Date.now()}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'process-run', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'ProcessRun' }),
      (b) => {
        let b2 = put(b, 'process-run', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'ProcessRun' });
      },
    ) as StorageProgram<Result>;
  },

  start(input: Record<string, unknown>) {
    const specRef = input.spec_ref as string;
    const specVersion = input.spec_version as number;
    const inputData = input.input as string;

    if (!specRef || specRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'spec_ref is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, 'process-run', id, {
      id,
      spec_ref: specRef,
      spec_version: specVersion,
      status: 'running',
      parent_run: null,
      started_at: now,
      ended_at: null,
      input: inputData,
      output: null,
      error: null,
    });
    return complete(p, 'ok', { run: id, spec_ref: specRef }) as StorageProgram<Result>;
  },

  start_child(input: Record<string, unknown>) {
    const specRef = input.spec_ref as string;
    const specVersion = input.spec_version as number;
    const parentRun = input.parent_run as string;
    const inputData = input.input as string;

    if (!specRef || specRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'spec_ref is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, 'process-run', id, {
      id,
      spec_ref: specRef,
      spec_version: specVersion,
      status: 'running',
      parent_run: parentRun,
      started_at: now,
      ended_at: null,
      input: inputData,
      output: null,
      error: null,
    });
    return complete(p, 'ok', { run: id, parent_run: parentRun }) as StorageProgram<Result>;
  },

  complete(input: Record<string, unknown>) {
    const runId = input.run as string;
    const outputData = input.output as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'running') {
            return { run: runId };
          }
          return { run: runId };
        });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },

  fail(input: Record<string, unknown>) {
    const runId = input.run as string;
    const error = input.error as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'running') {
            return { run: runId };
          }
          return { run: runId, error };
        });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const runId = input.run as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-run', runId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'running' && status !== 'suspended') {
            return rec;
          }
          return { ...rec, status: 'cancelled', ended_at: new Date().toISOString() };
        });
        return complete(b2, 'ok', { run: runId });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },

  suspend(input: Record<string, unknown>) {
    const runId = input.run as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-run', runId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'running') {
            return rec;
          }
          return { ...rec, status: 'suspended' };
        });
        return complete(b2, 'ok', { run: runId });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },

  resume(input: Record<string, unknown>) {
    const runId = input.run as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-run', runId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'suspended') {
            return rec;
          }
          return { ...rec, status: 'running' };
        });
        return complete(b2, 'ok', { run: runId });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },

  get_status(input: Record<string, unknown>) {
    const runId = input.run as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            run: runId,
            status: rec.status as string,
            spec_ref: rec.spec_ref as string,
          };
        });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },

  replay(input: Record<string, unknown>) {
    const originalRunId = input.original_run as string;
    const startFromStep = (input.start_from_step as string | undefined) ?? null;

    if (!originalRunId || originalRunId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'original_run is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-run', originalRunId, 'existing');
    return branch(p, 'existing',
      (b) => {
        // Check that the source run is in a terminal state
        const checkTerminal = (bindings: Record<string, unknown>): boolean => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          return status === 'completed' || status === 'failed' || status === 'cancelled';
        };
        return branch(b,
          checkTerminal,
          (b2) => {
            // Terminal — create a new run with same spec/input
            const newId = nextId();
            const now = new Date().toISOString();
            let b3 = putFrom(b2, 'process-run', newId, (bindings) => {
              const rec = bindings.existing as Record<string, unknown>;
              return {
                id: newId,
                spec_ref: rec.spec_ref,
                spec_version: rec.spec_version,
                status: 'running',
                parent_run: null,
                started_at: now,
                ended_at: null,
                input: rec.input,
                output: null,
                error: null,
                principal: null,
                run_context: null,
              };
            });
            return complete(b3, 'ok', { run: newId });
          },
          (b2) => complete(b2, 'not_terminal', { run: originalRunId }),
        );
      },
      (b) => complete(b, 'error', { message: `run ${originalRunId} not found` }),
    ) as StorageProgram<Result>;
  },

  attachContext(input: Record<string, unknown>) {
    const runId = input.run as string;
    const principal = input.principal as string;
    const context = input.context as string;

    if (!principal || principal.trim() === '') {
      return complete(createProgram(), 'error', { message: 'principal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-run', runId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, principal, run_context: context };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'not_found', { message: `run ${runId} not found` }),
    ) as StorageProgram<Result>;
  },
};

// Rebuild complete and fail with proper storage writes
const handler: FunctionalConceptHandler = {
  ..._handler,

  complete(input: Record<string, unknown>) {
    const runId = input.run as string;
    const outputData = input.output as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-run', runId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'running') {
            return rec;
          }
          return { ...rec, status: 'completed', ended_at: new Date().toISOString(), output: outputData };
        });
        return complete(b2, 'ok', { run: runId });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },

  fail(input: Record<string, unknown>) {
    const runId = input.run as string;
    const error = input.error as string;
    let p = createProgram();
    p = get(p, 'process-run', runId, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-run', runId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'running') {
            return rec;
          }
          return { ...rec, status: 'failed', ended_at: new Date().toISOString(), error };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const status = rec.status as string;
          if (status !== 'running') {
            return { run: runId };
          }
          return { run: runId, error };
        });
      },
      (b) => complete(b, 'not_found', { run: runId }),
    ) as StorageProgram<Result>;
  },
};

export const processRunHandler = autoInterpret(handler);
