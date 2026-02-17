// ============================================================
// HTTP Transport Adapters
//
// Provides ConceptTransport implementations that communicate
// with remote concepts over HTTP. Two adapters per Section 6.4:
//
//   HttpLiteAdapter   — JSON-RPC for snapshot/lookup/filter
//   HttpGraphQLAdapter — GraphQL over HTTP for full query mode
//
// Both adapters invoke actions via POST with the ActionInvocation
// JSON envelope. The difference is in how queries are dispatched.
//
// For in-process testing, the adapters accept an optional fetch
// function, allowing mock HTTP without a real server.
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';

// --- Lite Filter (Section 4.3) ---

export interface LiteFilter {
  field: string;
  op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ne';
  value: unknown;
}

// --- State Snapshot (Section 4.3) ---

export interface ConceptStateSnapshot {
  asOf: string;
  relations: Record<string, Record<string, unknown>[]>;
}

// --- HTTP Fetch Function type ---

export type HttpFetchFn = (
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ status: number; json(): Promise<unknown> }>;

// --- HttpLiteAdapter ---

/**
 * HTTP transport adapter for lite query mode (Section 6.4).
 * Actions are invoked via POST /invoke.
 * Queries use JSON-RPC calls to snapshot/lookup/filter.
 */
export function createHttpLiteAdapter(
  baseUrl: string,
  fetchFn?: HttpFetchFn,
): ConceptTransport {
  const doFetch = fetchFn || defaultFetch;

  return {
    queryMode: 'lite' as const,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const response = await doFetch(`${baseUrl}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invocation),
      });

      if (response.status !== 200) {
        throw new Error(`HTTP invoke failed with status ${response.status}`);
      }

      return response.json() as Promise<ActionCompletion>;
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      // Lite mode: use lookup/filter JSON-RPC calls
      const rpcPayload = {
        method: 'query',
        params: {
          relation: request.relation,
          args: request.args || {},
        },
      };

      const response = await doFetch(`${baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcPayload),
      });

      if (response.status !== 200) {
        throw new Error(`HTTP query failed with status ${response.status}`);
      }

      const result = await response.json();
      return result as Record<string, unknown>[];
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        const response = await doFetch(`${baseUrl}/health`, {
          method: 'GET',
          headers: {},
          body: '',
        });
        const latency = Date.now() - start;
        return { available: response.status === 200, latency };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}

// --- HttpGraphQLAdapter ---

/**
 * HTTP transport adapter for full GraphQL query mode (Section 6.4).
 * Actions are invoked via POST /invoke (same as lite).
 * Queries are translated to GraphQL and sent via POST /graphql.
 */
export function createHttpGraphQLAdapter(
  baseUrl: string,
  fetchFn?: HttpFetchFn,
): ConceptTransport {
  const doFetch = fetchFn || defaultFetch;

  return {
    queryMode: 'graphql' as const,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const response = await doFetch(`${baseUrl}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invocation),
      });

      if (response.status !== 200) {
        throw new Error(`HTTP invoke failed with status ${response.status}`);
      }

      return response.json() as Promise<ActionCompletion>;
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      // Full-GraphQL mode: translate ConceptQuery to GraphQL query
      const graphqlQuery = request.graphql || buildGraphQLQuery(request);

      const response = await doFetch(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: graphqlQuery }),
      });

      if (response.status !== 200) {
        throw new Error(`HTTP GraphQL query failed with status ${response.status}`);
      }

      const result = await response.json() as { data?: Record<string, unknown[]> };
      if (result.data) {
        // Return the first field's value from the GraphQL response
        const values = Object.values(result.data);
        if (values.length > 0 && Array.isArray(values[0])) {
          return values[0] as Record<string, unknown>[];
        }
      }
      return [];
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        const response = await doFetch(`${baseUrl}/health`, {
          method: 'GET',
          headers: {},
          body: '',
        });
        const latency = Date.now() - start;
        return { available: response.status === 200, latency };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}

// --- Helper: build a simple GraphQL query from ConceptQuery ---

function buildGraphQLQuery(request: ConceptQuery): string {
  const args = request.args || {};
  const argEntries = Object.entries(args);

  if (argEntries.length === 0) {
    return `{ ${request.relation} { __all } }`;
  }

  const argStr = argEntries
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');

  return `{ ${request.relation}(${argStr}) { __all } }`;
}

// --- HTTP Server Handler ---

/**
 * Creates an HTTP request handler that serves a concept via HTTP.
 * This is the server-side counterpart to the HTTP adapters.
 * Accepts invocations, queries, and health checks.
 *
 * Returns a handler function that can be used with any HTTP server
 * framework (express, fastify, node http, etc.).
 */
export function createHttpConceptServer(
  transport: ConceptTransport,
): (path: string, method: string, body: unknown) => Promise<{ status: number; body: unknown }> {
  return async (path: string, method: string, body: unknown) => {
    if (path === '/health' && method === 'GET') {
      const health = await transport.health();
      return { status: 200, body: health };
    }

    if (path === '/invoke' && method === 'POST') {
      try {
        const invocation = body as ActionInvocation;
        const completion = await transport.invoke(invocation);
        return { status: 200, body: completion };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 500, body: { error: message } };
      }
    }

    if (path === '/query' && method === 'POST') {
      try {
        const request = body as { params: ConceptQuery };
        const results = await transport.query(request.params);
        return { status: 200, body: results };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 500, body: { error: message } };
      }
    }

    if (path === '/graphql' && method === 'POST') {
      // For full-GraphQL mode, pass through to the transport's query
      try {
        const { query } = body as { query: string };
        const results = await transport.query({ relation: '', graphql: query } as ConceptQuery & { graphql: string });
        return { status: 200, body: { data: { results } } };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 500, body: { errors: [{ message }] } };
      }
    }

    return { status: 404, body: { error: 'Not found' } };
  };
}

// --- Default fetch (uses globalThis.fetch if available) ---

function defaultFetch(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string },
): Promise<{ status: number; json(): Promise<unknown> }> {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.method !== 'GET' ? options.body : undefined,
    }) as Promise<{ status: number; json(): Promise<unknown> }>;
  }
  throw new Error('No fetch implementation available. Provide a custom fetchFn.');
}
