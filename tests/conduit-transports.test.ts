// Conduit Transport Integration — All 3 Transport Types Test
// Validates in-process, HTTP distributed, and WebSocket transports.

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../runtime/adapters/transport.js';
import { createHttpConceptServer, createHttpLiteAdapter } from '../runtime/adapters/http-transport.js';
import { createWebSocketConceptServer, createWebSocketAdapter } from '../runtime/adapters/ws-transport.js';
import type { MockWebSocket } from '../runtime/adapters/ws-transport.js';
import { echoHandler } from '../handlers/ts/app/echo.handler.js';
import { userHandler } from '../handlers/ts/app/user.handler.js';
import { passwordHandler } from '../handlers/ts/app/password.handler.js';
import type { ActionInvocation } from '../runtime/types.js';
import { generateId, timestamp } from '../runtime/types.js';

function mkInvocation(concept: string, action: string, input: Record<string, unknown>): ActionInvocation {
  return { id: generateId(), concept, action, input, flow: 'transport-test', timestamp: timestamp() };
}

describe('Conduit Transports — In-Process', () => {
  it('Echo concept works via in-process transport', async () => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(echoHandler, storage);

    const completion = await transport.invoke(
      mkInvocation('urn:clef/Echo', 'send', { id: 'ip-1', text: 'in-process test' }),
    );

    expect(completion.variant).toBe('ok');
    expect(completion.output.echo).toBe('in-process test');
  });

  it('User concept handles duplicate detection via in-process', async () => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(userHandler, storage);

    const first = await transport.invoke(
      mkInvocation('urn:clef/User', 'register', { user: 'u1', name: 'alice', email: 'alice@test.io' }),
    );
    expect(first.variant).toBe('ok');

    const dup = await transport.invoke(
      mkInvocation('urn:clef/User', 'register', { user: 'u2', name: 'alice', email: 'alice2@test.io' }),
    );
    expect(dup.variant).toBe('error');
  });
});

describe('Conduit Transports — HTTP', () => {
  it('Echo concept works via HTTP concept server + lite adapter', async () => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(echoHandler, storage);
    const httpHandler = createHttpConceptServer(transport);

    // Simulate HTTP transport by creating mock fetch that calls the server handler
    const mockFetch = async (url: string, options: { method: string; headers: Record<string, string>; body: string }) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await httpHandler(path, options.method, body);
      return {
        status: result.status,
        async json() { return result.body; },
      };
    };

    const adapter = createHttpLiteAdapter('http://mock', mockFetch);
    const completion = await adapter.invoke(
      mkInvocation('urn:clef/Echo', 'send', { id: 'http-1', text: 'http test' }),
    );

    expect(completion.variant).toBe('ok');
    expect(completion.output.echo).toBe('http test');
  });

  it('HTTP health endpoint returns available', async () => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(echoHandler, storage);
    const httpHandler = createHttpConceptServer(transport);

    const result = await httpHandler('/health', 'GET', undefined);
    expect(result.status).toBe(200);
    expect((result.body as Record<string, unknown>).available).toBe(true);
  });

  it('HTTP returns 404 for unknown path', async () => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(echoHandler, storage);
    const httpHandler = createHttpConceptServer(transport);

    const result = await httpHandler('/unknown', 'GET', undefined);
    expect(result.status).toBe(404);
  });
});

describe('Conduit Transports — WebSocket', () => {
  it('Echo concept works via WebSocket transport', async () => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(echoHandler, storage);
    const wsServerHandler = createWebSocketConceptServer(transport);

    // Create mock WS pair
    const clientMessages: string[] = [];
    const serverMessages: string[] = [];

    const mockWsFactory = () => {
      const handlers: ((data: string) => void)[] = [];
      const ws: MockWebSocket = {
        send(data: string) {
          // Client sends → process on server → send response back
          serverMessages.push(data);
          wsServerHandler(data).then(response => {
            if (response) {
              handlers.forEach(h => h(response));
            }
          });
        },
        onMessage(handler) { handlers.push(handler); },
        close() {},
        readyState: 1,
      };
      return ws;
    };

    const adapter = createWebSocketAdapter('ws://mock', 'lite', mockWsFactory);

    const completion = await adapter.invoke(
      mkInvocation('urn:clef/Echo', 'send', { id: 'ws-1', text: 'websocket test' }),
    );

    expect(completion.variant).toBe('ok');
    expect(completion.output.echo).toBe('websocket test');

    adapter.close();
  });

  it('WebSocket server handles health check', async () => {
    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(echoHandler, storage);
    const wsHandler = createWebSocketConceptServer(transport);

    const msg = JSON.stringify({ type: 'health', id: 'h1', payload: null });
    const response = await wsHandler(msg);
    expect(response).toBeTruthy();

    const parsed = JSON.parse(response!);
    expect(parsed.type).toBe('response');
    expect(parsed.payload.available).toBe(true);
  });
});
