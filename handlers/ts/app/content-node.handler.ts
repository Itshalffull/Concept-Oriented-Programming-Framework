// ContentNode Concept Implementation
// Per spec §2.1: There is one entity — ContentNode. There are no entity types
// and no bundles. Identity comes from which Schemas are applied (via Schema
// concept), not from a "type" field. ContentNode is a universal entity pool.
import type { ConceptHandler } from '@clef/runtime';

function parseStructuredValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function expandNodeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const contentFields = parseStructuredValue(record.content);
  const metadataFields = parseStructuredValue(record.metadata);

  return {
    ...record,
    ...(contentFields ?? {}),
    ...(metadataFields
      ? Object.fromEntries(
          Object.entries(metadataFields).filter(([key]) => !(key in record) && !(contentFields && key in contentFields)),
        )
      : {}),
  };
}

export const contentNodeHandler: ConceptHandler = {
  async create(input, storage) {
    const node = input.node as string;
    const type = (input.type as string | undefined) ?? '';
    const content = (input.content as string | undefined) ?? '';
    const metadata = (input.metadata as string | undefined) ?? '';
    const createdBy = (input.createdBy as string | undefined) ?? 'system';
    const existing = await storage.get('node', node);
    if (existing) return { variant: 'exists', message: 'already exists' };
    const now = new Date().toISOString();
    await storage.put('node', node, {
      node,
      type,
      content,
      metadata,
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
      ...expandNodeRecord(record as Record<string, unknown>),
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

  async list(_input, storage) {
    const items = await storage.find('node', {});
    const allItems = Array.isArray(items) ? items : [];
    return {
      variant: 'ok',
      items: JSON.stringify(allItems.map((item) => expandNodeRecord(item as Record<string, unknown>))),
    };
  },

  async stats(_input, storage) {
    const items = await storage.find('node', {});
    const allItems = Array.isArray(items) ? items : [];
    const stats = [
      { label: 'Content Nodes', value: String(allItems.length), description: 'Entities in the content pool' },
    ];
    return { variant: 'ok', items: JSON.stringify(stats) };
  },
};
