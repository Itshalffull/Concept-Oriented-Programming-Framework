// ============================================================
// Signature Concept Handler Tests
//
// Validates sign, verify, timestamp, and addTrustedSigner
// actions for the collaboration kit's signature concept.
// Covers sign/verify cycle, expired certificates, untrusted
// signers, timestamp proofs, and identity management.
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  signatureHandler,
  resetSignatureCounter,
} from '../handlers/ts/signature.handler.js';

describe('Signature', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSignatureCounter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- addTrustedSigner ----

  describe('addTrustedSigner', () => {
    it('adds a new trusted signer identity', async () => {
      const result = await signatureHandler.addTrustedSigner(
        { identity: 'alice@example.com' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns alreadyTrusted for duplicate identity', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice@example.com' }, storage);
      const result = await signatureHandler.addTrustedSigner(
        { identity: 'alice@example.com' },
        storage,
      );
      expect(result.variant).toBe('alreadyTrusted');
      expect(result.message).toContain('alice@example.com');
    });

    it('allows multiple distinct trusted signers', async () => {
      const r1 = await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      const r2 = await signatureHandler.addTrustedSigner({ identity: 'bob' }, storage);
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
    });
  });

  // ---- sign ----

  describe('sign', () => {
    it('signs content and returns a signature ID', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      const result = await signatureHandler.sign(
        { contentHash: 'abc123', identity: 'alice' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.signatureId).toBe('signature-2'); // ID 1 used by addTrustedSigner
    });

    it('stores the signature record with all required fields', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      const result = await signatureHandler.sign(
        { contentHash: 'hash-xyz', identity: 'alice' },
        storage,
      );
      const stored = await storage.get('signature', result.signatureId as string);
      expect(stored).not.toBeNull();
      expect(stored!.contentHash).toBe('hash-xyz');
      expect(stored!.signer).toBe('alice');
      expect(stored!.certificate).toBeDefined();
      expect(stored!.timestamp).toBeDefined();
      expect(stored!.signatureData).toBeDefined();
      expect(stored!.valid).toBe(true);
    });

    it('rejects signing by untrusted identity', async () => {
      const result = await signatureHandler.sign(
        { contentHash: 'abc', identity: 'unknown-user' },
        storage,
      );
      expect(result.variant).toBe('unknownIdentity');
      expect(result.message).toContain('unknown-user');
    });

    it('produces unique signature IDs', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      const r1 = await signatureHandler.sign(
        { contentHash: 'hash1', identity: 'alice' },
        storage,
      );
      const r2 = await signatureHandler.sign(
        { contentHash: 'hash2', identity: 'alice' },
        storage,
      );
      expect(r1.signatureId).not.toBe(r2.signatureId);
    });
  });

  // ---- verify ----

  describe('verify', () => {
    it('verifies a valid signature returns valid with identity and timestamp', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      const signed = await signatureHandler.sign(
        { contentHash: 'my-hash', identity: 'alice' },
        storage,
      );

      const result = await signatureHandler.verify(
        { contentHash: 'my-hash', signatureId: signed.signatureId },
        storage,
      );
      expect(result.variant).toBe('valid');
      expect(result.identity).toBe('alice');
      expect(result.timestamp).toBeDefined();
    });

    it('returns invalid when signature ID does not exist', async () => {
      const result = await signatureHandler.verify(
        { contentHash: 'hash', signatureId: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('not found');
    });

    it('returns invalid when content hash does not match', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      const signed = await signatureHandler.sign(
        { contentHash: 'original-hash', identity: 'alice' },
        storage,
      );

      const result = await signatureHandler.verify(
        { contentHash: 'tampered-hash', signatureId: signed.signatureId },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('does not match');
    });

    it('returns untrustedSigner when signer is no longer trusted', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      const signed = await signatureHandler.sign(
        { contentHash: 'my-hash', identity: 'alice' },
        storage,
      );

      // Remove alice from trusted signers by deleting the record
      const trustedRecords = await storage.find('signature-trusted', { identity: 'alice' });
      for (const rec of trustedRecords) {
        await storage.del('signature-trusted', rec.id as string);
      }

      const result = await signatureHandler.verify(
        { contentHash: 'my-hash', signatureId: signed.signatureId },
        storage,
      );
      expect(result.variant).toBe('untrustedSigner');
      expect(result.signer).toBe('alice');
    });

    it('returns expired when certificate is older than 365 days', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);

      // Sign at a time that will be >365 days old when we verify
      vi.useFakeTimers();
      const oldTime = new Date('2024-01-01T00:00:00.000Z').getTime();
      vi.setSystemTime(oldTime);

      const signed = await signatureHandler.sign(
        { contentHash: 'old-hash', identity: 'alice' },
        storage,
      );

      // Jump forward more than 365 days
      vi.setSystemTime(new Date('2025-02-01T00:00:00.000Z').getTime());

      const result = await signatureHandler.verify(
        { contentHash: 'old-hash', signatureId: signed.signatureId },
        storage,
      );
      expect(result.variant).toBe('expired');
      expect(result.message).toContain('expired');
    });
  });

  // ---- timestamp ----

  describe('timestamp', () => {
    it('generates a timestamp proof for content', async () => {
      const result = await signatureHandler.timestamp(
        { contentHash: 'document-hash-123' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.proof).toBeDefined();

      const proof = JSON.parse(result.proof as string);
      expect(proof.contentHash).toBe('document-hash-123');
      expect(proof.timestamp).toBeDefined();
      expect(proof.nonce).toBeDefined();
      expect(proof.proof).toBeDefined();
      expect(proof.authority).toBe('tsa-authority');
    });

    it('generates unique proofs for each call', async () => {
      const r1 = await signatureHandler.timestamp({ contentHash: 'hash' }, storage);
      const r2 = await signatureHandler.timestamp({ contentHash: 'hash' }, storage);

      const proof1 = JSON.parse(r1.proof as string);
      const proof2 = JSON.parse(r2.proof as string);
      expect(proof1.nonce).not.toBe(proof2.nonce);
    });

    it('does not require a trusted identity to generate a timestamp', async () => {
      // timestamp action doesn't check identity, just content hash
      const result = await signatureHandler.timestamp(
        { contentHash: 'any-hash' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  // ---- Multi-step sequences ----

  describe('full sign and verify workflow', () => {
    it('addTrustedSigner -> sign -> verify roundtrip', async () => {
      // Trust alice
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);

      // Alice signs a document
      const signed = await signatureHandler.sign(
        { contentHash: 'sha256:deadbeef', identity: 'alice' },
        storage,
      );
      expect(signed.variant).toBe('ok');

      // Verify the signature
      const verified = await signatureHandler.verify(
        { contentHash: 'sha256:deadbeef', signatureId: signed.signatureId },
        storage,
      );
      expect(verified.variant).toBe('valid');
      expect(verified.identity).toBe('alice');
    });

    it('multiple signers can sign the same content', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);
      await signatureHandler.addTrustedSigner({ identity: 'bob' }, storage);

      const s1 = await signatureHandler.sign(
        { contentHash: 'shared-doc', identity: 'alice' },
        storage,
      );
      const s2 = await signatureHandler.sign(
        { contentHash: 'shared-doc', identity: 'bob' },
        storage,
      );

      expect(s1.variant).toBe('ok');
      expect(s2.variant).toBe('ok');

      const v1 = await signatureHandler.verify(
        { contentHash: 'shared-doc', signatureId: s1.signatureId },
        storage,
      );
      const v2 = await signatureHandler.verify(
        { contentHash: 'shared-doc', signatureId: s2.signatureId },
        storage,
      );
      expect(v1.variant).toBe('valid');
      expect(v1.identity).toBe('alice');
      expect(v2.variant).toBe('valid');
      expect(v2.identity).toBe('bob');
    });

    it('sign -> timestamp provides both signature and temporal proof', async () => {
      await signatureHandler.addTrustedSigner({ identity: 'alice' }, storage);

      const contentHash = 'sha256:abc';
      const signed = await signatureHandler.sign(
        { contentHash, identity: 'alice' },
        storage,
      );
      const timestamped = await signatureHandler.timestamp({ contentHash }, storage);

      expect(signed.variant).toBe('ok');
      expect(timestamped.variant).toBe('ok');

      const proof = JSON.parse(timestamped.proof as string);
      expect(proof.contentHash).toBe(contentHash);
    });
  });
});
