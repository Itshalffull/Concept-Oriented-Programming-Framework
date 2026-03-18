// @migrated dsl-constructs 2026-03-18
// FinalityGate Concept Handler
// Coordination concept wrapping external finality signals — @gate concept.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _finalityGateHandler: FunctionalConceptHandler = {
  submit(input: Record<string, unknown>) {
    const id = `finality-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'finality', id, {
      id, operationRef: input.operationRef, providerRef: input.providerRef,
      status: 'Pending', submittedAt: new Date().toISOString(),
    });
    return complete(p, 'pending', { gate: id }) as StorageProgram<Result>;
  },

  confirm(input: Record<string, unknown>) {
    const { gate, proof } = input;
    let p = createProgram();
    p = get(p, 'finality', gate as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Finalized', proof, confirmedAt: new Date().toISOString() };
        }, 'updated');
        b2 = putFrom(b2, 'finality', gate as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'finalized', { gate });
      },
      (b) => complete(b, 'not_found', { gate }),
    );

    return p as StorageProgram<Result>;
  },
};

export const finalityGateHandler = autoInterpret(_finalityGateHandler);
