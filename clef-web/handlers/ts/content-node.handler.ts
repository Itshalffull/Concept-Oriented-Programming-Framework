import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const contentNodeHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const { type, content, slug, title, createdBy } = input as {
      type: string; content: string; slug: string; title: string; createdBy: string;
    };

    const existing = await storage.get('content_node', slug);
    if (existing) {
      return { variant: 'exists', slug };
    }

    const now = new Date().toISOString();
    await storage.put('content_node', slug, {
      id: randomUUID(),
      type,
      content,
      slug,
      title,
      status: 'draft',
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok', node: slug };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage) {
    const { node, content } = input as { node: string; content: string };

    const record = await storage.get('content_node', node);
    if (!record) return { variant: 'notfound', node };

    await storage.put('content_node', node, {
      ...record,
      content,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', node };
  },

  async publish(input: Record<string, unknown>, storage: ConceptStorage) {
    const { node } = input as { node: string };

    const record = await storage.get('content_node', node);
    if (!record) return { variant: 'notfound', node };

    await storage.put('content_node', node, { ...record, status: 'published' });
    return { variant: 'ok', node };
  },

  async unpublish(input: Record<string, unknown>, storage: ConceptStorage) {
    const { node } = input as { node: string };

    const record = await storage.get('content_node', node);
    if (!record) return { variant: 'notfound', node };

    await storage.put('content_node', node, { ...record, status: 'draft' });
    return { variant: 'ok', node };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const { slug } = input as { slug: string };

    const record = await storage.get('content_node', slug);
    if (!record) return { variant: 'notfound', slug };

    return { variant: 'ok', node: record };
  },
};
