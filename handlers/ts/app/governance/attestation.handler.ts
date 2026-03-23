// @clef-handler style=functional
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
    if (!input.schema || (typeof input.schema === 'string' && (input.schema as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'schema is required' }) as StorageProgram<Result>;
    }
    const id = `attest-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'attestation', id, {
      id, schema: input.schema, attester: input.attester,
      recipient: input.recipient, data: input.data,
      createdAt: new Date().toISOString(), expiry: input.expiry ?? null, revoked: false,
    });
    return complete(p, 'ok', { id, attestation: id }) as StorageProgram<Result>;
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
            return complete(authP, 'ok', { attestation });
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
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.revoked) return 'revoked';
          const expiry = record.expiry as string | null;
          if (expiry) {
            const expiryDate = new Date(expiry);
            if (!isNaN(expiryDate.getTime()) && expiryDate < new Date()) return 'expired';
          }
          return 'valid';
        }, 'verifyStatus');

        return branch(thenP,
          (b) => b.verifyStatus === 'valid',
          (b) => {
            // Check if expiry is a valid future date (spec: has expiry -> ok; no expiry/invalid -> valid)
            b = mapBindings(b, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const expiry = record.expiry as string | null;
              if (expiry) {
                const expiryDate = new Date(expiry as string);
                return !isNaN(expiryDate.getTime()) && expiryDate > new Date();
              }
              return false;
            }, 'hasValidExpiry');
            return branch(b, 'hasValidExpiry',
              (bp) => complete(bp, 'ok', { attestation }),
              (bp) => complete(bp, 'valid', { attestation }),
            );
          },
          (b) => complete(b, 'ok', { attestation, status: b.verifyStatus }),
        );
      },
      (elseP) => complete(elseP, 'not_found', { attestation }),
    ) as StorageProgram<Result>;
  },
};

export const attestationHandler = autoInterpret(_attestationHandler);
