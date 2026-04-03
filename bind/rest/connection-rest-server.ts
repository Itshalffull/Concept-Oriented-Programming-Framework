// ============================================================
// Clef Bind — Connection-Aware REST Server Adapter
//
// Section 6.3: REST target wiring through Connection.
//   Auto-generates RESTful routes from Connection/discover, then
//   dispatches every request through Connection/invoke. Variant
//   results map to HTTP status codes.
//
// Framework-agnostic: exports standard Request→Response handlers
// compatible with any runtime (Deno, Bun, Node, Cloudflare Workers).
// ============================================================

import type {
  TransportAdapter,
  TransportSession,
} from '../../runtime/adapters/connection-transport.js';

// --- Public Types ---

/**
 * Configuration for the Connection-aware REST server.
 */
export interface ConnectionRestConfig {
  /** Kernel endpoint to connect to (e.g., "ws://localhost:3000/kernel"). */
  endpoint: string;
  /** Optional credentials for Connection/connect (API key, OAuth token, etc.). */
  credentials?: string;
  /** Transport protocol identifier. Defaults to "http". */
  transport?: string;
  /** URL prefix for all generated routes. Defaults to "/api". */
  prefix?: string;
}

/**
 * Framework-agnostic request representation.
 * Compatible with the WHATWG Request interface subset used across runtimes.
 */
export interface RestRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

/**
 * Framework-agnostic response representation.
 */
export interface RestResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/**
 * A request handler that processes a RestRequest and returns a RestResponse,
 * or null if the request does not match any generated route.
 */
export type RequestHandler = (request: RestRequest) => Promise<RestResponse | null>;

/**
 * Concept manifest entry returned by Connection/discover(depth: "manifest").
 */
interface DiscoveredConcept {
  name: string;
  actions: string[];
  variants?: string[];
}

/**
 * Discovery result from Connection/discover.
 */
interface DiscoverResult {
  depth: string;
  concepts: DiscoveredConcept[];
}

// --- Variant → HTTP Status Mapping ---

const VARIANT_STATUS_MAP: Record<string, number> = {
  ok: 200,
  created: 201,
  not_found: 404,
  notfound: 404,
  unauthorized: 403,
  forbidden: 403,
  duplicate: 409,
  already_exists: 409,
  conflict: 409,
  invalid: 400,
  bad_input: 400,
  validation_error: 400,
  not_supported: 405,
  disconnected: 503,
  error: 500,
};

/**
 * Map a Connection/invoke completion variant to an HTTP status code.
 * Falls back to 500 for unrecognized variants.
 */
function variantToStatus(variant: string): number {
  return VARIANT_STATUS_MAP[variant] ?? 500;
}

// --- Route Matching ---

/**
 * Parsed route pattern for matching incoming requests.
 */
interface RoutePattern {
  method: string;
  /** Regex to match the URL path. */
  pattern: RegExp;
  /** Concept name to invoke. */
  concept: string;
  /** Action name to invoke. */
  action: string;
  /** Whether this route captures an :id parameter. */
  hasId: boolean;
}

/**
 * Build REST route patterns for a discovered concept.
 *
 * Standard CRUD mapping:
 *   POST   /prefix/{concept}      → create
 *   GET    /prefix/{concept}      → list
 *   GET    /prefix/{concept}/:id  → get
 *   PUT    /prefix/{concept}/:id  → update
 *   DELETE /prefix/{concept}/:id  → delete
 *
 * Only routes whose action exists in the concept's declared actions are
 * generated. Additional actions beyond CRUD are not auto-routed — they
 * can be invoked through the generic /prefix/_invoke endpoint.
 */
function buildRoutesForConcept(
  concept: DiscoveredConcept,
  prefix: string,
): RoutePattern[] {
  const routes: RoutePattern[] = [];
  const slug = concept.name.toLowerCase();
  const base = `${prefix}/${slug}`;
  // Escape prefix for regex (handles slashes)
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const crudMap: Array<{ method: string; action: string; hasId: boolean; suffix: string }> = [
    { method: 'POST', action: 'create', hasId: false, suffix: '' },
    { method: 'GET', action: 'list', hasId: false, suffix: '' },
    { method: 'GET', action: 'get', hasId: true, suffix: '/([^/]+)' },
    { method: 'PUT', action: 'update', hasId: true, suffix: '/([^/]+)' },
    { method: 'DELETE', action: 'delete', hasId: true, suffix: '/([^/]+)' },
  ];

  for (const mapping of crudMap) {
    if (concept.actions.includes(mapping.action)) {
      routes.push({
        method: mapping.method,
        concept: concept.name,
        action: mapping.action,
        hasId: mapping.hasId,
        pattern: new RegExp(`^${escapedBase}${mapping.suffix}$`),
      });
    }
  }

  return routes;
}

// --- URL Path Extraction ---

/**
 * Extract the pathname from a URL string, handling both absolute URLs
 * and relative paths.
 */
function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    // Relative URL — extract path before query string
    const qIndex = url.indexOf('?');
    return qIndex >= 0 ? url.slice(0, qIndex) : url;
  }
}

/**
 * Extract query parameters from a URL string.
 */
