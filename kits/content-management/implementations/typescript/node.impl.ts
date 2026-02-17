// Node Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const nodeHandler: ConceptHandler = {
  async create(input, storage) {
    const node = input.node as string;
    const bundle = input.bundle as string;

    await storage.put('node', node, { node, bundle });

    return { variant: 'ok', node, bundle };
  },

  async get(input, storage) {
    const node = input.node as string;

    const record = await storage.get('node', node);
    if (!record) {
      return { variant: 'notfound', message: 'Node not found' };
    }

    return {
      variant: 'ok',
      node,
      bundle: record.bundle as string,
    };
  },
};
