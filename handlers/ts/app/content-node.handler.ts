import type { ConceptHandler } from '@clef/runtime';

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

  async list(input, storage) {
    const items = await storage.find('node', {});
    const allItems = Array.isArray(items) ? items : [];
    // Optional type filter
    const typeFilter = input.type as string | undefined;
    const filtered = typeFilter
      ? allItems.filter((item: Record<string, unknown>) => item.type === typeFilter)
      : allItems;
    return { variant: 'ok', items: JSON.stringify(filtered) };
  },

  async stats(_input, storage) {
    const items = await storage.find('node', {});
    const allItems = Array.isArray(items) ? items : [];
    // Count by type
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      const type = (item as Record<string, unknown>).type as string ?? 'unknown';
      counts[type] = (counts[type] ?? 0) + 1;
    }
    const stats = [
      { label: 'Content Nodes', value: String(allItems.length), description: 'Entities in the content pool' },
      { label: 'Concepts', value: String(counts['concept'] ?? 0), description: 'Registered concept handlers' },
      { label: 'Schemas', value: String(counts['schema'] ?? 0), description: 'Composable data shapes' },
      { label: 'Syncs', value: String(counts['sync'] ?? 0), description: 'Sync rules across suites' },
      { label: 'Suites', value: String(counts['suite'] ?? 0), description: 'Concept suite packages' },
      { label: 'Themes', value: String(counts['theme'] ?? 0), description: 'Design system themes' },
    ];
    return { variant: 'ok', items: JSON.stringify(stats) };
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
