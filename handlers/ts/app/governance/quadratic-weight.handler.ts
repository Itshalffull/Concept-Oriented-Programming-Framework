// QuadraticWeight Source Provider
// Applies square-root scaling to a base balance for diminishing-returns governance weight.
import type { ConceptHandler } from '@clef/runtime';

export const quadraticWeightHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `qw-cfg-${Date.now()}`;
    await storage.put('qw_cfg', id, {
      id,
      baseSource: input.baseSource,
    });

    await storage.put('plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'QuadraticWeight',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async compute(input, storage) {
    const { config, participant, balance } = input;
    const weight = Math.sqrt(balance as number);
    return { variant: 'weight', participant, balance, sqrtWeight: weight };
  },
};
