// Conduit Example App — REST API Route Mapping
// Maps standard REST endpoints to kernel handleRequest calls.

import type { Kernel } from '../../../kernel/src/self-hosted.js';
import type { IncomingMessage, ServerResponse } from 'http';

interface RouteMapping {
  httpMethod: string;
  path: string;
  toKernelMethod: string;
  extractInput: (body: Record<string, unknown>, params: Record<string, string>) => Record<string, unknown>;
}

const ROUTES: RouteMapping[] = [
  // Auth
  { httpMethod: 'POST', path: '/api/users', toKernelMethod: 'register',
    extractInput: (b) => ({ username: b.user?.username, email: b.user?.email, password: b.user?.password }) },
  { httpMethod: 'POST', path: '/api/users/login', toKernelMethod: 'login',
    extractInput: (b) => ({ email: b.user?.email, password: b.user?.password }) },

  // Profile
  { httpMethod: 'PUT', path: '/api/user', toKernelMethod: 'update_profile',
    extractInput: (b) => ({ bio: b.user?.bio, image: b.user?.image }) },

  // Articles
  { httpMethod: 'POST', path: '/api/articles', toKernelMethod: 'create_article',
    extractInput: (b) => ({ title: b.article?.title, description: b.article?.description, body: b.article?.body, tagList: b.article?.tagList }) },
  { httpMethod: 'DELETE', path: '/api/articles/:slug', toKernelMethod: 'delete_article',
    extractInput: (_b, p) => ({ article: p.slug }) },

  // Comments
  { httpMethod: 'POST', path: '/api/articles/:slug/comments', toKernelMethod: 'create_comment',
    extractInput: (b, p) => ({ body: b.comment?.body, article: p.slug }) },
  { httpMethod: 'DELETE', path: '/api/articles/:slug/comments/:id', toKernelMethod: 'delete_comment',
    extractInput: (_b, p) => ({ comment: p.id, article: p.slug }) },

  // Social
  { httpMethod: 'POST', path: '/api/profiles/:username/follow', toKernelMethod: 'follow',
    extractInput: (_b, p) => ({ target: p.username }) },
  { httpMethod: 'DELETE', path: '/api/profiles/:username/follow', toKernelMethod: 'unfollow',
    extractInput: (_b, p) => ({ target: p.username }) },
  { httpMethod: 'POST', path: '/api/articles/:slug/favorite', toKernelMethod: 'favorite',
    extractInput: (_b, p) => ({ article: p.slug }) },
  { httpMethod: 'DELETE', path: '/api/articles/:slug/favorite', toKernelMethod: 'unfavorite',
    extractInput: (_b, p) => ({ article: p.slug }) },

  // Echo (health check / debug)
  { httpMethod: 'POST', path: '/api/echo', toKernelMethod: 'echo',
    extractInput: (b) => ({ text: b.text }) },

  // Read operations — all flow through kernel syncs
  { httpMethod: 'GET', path: '/api/articles', toKernelMethod: 'list_articles',
    extractInput: () => ({}) },
  { httpMethod: 'GET', path: '/api/articles/:slug', toKernelMethod: 'get_article',
    extractInput: (_b, p) => ({ slug: p.slug }) },
  { httpMethod: 'GET', path: '/api/tags', toKernelMethod: 'list_tags',
    extractInput: () => ({}) },
  { httpMethod: 'GET', path: '/api/profiles/:username', toKernelMethod: 'get_profile',
    extractInput: (_b, p) => ({ username: p.username }) },
  { httpMethod: 'GET', path: '/api/articles/:slug/comments', toKernelMethod: 'list_comments',
    extractInput: (_b, p) => ({ article: p.slug }) },
];

