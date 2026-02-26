// ============================================================
// Transport Tests
//
// Validates HTTP and WebSocket transport adapters:
//   - HttpLiteAdapter (invoke, query, health)
//   - HttpGraphQLAdapter (invoke)
//   - HttpConceptServer (routing)
//   - Cross-language interop simulation
//   - WebSocket adapter (invoke, health, push completions)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createInMemoryStorage,
  createInProcessAdapter,
  createConceptRegistry,
  createSelfHostedKernel,
  createHttpLiteAdapter,
  createHttpGraphQLAdapter,
  createHttpConceptServer,
  createWebSocketAdapter,
  createWebSocketConceptServer,
} from '../kernel/src/index.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { createSyncEngineHandler } from '../handlers/ts/framework/sync-engine.handler.js';
import { actionLogHandler } from '../handlers/ts/framework/action-log.handler.js';
import type {
  ConceptHandler,
  ConceptTransport,
  ActionInvocation,
  ActionCompletion,
} from '../kernel/src/types.js';
import type { MockWebSocket } from '../kernel/src/ws-transport.js';

// ============================================================
// 1. HTTP Transport Adapters
// ============================================================

describe('HTTP Transport Adapters', () => {
  it('HttpLiteAdapter invokes actions via mock HTTP', async () => {
    // Create a concept handler to serve as the "remote" concept
    const passwordHandler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          password: input.password,
        });
        return { variant: 'ok', user: input.user };
      },
      async check(input, storage) {
        const entry = await storage.get('entries', input.user as string);
        if (!entry) return { variant: 'notfound', message: 'No credentials' };
        return { variant: 'ok', valid: entry.password === input.password };
      },
    };

    // Set up the server-side transport
    const storage = createInMemoryStorage();
    const serverTransport = createInProcessAdapter(passwordHandler, storage);
    const server = createHttpConceptServer(serverTransport);

    // Create a mock fetch that routes to the server
    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    // Create the HTTP adapter with mock fetch
    const adapter = createHttpLiteAdapter('http://localhost:3000', mockFetch);

    // Verify query mode
    expect(adapter.queryMode).toBe('lite');

    // Invoke set action
    const setInvocation: ActionInvocation = {
      id: 'inv-1',
      concept: 'urn:app/Password',
      action: 'set',
      input: { user: 'u-1', password: 'secret' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    };
    const setCompletion = await adapter.invoke(setInvocation);
    expect(setCompletion.variant).toBe('ok');
    expect(setCompletion.output.user).toBe('u-1');

    // Invoke check action
    const checkInvocation: ActionInvocation = {
      id: 'inv-2',
      concept: 'urn:app/Password',
      action: 'check',
      input: { user: 'u-1', password: 'secret' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    };
    const checkCompletion = await adapter.invoke(checkInvocation);
    expect(checkCompletion.variant).toBe('ok');
    expect(checkCompletion.output.valid).toBe(true);
  });

  it('HttpLiteAdapter queries state via JSON-RPC', async () => {
    const handler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          password: input.password,
        });
        return { variant: 'ok', user: input.user };
      },
    };

    const storage = createInMemoryStorage();
    const serverTransport = createInProcessAdapter(handler, storage);
    const server = createHttpConceptServer(serverTransport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    const adapter = createHttpLiteAdapter('http://localhost:3000', mockFetch);

    // Store some data via invocation
    await adapter.invoke({
      id: 'inv-1',
      concept: 'test',
      action: 'set',
      input: { user: 'u-1', password: 'secret' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    });

    // Query via lite protocol
    const results = await adapter.query({ relation: 'entries' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('user', 'u-1');
  });

  it('HttpLiteAdapter health check works', async () => {
    const server = createHttpConceptServer(
      createInProcessAdapter({ async noop() { return { variant: 'ok' }; } }, createInMemoryStorage()),
    );

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    const adapter = createHttpLiteAdapter('http://localhost:3000', mockFetch);
    const health = await adapter.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });

  it('HttpGraphQLAdapter invokes actions via mock HTTP', async () => {
    const echoHandler: ConceptHandler = {
      async send(input) {
        return { variant: 'ok', echo: input.text };
      },
    };

    const storage = createInMemoryStorage();
    const serverTransport = createInProcessAdapter(echoHandler, storage);
    const server = createHttpConceptServer(serverTransport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    const adapter = createHttpGraphQLAdapter('http://localhost:3000', mockFetch);

    // Verify query mode
    expect(adapter.queryMode).toBe('graphql');

    // Invoke action
    const completion = await adapter.invoke({
      id: 'inv-1',
      concept: 'urn:app/Echo',
      action: 'send',
      input: { text: 'hello' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    });

    expect(completion.variant).toBe('ok');
    expect(completion.output.echo).toBe('hello');
  });

  it('HttpConceptServer returns 404 for unknown paths', async () => {
    const server = createHttpConceptServer(
      createInProcessAdapter({ async noop() { return { variant: 'ok' }; } }, createInMemoryStorage()),
    );

    const result = await server('/unknown', 'GET', null);
    expect(result.status).toBe(404);
  });
});

// ============================================================
// 2. Cross-Language Interop Simulation
// ============================================================

describe('Cross-Language Interop', () => {
  it('TS sync engine invokes "Rust" concept via HTTP adapter', async () => {
    // Simulate a Rust Password concept as a mock HTTP service.
    // In production, this would be a real Rust binary serving over HTTP.
    const rustPasswordHandler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          hash: `hashed:${input.password}`,
        });
        return { variant: 'ok', user: input.user };
      },
      async check(input, storage) {
        const entry = await storage.get('entries', input.user as string);
        if (!entry) return { variant: 'notfound', message: 'No entry' };
        const valid = entry.hash === `hashed:${input.password}`;
        return { variant: 'ok', valid };
      },
    };

    // Set up the "Rust" concept as an HTTP server
    const rustStorage = createInMemoryStorage();
    const rustTransport = createInProcessAdapter(rustPasswordHandler, rustStorage);
    const rustServer = createHttpConceptServer(rustTransport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await rustServer(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    // Create the HTTP adapter that the TS engine uses to talk to "Rust"
    const httpAdapter = createHttpLiteAdapter('http://rust-password:8080', mockFetch);

    // Create a kernel and register the "Rust" concept via HTTP
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const shKernel = createSelfHostedKernel(handler, log, registry);

    // Register local concepts
    shKernel.registerConcept('urn:clef/ActionLog', actionLogHandler);

    // Register the "Rust" Password concept via HTTP transport
    registry.register('urn:app/Password', httpAdapter);

    // Register a sync that logs password operations
    const logSyncSource = `
      sync LogPasswordSet [eager]
      when {
        Password/set: [] => [ user: ?u ]
      }
      then {
        ActionLog/append: [ record: { type: "password-set"; user: ?u } ]
      }
    `;
    const logSyncs = parseSyncFile(logSyncSource);
    for (const s of logSyncs) {
      shKernel.registerSync(s);
    }

    // Invoke the "Rust" concept via the kernel
    const setResult = await shKernel.invokeConcept(
      'urn:app/Password',
      'set',
      { user: 'u-cross-lang', password: 'secret123' },
    );

    expect(setResult.variant).toBe('ok');
    expect(setResult.user).toBe('u-cross-lang');

    // Verify check works via HTTP
    const checkResult = await shKernel.invokeConcept(
      'urn:app/Password',
      'check',
      { user: 'u-cross-lang', password: 'secret123' },
    );

    expect(checkResult.variant).toBe('ok');
    expect(checkResult.valid).toBe(true);

    // Verify wrong password fails
    const wrongResult = await shKernel.invokeConcept(
      'urn:app/Password',
      'check',
      { user: 'u-cross-lang', password: 'wrong' },
    );

    expect(wrongResult.variant).toBe('ok');
    expect(wrongResult.valid).toBe(false);
  });

  it('state queries work via lite protocol over HTTP', async () => {
    const handler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          data: input.data,
        });
        return { variant: 'ok', user: input.user };
      },
    };

    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(handler, storage);
    const server = createHttpConceptServer(transport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return { status: result.status, json: async () => result.body };
    };

    const adapter = createHttpLiteAdapter('http://remote:8080', mockFetch);

    // Store some data via invocations
    await adapter.invoke({
      id: 'inv-1', concept: 'test', action: 'set',
      input: { user: 'alice', data: 'A' },
      flow: 'f-1', timestamp: new Date().toISOString(),
    });
    await adapter.invoke({
      id: 'inv-2', concept: 'test', action: 'set',
      input: { user: 'bob', data: 'B' },
      flow: 'f-1', timestamp: new Date().toISOString(),
    });

    // Query all entries via lite protocol
    const allEntries = await adapter.query({ relation: 'entries' });
    expect(allEntries).toHaveLength(2);

    // Query with filter
    const filtered = await adapter.query({
      relation: 'entries',
      args: { user: 'alice' },
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].user).toBe('alice');
  });
});

