// @clef-handler style=functional
// ProofOfPersonhood Sybil Resistance Provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let popCounter = 0;

const _proofOfPersonhoodHandler: FunctionalConceptHandler = {
  requestVerification(input: Record<string, unknown>) {
    if (!input.candidate || (typeof input.candidate === 'string' && (input.candidate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'candidate is required' }) as StorageProgram<Result>;
    }
    const id = `pop-${++popCounter}`;
    let p = createProgram();
    p = put(p, 'pop', id, {
      id,
      candidate: input.candidate,
      method: input.method,
      status: 'Pending',
      expiresAt: null,
      requestedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { id, verification: id }) as StorageProgram<Result>;
  },

  // Direct verify - creates and immediately confirms a verification
  verify(input: Record<string, unknown>) {
    if (!input.participant || (typeof input.participant === 'string' && (input.participant as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'participant is required' }) as StorageProgram<Result>;
    }
    const id = `pop-${++popCounter}`;
    let p = createProgram();
    p = put(p, 'pop', id, {
      id,
      candidate: input.participant,
      participant: input.participant,
      method: input.method,
      proofHash: input.proofHash,
      verifier: input.verifier,
      status: 'Verified',
      expiresAt: null,
      verifiedAt: new Date().toISOString(),
    });
    // Also index by participant
    p = put(p, 'pop_by_participant', input.participant as string, { verification: id });
    return complete(p, 'ok', { id, verification: id }) as StorageProgram<Result>;
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
          (t2) => complete(t2, 'ok', { verification }),
          (e2) => {
            let b2 = putFrom(e2, 'pop', verification as string, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, status: 'Verified', verifiedAt: new Date().toISOString() };
            });
            return completeFrom(b2, 'ok', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { verification, candidate: record.candidate };
            });
          },
        );
      },
      (b) => complete(b, 'error', { message: `Verification not found: ${verification}` }),
    );

    return p as StorageProgram<Result>;
  },

  rejectVerification(input: Record<string, unknown>) {
    const { verification, reason } = input;
    let p = createProgram();
    p = get(p, 'pop', verification as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'pop', verification as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'Rejected', rejectedAt: new Date().toISOString(), rejectionReason: reason };
        });
        return complete(b2, 'ok', { verification, reason });
      },
      (b) => complete(b, 'error', { message: `Verification not found: ${verification}` }),
    );

    return p as StorageProgram<Result>;
  },

  checkStatus(input: Record<string, unknown>) {
    const { verification, participant } = input;

    if (participant) {
      // Look up by participant
      let p = createProgram();
      p = get(p, 'pop_by_participant', participant as string, 'idx');
      return branch(p, 'idx',
        (b) => {
          b = mapBindings(b, (bindings) => (bindings.idx as Record<string, unknown>).verification, 'vid');
          return completeFrom(b, 'valid', (bindings) => ({ verification: bindings.vid, candidate: participant }));
        },
        (b) => complete(b, 'not_found', { participant }),
      ) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'pop', verification as string, 'record');

    return branch(p, 'record',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { verification, candidate: record.candidate, status: record.status };
        });
      },
      (b) => complete(b, 'error', { message: `Verification not found: ${verification}` }),
    ) as StorageProgram<Result>;
  },
};

export const proofOfPersonhoodHandler = autoInterpret(_proofOfPersonhoodHandler);
