// SybilResistance Concept Handler
// Coordination concept ensuring each participant has at most one identity.
import type { ConceptHandler } from '@clef/runtime';

export const sybilResistanceHandler: ConceptHandler = {
  async verify(input, storage) {
    const { candidate, method, evidence } = input;
    const existing = await storage.get('verified', candidate as string);
    if (existing) return { variant: 'already_verified', candidate };
    const id = `sybil-${Date.now()}`;
    await storage.put('verified', candidate as string, { id, candidate, method, evidence, verifiedAt: new Date().toISOString() });
    return { variant: 'verified', id };
  },

  async challenge(input, storage) {
    const { targetId, challenger, evidence } = input;
    const target = await storage.get('verified', targetId as string);
    if (!target) return { variant: 'invalid_target', targetId };
    const challengeId = `challenge-${Date.now()}`;
    await storage.put('challenge', challengeId, { challengeId, targetId, challenger, evidence, status: 'Open' });
    return { variant: 'challenge_opened', challengeId };
  },

  async resolveChallenge(input, storage) {
    const { challengeId, outcome } = input;
    const record = await storage.get('challenge', challengeId as string);
    if (!record) return { variant: 'not_found', challengeId };
    if (outcome === 'upheld') {
      await storage.del('verified', record.targetId as string);
      await storage.put('challenge', challengeId as string, { ...record, status: 'Upheld' });
      return { variant: 'upheld', challengeId, removedId: record.targetId };
    }
    await storage.put('challenge', challengeId as string, { ...record, status: 'Overturned' });
    return { variant: 'overturned', challengeId };
  },
};
