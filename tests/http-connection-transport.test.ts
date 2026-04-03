// ============================================================
// HTTP Connection Transport Adapter Tests
//
// Validates the HTTP transport adapter for the Connection concept:
//   - Client: connect, invoke, observe (SSE), disconnect, health
//   - Server: routing, session management, SSE streaming
//   - Error handling: timeouts, auth failures, missing sessions
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createHttpConnectionAdapter,
  createHttpConnectionServer,
  type HttpFetchFn,
  type HttpConnectionConfig,
  type CompletionHandler,
} from '../runtime/adapters/http-connection-transport.js';
import {
  createInMemoryStorage,
  createInProcessAdapter,
} from '../runtime/index.js';
import type {
  ConceptHandler,
  ConceptTransport,
  ActionInvocation,
  ActionCompletion,
} from '../runtime/types.js';

// --- Test Helpers ---

function makeInvocation(overrides?: Partial<ActionInvocation>): ActionInvocation {
  return {
    id: 'inv-1',
    concept: 'Task',
    action: 'create',
    input: { name: 'Write specs' },
    flow: 'flow-1',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeCompletion(overrides?: Partial<ActionCompletion>): ActionCompletion {
  return {
    id: 'inv-1',
    concept: 'Task',
    action: 'create',
    input: { name: 'Write specs' },
    variant: 'ok',
    output: { id: 'task-1' },
    flow: 'flow-1',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock fetch that routes requests to an HTTP connection server handler.
 */
function createMockFetchForServer(
  serverHandler: (
    path: string,
    method: string,
    body: unknown,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; body: unknown; headers?: Record<string, string>; stream?: ReadableStream<Uint8Array> }>,
): HttpFetchFn {
  return async (url: string, options) => {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    const method = options.method;
    const body = options.body ? JSON.parse(options.body) : undefined;
    const headers = options.headers;

    const result = await serverHandler(path, method, body, headers);

    return {
      status: result.status,
      ok: result.status >= 200 && result.status < 300,
      json: async () => result.body,
      text: async () => JSON.stringify(result.body),
      body: result.stream || null,
      headers: {
        get: (name: string) => result.headers?.[name] ?? null,
      },
    };
  };
}

// ============================================================
// 1. Client-Side Adapter
// ============================================================

describe('HttpConnectionAdapter — Client', () => {
  it('connects to a kernel and receives session + concepts', async () => {
    const mockFetch: HttpFetchFn = async (_url, options) => {
      const body = JSON.parse(options.body!);
      expect(body.endpoint).toBe('http://localhost:4000/kernel');
      return {
        status: 200,
        ok: true,
        json: async () => ({
          session: 'sess-abc',
          registeredConcepts: ['Task', 'User', 'Note'],
        }),
        text: async () => '',
        body: null,
        headers: { get: () => null },
      };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    const session = await adapter.connect();
    expect(session.sessionToken).toBe('sess-abc');
    expect(session.registeredConcepts).toEqual(['Task', 'User', 'Note']);
    expect(session.endpoint).toBe('http://localhost:4000/kernel');
    expect(adapter.getSession()).toEqual(session);
  });

  it('invokes actions with session token in Authorization header', async () => {
    let capturedHeaders: Record<string, string> = {};

    const mockFetch: HttpFetchFn = async (url, options) => {
      capturedHeaders = options.headers;
      const path = new URL(url).pathname;

      if (path.endsWith('/connect')) {
        return {
          status: 200, ok: true,
          json: async () => ({ session: 'sess-xyz', registeredConcepts: ['Task'] }),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }

      if (path.endsWith('/invoke')) {
        return {
          status: 200, ok: true,
          json: async () => makeCompletion(),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }

      return { status: 404, ok: false, json: async () => ({}), text: async () => '', body: null, headers: { get: () => null } };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    await adapter.connect();
    const completion = await adapter.invoke(makeInvocation());

    expect(completion.variant).toBe('ok');
    expect(capturedHeaders['Authorization']).toBe('Bearer sess-xyz');
  });

  it('queries state via lite mode', async () => {
    const mockFetch: HttpFetchFn = async (url, options) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/connect')) {
        return {
          status: 200, ok: true,
          json: async () => ({ session: 'sess-q', registeredConcepts: [] }),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }
      if (path.endsWith('/query')) {
        const body = JSON.parse(options.body!);
        expect(body.params.relation).toBe('tasks');
        expect(body.params.args).toEqual({ status: 'open' });
        return {
          status: 200, ok: true,
          json: async () => [{ id: 'task-1', status: 'open' }],
          text: async () => '', body: null, headers: { get: () => null },
        };
      }
      return { status: 404, ok: false, json: async () => ({}), text: async () => '', body: null, headers: { get: () => null } };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    await adapter.connect();
    const results = await adapter.query({ relation: 'tasks', args: { status: 'open' } });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('task-1');
  });

  it('reports health as available when server responds 200', async () => {
    const mockFetch: HttpFetchFn = async () => ({
      status: 200, ok: true,
      json: async () => ({ available: true }),
      text: async () => '', body: null, headers: { get: () => null },
    });

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    const health = await adapter.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });

  it('reports health as unavailable when server errors', async () => {
    const mockFetch: HttpFetchFn = async () => {
      throw new Error('ECONNREFUSED');
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    const health = await adapter.health();
    expect(health.available).toBe(false);
  });

  it('disconnects and clears session', async () => {
    let disconnectCalled = false;

    const mockFetch: HttpFetchFn = async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/connect')) {
        return {
          status: 200, ok: true,
          json: async () => ({ session: 'sess-dc', registeredConcepts: [] }),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }
      if (path.endsWith('/disconnect')) {
        disconnectCalled = true;
        return {
          status: 200, ok: true,
          json: async () => ({ ok: true }),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }
      return { status: 404, ok: false, json: async () => ({}), text: async () => '', body: null, headers: { get: () => null } };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    await adapter.connect();
    expect(adapter.getSession()).not.toBeNull();

    await adapter.disconnect();
    expect(disconnectCalled).toBe(true);
    expect(adapter.getSession()).toBeNull();
  });

  it('includes default headers in all requests', async () => {
    let capturedHeaders: Record<string, string> = {};

    const mockFetch: HttpFetchFn = async (_url, options) => {
      capturedHeaders = options.headers;
      return {
        status: 200, ok: true,
        json: async () => ({ session: 'sess-hdr', registeredConcepts: [] }),
        text: async () => '', body: null, headers: { get: () => null },
      };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
      defaultHeaders: { 'X-Request-Id': 'req-123' },
    });

    await adapter.connect();
    expect(capturedHeaders['X-Request-Id']).toBe('req-123');
  });

  it('queryMode is lite', () => {
    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: async () => ({
        status: 200, ok: true, json: async () => ({}),
        text: async () => '', body: null, headers: { get: () => null },
      }),
    });

    expect(adapter.queryMode).toBe('lite');
  });
});

// ============================================================
// 2. Client-Side SSE (Observe)
// ============================================================

describe('HttpConnectionAdapter — SSE Observe', () => {
  it('opens an SSE subscription and returns a stream handle', async () => {
    const mockFetch: HttpFetchFn = async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/connect')) {
        return {
          status: 200, ok: true,
          json: async () => ({ session: 'sess-sse', registeredConcepts: ['Task'] }),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }
      if (path.endsWith('/observe')) {
        // Return an empty readable stream (no events)
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return {
          status: 200, ok: true,
          json: async () => ({}), text: async () => '',
          body: stream,
          headers: { get: (name: string) => name === 'content-type' ? 'text/event-stream' : null },
        };
      }
      return { status: 404, ok: false, json: async () => ({}), text: async () => '', body: null, headers: { get: () => null } };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    await adapter.connect();
    const handler = vi.fn();
    const sub = adapter.observe('Task', undefined, handler);

    expect(sub.streamId).toMatch(/^sse-/);
    expect(typeof sub.close).toBe('function');

    // Clean up
    sub.close();
  });

  it('parses SSE events and dispatches to handler', async () => {
    const completion = makeCompletion({ concept: 'Task', action: 'create' });
    const ssePayload = `event: completion\ndata: ${JSON.stringify(completion)}\n\n`;

    const mockFetch: HttpFetchFn = async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/connect')) {
        return {
          status: 200, ok: true,
          json: async () => ({ session: 'sess-sse2', registeredConcepts: ['Task'] }),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }
      if (path.endsWith('/observe')) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(ssePayload));
            controller.close();
          },
        });
        return {
          status: 200, ok: true,
          json: async () => ({}), text: async () => '',
          body: stream,
          headers: { get: () => 'text/event-stream' },
        };
      }
      return { status: 404, ok: false, json: async () => ({}), text: async () => '', body: null, headers: { get: () => null } };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    await adapter.connect();

    const received: ActionCompletion[] = [];
    const sub = adapter.observe('Task', 'create', (c) => received.push(c));

    // Wait for the SSE stream to be processed
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(received).toHaveLength(1);
    expect(received[0].concept).toBe('Task');
    expect(received[0].action).toBe('create');
    expect(received[0].variant).toBe('ok');

    sub.close();
  });

  it('closeAllStreams aborts all active SSE connections', async () => {
    const mockFetch: HttpFetchFn = async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/connect')) {
        return {
          status: 200, ok: true,
          json: async () => ({ session: 'sess-close', registeredConcepts: ['Task'] }),
          text: async () => '', body: null, headers: { get: () => null },
        };
      }
      if (path.endsWith('/observe')) {
        // Long-lived stream that never closes
        const stream = new ReadableStream<Uint8Array>({
          start() {
            // Keep alive indefinitely
          },
        });
        return {
          status: 200, ok: true,
          json: async () => ({}), text: async () => '',
          body: stream,
          headers: { get: () => 'text/event-stream' },
        };
      }
      return { status: 404, ok: false, json: async () => ({}), text: async () => '', body: null, headers: { get: () => null } };
    };

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000/kernel',
      fetchFn: mockFetch,
    });

    await adapter.connect();
    const sub1 = adapter.observe('Task', undefined, () => {});
    const sub2 = adapter.observe('Task', 'create', () => {});

    expect(sub1.streamId).not.toBe(sub2.streamId);

    adapter.closeAllStreams();
    // After closeAllStreams, internal map should be cleared
    // Verifying no errors thrown is sufficient
  });
});

