# Transport Adapter Scaffold Templates

Copy-paste templates for creating new transport adapters. Each template is self-contained — fill in the protocol-specific sections.

## Template 1: Minimal Custom Adapter

The simplest possible adapter. Start here and add protocol details.

```typescript
// my-transport.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';
import { timestamp } from './types.js';

/**
 * Create a transport adapter for [protocol name].
 */
export function createMyAdapter(
  // Protocol-specific config:
  config: { /* ... */ },
): ConceptTransport {
  return {
    queryMode: 'lite',  // or 'graphql'

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      // TODO: Send invocation to concept, receive completion
      // - Send the full ActionInvocation envelope
      // - Return the full ActionCompletion envelope
      // - Throw on transport failure
      throw new Error('Not implemented');
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      // TODO: Query concept state
      // - Lite mode: use request.relation + request.args
      // - GraphQL mode: use request.graphql or build from relation + args
      // - Return Record<string, unknown>[]
      throw new Error('Not implemented');
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      // TODO: Check availability and measure latency
      // - NEVER throw — catch errors and return { available: false }
      const start = Date.now();
      try {
        // ... check concept availability ...
        return { available: true, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}
```

## Template 2: HTTP Adapter (Lite Mode)

For concepts reachable over HTTP with lite query protocol.

```typescript
// http-lite-adapter.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';

export type FetchFn = (
  url: string,
  options: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export function createHttpLiteAdapter(
  baseUrl: string,
  fetchFn?: FetchFn,
): ConceptTransport {
  const doFetch = fetchFn || (globalThis.fetch as unknown as FetchFn);

  return {
    queryMode: 'lite' as const,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const response = await doFetch(`${baseUrl}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invocation),
      });
      if (response.status !== 200) {
        throw new Error(`HTTP invoke failed: ${response.status}`);
      }
      return response.json() as Promise<ActionCompletion>;
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      const response = await doFetch(`${baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'query',
          params: { relation: request.relation, args: request.args || {} },
        }),
      });
      if (response.status !== 200) {
        throw new Error(`HTTP query failed: ${response.status}`);
      }
      return response.json() as Promise<Record<string, unknown>[]>;
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        const response = await doFetch(`${baseUrl}/health`, {
          method: 'GET', headers: {}, body: '',
        });
        return { available: response.status === 200, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}
```

## Template 3: HTTP Adapter (GraphQL Mode)

For concepts reachable over HTTP with GraphQL queries.

```typescript
// http-graphql-adapter.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';

export type FetchFn = (
  url: string,
  options: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export function createHttpGraphQLAdapter(
  baseUrl: string,
  fetchFn?: FetchFn,
): ConceptTransport {
  const doFetch = fetchFn || (globalThis.fetch as unknown as FetchFn);

  return {
    queryMode: 'graphql' as const,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const response = await doFetch(`${baseUrl}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invocation),
      });
      if (response.status !== 200) {
        throw new Error(`HTTP invoke failed: ${response.status}`);
      }
      return response.json() as Promise<ActionCompletion>;
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      const graphqlQuery = request.graphql ?? buildGraphQLQuery(request);
      const response = await doFetch(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: graphqlQuery }),
      });
      if (response.status !== 200) {
        throw new Error(`HTTP GraphQL query failed: ${response.status}`);
      }
      const result = await response.json() as { data?: Record<string, unknown[]> };
      if (result.data) {
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
          method: 'GET', headers: {}, body: '',
        });
        return { available: response.status === 200, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}

function buildGraphQLQuery(request: ConceptQuery): string {
  const args = request.args || {};
  const entries = Object.entries(args);
  if (entries.length === 0) {
    return `{ ${request.relation} { __all } }`;
  }
  const argStr = entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
  return `{ ${request.relation}(${argStr}) { __all } }`;
}
```

## Template 4: WebSocket Adapter

For persistent bidirectional connections with push completion support.

```typescript
// ws-adapter.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';

interface WsMessage {
  type: 'invoke' | 'query' | 'health' | 'completion' | 'response' | 'error';
  id: string;
  payload: unknown;
}

interface SocketLike {
  send(data: string): void;
  onMessage(handler: (data: string) => void): void;
  close(): void;
  readyState: number;
}

type SocketFactory = (url: string) => SocketLike;

