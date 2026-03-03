// EqualWeight Source Provider
// Returns a fixed weight per participant regardless of holdings or reputation.
import type { ConceptHandler } from '@clef/runtime';

export const equalWeightHandler: ConceptHandler = {
  async configure(input, storage) {
    const id = `ew-cfg-${Date.now()}`;
    await storage.put('ew_cfg', id, {
      id,
      weightPerPerson: input.weightPerPerson ?? 1.0,
    });

    await storage.put('plugin-registry', `weight-source:${id}`, {
      id: `weight-source:${id}`,
      pluginKind: 'weight-source',
      provider: 'EqualWeight',
      instanceId: id,
    });

    return { variant: 'configured', config: id };
  },

  async getWeight(input, storage) {
    const { config, participant } = input;
    const record = await storage.get('ew_cfg', config as string);
    const weight = record ? (record.weightPerPerson as number) : 1.0;
    return { variant: 'weight', participant, weight };
  },
};
