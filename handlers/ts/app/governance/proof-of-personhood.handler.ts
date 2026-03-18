// @migrated dsl-constructs 2026-03-18
// ProofOfPersonhood Sybil Resistance Provider
// Verification lifecycle with status tracking, expiry, and revocation.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _proofOfPersonhoodHandler: FunctionalConceptHandler = {
  requestVerification(input: Record<string, unknown>) {
    const id = `pop-${Date.now()}`;
    const expiresAt = input.expiryDays
      ? new Date(Date.now() + (input.expiryDays as number) * 86400000).toISOString()
      : null;

    let p = createProgram();
    p = put(p, 'pop', id, {
      id,
      candidate: input.candidate,
      method: input.method,
      status: 'Pending',
      expiresAt,
      requestedAt: new Date().toISOString(),
    });
    p = put(p, 'plugin-registry', `sybil-method:${id}`, {
      id: `sybil-method:${id}`,
      pluginKind: 'sybil-method',
      provider: 'ProofOfPersonhood',
      instanceId: id,
    });
    return complete(p, 'verification_requested', { verification: id }) as StorageProgram<Result>;
  },

  confirmVerification(input: Record<string, unknown>) {
    const { verification } = input;
    let p = createProgram();
    p = get(p, 'pop', verification as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'verified', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.status === 'Verified') return { variant: 'already_verified', verification };
          return { variant: 'verified', verification, candidate: record.candidate };
        });
      },
      (b) => complete(b, 'not_found', { verification }),
    );

    return p as StorageProgram<Result>;
  },

  rejectVerification(input: Record<string, unknown>) {
    const { verification, reason } = input;
    let p = createProgram();
    p = get(p, 'pop', verification as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'pop', verification as string, {
          status: 'Rejected',
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason,
        });
        return complete(b2, 'rejected', { verification, reason });
      },
      (b) => complete(b, 'not_found', { verification }),
    );

    return p as StorageProgram<Result>;
  },

  checkStatus(input: Record<string, unknown>) {
    const { verification } = input;
    let p = createProgram();
    p = get(p, 'pop', verification as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'status', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.expiresAt && record.status === 'Verified') {
            if (new Date() > new Date(record.expiresAt as string)) {
              return { variant: 'expired', verification, candidate: record.candidate };
            }
          }
          return { variant: record.status as string, verification, candidate: record.candidate };
        });
      },
      (b) => complete(b, 'not_found', { verification }),
    );

    return p as StorageProgram<Result>;
  },
};

export const proofOfPersonhoodHandler = autoInterpret(_proofOfPersonhoodHandler);
