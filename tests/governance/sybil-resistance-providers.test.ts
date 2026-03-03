// ============================================================
// Sybil Resistance Provider Conformance Tests
//
// Tests for all 4 sybil resistance providers: ProofOfPersonhood,
// StakeThreshold, SocialGraphVerification, and AttestationSybil.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { proofOfPersonhoodHandler } from '../../handlers/ts/app/governance/proof-of-personhood.handler.js';
import { stakeThresholdHandler } from '../../handlers/ts/app/governance/stake-threshold.handler.js';
import { socialGraphVerificationHandler } from '../../handlers/ts/app/governance/social-graph-verification.handler.js';
import { attestationSybilHandler } from '../../handlers/ts/app/governance/attestation-sybil.handler.js';

describe('Sybil Resistance Providers', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ────────────────────────────────────────────────
  //  ProofOfPersonhood
  // ────────────────────────────────────────────────
  describe('ProofOfPersonhood', () => {
    it('requests and confirms verification', async () => {
      const req = await proofOfPersonhoodHandler.requestVerification(
        { candidate: 'alice', method: 'biometric' },
        storage,
      );
      expect(req.variant).toBe('verification_requested');

      const confirm = await proofOfPersonhoodHandler.confirmVerification(
        { verification: req.verification },
        storage,
      );
      expect(confirm.variant).toBe('verified');
      expect(confirm.candidate).toBe('alice');
    });

    it('prevents double-verification', async () => {
      const req = await proofOfPersonhoodHandler.requestVerification(
        { candidate: 'alice', method: 'biometric' },
        storage,
      );
      await proofOfPersonhoodHandler.confirmVerification({ verification: req.verification }, storage);
      const again = await proofOfPersonhoodHandler.confirmVerification(
        { verification: req.verification },
        storage,
      );
      expect(again.variant).toBe('already_verified');
    });

    it('rejects verification with a reason', async () => {
      const req = await proofOfPersonhoodHandler.requestVerification(
        { candidate: 'bob', method: 'video' },
        storage,
      );
      const reject = await proofOfPersonhoodHandler.rejectVerification(
        { verification: req.verification, reason: 'Failed liveness check' },
        storage,
      );
      expect(reject.variant).toBe('rejected');
      expect(reject.reason).toBe('Failed liveness check');
    });

    it('checks status of pending verification', async () => {
      const req = await proofOfPersonhoodHandler.requestVerification(
        { candidate: 'charlie', method: 'social' },
        storage,
      );
      const status = await proofOfPersonhoodHandler.checkStatus(
        { verification: req.verification },
        storage,
      );
      expect(status.variant).toBe('Pending');
    });
  });

  // ────────────────────────────────────────────────
  //  StakeThreshold
  // ────────────────────────────────────────────────
  describe('StakeThreshold', () => {
    it('qualifies when stake meets minimum', async () => {
      const cfg = await stakeThresholdHandler.configure(
        { minimumStake: 100, token: 'ETH' },
        storage,
      );

      await stakeThresholdHandler.deposit(
        { config: cfg.config, candidate: 'alice', amount: 100 },
        storage,
      );

      const check = await stakeThresholdHandler.check(
        { config: cfg.config, candidate: 'alice' },
        storage,
      );
      expect(check.variant).toBe('qualified');
      expect(check.balance).toBe(100);
    });

    it('reports insufficient stake', async () => {
      const cfg = await stakeThresholdHandler.configure(
        { minimumStake: 100, token: 'ETH' },
        storage,
      );

      await stakeThresholdHandler.deposit(
        { config: cfg.config, candidate: 'alice', amount: 50 },
        storage,
      );

      const check = await stakeThresholdHandler.check(
        { config: cfg.config, candidate: 'alice' },
        storage,
      );
      expect(check.variant).toBe('insufficient');
      expect(check.shortfall).toBe(50);
    });

    it('slashes stake', async () => {
      const cfg = await stakeThresholdHandler.configure(
        { minimumStake: 100, token: 'ETH' },
        storage,
      );
      await stakeThresholdHandler.deposit(
        { config: cfg.config, candidate: 'alice', amount: 200 },
        storage,
      );
      const slash = await stakeThresholdHandler.slash(
        { config: cfg.config, candidate: 'alice', amount: 80 },
        storage,
      );
      expect(slash.variant).toBe('slashed');
      expect(slash.slashedAmount).toBe(80);
      expect(slash.remainingBalance).toBe(120);
    });

    it('limits slash to current balance', async () => {
      const cfg = await stakeThresholdHandler.configure(
        { minimumStake: 10, token: 'ETH' },
        storage,
      );
      await stakeThresholdHandler.deposit(
        { config: cfg.config, candidate: 'alice', amount: 30 },
        storage,
      );
      const slash = await stakeThresholdHandler.slash(
        { config: cfg.config, candidate: 'alice', amount: 500 },
        storage,
      );
      expect(slash.slashedAmount).toBe(30);
      expect(slash.remainingBalance).toBe(0);
    });
  });

  // ────────────────────────────────────────────────
  //  SocialGraphVerification
  // ────────────────────────────────────────────────
  describe('SocialGraphVerification', () => {
    it('verifies when enough vouchers', async () => {
      const cfg = await socialGraphVerificationHandler.configure(
        { minimumVouchers: 2 },
        storage,
      );

      await socialGraphVerificationHandler.addVouch(
        { config: cfg.config, voucher: 'alice', candidate: 'dave' },
        storage,
      );
      await socialGraphVerificationHandler.addVouch(
        { config: cfg.config, voucher: 'bob', candidate: 'dave' },
        storage,
      );

      const verify = await socialGraphVerificationHandler.verify(
        { config: cfg.config, candidate: 'dave' },
        storage,
      );
      expect(verify.variant).toBe('verified');
      expect(verify.voucherCount).toBe(2);
    });

    it('reports insufficient vouchers', async () => {
      const cfg = await socialGraphVerificationHandler.configure(
        { minimumVouchers: 3 },
        storage,
      );
      await socialGraphVerificationHandler.addVouch(
        { config: cfg.config, voucher: 'alice', candidate: 'dave' },
        storage,
      );

      const verify = await socialGraphVerificationHandler.verify(
        { config: cfg.config, candidate: 'dave' },
        storage,
      );
      expect(verify.variant).toBe('insufficient');
      expect(verify.required).toBe(3);
    });

    it('prevents self-vouching', async () => {
      const cfg = await socialGraphVerificationHandler.configure(
        { minimumVouchers: 1 },
        storage,
      );
      const result = await socialGraphVerificationHandler.addVouch(
        { config: cfg.config, voucher: 'alice', candidate: 'alice' },
        storage,
      );
      expect(result.variant).toBe('self_vouch');
    });

    it('prevents duplicate vouches', async () => {
      const cfg = await socialGraphVerificationHandler.configure(
        { minimumVouchers: 2 },
        storage,
      );
      await socialGraphVerificationHandler.addVouch(
        { config: cfg.config, voucher: 'alice', candidate: 'bob' },
        storage,
      );
      const dupe = await socialGraphVerificationHandler.addVouch(
        { config: cfg.config, voucher: 'alice', candidate: 'bob' },
        storage,
      );
      expect(dupe.variant).toBe('already_vouched');
    });

    it('revokes a vouch', async () => {
      const cfg = await socialGraphVerificationHandler.configure(
        { minimumVouchers: 1 },
        storage,
      );
      await socialGraphVerificationHandler.addVouch(
        { config: cfg.config, voucher: 'alice', candidate: 'bob' },
        storage,
      );
      const revoke = await socialGraphVerificationHandler.revokeVouch(
        { config: cfg.config, voucher: 'alice', candidate: 'bob' },
        storage,
      );
      expect(revoke.variant).toBe('revoked');
    });
  });

  // ────────────────────────────────────────────────
  //  AttestationSybil
  // ────────────────────────────────────────────────
  describe('AttestationSybil', () => {
    it('verifies matching attestation', async () => {
      const cfg = await attestationSybilHandler.configure(
        { requiredSchema: 'identity-v1', requiredAttester: 'trustedCA' },
        storage,
      );

      await attestationSybilHandler.submitAttestation({
        config: cfg.config,
        candidate: 'alice',
        attestationRef: 'att-001',
        schema: 'identity-v1',
        attester: 'trustedCA',
      }, storage);

      const verify = await attestationSybilHandler.verify(
        { config: cfg.config, candidate: 'alice' },
        storage,
      );
      expect(verify.variant).toBe('verified');
      expect(verify.attestationRef).toBe('att-001');
    });

    it('rejects schema mismatch', async () => {
      const cfg = await attestationSybilHandler.configure(
        { requiredSchema: 'identity-v1' },
        storage,
      );
      await attestationSybilHandler.submitAttestation({
        config: cfg.config,
        candidate: 'alice',
        attestationRef: 'att-002',
        schema: 'wrong-schema',
        attester: 'anyCA',
      }, storage);

      const verify = await attestationSybilHandler.verify(
        { config: cfg.config, candidate: 'alice' },
        storage,
      );
      expect(verify.variant).toBe('schema_mismatch');
    });

    it('rejects attester mismatch', async () => {
      const cfg = await attestationSybilHandler.configure(
        { requiredSchema: 'identity-v1', requiredAttester: 'trustedCA' },
        storage,
      );
      await attestationSybilHandler.submitAttestation({
        config: cfg.config,
        candidate: 'alice',
        attestationRef: 'att-003',
        schema: 'identity-v1',
        attester: 'untrustedCA',
      }, storage);

      const verify = await attestationSybilHandler.verify(
        { config: cfg.config, candidate: 'alice' },
        storage,
      );
      expect(verify.variant).toBe('attester_mismatch');
    });

    it('returns no_attestation for unsubmitted candidate', async () => {
      const cfg = await attestationSybilHandler.configure(
        { requiredSchema: 'id-v1' },
        storage,
      );
      const verify = await attestationSybilHandler.verify(
        { config: cfg.config, candidate: 'nobody' },
        storage,
      );
      expect(verify.variant).toBe('no_attestation');
    });
  });
});
