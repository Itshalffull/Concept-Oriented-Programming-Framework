// @migrated dsl-constructs 2026-03-18
// Policy Concept Handler
// ADICO-encoded governance rules with deontic modality.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _policyHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const id = `policy-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'policy', id, {
      id, attributes: input.attributes, deontic: input.deontic,
      aim: input.aim, conditions: input.conditions, orElse: input.orElse ?? null,
      status: 'Active', createdAt: new Date().toISOString(),
    });
    return complete(p, 'created', { policy: id }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { policy } = input;
    let p = createProgram();
    p = get(p, 'policy', policy as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'compliant', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Active') return { variant: 'suspended', policy };
          return { variant: 'compliant', policy };
        });
      },
      (b) => complete(b, 'not_found', { policy }),
    );

    return p as StorageProgram<Result>;
  },

  suspend(input: Record<string, unknown>) {
    const { policy, reason } = input;
    let p = createProgram();
    p = get(p, 'policy', policy as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'policy', policy as string, { status: 'Suspended', suspendReason: reason });
        return complete(b2, 'suspended', { policy });
      },
      (b) => complete(b, 'not_found', { policy }),
    );

    return p as StorageProgram<Result>;
  },

  repeal(input: Record<string, unknown>) {
    const { policy } = input;
    let p = createProgram();
    p = get(p, 'policy', policy as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'policy', policy as string, { status: 'Repealed' });
        return complete(b2, 'repealed', { policy });
      },
      (b) => complete(b, 'not_found', { policy }),
    );

    return p as StorageProgram<Result>;
  },

  modify(input: Record<string, unknown>) {
    const { policy } = input;
    let p = createProgram();
    p = get(p, 'policy', policy as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'policy', policy as string, { ...input, updatedAt: new Date().toISOString() });
        return complete(b2, 'modified', { policy });
      },
      (b) => complete(b, 'not_found', { policy }),
    );

    return p as StorageProgram<Result>;
  },
};

export const policyHandler = autoInterpret(_policyHandler);
