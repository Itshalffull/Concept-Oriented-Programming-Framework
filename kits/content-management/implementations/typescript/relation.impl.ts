// Relation Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const relationHandler: ConceptHandler = {
  async link(input, storage) {
    const rel = input.rel as string;
    const source = input.source as string;
    const target = input.target as string;
    const relType = input.relType as string;

    await storage.put('relation', rel, { relation: rel, source, target, relType });

    return { variant: 'ok', rel };
  },

  async unlink(input, storage) {
    const rel = input.rel as string;

    const existing = await storage.get('relation', rel);
    if (!existing) {
      return { variant: 'notfound', message: 'Relation not found' };
    }

    await storage.del('relation', rel);

    return { variant: 'ok', rel };
  },

  async get(input, storage) {
    const rel = input.rel as string;

    const record = await storage.get('relation', rel);
    if (!record) {
      return { variant: 'notfound', message: 'Relation not found' };
    }

    return {
      variant: 'ok',
      rel,
      source: record.source as string,
      target: record.target as string,
      relType: record.relType as string,
    };
  },
};
