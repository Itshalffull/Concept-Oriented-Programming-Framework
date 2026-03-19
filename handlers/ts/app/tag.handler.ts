// Tag Concept Implementation (Classification Kit)
import type { ConceptHandler } from '@clef/runtime';

export const tagHandler: ConceptHandler = {
  async add(input, storage) {
    const tag = input.tag as string;
    const article = input.article as string;

    const existing = await storage.get('tag', tag);
    const articles: string[] = existing
      ? (existing.articles as string[]) || []
      : [];

    if (!articles.includes(article)) {
      articles.push(article);
    }

    await storage.put('tag', tag, {
      tag,
      articles,
    });

    return { variant: 'ok' };
  },

  async remove(input, storage) {
    const tag = input.tag as string;
    const article = input.article as string;

    const existing = await storage.get('tag', tag);
    if (!existing) {
      return { variant: 'notfound', message: 'Tag does not exist' };
    }

    const articles: string[] = (existing.articles as string[]) || [];
    const updated = articles.filter(a => a !== article);

    await storage.put('tag', tag, {
      tag,
      articles: updated,
    });

    return { variant: 'ok' };
  },

  async list(_input, storage) {
    const allTags = await storage.find('tag');
    const tagNames = allTags.map(record => record.tag as string);
    return { variant: 'ok', tags: JSON.stringify(tagNames) };
  },

  async addTag(input, storage) {
    const entity = input.entity as string;
    const tag = input.tag as string;

    let existing = await storage.get('tag', tag);
    if (!existing) {
      // Auto-create the tag with an empty index
      existing = {
        tag,
        tagIndex: '[]',
        articles: [],
      };
    }

    const tagIndex: string[] = existing.tagIndex
      ? JSON.parse(existing.tagIndex as string)
      : [];

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
    const entities: string[] = existing && existing.tagIndex
      ? JSON.parse(existing.tagIndex as string)
      : [];

    // Return single entity as plain string, multiple as comma-separated
    const entitiesValue = entities.length === 1 ? entities[0] : entities.join(',');
    return { variant: 'ok', entities: entitiesValue };
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
