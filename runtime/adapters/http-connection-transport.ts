// ============================================================
// Clef Kernel — HTTP Connection Transport Adapter
//
// Section 6.4: Transport Layer
//   HttpConnectionAdapter — request/response for connect, invoke,
//   discover, and disconnect. SSE for observe (server-push).
//
// The fallback transport: simplest deployment model, compatible
// with serverless, CDNs, and HTTP proxies. Each invoke is a
// separate HTTP request (no persistent connection for req/res).
// Observe uses Server-Sent Events (unidirectional server→client).
//
// For testing, accepts a mock fetch implementation.
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from '../types.js';

// --- Types ---

/**
 * Injectable fetch function for testing without a real HTTP server.
 * Mirrors the browser/node fetch signature subset we use.
 */
export type HttpFetchFn = (
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
  body: ReadableStream<Uint8Array> | null;
  headers: { get(name: string): string | null };
}>;

/**
 * Configuration for the HTTP connection transport adapter.
 */
export interface HttpConnectionConfig {
  /** Base URL of the kernel HTTP endpoint (e.g., "http://localhost:4000/kernel"). */
  baseUrl: string;
  /** Optional fetch implementation. Defaults to globalThis.fetch. */
  fetchFn?: HttpFetchFn;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /** Additional headers sent with every request (e.g., custom auth). */
  defaultHeaders?: Record<string, string>;
}

/**
 * Session state maintained by the adapter after a successful connect.
 */
export interface HttpConnectionSession {
  sessionToken: string;
  registeredConcepts: string[];
  endpoint: string;
}

/**
 * SSE stream subscription handle. Call close() to stop receiving events.
 */
export interface SseSubscription {
  readonly streamId: string;
  close(): void;
}

/**
 * Callback for SSE completion events pushed by the server.
 */
export type CompletionHandler = (completion: ActionCompletion) => void;

// --- HTTP Connection Transport Adapter ---

/**
 * Create an HTTP connection transport adapter for the Connection concept.
 *
 * Protocol mapping:
 *   connect    → POST /connect    { endpoint, credentials }
 *   invoke     → POST /invoke     { concept, action, input }
 *   discover   → POST /discover   { depth, concept? }
 *   observe    → GET  /observe    Accept: text/event-stream (SSE)
 *   disconnect → POST /disconnect { session }
 *   query      → POST /query      { relation, args }
 *   health     → GET  /health
 *
 * Each request carries the session token as Authorization: Bearer <token>
 * after a successful connect.
 *
 * Observe uses Server-Sent Events: the server holds the connection open
 * and pushes ActionCompletion JSON objects as SSE data events. Multiple
 * SSE subscriptions can be active simultaneously; each is independently
 * closeable via AbortController.
 */
