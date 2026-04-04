// @clef-handler style=functional
// ============================================================
// Article × DEV.to External Handler
//
// Maps the Article concept (specs/app/article.concept) to the
// DEV.to (Forem) REST API via perform('http', ...) transport
// effects. Field transforms map between concept fields and
// DEV.to API fields per the ingest manifest
// (examples/conduit/app.external.yaml).
//
// Each action builds a StorageProgram that:
// 1. Validates input
// 2. Transforms concept fields → API fields
// 3. Performs HTTP call via transport effect
// 4. Transforms API response → concept fields
// 5. Completes with the appropriate variant
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, mapBindings, perform,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Field transform helpers
// ---------------------------------------------------------------------------

/** Transform Article concept input → DEV.to API request body */
function toDevtoRequest(input: Record<string, unknown>): Record<string, unknown> {
  return {
    article: {
      title: input.title,
      body_markdown: input.body,
      description: input.description,
      published: false,
    },
  };
}

/** Transform DEV.to API response → Article concept output */
function fromDevtoResponse(data: Record<string, unknown>): Record<string, unknown> {
  const user = data.user as Record<string, unknown> | undefined;
  return {
    article: String(data.id ?? ''),
    title: data.title as string ?? '',
    description: data.description as string ?? '',
    body: data.body_markdown as string ?? '',
    slug: data.slug as string ?? '',
    author: user?.username as string ?? '',
    createdAt: data.created_at as string ?? '',
    updatedAt: data.edited_at as string ?? data.created_at as string ?? '',
  };
}

/** Transform a list of DEV.to articles → Article concept list */
function fromDevtoListResponse(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return items.map(fromDevtoResponse);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const _articleDevtoHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ArticleDevto' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const title = input.title as string;
    const body = input.body as string;
    const description = (input.description as string) ?? '';

    if (!title || title.trim() === '') {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }

    const apiBody = toDevtoRequest({ title, body, description });

    let p = createProgram();
    p = perform(p, 'http', 'POST', {
      path: '/articles',
      body: JSON.stringify(apiBody),
      headers: { 'Content-Type': 'application/json' },
    }, 'response');

    p = mapBindings(p, (bindings) => {
      const response = bindings.response as Record<string, unknown>;
      if (!response || response.error) {
        return { _error: true, message: response?.error ?? 'API call failed' };
      }
      return { _error: false, ...fromDevtoResponse(response) };
    }, 'result');

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.result as Record<string, unknown>;
      if (result._error) {
        return { variant: 'error', message: result.message };
      }
      return { article: result.article };
    }) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const articleId = input.article as string;
    const title = input.title as string;
    const body = input.body as string;
    const description = (input.description as string) ?? '';

    if (!articleId || articleId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'article ID is required' }) as StorageProgram<Result>;
    }

    const apiBody = toDevtoRequest({ title, body, description });

    let p = createProgram();
    p = perform(p, 'http', 'PUT', {
      path: `/articles/${articleId}`,
      body: JSON.stringify(apiBody),
      headers: { 'Content-Type': 'application/json' },
    }, 'response');

    p = mapBindings(p, (bindings) => {
      const response = bindings.response as Record<string, unknown>;
      if (!response || response.error) {
        return { _error: true, message: response?.error ?? 'Article not found' };
      }
      return { _error: false, ...fromDevtoResponse(response) };
    }, 'result');

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.result as Record<string, unknown>;
      if (result._error) {
        return { variant: 'notfound', message: result.message };
      }
      return { article: result.article };
    }) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const articleId = input.article as string;

    if (!articleId || articleId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'article ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = perform(p, 'http', 'DELETE', {
      path: `/articles/${articleId}`,
    }, 'response');

    p = mapBindings(p, (bindings) => {
      const response = bindings.response as Record<string, unknown>;
      if (response && response.error) {
        return { _error: true, message: response.error };
      }
      return { _error: false };
    }, 'result');

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.result as Record<string, unknown>;
      if (result._error) {
        return { variant: 'notfound', message: result.message };
      }
      return { article: articleId };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const articleId = input.article as string;

    if (!articleId || articleId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'article ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = perform(p, 'http', 'GET', {
      path: `/articles/${articleId}`,
    }, 'response');

    p = mapBindings(p, (bindings) => {
      const response = bindings.response as Record<string, unknown>;
      if (!response || response.error || response.status === 404) {
        return { _error: true, message: 'Article not found' };
      }
      return { _error: false, ...fromDevtoResponse(response) };
    }, 'result');

    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.result as Record<string, unknown>;
      if (result._error) {
        return { variant: 'notfound', message: result.message };
      }
      return {
        article: result.article,
        slug: result.slug,
        title: result.title,
        description: result.description,
        body: result.body,
        author: result.author,
      };
    }) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = perform(p, 'http', 'GET', {
      path: '/articles/me/published',
    }, 'response');

    p = mapBindings(p, (bindings) => {
      const response = bindings.response as unknown;
      if (!Array.isArray(response)) {
        return JSON.stringify([]);
      }
      return JSON.stringify(fromDevtoListResponse(response as Array<Record<string, unknown>>));
    }, 'articles');

    return completeFrom(p, 'ok', (bindings) => ({
      articles: bindings.articles as string,
    })) as StorageProgram<Result>;
  },
};

export const articleDevtoHandler = autoInterpret(_articleDevtoHandler);
