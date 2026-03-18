// @migrated dsl-constructs 2026-03-18
// ============================================================
// Signature Handler
//
// Cryptographic proof of authorship, integrity, and temporal
// existence. Provides signing, verification, and RFC 3161
// timestamping against a set of trusted signer identities.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { createHmac, randomBytes } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `signature-${++idCounter}`;
}

/**
 * Produce an HMAC-SHA256 signature over the given data using the provided key.
 */
function hmacSign(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Generate a synthetic certificate for a signer identity.
 */
function generateCertificate(identity: string): string {
  const nonce = randomBytes(16).toString('hex');
  return JSON.stringify({ identity, nonce, issuedAt: new Date().toISOString() });
}

const _handler: FunctionalConceptHandler = {
  sign(input: Record<string, unknown>) {
    const contentHash = input.contentHash as string;
    const identity = input.identity as string;

    let p = createProgram();
    p = find(p, 'signature-trusted', { identity }, 'trusted');

    return completeFrom(p, 'ok', (bindings) => {
      const trusted = bindings.trusted as Record<string, unknown>[];
      if (trusted.length === 0) {
        return {
          variant: 'unknownIdentity',
          message: `Identity "${identity}" is not in the trusted signers set`,
        };
      }

      const certificate = generateCertificate(identity);
      const timestamp = new Date().toISOString();
      const signatureData = hmacSign(`${contentHash}:${identity}:${timestamp}`, identity);

      const sigId = nextId();
      return { signatureId: sigId };
    }) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const contentHash = input.contentHash as string;
    const signatureId = input.signatureId as string;

    let p = createProgram();
    p = get(p, 'signature', signatureId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'signature-trusted', {}, 'allTrusted');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const allTrusted = bindings.allTrusted as Record<string, unknown>[];

          const signer = record.signer as string;
          const timestamp = record.timestamp as string;
          const storedSig = record.signatureData as string;

          const trusted = allTrusted.filter(t => t.identity === signer);
          if (trusted.length === 0) {
            return { variant: 'untrustedSigner', signer };
          }

          const expectedSig = hmacSign(`${contentHash}:${signer}:${timestamp}`, signer);
          if (storedSig !== expectedSig) {
            return { variant: 'invalid', message: 'Signature does not match content hash' };
          }

          const cert = JSON.parse(record.certificate as string);
          const issuedAt = new Date(cert.issuedAt).getTime();
          const oneYearMs = 365 * 24 * 60 * 60 * 1000;
          if (Date.now() - issuedAt > oneYearMs) {
            return { variant: 'expired', message: 'Certificate has expired' };
          }

          return { variant: 'valid', identity: signer, timestamp };
        });
      },
      (elseP) => complete(elseP, 'invalid', { message: `Signature "${signatureId}" not found` }),
    ) as StorageProgram<Result>;
  },

  timestamp(input: Record<string, unknown>) {
    const contentHash = input.contentHash as string;

    const ts = new Date().toISOString();
    const nonce = randomBytes(16).toString('hex');
    const proofData = hmacSign(`${contentHash}:${ts}:${nonce}`, 'tsa-authority');

    const proof = JSON.stringify({
      contentHash,
      timestamp: ts,
      nonce,
      proof: proofData,
      authority: 'tsa-authority',
    });

    const p = createProgram();
    return complete(p, 'ok', { proof }) as StorageProgram<Result>;
  },

  addTrustedSigner(input: Record<string, unknown>) {
    const identity = input.identity as string;

    let p = createProgram();
    p = find(p, 'signature-trusted', { identity }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length > 0) {
        return {
          variant: 'alreadyTrusted',
          message: `Identity "${identity}" is already in the trusted set`,
        };
      }
      return {};
    }) as StorageProgram<Result>;
  },
};

export const signatureHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSignatureCounter(): void {
  idCounter = 0;
}