export function createHttpConnectionAdapter(
  config: HttpConnectionConfig,
): ConceptTransport & {
  /** Establish a session with the kernel. Must be called before invoke/observe. */
  connect(credentials?: string): Promise<HttpConnectionSession>;
  /** End the session and close all SSE subscriptions. */
  disconnect(): Promise<void>;
  /** Open an SSE subscription for completion events. */
  observe(
    concept: string,
    action: string | undefined,
    handler: CompletionHandler,
  ): SseSubscription;
  /** Current session, or null if not connected. */
  getSession(): HttpConnectionSession | null;
  /** Close all SSE subscriptions without disconnecting. */
  closeAllStreams(): void;
} {
  const {
    baseUrl,
    timeoutMs = 30_000,
    defaultHeaders = {},
  } = config;
  const doFetch = config.fetchFn || getDefaultFetch();

  let session: HttpConnectionSession | null = null;
  let streamCounter = 0;
  const activeStreams = new Map<string, AbortController>();

  // --- Helpers ---

  function buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...extra,
    };
    if (session?.sessionToken) {
      headers['Authorization'] = `Bearer ${session.sessionToken}`;
    }
    return headers;
  }

  function createAbortSignal(): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
      signal: controller.signal,
      clear: () => clearTimeout(timer),
    };
  }

  async function post<T>(
    path: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const { signal, clear } = createAbortSignal();
    try {
      const response = await doFetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: buildHeaders(extraHeaders),
        body: JSON.stringify(body),
        signal,
      });
      clear();

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `HTTP ${response.status} on POST ${path}: ${text || 'no body'}`,
        );
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clear();
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request to ${path} timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  async function get<T>(path: string): Promise<T> {
    const { signal, clear } = createAbortSignal();
    try {
      const response = await doFetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: buildHeaders({ 'Content-Type': '' }),
        signal,
      });
      clear();

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `HTTP ${response.status} on GET ${path}: ${text || 'no body'}`,
        );
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clear();
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request to ${path} timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  // --- ConceptTransport interface ---

  return {
    queryMode: 'lite' as const,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      return post<ActionCompletion>('/invoke', invocation as unknown as Record<string, unknown>);
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      const rpcPayload = {
        method: 'query',
        params: {
          relation: request.relation,
          args: request.args || {},
        },
      };
      return post<Record<string, unknown>[]>('/query', rpcPayload);
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        await get<{ available: boolean }>('/health');
        return { available: true, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },

    // --- Connection-specific methods ---

    /**
     * Establish a session with the kernel at the configured endpoint.
     *
     * POST /connect { endpoint, credentials? }
     * Response: { session, registeredConcepts }
     */
    async connect(credentials?: string): Promise<HttpConnectionSession> {
      const body: Record<string, unknown> = { endpoint: baseUrl };
      if (credentials) {
        body.credentials = credentials;
      }

      const result = await post<{
        session: string;
        registeredConcepts: string[];
      }>('/connect', body);

      session = {
        sessionToken: result.session,
        registeredConcepts: result.registeredConcepts,
        endpoint: baseUrl,
      };

      return session;
    },

    /**
     * End the session and close all active SSE subscriptions.
     *
     * POST /disconnect { session }
     * Idempotent: safe to call multiple times.
     */
    async disconnect(): Promise<void> {
      // Close all SSE streams first
      for (const [, controller] of activeStreams) {
        controller.abort();
      }
      activeStreams.clear();

      if (session) {
        try {
          await post('/disconnect', { session: session.sessionToken });
        } catch {
          // Best-effort: server may already be gone
        }
        session = null;
      }
    },

    /**
     * Open an SSE subscription for completion events.
     *
     * GET /observe?concept=X&action=Y
     * Accept: text/event-stream
     *
     * The server holds the connection open and pushes ActionCompletion
     * objects as SSE data events. Each event has:
     *   event: completion
     *   data: <JSON-encoded ActionCompletion>
     *
     * Returns a subscription handle with a close() method.
     */
    observe(
      concept: string,
      action: string | undefined,
      handler: CompletionHandler,
    ): SseSubscription {
      const streamId = `sse-${++streamCounter}`;
      const controller = new AbortController();
      activeStreams.set(streamId, controller);

      // Build SSE URL with query parameters
      const params = new URLSearchParams({ concept });
      if (action) {
        params.set('action', action);
      }
      const sseUrl = `${baseUrl}/observe?${params.toString()}`;

      // Start SSE connection in the background
      startSseStream(sseUrl, controller.signal, handler, streamId);

      return {
        streamId,
        close() {
          controller.abort();
          activeStreams.delete(streamId);
        },
      };
    },

    getSession(): HttpConnectionSession | null {
      return session;
    },

    closeAllStreams(): void {
      for (const [, controller] of activeStreams) {
        controller.abort();
      }
      activeStreams.clear();
    },
  };

  // --- SSE Streaming ---

  /**
   * Connect to an SSE endpoint and parse incoming events.
   *
   * Uses fetch with streaming body reader to process SSE lines.
   * Handles reconnection-friendly event format:
   *   event: completion
   *   data: {"id":"...","concept":"...","action":"...","variant":"ok",...}
   *
   * The stream runs until the AbortController signal fires or the
   * server closes the connection.
   */
  async function startSseStream(
    url: string,
    signal: AbortSignal,
    handler: CompletionHandler,
    streamId: string,
  ): Promise<void> {
    try {
      const response = await doFetch(url, {
        method: 'GET',
        headers: {
          ...buildHeaders(),
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Content-Type': '',
        },
        signal,
      });

      if (!response.ok) {
        activeStreams.delete(streamId);
        return;
      }

      const body = response.body;
      if (!body) {
        activeStreams.delete(streamId);
        return;
      }

      // Parse the SSE stream
      await parseSseStream(body, signal, handler);
    } catch (err: unknown) {
      // AbortError is expected when close() is called
      if (err instanceof Error && err.name !== 'AbortError') {
        // Unexpected error — clean up
        activeStreams.delete(streamId);
      }
    }
  }
}

// --- SSE Parser ---

/**
 * Parse a ReadableStream as Server-Sent Events.
 *
 * SSE format (https://html.spec.whatwg.org/multipage/server-sent-events.html):
 *   event: <type>\n
 *   data: <payload>\n
 *   \n
 *
 * We only process events with type "completion". The data field is
 * JSON-parsed as an ActionCompletion and dispatched to the handler.
 */
async function parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  handler: CompletionHandler,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line === '') {
          // Empty line = end of event
          if (currentEvent === 'completion' && currentData) {
            try {
              const completion = JSON.parse(currentData) as ActionCompletion;
              handler(completion);
            } catch {
              // Skip malformed event data
            }
          }
          currentEvent = '';
          currentData = '';
        } else if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          // Support multi-line data by appending
          const dataLine = line.slice(5).trim();
          currentData = currentData ? currentData + '\n' + dataLine : dataLine;
        }
        // Ignore id:, retry:, and comment lines (starting with :)
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- HTTP Connection Server Handler ---

/**
 * Create a server-side HTTP handler for the Connection concept transport.
 *
 * This is the server-side counterpart to createHttpConnectionAdapter.
 * It wraps a ConceptTransport and adds Connection-specific routes:
 *
 *   POST /connect     → create session, return token + registered concepts
 *   POST /disconnect  → invalidate session
 *   GET  /observe     → SSE stream of completion events
 *   POST /invoke      → standard ConceptTransport invoke
 *   POST /query       → standard ConceptTransport query
 *   GET  /health      → standard health check
 *
 * The observe endpoint returns SSE events with:
 *   event: completion
 *   data: <JSON ActionCompletion>
 */
