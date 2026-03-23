// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Article Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const _articleHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const article = input.article as string;
    const title = input.title as string;
    const description = input.description as string;
    const body = input.body as string;
    const author = input.author as string;
    const now = new Date().toISOString();
    const slug = slugify(title);

    let p = createProgram();
    p = put(p, 'article', article, {
      article, slug, title, description, body, author,
      createdAt: now, updatedAt: now,
    });
    return complete(p, 'ok', { article }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  update(input: Record<string, unknown>) {
    const article = input.article as string;
    const title = input.title as string;
    const description = input.description as string;
    const body = input.body as string;

    let p = createProgram();
    p = spGet(p, 'article', article, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        const slug = slugify(title);
        let b2 = put(b, 'article', article, {
          slug, title, description, body, updatedAt: now,
        });
        return complete(b2, 'ok', { article });
      },
      (b) => complete(b, 'notfound', { message: 'Article not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const article = input.article as string;

    let p = createProgram();
    p = spGet(p, 'article', article, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'article', article);
        return complete(b2, 'ok', { article });
      },
      (b) => complete(b, 'notfound', { message: 'Article not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'article', {}, 'allArticles');
    p = completeFrom(p, 'ok', (bindings) => {
      const allArticles = (bindings.allArticles as Array<Record<string, unknown>>) || [];
      const articles = allArticles.map(r => ({
        slug: r.slug, title: r.title, description: r.description,
        body: r.body, author: r.author, createdAt: r.createdAt,
      }));
      return { articles: JSON.stringify(articles) };
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const article = input.article as string;

    let p = createProgram();
    p = spGet(p, 'article', article, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          article,
          slug: record.slug,
          title: record.title,
          description: record.description,
          body: record.body,
          author: record.author,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
      }),
      (b) => complete(b, 'notfound', { message: 'Article not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const articleHandler = autoInterpret(_articleHandler);

