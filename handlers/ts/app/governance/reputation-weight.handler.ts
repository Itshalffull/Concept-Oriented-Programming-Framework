// ReputationWeight Source Provider
// Applies scaling functions (linear, log, sigmoid) to raw reputation scores for weighted governance.
import type { ConceptHandler } from '@clef/runtime';

function applyScaling(score: number, fn: string, cap: number | null): number {
  let scaled: number;
  switch (fn) {
    case 'log':
      scaled = score > 0 ? Math.log(1 + score) : 0;
      break;
    case 'sigmoid':
      scaled = 1 / (1 + Math.exp(-score));
      break;
    case 'linear':
    default:
      scaled = score;
      break;
  }
  if (cap !== null && scaled > cap) scaled = cap;
  return scaled;
}

export const reputationWeightHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `rw-cfg-${Date.now()}`;
    await storage.put('rw_cfg', id, {
      id,
      scalingFunction: input.scalingFunction ?? 'linear',
      cap: input.cap ?? null,
    });

    await storage.put('plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'ReputationWeight',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async compute(input, storage) {
    const { config, participant, reputationScore } = input;
    const cfg = await storage.get('rw_cfg', config as string);
    const scalingFn = cfg ? (cfg.scalingFunction as string) : 'linear';
    const cap = cfg ? (cfg.cap as number | null) : null;
    const weight = applyScaling(reputationScore as number, scalingFn, cap);
    return { variant: 'weight', participant, weight, rawScore: reputationScore };
  },
};
