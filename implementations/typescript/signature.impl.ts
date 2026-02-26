// ============================================================
// Signature Handler
//
// Cryptographic proof of authorship, integrity, and temporal
// existence. Provides signing, verification, and RFC 3161
// timestamping against a set of trusted signer identities.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';
import { createHmac, randomBytes } from 'crypto';

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
 * In production this would come from a real PKI / X.509 infrastructure.
 */
function generateCertificate(identity: string): string {
  const nonce = randomBytes(16).toString('hex');
  return JSON.stringify({ identity, nonce, issuedAt: new Date().toISOString() });
}

export const signatureHandler: ConceptHandler = {
  async sign(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentHash = input.contentHash as string;
    const identity = input.identity as string;

    // Check that the identity is a trusted signer
    const trusted = await storage.find('signature-trusted', { identity });
    if (trusted.length === 0) {
      return {
        variant: 'unknownIdentity',
        message: `Identity "${identity}" is not in the trusted signers set`,
      };
    }

    // Create the signature using HMAC over contentHash keyed by identity
    const certificate = generateCertificate(identity);
    const timestamp = new Date().toISOString();
    const signatureData = hmacSign(`${contentHash}:${identity}:${timestamp}`, identity);

    const sigId = nextId();
    await storage.put('signature', sigId, {
      id: sigId,
      contentHash,
      signer: identity,
      certificate,
      timestamp,
      signatureData,
      valid: true,
    });

    return { variant: 'ok', signatureId: sigId };
  },

  async verify(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentHash = input.contentHash as string;
    const signatureId = input.signatureId as string;

    const record = await storage.get('signature', signatureId);
    if (!record) {
      return { variant: 'invalid', message: `Signature "${signatureId}" not found` };
    }

    const signer = record.signer as string;
    const timestamp = record.timestamp as string;
    const storedSig = record.signatureData as string;

    // Verify the signer is still trusted
    const trusted = await storage.find('signature-trusted', { identity: signer });
    if (trusted.length === 0) {
      return { variant: 'untrustedSigner', signer };
    }

    // Re-compute the expected HMAC and compare
    const expectedSig = hmacSign(`${contentHash}:${signer}:${timestamp}`, signer);
    if (storedSig !== expectedSig) {
      return { variant: 'invalid', message: 'Signature does not match content hash' };
    }

    // Check certificate expiry (certificates issued more than 365 days ago are expired)
    const cert = JSON.parse(record.certificate as string);
    const issuedAt = new Date(cert.issuedAt).getTime();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (Date.now() - issuedAt > oneYearMs) {
      return { variant: 'expired', message: 'Certificate has expired' };
    }

    return { variant: 'valid', identity: signer, timestamp };
  },

  async timestamp(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentHash = input.contentHash as string;

    // Generate an RFC 3161-style timestamp proof.
    // In production this would call a Timestamp Authority (TSA).
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

    return { variant: 'ok', proof };
  },

  async addTrustedSigner(input: Record<string, unknown>, storage: ConceptStorage) {
    const identity = input.identity as string;

    // Check if already trusted
    const existing = await storage.find('signature-trusted', { identity });
    if (existing.length > 0) {
      return {
        variant: 'alreadyTrusted',
        message: `Identity "${identity}" is already in the trusted set`,
      };
    }

    const id = nextId();
    await storage.put('signature-trusted', id, {
      id,
      identity,
    });

    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSignatureCounter(): void {
  idCounter = 0;
}
