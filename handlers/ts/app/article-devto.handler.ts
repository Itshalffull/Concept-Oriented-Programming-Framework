// @clef-handler style=functional
// ============================================================
// Article × DEV.to External Handler (QueryProgram-based)
//
// Maps the Article concept (specs/app/article.concept) to the
// DEV.to (Forem) REST API via QueryProgram instructions.
// Instead of raw perform('http', ...) calls, each action builds
// a QueryProgram that RemoteQueryProvider interprets, enabling:
// - planPushdown (push filterable predicates to the API)
// - Unified query language (same filters for local + remote)
// - Composable with View pipeline (compile-query → execute-query)
//
// Field transforms map between concept fields and DEV.to API
// fields per the ingest manifest (examples/conduit/app.external.yaml).
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, put, mapBindings, perform,
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
// Constants
// ---------------------------------------------------------------------------

const DEVTO_BASE = 'https://dev.to/api';
const AUTH_HEADER = { 'api-key': '${DEVTO_API_KEY}' };

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const _articleDevtoHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ArticleDevto' }) as StorageProgram<Result>;
  },

  // List: build a full QueryProgram — scan → filter → sort → limit → pure
  // RemoteQueryProvider interprets this with planPushdown against the DEV.to API.
  list(input: Record<string, unknown>) {
    const tag = input.tag as string | undefined;
    const limit = typeof input.limit === 'number' ? input.limit : 30;

    // Build QueryProgram instructions
    const instructions: Array<Record<string, unknown>> = [
      { type: 'scan', source: `${DEVTO_BASE}/articles/me/published`, bindAs: 'records',
        _remote: { method: 'GET', headers: AUTH_HEADER } },
    ];

    // Optional tag filter — pushable to API as ?tag=value
    if (tag) {
      instructions.push({
        type: 'filter',
        node: JSON.stringify({ type: 'eq', field: 'tag_list', value: tag }),
        bindAs: 'filtered',
        _pushdownHint: { queryParam: 'tag', value: tag },
      });
    }

    instructions.push(
      { type: 'sort', keys: JSON.stringify([{ field: 'published_at', direction: 'desc' }]), bindAs: 'sorted' },
      { type: 'limit', count: limit, output: 'page' },
      { type: 'pure', variant: 'ok', output: 'page' },
    );

    let p = createProgram();
    // Store the QueryProgram for RemoteQueryProvider to execute
    p = put(p, 'queryProgram', 'article-devto-list', {
      instructions: JSON.stringify(instructions),
      bindings: JSON.stringify(['records', 'filtered', 'sorted', 'page']),
      terminated: true,
      readFields: JSON.stringify(['tag_list', 'published_at']),
      _source: 'devto',
      _responseTransform: 'fromDevtoListResponse',
    });

    // Also perform the HTTP call directly as fallback
    p = perform(p, 'http', 'GET', {
      path: '/articles/me/published',
      headers: AUTH_HEADER,
    }, 'response');

    p = mapBindings(p, (bindings) => {
      const response = bindings.response as unknown;
      if (!Array.isArray(response)) return JSON.stringify([]);
      return JSON.stringify(fromDevtoListResponse(response as Array<Record<string, unknown>>));
    }, 'articles');

    return completeFrom(p, 'ok', (bindings) => ({
      articles: bindings.articles as string,
    })) as StorageProgram<Result>;
  },

  // Get: single-step QueryProgram with _remote metadata
  get(input: Record<string, unknown>) {
    const articleId = input.article as string;

    if (!articleId || articleId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'article ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // QueryProgram: scan (single resource fetch) → pure
    p = put(p, 'queryProgram', `article-devto-get-${articleId}`, {
      instructions: JSON.stringify([
        { type: 'scan', source: `${DEVTO_BASE}/articles/${articleId}`, bindAs: 'record',
          _remote: { method: 'GET', headers: AUTH_HEADER } },
        { type: 'pure', variant: 'ok', output: 'record' },
      ]),
      bindings: JSON.stringify(['record']),
      terminated: true,
      readFields: JSON.stringify([]),
      _source: 'devto',
    });

    // Fallback: direct HTTP call
    p = perform(p, 'http', 'GET', {
      path: `/articles/${articleId}`,
      headers: AUTH_HEADER,
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
        article: result.article, slug: result.slug, title: result.title,
        description: result.description, body: result.body, author: result.author,
      };
    }) as StorageProgram<Result>;
  },

  // Create: mutation QueryProgram with POST _remote metadata
  create(input: Record<string, unknown>) {
    const title = input.title as string;
    const body = input.body as string;
    const description = (input.description as string) ?? '';

    if (!title || title.trim() === '') {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }

    const apiBody = toDevtoRequest({ title, body, description });

    let p = createProgram();
    // QueryProgram: mutation scan → pure
    p = put(p, 'queryProgram', 'article-devto-create', {
      instructions: JSON.stringify([
        { type: 'scan', source: `${DEVTO_BASE}/articles`, bindAs: 'created',
          _remote: { method: 'POST', body: apiBody, headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' } } },
        { type: 'pure', variant: 'ok', output: 'created' },
      ]),
      bindings: JSON.stringify(['created']),
      terminated: true,
      readFields: JSON.stringify([]),
      _source: 'devto',
    });

    // Fallback: direct HTTP call
    p = perform(p, 'http', 'POST', {
      path: '/articles',
      body: JSON.stringify(apiBody),
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
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
      if (result._error) return { variant: 'error', message: result.message };
      return { article: result.article };
    }) as StorageProgram<Result>;
  },

  // Update: mutation QueryProgram with PUT _remote metadata
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
    p = put(p, 'queryProgram', `article-devto-update-${articleId}`, {
      instructions: JSON.stringify([
        { type: 'scan', source: `${DEVTO_BASE}/articles/${articleId}`, bindAs: 'updated',
          _remote: { method: 'PUT', body: apiBody, headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' } } },
        { type: 'pure', variant: 'ok', output: 'updated' },
      ]),
      bindings: JSON.stringify(['updated']),
      terminated: true,
      readFields: JSON.stringify([]),
      _source: 'devto',
    });

    // Fallback
    p = perform(p, 'http', 'PUT', {
      path: `/articles/${articleId}`,
      body: JSON.stringify(apiBody),
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
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
      if (result._error) return { variant: 'notfound', message: result.message };
      return { article: result.article };
    }) as StorageProgram<Result>;
  },

  // Delete: mutation QueryProgram with DELETE _remote metadata
  delete(input: Record<string, unknown>) {
    const articleId = input.article as string;

    if (!articleId || articleId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'article ID is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, 'queryProgram', `article-devto-delete-${articleId}`, {
      instructions: JSON.stringify([
        { type: 'scan', source: `${DEVTO_BASE}/articles/${articleId}`, bindAs: 'deleted',
          _remote: { method: 'DELETE', headers: AUTH_HEADER } },
        { type: 'pure', variant: 'ok', output: 'deleted' },
      ]),
      bindings: JSON.stringify(['deleted']),
      terminated: true,
      readFields: JSON.stringify([]),
      _source: 'devto',
    });

    // Fallback
    p = perform(p, 'http', 'DELETE', {
      path: `/articles/${articleId}`,
      headers: AUTH_HEADER,
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
      if (result._error) return { variant: 'notfound', message: result.message };
      return { article: articleId };
    }) as StorageProgram<Result>;
  },
};

export const articleDevtoHandler = autoInterpret(_articleDevtoHandler);