function matchRoute(method: string, url: string): { route: RouteMapping; params: Record<string, string> } | null {
  for (const route of ROUTES) {
    if (route.httpMethod !== method) continue;

    const routeParts = route.path.split('/');
    const urlParts = url.split('?')[0].split('/');

    if (routeParts.length !== urlParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = urlParts[i];
      } else if (routeParts[i] !== urlParts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { route, params };
  }
  return null;
}

function extractToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Token ') || auth?.startsWith('Bearer ')) {
    return auth.split(' ')[1];
  }
  return undefined;
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Helper to access nested body fields safely
function safeGet(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const val = obj[key];
  return typeof val === 'object' && val !== null ? val as Record<string, unknown> : undefined;
}

// Parse JSON-encoded list fields returned by concept actions
// and format responses to match the RealWorld API spec.
// Data has already flowed through the full kernel architecture;
// this is presentation-layer formatting only.
function formatResponse(
  method: string,
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  // Parse JSON-encoded string fields into arrays/objects
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      try {
        const obj = JSON.parse(value);
        if (Array.isArray(obj) || typeof obj === 'object') {
          parsed[key] = obj;
          continue;
        }
      } catch {
        // Not JSON, keep as-is
      }
    }
    parsed[key] = value;
  }

  // Normalize article shape for RealWorld API spec.
  // Concept actions return raw data (author as user ID string);
  // this adds defaults for fields the frontend expects.
  function normalizeArticle(raw: Record<string, unknown>): Record<string, unknown> {
    const author = raw.author;
    return {
      ...raw,
      tagList: raw.tagList ?? [],
      favorited: raw.favorited ?? false,
      favoritesCount: raw.favoritesCount ?? 0,
      updatedAt: raw.updatedAt ?? raw.createdAt ?? '',
      author: typeof author === 'string'
        ? { username: author, bio: '', image: '', following: false }
        : author ?? { username: '', bio: '', image: '', following: false },
    };
  }

  // Format per endpoint
  if (method === 'list_articles') {
    const articles = ((parsed.articles as unknown[]) ?? []).map(a => normalizeArticle(a as Record<string, unknown>));
    return { articles, articlesCount: articles.length };
  }

  if (method === 'get_article') {
    const articles = ((parsed.articles as Array<{ slug: string }>) ?? []);
    const slug = parsed.slug as string;
    const raw = articles.find(a => a.slug === slug);
    if (!raw) return null;
    return { article: normalizeArticle(raw as unknown as Record<string, unknown>) };
  }

  if (method === 'list_tags') {
    const tags = (parsed.tags as string[]) ?? [];
    return { tags };
  }

  if (method === 'get_profile') {
    if (!parsed.profile) return null;
    return parsed;
  }

  if (method === 'list_comments') {
    const comments = (parsed.comments as unknown[]) ?? [];
    return { comments };
  }

  // Non-read endpoints: return body as-is
  return body;
}

export function createRouter(kernel: Kernel) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', concepts: 10, syncs: 8 }));
      return;
    }

    const matched = matchRoute(req.method || 'GET', req.url || '/');
    if (!matched) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: { body: ['Not found'] } }));
      return;
    }

    const body = await readBody(req);
    const token = extractToken(req);

    // Augment body with nested accessor for extractInput
    const bodyWithNested = new Proxy(body, {
      get(target, prop: string) {
        return safeGet(target, prop) || target[prop];
      },
    });

    const kernelInput: Record<string, unknown> = {
      method: matched.route.toKernelMethod,
      ...matched.route.extractInput(bodyWithNested, matched.params),
    };

    if (token) {
      kernelInput.token = token;
    }

    try {
      const result = await kernel.handleRequest(kernelInput);

      if (result.error) {
        const code = result.code || 422;
        res.writeHead(code as number, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: { body: [result.error] } }));
      } else {
        const responseBody = formatResponse(matched.route.toKernelMethod, result.body || {});
        const statusCode = responseBody === null ? 404 : 200;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseBody ?? { errors: { body: ['Not found'] } }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: { body: [message] } }));
    }
  };
}
