// Tag Concept Implementation (Classification Kit)
import type { ConceptHandler } from '@copf/kernel';

export const tagHandler: ConceptHandler = {
  async addTag(input, storage) {
    const entity = input.entity as string;
    const tag = input.tag as string;

    const existing = await storage.get('tag', tag);
    if (!existing) {
      return { variant: 'notfound', message: 'Tag does not exist' };
    }

    const tagIndex: string[] = JSON.parse(existing.tagIndex as string);

    if (!tagIndex.includes(entity)) {
      tagIndex.push(entity);
    }

    await storage.put('tag', tag, {
      ...existing,
      tagIndex: JSON.stringify(tagIndex),
    });

    return { variant: 'ok' };
  },

  async removeTag(input, storage) {
    const entity = input.entity as string;
    const tag = input.tag as string;

    const existing = await storage.get('tag', tag);
    if (!existing) {
      return { variant: 'notfound', message: 'Tag does not exist' };
    }

    const tagIndex: string[] = JSON.parse(existing.tagIndex as string);

    if (!tagIndex.includes(entity)) {
      return { variant: 'notfound', message: 'Entity not associated with this tag' };
    }

    const updated = tagIndex.filter(e => e !== entity);

    await storage.put('tag', tag, {
      ...existing,
      tagIndex: JSON.stringify(updated),
    });

    return { variant: 'ok' };
  },

  async getByTag(input, storage) {
    const tag = input.tag as string;

    const existing = await storage.get('tag', tag);
    const entities: string[] = existing
      ? JSON.parse(existing.tagIndex as string)
      : [];

    return { variant: 'ok', entities: JSON.stringify(entities) };
  },

  async getChildren(input, storage) {
    const tag = input.tag as string;

    const existing = await storage.get('tag', tag);
    if (!existing) {
      return { variant: 'notfound', message: 'Tag does not exist' };
    }

    const allTags = await storage.find('tag');
    const children: string[] = [];

    for (const record of allTags) {
      if (record.parent === tag) {
        children.push(record.tag as string);
      }
    }

    return { variant: 'ok', children: JSON.stringify(children) };
  },

  async rename(input, storage) {
    const tag = input.tag as string;
    const name = input.name as string;

    const existing = await storage.get('tag', tag);
    if (!existing) {
      return { variant: 'notfound', message: 'Tag does not exist' };
    }

    await storage.put('tag', tag, {
      ...existing,
      name,
    });

    return { variant: 'ok' };
  },
};
