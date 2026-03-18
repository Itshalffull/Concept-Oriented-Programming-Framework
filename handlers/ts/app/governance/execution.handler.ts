// @migrated dsl-constructs 2026-03-18
// Execution Concept Handler
// Atomic action execution with rollback support.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _executionHandler: FunctionalConceptHandler = {
  schedule(input: Record<string, unknown>) {
    const id = `execution-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'execution', id, {
      id, sourceRef: input.sourceRef, actions: input.actions,
      executor: input.executor, status: 'Pending', scheduledAt: new Date().toISOString(),
    });
    return complete(p, 'scheduled', { execution: id }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const { execution } = input;
    let p = createProgram();
    p = get(p, 'execution', execution as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Completed', completedAt: new Date().toISOString() };
        }, 'updated');
        b2 = put(b2, 'execution', execution as string, {});
        return complete(b2, 'completed', { execution, result: 'success' });
      },
      (b) => complete(b, 'not_found', { execution }),
    );

    return p as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const { execution, reason } = input;
    let p = createProgram();
    p = get(p, 'execution', execution as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Rolled_Back', rollbackReason: reason };
        }, 'updated');
        b2 = put(b2, 'execution', execution as string, {});
        return complete(b2, 'rolled_back', { execution });
      },
      (b) => complete(b, 'not_found', { execution }),
    );

    return p as StorageProgram<Result>;
  },
};

export const executionHandler = autoInterpret(_executionHandler);
