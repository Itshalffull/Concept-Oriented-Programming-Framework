// ============================================================
// Attestation Concept Conformance Tests
//
// Tests for attestation creation, revocation, and verification.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { attestationHandler } from '../../handlers/ts/app/governance/attestation.handler.js';

describe('Attestation Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('attest', () => {
    it('creates an attestation', async () => {
      const result = await attestationHandler.attest({
        schema: 'identity-v1',
        attester: 'ca-1',
        recipient: 'alice',
        data: { verified: true },
      }, storage);
      expect(result.variant).toBe('created');
      expect(result.attestation).toBeDefined();
    });
  });

  describe('verify', () => {
    it('verifies a valid attestation', async () => {
      const att = await attestationHandler.attest({
        schema: 'identity-v1', attester: 'ca-1', recipient: 'alice', data: {},
      }, storage);
      const result = await attestationHandler.verify({ attestation: att.attestation }, storage);
      expect(result.variant).toBe('valid');
    });

    it('returns not_found for unknown attestation', async () => {
      const result = await attestationHandler.verify({ attestation: 'nonexistent' }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('revoke', () => {
    it('revokes by original attester', async () => {
      const att = await attestationHandler.attest({
        schema: 'id-v1', attester: 'ca-1', recipient: 'alice', data: {},
      }, storage);
      const result = await attestationHandler.revoke(
        { attestation: att.attestation, revoker: 'ca-1' },
        storage,
      );
      expect(result.variant).toBe('revoked');
    });

    it('rejects revocation by unauthorized party', async () => {
      const att = await attestationHandler.attest({
        schema: 'id-v1', attester: 'ca-1', recipient: 'alice', data: {},
      }, storage);
      const result = await attestationHandler.revoke(
        { attestation: att.attestation, revoker: 'intruder' },
        storage,
      );
      expect(result.variant).toBe('unauthorized');
    });

    it('verifying a revoked attestation returns revoked status', async () => {
      const att = await attestationHandler.attest({
        schema: 'id-v1', attester: 'ca-1', recipient: 'alice', data: {},
      }, storage);
      await attestationHandler.revoke({ attestation: att.attestation, revoker: 'ca-1' }, storage);
      const result = await attestationHandler.verify({ attestation: att.attestation }, storage);
      expect(result.variant).toBe('revoked_status');
    });
  });
});
