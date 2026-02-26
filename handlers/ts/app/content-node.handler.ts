import type { ConceptHandler } from '@clef/kernel';

export const contentNodeHandler: ConceptHandler = {
  async create(input, storage) {
    const node = input.node as string;
    const type = input.type as string;
    const content = input.content as string;
    const createdBy = input.createdBy as string;
    const existing = await storage.get('node', node);
    if (existing) return { variant: 'exists', message: 'already exists' };
    const now = new Date().toISOString();
    await storage.put('node', node, {
      node,
      type,
      content,
      metadata: '',
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
    return { variant: 'ok', node };
  },

  async update(input, storage) {
    const node = input.node as string;
    const content = input.content as string;
    const existing = await storage.get('node', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    const now = new Date().toISOString();
    await storage.put('node', node, {
      ...existing,
      content,
      updatedAt: now,
    });
    return { variant: 'ok', node };
  },

  async delete(input, storage) {
    const node = input.node as string;
    const existing = await storage.get('node', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    await storage.del('node', node);
    return { variant: 'ok', node };
  },

  async get(input, storage) {
    const node = input.node as string;
    const record = await storage.get('node', node);
    if (!record) return { variant: 'notfound', message: 'Node not found' };
    return {
      variant: 'ok',
      node,
      type: record.type as string,
      content: record.content as string,
      metadata: record.metadata as string,
    };
  },

  async setMetadata(input, storage) {
    const node = input.node as string;
    const metadata = input.metadata as string;
    const existing = await storage.get('node', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    await storage.put('node', node, {
      ...existing,
      metadata,
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', node };
  },

  async changeType(input, storage) {
    const node = input.node as string;
    const type = input.type as string;
    const existing = await storage.get('node', node);
    if (!existing) return { variant: 'notfound', message: 'Node not found' };
    await storage.put('node', node, {
      ...existing,
      type,
      updatedAt: new Date().toISOString(),
    });
    return { variant: 'ok', node };
  },
};
