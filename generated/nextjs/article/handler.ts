// Article concept handler — content article lifecycle with create, update, delete, get, and list.
// Implements slug generation from title and word count tracking.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ArticleStorage,
  ArticleCreateInput,
  ArticleCreateOutput,
  ArticleUpdateInput,
  ArticleUpdateOutput,
  ArticleDeleteInput,
  ArticleDeleteOutput,
  ArticleGetInput,
  ArticleGetOutput,
  ArticleListInput,
  ArticleListOutput,
} from './types.js';

import {
  createOk,
  updateOk,
  updateNotfound,
  deleteOk,
  deleteNotfound,
  getOk,
  getNotfound,
  listOk,
} from './types.js';

export interface ArticleError {
  readonly code: string;
  readonly message: string;
}

export interface ArticleHandler {
  readonly create: (
    input: ArticleCreateInput,
    storage: ArticleStorage,
  ) => TE.TaskEither<ArticleError, ArticleCreateOutput>;
  readonly update: (
    input: ArticleUpdateInput,
    storage: ArticleStorage,
  ) => TE.TaskEither<ArticleError, ArticleUpdateOutput>;
  readonly delete: (
    input: ArticleDeleteInput,
    storage: ArticleStorage,
  ) => TE.TaskEither<ArticleError, ArticleDeleteOutput>;
  readonly get: (
    input: ArticleGetInput,
    storage: ArticleStorage,
  ) => TE.TaskEither<ArticleError, ArticleGetOutput>;
  readonly list: (
    input: ArticleListInput,
    storage: ArticleStorage,
  ) => TE.TaskEither<ArticleError, ArticleListOutput>;
}

// --- Pure helpers ---

const generateSlug = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const countWords = (body: string): number => {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
};

const toStorageError = (error: unknown): ArticleError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const articleHandler: ArticleHandler = {
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const now = new Date().toISOString();
          const slug = generateSlug(input.title);
          const wordCount = countWords(input.body);

          await storage.put('article', input.article, {
            article: input.article,
            title: input.title,
            slug,
            description: input.description,
            body: input.body,
            author: input.author,
            wordCount,
            status: 'draft',
            createdAt: now,
            updatedAt: now,
          });

          return createOk(input.article);
        },
        toStorageError,
      ),
    ),

  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('article', input.article),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                updateNotfound(`Article '${input.article}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const slug = generateSlug(input.title);
                  const wordCount = countWords(input.body);

                  const updated = {
                    ...existing,
                    title: input.title,
                    slug,
                    description: input.description,
                    body: input.body,
                    wordCount,
                    updatedAt: now,
                  };
                  await storage.put('article', input.article, updated);
                  return updateOk(input.article);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('article', input.article),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                deleteNotfound(`Article '${input.article}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('article', input.article);
                  return deleteOk(input.article);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('article', input.article),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                getNotfound(`Article '${input.article}' not found`),
              ),
            (found) =>
              TE.right(
                getOk(
                  input.article,
                  typeof found['slug'] === 'string' ? found['slug'] as string : generateSlug(String(found['title'] ?? '')),
                  typeof found['title'] === 'string' ? found['title'] as string : '',
                  typeof found['description'] === 'string' ? found['description'] as string : '',
                  typeof found['body'] === 'string' ? found['body'] as string : '',
                  typeof found['author'] === 'string' ? found['author'] as string : '',
                ),
              ),
          ),
        ),
      ),
    ),

  list: (_input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('article');
          const summaries = records.map((r) => ({
            article: r['article'],
            title: r['title'],
            slug: r['slug'],
            author: r['author'],
            status: r['status'],
            createdAt: r['createdAt'],
          }));
          return listOk(JSON.stringify(summaries));
        },
        toStorageError,
      ),
    ),
};