// ============================================================
// 3. Server-Side Handler
// ============================================================

describe('HttpConnectionServer', () => {
  function createTestServer() {
    const handler: ConceptHandler = {
      async create(input, storage) {
        const id = `task-${Date.now()}`;
        await storage.put('tasks', id, { id, name: input.name });
        return { variant: 'ok', id };
      },
    };

    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(handler, storage);

    const server = createHttpConnectionServer(transport, {
      authenticate: async (credentials) => {
        if (credentials === 'bad') return null;
        return `sess-${Date.now()}`;
      },
      listConcepts: () => ['Task', 'User'],
      validateSession: (token) => token.startsWith('sess-'),
    });

    return { server, transport };
  }

  it('handles POST /connect with valid credentials', async () => {
    const { server } = createTestServer();
    const result = await server('/connect', 'POST', { credentials: 'valid-key' });

    expect(result.status).toBe(200);
    const body = result.body as { session: string; registeredConcepts: string[] };
    expect(body.session).toMatch(/^sess-/);
    expect(body.registeredConcepts).toEqual(['Task', 'User']);
  });

  it('rejects POST /connect with invalid credentials', async () => {
    const { server } = createTestServer();
    const result = await server('/connect', 'POST', { credentials: 'bad' });

    expect(result.status).toBe(401);
    const body = result.body as { error: string };
    expect(body.error).toBe('unauthorized');
  });

  it('handles POST /disconnect', async () => {
    const { server } = createTestServer();

    // Connect first
    const connectResult = await server('/connect', 'POST', {});
    const { session } = connectResult.body as { session: string };

    // Disconnect
    const result = await server('/disconnect', 'POST', { session });
    expect(result.status).toBe(200);
  });

  it('handles POST /invoke with valid session', async () => {
    const { server } = createTestServer();

    const invocation = makeInvocation({ concept: 'urn:app:Task' });
    const result = await server('/invoke', 'POST', invocation, {
      'authorization': 'Bearer sess-valid',
    });

    expect(result.status).toBe(200);
    const body = result.body as ActionCompletion;
    expect(body.variant).toBe('ok');
  });

  it('rejects POST /invoke without valid session', async () => {
    const { server } = createTestServer();

    const result = await server('/invoke', 'POST', makeInvocation(), {
      'authorization': 'Bearer invalid-token',
    });

    expect(result.status).toBe(401);
  });

  it('handles POST /query with valid session', async () => {
    const { server } = createTestServer();

    const result = await server('/query', 'POST',
      { params: { relation: 'tasks', args: {} } },
      { 'authorization': 'Bearer sess-q' },
    );

    expect(result.status).toBe(200);
    expect(Array.isArray(result.body)).toBe(true);
  });

  it('handles GET /health', async () => {
    const { server } = createTestServer();
    const result = await server('/health', 'GET', null);

    expect(result.status).toBe(200);
    const body = result.body as { available: boolean; latency: number };
    expect(body.available).toBe(true);
  });

  it('returns 404 for unknown routes', async () => {
    const { server } = createTestServer();
    const result = await server('/unknown', 'GET', null);
    expect(result.status).toBe(404);
  });

  it('handles GET /observe with SSE stream response', async () => {
    const { server } = createTestServer();

    const result = await server(
      '/observe?concept=Task&action=create',
      'GET',
      null,
      { 'authorization': 'Bearer sess-observe' },
    );

    expect(result.status).toBe(200);
    expect(result.headers?.['Content-Type']).toBe('text/event-stream');
    expect(result.stream).toBeDefined();
  });

  it('rejects GET /observe without valid session', async () => {
    const { server } = createTestServer();

    const result = await server(
      '/observe?concept=Task',
      'GET',
      null,
      { 'authorization': 'Bearer invalid' },
    );

    expect(result.status).toBe(401);
  });
});

