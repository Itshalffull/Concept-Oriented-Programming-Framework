// Article Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const articleHandler: ConceptHandler = {
  async create(input, storage) {
    const article = input.article as string;
    const title = input.title as string;
    const description = input.description as string;
    const body = input.body as string;
    const author = input.author as string;
    const now = new Date().toISOString();
    const slug = slugify(title);

    await storage.put('article', article, {
      article,
      slug,
      title,
      description,
      body,
      author,
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok', article };
  },

  async update(input, storage) {
    const article = input.article as string;
    const title = input.title as string;
    const description = input.description as string;
    const body = input.body as string;

    const existing = await storage.get('article', article);
    if (!existing) {
      return { variant: 'notfound', message: 'Article not found' };
    }

    const now = new Date().toISOString();
    const slug = slugify(title);

    await storage.put('article', article, {
      ...existing,
      slug,
      title,
      description,
      body,
      updatedAt: now,
    });

    return { variant: 'ok', article };
  },

  async delete(input, storage) {
    const article = input.article as string;

    const existing = await storage.get('article', article);
    if (!existing) {
      return { variant: 'notfound', message: 'Article not found' };
    }

    await storage.del('article', article);

    return { variant: 'ok', article };
  },

  async list(_input, storage) {
    const allArticles = await storage.find('article');
    const articles = allArticles.map(r => ({
      slug: r.slug,
      title: r.title,
      description: r.description,
      body: r.body,
      author: r.author,
      createdAt: r.createdAt,
    }));
    return { variant: 'ok', articles: JSON.stringify(articles) };
  },

  async get(input, storage) {
    const article = input.article as string;

    const record = await storage.get('article', article);
    if (!record) {
      return { variant: 'notfound', message: 'Article not found' };
    }

    return {
      variant: 'ok',
      article,
      slug: record.slug as string,
      title: record.title as string,
      description: record.description as string,
      body: record.body as string,
      author: record.author as string,
    };
  },
};
