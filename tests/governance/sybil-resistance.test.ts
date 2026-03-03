// ============================================================
// Sybil Resistance Concept Conformance Tests
//
// Tests for identity verification, challenge, and resolution lifecycle.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { sybilResistanceHandler } from '../../handlers/ts/app/governance/sybil-resistance.handler.js';

describe('Sybil Resistance Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('verify', () => {
    it('verifies a candidate', async () => {
      const result = await sybilResistanceHandler.verify(
        { candidate: 'alice', method: 'biometric', evidence: 'scan-data' },
        storage,
      );
      expect(result.variant).toBe('verified');
    });

    it('prevents duplicate verification', async () => {
      await sybilResistanceHandler.verify({ candidate: 'alice', method: 'biometric', evidence: 'scan' }, storage);
      const result = await sybilResistanceHandler.verify(
        { candidate: 'alice', method: 'biometric', evidence: 'scan2' },
        storage,
      );
      expect(result.variant).toBe('already_verified');
    });
  });

  describe('challenge / resolveChallenge', () => {
    it('opens and upholds a challenge', async () => {
      await sybilResistanceHandler.verify(
        { candidate: 'bob', method: 'social', evidence: 'proof' },
        storage,
      );
      const challenge = await sybilResistanceHandler.challenge(
        { targetId: 'bob', challenger: 'charlie', evidence: 'counter-proof' },
        storage,
      );
      expect(challenge.variant).toBe('challenge_opened');

      const resolve = await sybilResistanceHandler.resolveChallenge(
        { challengeId: challenge.challengeId, outcome: 'upheld' },
        storage,
      );
      expect(resolve.variant).toBe('upheld');
    });

    it('overturns a challenge', async () => {
      await sybilResistanceHandler.verify(
        { candidate: 'dave', method: 'social', evidence: 'proof' },
        storage,
      );
      const challenge = await sybilResistanceHandler.challenge(
        { targetId: 'dave', challenger: 'eve', evidence: 'weak' },
        storage,
      );
      const resolve = await sybilResistanceHandler.resolveChallenge(
        { challengeId: challenge.challengeId, outcome: 'overturned' },
        storage,
      );
      expect(resolve.variant).toBe('overturned');
    });
  });
});