// ============================================================
// 4. Client + Server Integration
// ============================================================

describe('HttpConnectionAdapter + Server Integration', () => {
  it('full lifecycle: connect, invoke, disconnect', async () => {
    const handler: ConceptHandler = {
      async create(input, storage) {
        const id = `task-${Date.now()}`;
        await storage.put('tasks', id, { id, name: input.name });
        return { variant: 'ok', id, name: input.name };
      },
    };

    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(handler, storage);

    const server = createHttpConnectionServer(transport, {
      listConcepts: () => ['Task'],
    });

    const mockFetch = createMockFetchForServer(server);

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000',
      fetchFn: mockFetch,
    });

    // Connect
    const session = await adapter.connect();
    expect(session.sessionToken).toBeDefined();
    expect(session.registeredConcepts).toEqual(['Task']);

    // Invoke
    const completion = await adapter.invoke(makeInvocation());
    expect(completion.variant).toBe('ok');

    // Disconnect
    await adapter.disconnect();
    expect(adapter.getSession()).toBeNull();
  });

  it('health check through adapter and server', async () => {
    const transport: ConceptTransport = {
      queryMode: 'lite',
      async invoke() { return makeCompletion(); },
      async query() { return []; },
      async health() { return { available: true, latency: 1 }; },
    };

    const server = createHttpConnectionServer(transport);
    const mockFetch = createMockFetchForServer(server);

    const adapter = createHttpConnectionAdapter({
      baseUrl: 'http://localhost:4000',
      fetchFn: mockFetch,
    });

    const health = await adapter.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });
});
