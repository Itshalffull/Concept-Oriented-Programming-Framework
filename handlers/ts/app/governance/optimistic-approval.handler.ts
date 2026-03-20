// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// OptimisticApproval Concept Handler
// Approve-unless-challenged pattern with bond mechanics — @gate concept.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _optimisticApprovalHandler: FunctionalConceptHandler = {
  assert(input: Record<string, unknown>) {
    const id = `assertion-${Date.now()}`;
    const expiresAt = new Date(Date.now() + (input.challengePeriodHours as number) * 3600000).toISOString();
    let p = createProgram();
    p = put(p, 'assertion', id, {
      id, asserter: input.asserter, payload: input.payload, bond: input.bond,
      challengePeriodHours: input.challengePeriodHours,
      assertedAt: new Date().toISOString(), expiresAt, status: 'Pending',
    });
    return complete(p, 'asserted', { assertion: id }) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const { assertion, challenger, bond } = input;
    let p = createProgram();
    p = get(p, 'assertion', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'challenged', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (new Date() > new Date(record.expiresAt as string)) {
            return { variant: 'expired', assertion };
          }
          return { variant: 'challenged', assertion };
        });
      },
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const { assertion } = input;
    let p = createProgram();
    p = get(p, 'assertion', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'approved', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status !== 'Pending') {
            return { variant: 'not_pending', assertion };
          }
          return { variant: 'approved', assertion };
        });
      },
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const { assertion, upheld } = input;
    let p = createProgram();
    p = get(p, 'assertion', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => {
        const status = upheld ? 'Rejected' : 'Approved';
        let b2 = put(b, 'assertion', assertion as string, { status });
        if (upheld) {
          return complete(b2, 'rejected', { assertion });
        }
        return complete(b2, 'approved', { assertion });
      },
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },
};

export const optimisticApprovalHandler = autoInterpret(_optimisticApprovalHandler);