export function createWebSocketAdapter(
  url: string,
  queryMode: 'graphql' | 'lite',
  socketFactory: SocketFactory,
): ConceptTransport & {
  close(): void;
  onPushCompletion(handler: (c: ActionCompletion) => void): void;
} {
  const ws = socketFactory(url);
  const pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  const pushHandlers: ((c: ActionCompletion) => void)[] = [];
  let nextId = 0;

  // Message handler
  ws.onMessage((data: string) => {
    try {
      const msg: WsMessage = JSON.parse(data);

      if (msg.type === 'response' || msg.type === 'error') {
        const req = pending.get(msg.id);
        if (req) {
          pending.delete(msg.id);
          msg.type === 'error'
            ? req.reject(new Error(msg.payload as string))
            : req.resolve(msg.payload);
        }
      }

      if (msg.type === 'completion') {
        for (const handler of pushHandlers) {
          handler(msg.payload as ActionCompletion);
        }
      }
    } catch { /* ignore malformed */ }
  });

  function sendAndWait<T>(type: WsMessage['type'], payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `msg-${++nextId}`;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      ws.send(JSON.stringify({ type, id, payload }));
    });
  }

  return {
    queryMode,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      return sendAndWait<ActionCompletion>('invoke', invocation);
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      return sendAndWait<Record<string, unknown>[]>('query', request);
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        await sendAndWait<void>('health', null);
        return { available: true, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },

    onPushCompletion(handler: (c: ActionCompletion) => void): void {
      pushHandlers.push(handler);
    },

    close(): void {
      ws.close();
      for (const [, req] of pending) {
        req.reject(new Error('Connection closed'));
      }
      pending.clear();
    },
  };
}
```

## Template 5: Server-Side HTTP Handler

Exposes any `ConceptTransport` over HTTP. Framework-agnostic.

```typescript
// http-concept-server.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
} from './types.js';

export function createHttpConceptServer(
  transport: ConceptTransport,
): (path: string, method: string, body: unknown) => Promise<{ status: number; body: unknown }> {
  return async (path, method, body) => {
    try {
      if (path === '/health' && method === 'GET') {
        return { status: 200, body: await transport.health() };
      }

      if (path === '/invoke' && method === 'POST') {
        const completion = await transport.invoke(body as ActionInvocation);
        return { status: 200, body: completion };
      }

      if (path === '/query' && method === 'POST') {
        const request = body as { params: ConceptQuery };
        const results = await transport.query(request.params);
        return { status: 200, body: results };
      }

      if (path === '/graphql' && method === 'POST') {
        const { query } = body as { query: string };
        const results = await transport.query({ relation: '', graphql: query });
        return { status: 200, body: { data: { results } } };
      }

      return { status: 404, body: { error: 'Not found' } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 500, body: { error: message } };
    }
  };
}
```

## Template 6: Server-Side WebSocket Handler

Exposes any `ConceptTransport` over WebSocket.

```typescript
// ws-concept-server.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
} from './types.js';

interface WsMessage {
  type: 'invoke' | 'query' | 'health' | 'completion' | 'response' | 'error';
  id: string;
  payload: unknown;
}

