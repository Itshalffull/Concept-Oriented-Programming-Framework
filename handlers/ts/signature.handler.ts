// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Signature Handler
//
// Cryptographic proof of authorship, integrity, and temporal
// existence. Provides signing, verification, and RFC 3161
// timestamping against a set of trusted signer identities.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';
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
};

const baseHandler = autoInterpret(_handler);

// sign and addTrustedSigner need imperative style for dynamic storage keys
const handler: ConceptHandler = {
  ...baseHandler,

  async addTrustedSigner(input: Record<string, unknown>, storage: ConceptStorage) {
    const identity = input.identity as string;

    const existing = await storage.find('signature-trusted', { identity });
    if (existing.length > 0) {
      return {
        variant: 'alreadyTrusted',
        message: `Identity "${identity}" is already in the trusted set`,
      };
    }

    const id = nextId();
    await storage.put('signature-trusted', id, { id, identity });
    return { variant: 'ok' };
  },

  async sign(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentHash = input.contentHash as string;
    const identity = input.identity as string;

    const trusted = await storage.find('signature-trusted', { identity });
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
    await storage.put('signature', sigId, {
      contentHash,
      signer: identity,
      certificate,
      timestamp,
      signatureData,
      valid: true,
    });

    return { variant: 'ok', signatureId: sigId };
  },
};

export const signatureHandler = handler as FunctionalConceptHandler & ConceptHandler;

/** Reset the ID counter. Useful for testing. */
export function resetSignatureCounter(): void {
  idCounter = 0;
}