function extractQuery(url: string): Record<string, string> {
  try {
    const parsed = new URL(url);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    const qIndex = url.indexOf('?');
    if (qIndex < 0) return {};
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(url.slice(qIndex + 1));
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
}

// --- Generic Invoke Endpoint ---

/**
 * Build a route pattern for the generic invoke endpoint:
 *   POST /prefix/_invoke { concept, action, input }
 *
 * This allows invoking any action (including non-CRUD actions)
 * through a single endpoint.
 */
function buildGenericInvokePattern(prefix: string): RegExp {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}/_invoke$`);
}

// --- JSON Response Helper ---

function jsonResponse(status: number, body: unknown): RestResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// --- Factory ---

/**
 * Create a Connection-aware REST server that auto-generates routes
 * from Connection/discover and dispatches through Connection/invoke.
 *
 * Lifecycle:
 *   1. Connects to the kernel via the provided TransportAdapter
 *   2. Discovers registered concepts at manifest depth
 *   3. Builds RESTful route patterns for each concept's CRUD actions
 *   4. Returns a RequestHandler that matches incoming requests to routes
 *
 * The returned handler returns null for requests that don't match any
 * route, allowing composition with other handlers or middleware.
 *
 * @param config - Connection configuration (endpoint, credentials, prefix)
 * @param adapter - TransportAdapter instance (WebSocket, HTTP, etc.)
 * @returns A RequestHandler array (one handler that covers all routes)
 */
export async function createConnectionRestServer(
  config: ConnectionRestConfig,
  adapter: TransportAdapter,
): Promise<RequestHandler[]> {
  const prefix = (config.prefix ?? '/api').replace(/\/+$/, '');

  // 1. Connect to kernel via Connection/connect
  let session: TransportSession;
  try {
    session = await adapter.connect(config.endpoint, config.credentials);
  } catch (err) {
    throw new Error(
      `Failed to connect to kernel at ${config.endpoint}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // 2. Discover registered concepts at manifest depth
  let concepts: DiscoveredConcept[] = [];
  try {
    const discoverResult = await adapter.invoke(
      session,
      'Connection',
      'discover',
      JSON.stringify({ connection: session.sessionId, depth: 'manifest' }),
    );

    if (discoverResult.variant === 'ok') {
      const parsed = JSON.parse(discoverResult.output) as {
        result?: string;
        connection?: string;
      };
      if (parsed.result) {
        const result = JSON.parse(parsed.result) as DiscoverResult;
        concepts = result.concepts;
      }
    }
  } catch {
    // Discovery failed — server starts with no auto-generated routes.
    // The generic _invoke endpoint still works.
  }

  // 3. Build route patterns from discovered concepts
  const routes: RoutePattern[] = [];
  for (const concept of concepts) {
    routes.push(...buildRoutesForConcept(concept, prefix));
  }

  const genericInvokePattern = buildGenericInvokePattern(prefix);

  // 4. Build and return the request handler

  /**
   * Invoke a concept action through Connection and return a REST response.
   */
  async function invokeAction(
    concept: string,
    action: string,
    input: Record<string, unknown>,
  ): Promise<RestResponse> {
    try {
      const result = await adapter.invoke(
        session,
        concept,
        action,
        JSON.stringify(input),
      );

      const status = variantToStatus(result.variant);
      let output: unknown;
      try {
        output = JSON.parse(result.output);
      } catch {
        output = result.output;
      }

      return jsonResponse(status, {
        variant: result.variant,
        output,
      });
    } catch (err) {
      return jsonResponse(500, {
        variant: 'error',
        output: {
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  /**
   * The main request handler. Matches incoming requests against
   * generated route patterns and the generic _invoke endpoint.
   */
  const handler: RequestHandler = async (request: RestRequest): Promise<RestResponse | null> => {
    const path = extractPath(request.url);
    const method = request.method.toUpperCase();

    // --- Generic invoke endpoint ---
    if (method === 'POST' && genericInvokePattern.test(path)) {
      try {
        const body = (await request.json()) as {
          concept?: string;
          action?: string;
          input?: Record<string, unknown>;
        };

        if (!body.concept || !body.action) {
          return jsonResponse(400, {
            variant: 'bad_input',
            output: { message: 'Request body must include "concept" and "action" fields' },
          });
        }

        return invokeAction(body.concept, body.action, body.input ?? {});
      } catch {
        return jsonResponse(400, {
          variant: 'bad_input',
          output: { message: 'Invalid JSON request body' },
        });
      }
    }

    // --- CRUD route matching ---
    for (const route of routes) {
      if (method !== route.method) continue;

      const match = route.pattern.exec(path);
      if (!match) continue;

      let input: Record<string, unknown> = {};

      if (route.hasId) {
        // Extract :id from path
        input.id = decodeURIComponent(match[1]);
      }

      if (method === 'POST' || method === 'PUT') {
        // Merge request body into input
        try {
          const body = (await request.json()) as Record<string, unknown>;
          input = { ...input, ...body };
        } catch {
          return jsonResponse(400, {
            variant: 'bad_input',
            output: { message: 'Invalid JSON request body' },
          });
        }
      }

      if (method === 'GET' && !route.hasId) {
        // GET collection — pass query parameters as input
        const query = extractQuery(request.url);
        input = { ...input, ...query };
      }

      return invokeAction(route.concept, route.action, input);
    }

    // No matching route
    return null;
  };

  return [handler];
}

/**
 * Disconnect the REST server from the kernel.
 * Call this during server shutdown to clean up the Connection session.
 */
export async function disconnectRestServer(
  adapter: TransportAdapter,
  session: TransportSession,
): Promise<void> {
  await adapter.disconnect(session);
}
