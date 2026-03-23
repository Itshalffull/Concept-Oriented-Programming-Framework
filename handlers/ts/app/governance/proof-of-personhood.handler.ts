// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ProofOfPersonhood Sybil Resistance Provider
// Verification lifecycle with status tracking, expiry, and revocation.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _proofOfPersonhoodHandler: FunctionalConceptHandler = {
  requestVerification(input: Record<string, unknown>) {
    if (!input.candidate || (typeof input.candidate === 'string' && (input.candidate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'candidate is required' }) as StorageProgram<Result>;
    }
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
    return complete(p, 'ok', { verification: id }) as StorageProgram<Result>;
  },

  confirmVerification(input: Record<string, unknown>) {
    const { verification } = input;
    let p = createProgram();
    p = get(p, 'pop', verification as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.status === 'Verified';
        }, 'isAlreadyVerified');

        return branch(b,
          (bindings) => bindings.isAlreadyVerified as boolean,
          (t2) => complete(t2, 'already_verified', { verification }),
          (e2) => {
            e2 = putFrom(e2, 'pop', verification as string, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, status: 'Verified', verifiedAt: new Date().toISOString() };
            });
            return completeFrom(e2, 'verified', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { verification, candidate: record.candidate };
            });
          },
        );
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
