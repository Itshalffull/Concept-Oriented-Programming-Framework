// Comment Concept Implementation (Content Kit - Threaded Discussion)
import type { ConceptHandler } from '@clef/runtime';

export const commentHandler: ConceptHandler = {
  async create(input, storage) {
    const comment = input.comment as string;
    const body = input.body as string;
    const target = input.target as string;
    const author = input.author as string;

    await storage.put('comment', comment, {
      comment,
      body,
      target,
      author,
    });

    return { variant: 'ok', comment };
  },

  async list(input, storage) {
    const target = input.target as string | undefined;

    const allComments = target
      ? await storage.find('comment', { target })
      : await storage.find('comment');

    return { variant: 'ok', comments: JSON.stringify(allComments) };
  },

  async addComment(input, storage) {
    const comment = input.comment as string;
    const entity = input.entity as string;
    const content = input.content as string;
    const author = input.author as string;

    const threadPath = `/${comment}`;

    await storage.put('comment', comment, {
      comment,
      entity,
      content,
      author,
      parent: '',
      threadPath,
      published: false,
    });

    return { variant: 'ok', comment };
  },

  async reply(input, storage) {
    const comment = input.comment as string;
    const parent = input.parent as string;
    const content = input.content as string;
    const author = input.author as string;

    const parentRecord = await storage.get('comment', parent);
    const parentThreadPath = parentRecord
      ? (parentRecord.threadPath as string)
      : `/${parent}`;

    const threadPath = `${parentThreadPath}/${comment}`;

    await storage.put('comment', comment, {
      comment,
      entity: parentRecord?.entity ?? '',
      content,
      author,
      parent,
      threadPath,
      published: false,
    });

    return { variant: 'ok', comment };
  },

  async publish(input, storage) {
    const comment = input.comment as string;

    const existing = await storage.get('comment', comment);
    if (!existing) {
      return { variant: 'notfound', message: 'Comment not found' };
    }

    await storage.put('comment', comment, {
      ...existing,
      published: true,
    });

    return { variant: 'ok' };
  },

  async unpublish(input, storage) {
    const comment = input.comment as string;

    const existing = await storage.get('comment', comment);
    if (!existing) {
      return { variant: 'notfound', message: 'Comment not found' };
    }

    await storage.put('comment', comment, {
      ...existing,
      published: false,
    });

    return { variant: 'ok' };
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
};
