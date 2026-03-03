// Quorum Concept Handler
// Minimum participation threshold for decision validity.
import type { ConceptHandler } from '@clef/runtime';

export const quorumHandler: ConceptHandler = {
  async setThreshold(input, storage) {
    const id = `quorum-${Date.now()}`;
    await storage.put('quorum', id, {
      id, type: input.type, absoluteThreshold: input.absoluteThreshold ?? null,
      fractionalThreshold: input.fractionalThreshold ?? null, scope: input.scope,
    });
    return { variant: 'set', quorum: id };
  },

  async check(input, storage) {
    const { quorum, participation, total } = input;
    const record = await storage.get('quorum', quorum as string);
    if (!record) return { variant: 'not_found', quorum };
    const p = participation as number;
    const t = total as number;
    if (record.type === 'None') return { variant: 'met', quorum, participation: p };
    if (record.type === 'Absolute' && p >= (record.absoluteThreshold as number)) {
      return { variant: 'met', quorum, participation: p };
    }
    if (record.type === 'Fractional' && p / t >= (record.fractionalThreshold as number)) {
      return { variant: 'met', quorum, participation: p };
    }
    return { variant: 'not_met', quorum, participation: p, required: record.absoluteThreshold ?? record.fractionalThreshold };
  },

  async updateThreshold(input, storage) {
    const { quorum } = input;
    const record = await storage.get('quorum', quorum as string);
    if (!record) return { variant: 'not_found', quorum };
    await storage.put('quorum', quorum as string, { ...record, ...input });
    return { variant: 'updated', quorum };
  },
};
