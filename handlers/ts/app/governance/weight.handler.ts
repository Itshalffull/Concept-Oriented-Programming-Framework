// Weight Concept Handler
// Coordination concept routing to pluggable weight source providers.
import type { ConceptHandler } from '@clef/runtime';

export const weightHandler: ConceptHandler = {
  async updateWeight(input, storage) {
    const { participant, source, value } = input;
    const id = `weight-${participant}`;
    const record = await storage.get('weight', id) ?? {};
    const sources = (record.sources as Record<string, number>) ?? {};
    sources[source as string] = value as number;
    const total = Object.values(sources).reduce((a, b) => a + b, 0);
    await storage.put('weight', id, { id, participant, sources, total, updatedAt: new Date().toISOString() });
    return { variant: 'updated', weight: id, newTotal: total };
  },

  async snapshot(input, storage) {
    const { snapshotRef, participants } = input;
    const id = `snapshot-${snapshotRef ?? Date.now()}`;
    await storage.put('snapshot', id, { id, participants, takenAt: new Date().toISOString() });
    return { variant: 'snapped', snapshot: id };
  },

  async getWeight(input, storage) {
    const { participant } = input;
    const record = await storage.get('weight', `weight-${participant}`);
    if (!record) return { variant: 'weight', participant, total: 0.0 };
    return { variant: 'weight', participant, total: record.total };
  },

  async getWeightFromSnapshot(input, storage) {
    const { snapshot, participant } = input;
    const record = await storage.get('snapshot', snapshot as string);
    if (!record) return { variant: 'not_found', snapshot };
    return { variant: 'weight', participant, total: 0.0, snapshot };
  },
};
