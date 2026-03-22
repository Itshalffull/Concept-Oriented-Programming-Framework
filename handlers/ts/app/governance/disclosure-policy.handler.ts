// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// DisclosurePolicy Concept Handler
// Governance transparency and disclosure timing rules.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _disclosurePolicyHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const id = `disclosure-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'disclosure', id, {
      id, scope: input.scope, timing: input.timing,
      audience: input.audience, format: input.format ?? null,
      status: 'Active', createdAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { policy: id }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { policy, event, requestor } = input;
    let p = createProgram();
    p = get(p, 'disclosure', policy as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return branch(b,
          (bindings) => (bindings.record as Record<string, unknown>).status !== 'Active',
          (b2) => complete(b2, 'suspended', { policy }),
          (b2) => complete(b2, 'ok', { policy, disclosedTo: requestor }),
        );
      },
      (b) => complete(b, 'not_found', { policy }),
    );

    return p as StorageProgram<Result>;
  },

  suspend(input: Record<string, unknown>) {
    const { policy, reason } = input;
    let p = createProgram();
    p = get(p, 'disclosure', policy as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, status: 'Suspended', suspendReason: reason };
        }, 'updated');
        b2 = putFrom(b2, 'disclosure', policy as string, (bindings) => bindings.updated as Record<string, unknown>);
        return complete(b2, 'suspended', { policy });
      },
      (b) => complete(b, 'not_found', { policy }),
    );

    return p as StorageProgram<Result>;
  },
};

export const disclosurePolicyHandler = autoInterpret(_disclosurePolicyHandler);
