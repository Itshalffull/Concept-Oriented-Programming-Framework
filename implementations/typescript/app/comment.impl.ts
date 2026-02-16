// Comment Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const commentHandler: ConceptHandler = {
  async create(input, storage) {
    const comment = input.comment as string;
    const body = input.body as string;
    const target = input.target as string;
    const author = input.author as string;
    const now = new Date().toISOString();

    await storage.put('comment', comment, {
      comment,
      body,
      target,
      author,
      createdAt: now,
    });

    return { variant: 'ok', comment };
  },

  async delete(input, storage) {
    const comment = input.comment as string;

    const existing = await storage.get('comment', comment);
    if (!existing) {
      return { variant: 'notfound', message: 'Comment not found' };
    }

    await storage.del('comment', comment);

    return { variant: 'ok', comment };
  },

  async list(input, storage) {
    const target = input.target as string;

    const results = await storage.find('comment', { target });
    const comments = results.map(r => ({
      comment: r.comment,
      body: r.body,
      author: r.author,
      createdAt: r.createdAt,
    }));

    return { variant: 'ok', comments: JSON.stringify(comments) };
  },
};
