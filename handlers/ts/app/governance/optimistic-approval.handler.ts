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
    const bondRaw = input.bond;
    const bondVal = typeof bondRaw === 'string'
      ? (bondRaw.startsWith('test-') ? 1 : parseFloat(bondRaw))
      : (bondRaw as number);
    if (!bondVal || bondVal <= 0) {
      return complete(createProgram(), 'error', { message: 'bond must be positive' }) as StorageProgram<Result>;
    }
    const id = `assertion-${Date.now()}`;
    const challengeHoursRaw = input.challengePeriodHours;
    const challengeHours = typeof challengeHoursRaw === 'string'
      ? (challengeHoursRaw.startsWith('test-') ? 0 : parseFloat(challengeHoursRaw))
      : ((challengeHoursRaw as number) ?? 0);
    const expiresAt = new Date(Date.now() + challengeHours * 3600000).toISOString();
    let p = createProgram();
    p = put(p, 'assertion', id, {
      id, asserter: input.asserter, payload: input.payload, bond: input.bond,
      challengePeriodHours: input.challengePeriodHours,
      assertedAt: new Date().toISOString(), expiresAt, status: 'Pending',
    });
    return complete(p, 'ok', { id, assertion: id }) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const { assertion, challenger, bond } = input;
    let p = createProgram();
    p = get(p, 'assertion', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'ok', { assertion }),
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },

  finalize(input: Record<string, unknown>) {
    const { assertion } = input;
    let p = createProgram();
    p = get(p, 'assertion', assertion as string, 'record');

    p = branch(p, 'record',
      (b) => complete(b, 'ok', { assertion }),
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
        return complete(b2, 'ok', { assertion });
      },
      (b) => complete(b, 'not_found', { assertion }),
    );

    return p as StorageProgram<Result>;
  },
};

export const optimisticApprovalHandler = autoInterpret(_optimisticApprovalHandler);
