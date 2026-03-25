// @clef-handler style=functional
// Attestation Concept Implementation
// Make verifiable claims about participants' attributes, credentials, or identity.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `attestation-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  attest(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const attester = input.attester as string;
    const recipient = input.recipient as string;
    const data = input.data as string;
    const expiry = (input.expiry as string) || null;

    if (!schema || schema.trim() === '') {
      return complete(createProgram(), 'error', { message: 'schema is required' }) as StorageProgram<Result>;
    }
    if (!attester || attester.trim() === '') {
      return complete(createProgram(), 'error', { message: 'attester is required' }) as StorageProgram<Result>;
    }
    if (!recipient || recipient.trim() === '') {
      return complete(createProgram(), 'error', { message: 'recipient is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'attestation', id, {
      id,
      schema: schema.trim(),
      attester: attester.trim(),
      recipient: recipient.trim(),
      data: data || '',
      createdAt: new Date().toISOString(),
      expiry: expiry || null,
      revoked: false,
    });

    return complete(p, 'ok', { attestation: id }) as StorageProgram<Result>;
  },

  revoke(input: Record<string, unknown>) {
    const attestation = input.attestation as string;
    const revoker = input.revoker as string;

    if (!attestation || attestation.trim() === '') {
      return complete(createProgram(), 'error', { message: 'attestation is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'attestation', attestation, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { attestation }),
      (() => {
        let b = createProgram();
        b = get(b, 'attestation', attestation, 'rec');
        // Check revoker is original attester
        return branch(b,
          (bindings) => {
            const rec = bindings.rec as Record<string, unknown>;
            return rec.attester !== revoker;
          },
          complete(createProgram(), 'unauthorized', { revoker }),
          (() => {
            let c = createProgram();
            c = get(c, 'attestation', attestation, 'rec2');
            c = putFrom(c, 'attestation', attestation, (bindings) => {
              const rec = bindings.rec2 as Record<string, unknown>;
              return { ...rec, revoked: true };
            });
            return complete(c, 'ok', { attestation });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const attestation = input.attestation as string;

    if (!attestation || attestation.trim() === '') {
      return complete(createProgram(), 'error', { message: 'attestation is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'attestation', attestation, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { attestation }),
      (() => {
        let b = createProgram();
        b = get(b, 'attestation', attestation, 'rec');
        // Check revoked
        return branch(b,
          (bindings) => {
            const rec = bindings.rec as Record<string, unknown>;
            return rec.revoked === true;
          },
          // Revoked => ok (per spec: "The attestation has been revoked")
          completeFrom(createProgram(), 'ok', () => ({ attestation })),
          (() => {
            // Check expiry
            let c = createProgram();
            c = get(c, 'attestation', attestation, 'rec3');
            return branch(c,
              (bindings) => {
                const rec = bindings.rec3 as Record<string, unknown>;
                if (!rec.expiry) return false;
                return new Date(rec.expiry as string) < new Date();
              },
              // Expired => ok (per spec: "The attestation exists but has passed its expiry")
              completeFrom(createProgram(), 'ok', () => ({ attestation })),
              // Valid
              complete(createProgram(), 'valid', { attestation }),
            );
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const attestationHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetAttestation(): void {
  idCounter = 0;
}
