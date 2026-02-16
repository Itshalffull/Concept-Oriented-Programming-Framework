// Tag Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const tagHandler: ConceptHandler = {
  async add(input, storage) {
    const tag = input.tag as string;
    const article = input.article as string;

    const existing = await storage.get('tag', tag);
    const articles: string[] = existing
      ? (existing.articles as string[])
      : [];

    if (!articles.includes(article)) {
      articles.push(article);
    }

    await storage.put('tag', tag, { tag, articles });

    return { variant: 'ok', tag };
  },

  async remove(input, storage) {
    const tag = input.tag as string;
    const article = input.article as string;

    const existing = await storage.get('tag', tag);
    if (existing) {
      const articles = (existing.articles as string[]).filter(a => a !== article);
      await storage.put('tag', tag, { tag, articles });
    }

    return { variant: 'ok', tag };
  },

  async list(_input, storage) {
    const allTags = await storage.find('tag');
    const tags = allTags.map(r => r.tag as string);

    return { variant: 'ok', tags: JSON.stringify(tags) };
  },
};
