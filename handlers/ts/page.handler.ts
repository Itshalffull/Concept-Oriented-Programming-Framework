// @clef-handler style=functional
// ============================================================
// Page Handler
//
// Define a navigable page with a URL pattern, rendering strategy,
// and layout configuration. Pages are the unit users create from
// the frontend to build application surfaces. Supports server-side,
// client-side, and static rendering modes for Next.js integration.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_RENDER_MODES = ['server', 'client', 'static'];

/** Extract :paramName segments from a URL pattern */
function extractParamNames(urlPattern: string): string[] {
  const matches = urlPattern.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
}

const _handler: FunctionalConceptHandler = {
  // ---- register ------------------------------------------------------------
  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'Page' });
  },

  // ---- create --------------------------------------------------------------
  create(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;
    const slug = input.slug as string;
    const title = input.title as string;
    const urlPattern = input.urlPattern as string;
    const renderMode = input.renderMode as string;
    const description = (input.description as string) || '';

    if (!slug || slug.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'Slug is required' }) as StorageProgram<Result>;
    }
    if (!urlPattern || urlPattern.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'URL pattern is required' }) as StorageProgram<Result>;
    }
    if (!VALID_RENDER_MODES.includes(renderMode)) {
      return complete(createProgram(), 'invalid', {
        message: `renderMode must be one of: ${VALID_RENDER_MODES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'page', {}, 'allPages');

    p = mapBindings(p, (b) => {
      const allPages = (b.allPages || []) as Record<string, unknown>[];
      const existing = allPages.find(pg => (pg.slug as string) === slug);
      return { isDuplicate: !!existing };
    }, 'check');

    return branch(p,
      (b) => (b.check as Record<string, unknown>).isDuplicate === true,
      (dupP) => complete(dupP, 'duplicate', {
        message: `A page with slug "${slug}" already exists`,
      }),
      (okP) => {
        const parameterNames = extractParamNames(urlPattern);
        const now = new Date().toISOString();
        const key = pageId || `page-${Date.now()}`;
        const p2 = put(okP, 'page', key, {
          page: key,
          slug,
          title,
          urlPattern,
          renderMode,
          parameterNames,
          description: description || null,
          layoutRef: null,
          meta: null,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        });
        return complete(p2, 'ok', { page: key });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const pg = b.existing as Record<string, unknown>;
        return {
          page: pageId,
          slug: pg.slug,
          title: pg.title,
          urlPattern: pg.urlPattern,
          renderMode: pg.renderMode,
          parameterNames: pg.parameterNames || [],
          layoutRef: pg.layoutRef || null,
          meta: pg.meta || null,
          status: pg.status,
          description: pg.description || null,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>): StorageProgram<Result> {
    let p = createProgram();
    p = find(p, 'page', {}, 'allPages');

    return completeFrom(p, 'ok', (b) => {
      const allPages = (b.allPages || []) as Record<string, unknown>[];
      const pages = allPages.map(pg => ({
        page: pg.page,
        slug: pg.slug,
        title: pg.title,
        urlPattern: pg.urlPattern,
        renderMode: pg.renderMode,
        status: pg.status,
      }));
      return { pages };
    }) as StorageProgram<Result>;
  },

  publish(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => branch(foundP,
        (b) => (b.existing as Record<string, unknown>).status === 'published',
        (alreadyP) => complete(alreadyP, 'invalid', { message: 'Page is already published' }),
        (draftP) => {
          const p2 = putFrom(draftP, 'page', pageId, (b) => {
            const pg = b.existing as Record<string, unknown>;
            return { ...pg, status: 'published', updatedAt: new Date().toISOString() };
          });
          return complete(p2, 'ok', { page: pageId });
        },
      ),
    ) as StorageProgram<Result>;
  },

  unpublish(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => branch(foundP,
        (b) => (b.existing as Record<string, unknown>).status === 'draft',
        (alreadyP) => complete(alreadyP, 'invalid', { message: 'Page is already in draft status' }),
        (publishedP) => {
          const p2 = putFrom(publishedP, 'page', pageId, (b) => {
            const pg = b.existing as Record<string, unknown>;
            return { ...pg, status: 'draft', updatedAt: new Date().toISOString() };
          });
          return complete(p2, 'ok', { page: pageId });
        },
      ),
    ) as StorageProgram<Result>;
  },

  updatePattern(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;
    const urlPattern = input.urlPattern as string;

    if (!urlPattern || urlPattern.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'URL pattern is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => {
        const parameterNames = extractParamNames(urlPattern);
        const p2 = putFrom(foundP, 'page', pageId, (b) => {
          const pg = b.existing as Record<string, unknown>;
          return { ...pg, urlPattern, parameterNames, updatedAt: new Date().toISOString() };
        });
        return complete(p2, 'ok', { page: pageId, parameterNames });
      },
    ) as StorageProgram<Result>;
  },

  setRenderMode(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;
    const renderMode = input.renderMode as string;

    if (!VALID_RENDER_MODES.includes(renderMode)) {
      return complete(createProgram(), 'invalid', {
        message: `renderMode must be one of: ${VALID_RENDER_MODES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => {
        const p2 = putFrom(foundP, 'page', pageId, (b) => {
          const pg = b.existing as Record<string, unknown>;
          return { ...pg, renderMode, updatedAt: new Date().toISOString() };
        });
        return complete(p2, 'ok', { page: pageId });
      },
    ) as StorageProgram<Result>;
  },

  setLayout(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;
    const layoutRef = input.layoutRef as string;

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => {
        const p2 = putFrom(foundP, 'page', pageId, (b) => {
          const pg = b.existing as Record<string, unknown>;
          return { ...pg, layoutRef, updatedAt: new Date().toISOString() };
        });
        return complete(p2, 'ok', { page: pageId });
      },
    ) as StorageProgram<Result>;
  },

  setMeta(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;
    const meta = input.meta as string;

    try {
      JSON.parse(meta);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'Meta must be valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => {
        const p2 = putFrom(foundP, 'page', pageId, (b) => {
          const pg = b.existing as Record<string, unknown>;
          return { ...pg, meta, updatedAt: new Date().toISOString() };
        });
        return complete(p2, 'ok', { page: pageId });
      },
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>): StorageProgram<Result> {
    const pageId = input.page as string;

    let p = createProgram();
    p = get(p, 'page', pageId, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (notFoundP) => complete(notFoundP, 'notfound', { message: `Page "${pageId}" not found` }),
      (foundP) => branch(foundP,
        (b) => (b.existing as Record<string, unknown>).status === 'published',
        (publishedP) => complete(publishedP, 'invalid', {
          message: 'Page must be unpublished before deletion',
        }),
        (draftP) => {
          // pageId is a static string known at construction time — del() is safe here.
          const p2 = del(draftP, 'page', pageId);
          return complete(p2, 'ok', { page: pageId });
        },
      ),
    ) as StorageProgram<Result>;
  },
};

export const pageHandler = autoInterpret(_handler);