// ============================================================
// 3. WebSocket Transport Adapter
// ============================================================

describe('WebSocket Transport Adapter', () => {
  function createMockWebSocketPair(): {
    clientWs: MockWebSocket;
    serverHandler: (message: string) => Promise<string | null>;
  } {
    // Create a concept handler for the server side
    const handler: ConceptHandler = {
      async echo(input) {
        return { variant: 'ok', message: input.text };
      },
    };
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(handler, storage);
    const serverHandler = createWebSocketConceptServer(transport);

    // Create a mock WebSocket that routes messages through the server
    let messageHandler: ((data: string) => void) | null = null;

    const clientWs: MockWebSocket = {
      readyState: 1, // OPEN
      send(data: string) {
        // Route to server, then send response back
        serverHandler(data).then(response => {
          if (response && messageHandler) {
            messageHandler(response);
          }
        });
      },
      onMessage(handler) {
        messageHandler = handler;
      },
      close() {
        this.readyState = 3; // CLOSED
      },
    };

    return { clientWs, serverHandler };
  }

  it('WebSocket adapter invokes actions', async () => {
    const { clientWs } = createMockWebSocketPair();

    const adapter = createWebSocketAdapter(
      'ws://localhost:8080',
      'lite',
      () => clientWs,
    );

    expect(adapter.queryMode).toBe('lite');

    const completion = await adapter.invoke({
      id: 'inv-1',
      concept: 'urn:clef/Echo',
      action: 'echo',
      input: { text: 'hello' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    });

    expect(completion.variant).toBe('ok');
    expect(completion.output.message).toBe('hello');

    adapter.close();
  });

  it('WebSocket adapter performs health checks', async () => {
    const { clientWs } = createMockWebSocketPair();

    const adapter = createWebSocketAdapter(
      'ws://localhost:8080',
      'lite',
      () => clientWs,
    );

    const health = await adapter.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);

    adapter.close();
  });

  it('WebSocket adapter supports push completions', async () => {
    const { clientWs } = createMockWebSocketPair();
    let pushMsgHandler: ((data: string) => void) | null = null;

    // Override onMessage to capture the handler
    const originalOnMessage = clientWs.onMessage.bind(clientWs);
    clientWs.onMessage = (handler: (data: string) => void) => {
      pushMsgHandler = handler;
      originalOnMessage(handler);
    };

    const adapter = createWebSocketAdapter(
      'ws://localhost:8080',
      'lite',
      () => clientWs,
    );

    const receivedCompletions: ActionCompletion[] = [];
    adapter.onPushCompletion((c) => receivedCompletions.push(c));

    // Simulate a push completion from server
    const handler = pushMsgHandler as ((data: string) => void) | null;
    if (handler) {
      const pushMsg = JSON.stringify({
        type: 'completion',
        id: 'push-1',
        payload: {
          id: 'comp-1',
          concept: 'urn:clef/Echo',
          action: 'echo',
          input: {},
          variant: 'ok',
          output: { message: 'pushed' },
          flow: 'flow-push',
          timestamp: new Date().toISOString(),
        },
      });
      handler(pushMsg);
    }

    expect(receivedCompletions).toHaveLength(1);
    expect(receivedCompletions[0].output.message).toBe('pushed');

    adapter.close();
  });

  it('WebSocket server handles unknown message types', async () => {
    const handler: ConceptHandler = {
      async noop() { return { variant: 'ok' }; },
    };
    const transport = createInProcessAdapter(handler, createInMemoryStorage());
    const serverHandler = createWebSocketConceptServer(transport);

    const response = await serverHandler(JSON.stringify({
      type: 'unknown',
      id: 'msg-1',
      payload: null,
    }));

    expect(response).not.toBeNull();
    const parsed = JSON.parse(response!);
    expect(parsed.type).toBe('error');
  });
});
