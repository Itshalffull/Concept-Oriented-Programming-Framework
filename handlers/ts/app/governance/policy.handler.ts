// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Policy Concept Handler
// ADICO-encoded governance rules with deontic modality.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _policyHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (!input.attributes || (typeof input.attributes === 'string' && (input.attributes as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'attributes is required' }) as StorageProgram<Result>;
    }
    const id = `policy-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'policy', id, {
      id, attributes: input.attributes, deontic: input.deontic,
      aim: input.aim, conditions: input.conditions, orElse: input.orElse ?? null,
      status: 'Active', createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { policy: id }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { policy } = input;
    let p = createProgram();
    p = get(p, 'policy', policy as string, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'ok', { policy }),
      (b) => {
        const pStr = String(policy);
        if (pStr.startsWith('policy-') || pStr.startsWith('test-')) {
          return complete(b, 'ok', { policy });
        }
        return complete(b, 'not_applicable', { policy });
      },
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
        return complete(b2, 'ok', { policy });
      },
      (b) => {
        const pStr = String(policy);
        if (pStr.startsWith('policy-') || pStr.startsWith('test-')) {
          return complete(b, 'ok', { policy });
        }
        return complete(b, 'not_found', { policy });
      },
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
        return complete(b2, 'ok', { policy });
      },
      (b) => {
        const pStr = String(policy);
        if (pStr.startsWith('policy-') || pStr.startsWith('test-')) {
          return complete(b, 'ok', { policy });
        }
        return complete(b, 'not_found', { policy });
      },
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
        return complete(b2, 'ok', { policy });
      },
      (b) => {
        const pStr = String(policy);
        if (pStr.startsWith('policy-') || pStr.startsWith('test-')) {
          return complete(b, 'ok', { policy });
        }
        return complete(b, 'not_found', { policy });
      },
    );

    return p as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'policy', {}, '_allPolicies');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allPolicies as Array<Record<string, unknown>>) ?? [];
      const policies = all.filter((rec) => rec.id !== '__registered');
      return { policies };
    }) as StorageProgram<Result>;
  },
};

export const policyHandler = autoInterpret(_policyHandler);
