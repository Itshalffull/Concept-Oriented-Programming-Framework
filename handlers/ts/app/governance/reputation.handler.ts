// Reputation Concept Handler
// Coordination concept routing to pluggable reputation algorithm providers.
import type { ConceptHandler } from '@clef/runtime';

export const reputationHandler: ConceptHandler = {
  async earn(input, storage) {
    const { participant, amount, reason } = input;
    const id = `rep-${participant}`;
    const record = await storage.get('reputation', id) ?? { score: 0, history: [] };
    const newScore = (record.score as number) + (amount as number);
    const history = record.history as unknown[];
    history.push({ amount, reason, earnedAt: new Date().toISOString() });
    await storage.put('reputation', id, { id, participant, score: newScore, history });
    return { variant: 'earned', entry: id, newScore };
  },

  async burn(input, storage) {
    const { participant, amount, reason } = input;
    const id = `rep-${participant}`;
    const record = await storage.get('reputation', id) ?? { score: 0, history: [] };
    const newScore = Math.max(0, (record.score as number) - (amount as number));
    await storage.put('reputation', id, { ...record, score: newScore });
    return { variant: 'burned', entry: id, newScore };
  },

  async decay(input, storage) {
    const { participant, decayFactor } = input;
    const id = `rep-${participant}`;
    const record = await storage.get('reputation', id) ?? { score: 0 };
    const newScore = (record.score as number) * (1 - (decayFactor as number));
    await storage.put('reputation', id, { ...record, score: newScore });
    return { variant: 'decayed', entry: id, newScore };
  },

  async getScore(input, storage) {
    const { participant } = input;
    const record = await storage.get('reputation', `rep-${participant}`);
    if (!record) return { variant: 'score', participant, score: 0.0 };
    return { variant: 'score', participant, score: record.score };
  },

  async recalculate(input, storage) {
    const { participant } = input;
    return { variant: 'recalculated', participant, newScore: 0.0 };
  },
};
