// Cache Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const cacheHandler: ConceptHandler = {
  async set(input, storage) {
    const bin = input.bin as string;
    const key = input.key as string;
    const data = input.data as string;
    const tags = input.tags as string;
    const maxAge = input.maxAge as number;

    const compositeKey = `${bin}:${key}`;
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const createdAt = Date.now();

    await storage.put('cacheEntry', compositeKey, {
      bin,
      key,
      data,
      tags: tagList,
      maxAge,
      createdAt,
    });

    return { variant: 'ok' };
  },

  async get(input, storage) {
    const bin = input.bin as string;
    const key = input.key as string;

    const compositeKey = `${bin}:${key}`;
    const entry = await storage.get('cacheEntry', compositeKey);

    if (!entry) {
      return { variant: 'miss' };
    }

    const createdAt = entry.createdAt as number;
    const maxAge = entry.maxAge as number;
    const now = Date.now();

    if (maxAge > 0 && now - createdAt > maxAge * 1000) {
      await storage.delete('cacheEntry', compositeKey);
      return { variant: 'miss' };
    }

    return { variant: 'ok', data: entry.data as string };
  },

  async invalidate(input, storage) {
    const bin = input.bin as string;
    const key = input.key as string;

    const compositeKey = `${bin}:${key}`;
    const entry = await storage.get('cacheEntry', compositeKey);

    if (!entry) {
      return { variant: 'notfound' };
    }

    await storage.delete('cacheEntry', compositeKey);

    return { variant: 'ok' };
  },

  async invalidateByTags(input, storage) {
    const tags = input.tags as string;
    const targetTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const allEntries = await storage.find('cacheEntry');
    let count = 0;

    for (const entry of allEntries) {
      const entryTags = entry.tags as string[];
      const hasMatch = targetTags.some(t => entryTags.includes(t));

      if (hasMatch) {
        const compositeKey = `${entry.bin as string}:${entry.key as string}`;
        await storage.delete('cacheEntry', compositeKey);
        count++;
      }
    }

    return { variant: 'ok', count };
  },
};
