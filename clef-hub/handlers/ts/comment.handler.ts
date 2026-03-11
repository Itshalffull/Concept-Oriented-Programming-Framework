import { randomUUID } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

export const commentHandler: ConceptHandler = {
  async add(input: Record<string, unknown>, storage: ConceptStorage) {
    const { entity, author, content, parent } = input;
    const id = randomUUID();
    await storage.put('comments', id, {
      id,
      entity: entity as string,
      author: author as string,
      content: content as string,
      parent: (parent as string) ?? null,
      createdAt: new Date().toISOString(),
    });
    return { variant: 'ok', comment: id };
  },

  async edit(input: Record<string, unknown>, storage: ConceptStorage) {
    const { comment, content } = input;
    const record = await storage.get('comments', comment as string);
    if (!record) return { variant: 'notfound' };
    await storage.put('comments', comment as string, {
      ...record,
      content: content as string,
    });
    return { variant: 'ok' };
  },

  async remove(input: Record<string, unknown>, storage: ConceptStorage) {
    const { comment } = input;
    const record = await storage.get('comments', comment as string);
    if (!record) return { variant: 'notfound' };
    await storage.del('comments', comment as string);
    return { variant: 'ok' };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const { entity } = input;
    const all = await storage.find('comments', { entity: entity as string });
    const comments = all.map((c) => ({
      id: c.id,
      author: c.author,
      content: c.content,
      parent: c.parent,
      createdAt: c.createdAt,
    }));
    return { variant: 'ok', comments };
  },
};
