// @migrated dsl-constructs 2026-03-18
// Attestation Concept Handler
// Verifiable claims about participants' attributes, credentials, or identity.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _attestationHandler: FunctionalConceptHandler = {
  attest(input: Record<string, unknown>) {
    const id = `attest-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'attestation', id, {
      id, schema: input.schema, attester: input.attester,
      recipient: input.recipient, data: input.data,
      createdAt: new Date().toISOString(), expiry: input.expiry ?? null, revoked: false,
    });
    return complete(p, 'created', { attestation: id }) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const { attestation, revoker } = input;
    let p = createProgram();
    p = get(p, 'attestation', attestation as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        // Check authorization via mapBindings, then branch on result
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.attester === revoker;
        }, 'authorized');

        return branch(thenP, 'authorized',
          (authP) => {
            authP = putFrom(authP, 'attestation', attestation as string, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, revoked: true };
            });
            return complete(authP, 'revoked', { attestation });
          },
          (unauthP) => complete(unauthP, 'unauthorized', { revoker }),
        );
      },
      (elseP) => complete(elseP, 'not_found', { attestation }),
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const { attestation } = input;
    let p = createProgram();
    p = get(p, 'attestation', attestation as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'valid', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.revoked) return { variant: 'revoked_status', attestation };
          if (record.expiry && new Date(record.expiry as string) < new Date()) return { variant: 'expired', attestation };
          return { variant: 'valid', attestation };
        });
      },
      (elseP) => complete(elseP, 'not_found', { attestation }),
    ) as StorageProgram<Result>;
  },
};

export const attestationHandler = autoInterpret(_attestationHandler);