export function createHttpConnectionServer(
  transport: ConceptTransport,
  options?: {
    /** Authenticate credentials on connect. Return session token or null to reject. */
    authenticate?: (credentials?: string) => Promise<string | null>;
    /** Return the list of registered concept names. */
    listConcepts?: () => string[];
    /** Validate a session token. Return true if valid. */
    validateSession?: (token: string) => boolean;
  },
): (
  path: string,
  method: string,
  body: unknown,
  headers?: Record<string, string>,
) => Promise<{
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  stream?: ReadableStream<Uint8Array>;
}> {
  const sessions = new Set<string>();
  let sessionCounter = 0;
  const completionSubscribers = new Map<string, (completion: ActionCompletion) => void>();

  const authenticate = options?.authenticate ?? (async () => `sess-${++sessionCounter}-${Date.now()}`);
  const listConcepts = options?.listConcepts ?? (() => []);
  const validateSession = options?.validateSession ?? ((token: string) => sessions.has(token));

  return async (path, method, body, headers) => {
    // --- Connect ---
    if (path === '/connect' && method === 'POST') {
      try {
        const { credentials } = (body as { credentials?: string }) || {};
        const token = await authenticate(credentials);
        if (!token) {
          return {
            status: 401,
            body: { error: 'unauthorized', message: 'Invalid credentials' },
          };
        }
        sessions.add(token);
        return {
          status: 200,
          body: {
            session: token,
            registeredConcepts: listConcepts(),
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 500, body: { error: message } };
      }
    }

    // --- Disconnect ---
    if (path === '/disconnect' && method === 'POST') {
      const { session } = (body as { session?: string }) || {};
      if (session) {
        sessions.delete(session);
        // Close any SSE subscriptions for this session
        for (const [key] of completionSubscribers) {
          if (key.startsWith(session)) {
            completionSubscribers.delete(key);
          }
        }
      }
      return { status: 200, body: { ok: true } };
    }

    // --- Observe (SSE) ---
    if (path.startsWith('/observe') && method === 'GET') {
      const authHeader = headers?.['authorization'] || headers?.['Authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/, '');
      if (!validateSession(token)) {
        return { status: 401, body: { error: 'unauthorized' } };
      }

      // Parse query params from path
      const urlParts = path.split('?');
      const params = new URLSearchParams(urlParts[1] || '');
      const concept = params.get('concept') || '';
      const action = params.get('action') || undefined;

      // Create an SSE stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // Register a subscriber that pushes completions as SSE events
          const subKey = `${token}:${concept}:${action || '*'}:${Date.now()}`;

          const subscriber = (completion: ActionCompletion) => {
            // Filter by concept and optional action
            if (completion.concept !== concept) return;
            if (action && completion.action !== action) return;

            const event = `event: completion\ndata: ${JSON.stringify(completion)}\n\n`;
            try {
              controller.enqueue(encoder.encode(event));
            } catch {
              // Stream closed
              completionSubscribers.delete(subKey);
            }
          };

          completionSubscribers.set(subKey, subscriber);
        },
      });

      return {
        status: 200,
        body: null,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        stream,
      };
    }

    // --- Standard ConceptTransport: invoke ---
    if (path === '/invoke' && method === 'POST') {
      // Validate session
      const authHeader = headers?.['authorization'] || headers?.['Authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/, '');
      if (!validateSession(token)) {
        return { status: 401, body: { error: 'unauthorized' } };
      }

      try {
        const invocation = body as ActionInvocation;
        const completion = await transport.invoke(invocation);

        // Push completion to SSE subscribers
        for (const subscriber of completionSubscribers.values()) {
          subscriber(completion);
        }

        return { status: 200, body: completion };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 500, body: { error: message } };
      }
    }

    // --- Standard ConceptTransport: query ---
    if (path === '/query' && method === 'POST') {
      const authHeader = headers?.['authorization'] || headers?.['Authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/, '');
      if (!validateSession(token)) {
        return { status: 401, body: { error: 'unauthorized' } };
      }

      try {
        const request = body as { params: ConceptQuery };
        const results = await transport.query(request.params);
        return { status: 200, body: results };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 500, body: { error: message } };
      }
    }

    // --- Health ---
    if (path === '/health' && method === 'GET') {
      const health = await transport.health();
      return { status: 200, body: health };
    }

    return { status: 404, body: { error: 'Not found' } };
  };
}

// --- Default fetch ---

function getDefaultFetch(): HttpFetchFn {
  const g = globalThis as Record<string, unknown>;
  if (typeof g['fetch'] === 'function') {
    return g['fetch'] as HttpFetchFn;
  }
  throw new Error(
    'No fetch implementation available. Provide a custom fetchFn in HttpConnectionConfig.',
  );
}
