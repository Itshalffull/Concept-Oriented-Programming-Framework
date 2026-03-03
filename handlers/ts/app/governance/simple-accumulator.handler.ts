// SimpleAccumulator Reputation Provider
// Add/subtract reputation with optional per-period decay and configurable cap.
import type { ConceptHandler } from '@clef/runtime';

export const simpleAccumulatorHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `acc-${Date.now()}`;
    await storage.put('accumulator', id, {
      id,
      decayRate: input.decayRate ?? null,
      cap: input.cap ?? null,
    });

    await storage.put('plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'SimpleAccumulator',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async add(input, storage) {
    const { config, participant, amount } = input;
    const cfg = await storage.get('accumulator', config as string);
    const cap = cfg ? (cfg.cap as number | null) : null;

    const key = `${config}:${participant}`;
    const existing = await storage.get('acc_score', key);
    const currentScore = existing ? (existing.score as number) : 0;
    let newScore = currentScore + (amount as number);

    if (cap !== null) newScore = Math.min(newScore, cap);

    await storage.put('acc_score', key, {
      config, participant, score: newScore,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'added', participant, newScore };
  },

  async applyDecay(input, storage) {
    const { config, participant } = input;
    const cfg = await storage.get('accumulator', config as string);
    const decayRate = cfg ? (cfg.decayRate as number | null) : null;
    if (decayRate === null) return { variant: 'no_decay', participant };

    const key = `${config}:${participant}`;
    const existing = await storage.get('acc_score', key);
    const currentScore = existing ? (existing.score as number) : 0;
    const newScore = currentScore * (1 - decayRate);

    await storage.put('acc_score', key, {
      config, participant, score: newScore,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'decayed', participant, newScore, previousScore: currentScore };
  },

  async getScore(input, storage) {
    const { config, participant } = input;
    const key = `${config}:${participant}`;
    const existing = await storage.get('acc_score', key);
    const score = existing ? (existing.score as number) : 0;
    return { variant: 'score', participant, score };
  },
};