export function createWebSocketConceptServer(
  transport: ConceptTransport,
): (message: string) => Promise<string | null> {
  return async (message) => {
    try {
      const msg: WsMessage = JSON.parse(message);

      switch (msg.type) {
        case 'invoke': {
          const completion = await transport.invoke(msg.payload as ActionInvocation);
          return JSON.stringify({ type: 'response', id: msg.id, payload: completion });
        }
        case 'query': {
          const results = await transport.query(msg.payload as ConceptQuery);
          return JSON.stringify({ type: 'response', id: msg.id, payload: results });
        }
        case 'health': {
          const health = await transport.health();
          return JSON.stringify({ type: 'response', id: msg.id, payload: health });
        }
        default:
          return JSON.stringify({
            type: 'error',
            id: msg.id,
            payload: `Unknown message type: ${msg.type}`,
          });
      }
    } catch (err: unknown) {
      return JSON.stringify({
        type: 'error',
        id: 'unknown',
        payload: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
```

## Template 7: Worker Adapter (postMessage)

For Web Workers or Node.js worker threads.

```typescript
// worker-adapter.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';

interface WorkerLike {
  postMessage(data: unknown): void;
  addEventListener(event: 'message', handler: (e: { data: unknown }) => void): void;
  terminate?(): void;
}

interface WorkerMessage {
  type: 'invoke' | 'query' | 'health' | 'response' | 'error';
  id: string;
  payload: unknown;
}

export function createWorkerAdapter(
  worker: WorkerLike,
  queryMode: 'graphql' | 'lite' = 'lite',
): ConceptTransport {
  const pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  let nextId = 0;

  worker.addEventListener('message', (e) => {
    const msg = e.data as WorkerMessage;
    const req = pending.get(msg.id);
    if (req) {
      pending.delete(msg.id);
      msg.type === 'error'
        ? req.reject(new Error(msg.payload as string))
        : req.resolve(msg.payload);
    }
  });

  function sendAndWait<T>(type: WorkerMessage['type'], payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `w-${++nextId}`;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ type, id, payload });
    });
  }

  return {
    queryMode,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      return sendAndWait<ActionCompletion>('invoke', invocation);
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      return sendAndWait<Record<string, unknown>[]>('query', request);
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        await sendAndWait<void>('health', null);
        return { available: true, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },
  };
}
```

## Template 8: Adapter Test

Test template using mock dependencies.

```typescript
// my-adapter.test.ts
import { describe, it, expect } from 'vitest';
import { createMyAdapter } from './my-adapter.js';
import type { ActionInvocation } from './types.js';

function makeInvocation(overrides: Partial<ActionInvocation> = {}): ActionInvocation {
  return {
    id: 'inv-1',
    concept: 'TestConcept',
    action: 'doSomething',
    input: { key: 'value' },
    flow: 'flow-1',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('MyAdapter', () => {
  describe('invoke', () => {
    it('sends invocation and returns completion', async () => {
      // Setup mock transport/protocol dependency
      const adapter = createMyAdapter(/* mock config */);

      const completion = await adapter.invoke(makeInvocation());
      expect(completion.id).toBe('inv-1');
      expect(completion.concept).toBe('TestConcept');
      expect(completion.action).toBe('doSomething');
      expect(completion.variant).toBeDefined();
    });

    it('throws on transport failure', async () => {
      const adapter = createMyAdapter(/* broken mock */);
      await expect(adapter.invoke(makeInvocation())).rejects.toThrow();
    });
  });

  describe('query', () => {
    it('queries with relation and args', async () => {
      const adapter = createMyAdapter(/* mock config */);
      const results = await adapter.query({
        relation: 'items',
        args: { id: '1' },
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns empty array for no matches', async () => {
      const adapter = createMyAdapter(/* mock config */);
      const results = await adapter.query({
        relation: 'items',
        args: { id: 'nonexistent' },
      });
      expect(results).toEqual([]);
    });
  });

  describe('health', () => {
    it('returns available with latency', async () => {
      const adapter = createMyAdapter(/* mock config */);
      const health = await adapter.health();
      expect(health.available).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('returns unavailable on failure (never throws)', async () => {
      const adapter = createMyAdapter(/* broken mock */);
      const health = await adapter.health();
      expect(health.available).toBe(false);
      // health() should NEVER throw
    });
  });

  it('has correct queryMode', () => {
    const adapter = createMyAdapter(/* mock config */);
    expect(['graphql', 'lite']).toContain(adapter.queryMode);
  });
});
```

## Template 9: In-Process Adapter (Wrapping Handler + Storage)

For same-process concepts where you have direct access to the handler and storage.

```typescript
// in-process-adapter.ts
import type {
  ConceptTransport,
  ConceptQuery,
  ConceptHandler,
  ConceptStorage,
  ActionInvocation,
  ActionCompletion,
} from './types.js';
import { timestamp } from './types.js';

export function createInProcessAdapter(
  handler: ConceptHandler,
  storage: ConceptStorage,
): ConceptTransport {
  return {
    queryMode: 'lite',

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      const actionFn = handler[invocation.action];
      if (!actionFn) {
        return {
          id: invocation.id,
          concept: invocation.concept,
          action: invocation.action,
          input: invocation.input,
          variant: 'error',
          output: { message: `Unknown action: ${invocation.action}` },
          flow: invocation.flow,
          timestamp: timestamp(),
        };
      }

      const result = await actionFn(invocation.input, storage);
      const { variant, ...output } = result;
      return {
        id: invocation.id,
        concept: invocation.concept,
        action: invocation.action,
        input: invocation.input,
        variant,
        output,
        flow: invocation.flow,
        timestamp: timestamp(),
      };
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      if (request.args && Object.keys(request.args).length > 0) {
        return storage.find(request.relation, request.args);
      }
      return storage.find(request.relation);
    },

    async health() {
      return { available: true, latency: 0 };
    },
  };
}
```
