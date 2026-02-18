# Adapter Patterns Reference

Common patterns for implementing transport adapters: invoke, query, health, error handling, server-side handlers, and testability.

## Pattern 1: Invoke — Send Action, Receive Completion

Every adapter's `invoke()` follows the same pattern: serialize the `ActionInvocation`, send it, receive an `ActionCompletion`.

### Direct Call (InProcessAdapter)

```typescript
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
}
```

**Key points:**
- Unknown action → error completion (not a throw)
- Spreads result into `variant` + `output`
- Preserves all invocation fields in the completion

### HTTP Request (HttpLiteAdapter / HttpGraphQLAdapter)

```typescript
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
}
```

**Key points:**
- Sends full invocation as JSON body to `/invoke`
- Non-200 status → throw (transport error, not action error)
- Response body is the complete `ActionCompletion`

### WebSocket Message (WebSocketAdapter)

```typescript
async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
  return sendAndWait<ActionCompletion>('invoke', invocation);
}
```

Where `sendAndWait` is a generic request-response correlator:

```typescript
function sendAndWait<T>(type: WsMessage['type'], payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `msg-${++messageId}`;
    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    const msg: WsMessage = { type, id, payload };
    ws.send(JSON.stringify(msg));
  });
}
```

**Key points:**
- Message ID correlates request to response
- `pendingRequests` map stores resolve/reject callbacks
- Message handler resolves/rejects when response arrives

## Pattern 2: Query — Read Concept State

### Lite Mode Query

```typescript
// InProcessAdapter — direct storage call
async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
  if (request.args && Object.keys(request.args).length > 0) {
    return storage.find(request.relation, request.args);
  }
  return storage.find(request.relation);
}

// HttpLiteAdapter — JSON-RPC call
async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
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

  return response.json() as Promise<Record<string, unknown>[]>;
}
```

### GraphQL Mode Query

```typescript
// HttpGraphQLAdapter — GraphQL query
async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
  const graphqlQuery = request.graphql ?? buildGraphQLQuery(request);

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
    const values = Object.values(result.data);
    if (values.length > 0 && Array.isArray(values[0])) {
      return values[0] as Record<string, unknown>[];
    }
  }
  return [];
}
```

**Key points:**
- Uses `request.graphql` if provided, otherwise builds from `relation` + `args`
- Extracts the first field's value from the GraphQL `data` response
- Returns `[]` if no data

### WebSocket Query

```typescript
async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
  return sendAndWait<Record<string, unknown>[]>('query', request);
}
```

The `ConceptQuery` is sent as the payload. The server decides how to handle it based on the negotiated query mode.

## Pattern 3: Health Check — Availability + Latency

All health checks follow the same pattern: measure time, catch errors, never throw.

### In-Process

```typescript
async health() {
  return { available: true, latency: 0 };
}
```

Always available, zero latency (same process).

### HTTP

```typescript
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
}
```

### WebSocket

```typescript
async health(): Promise<{ available: boolean; latency: number }> {
  const start = Date.now();
  try {
    await sendAndWait<void>('health', null);
    return { available: true, latency: Date.now() - start };
  } catch {
    return { available: false, latency: Date.now() - start };
  }
}
```

**Key invariant:** `health()` **never throws**. It catches all errors and returns `{ available: false }`.

## Pattern 4: Error Handling

### Two Types of Errors

1. **Action errors** — The concept processed the action but returned an error variant. These are normal completions:
   ```typescript
   // This is a normal completion, not a transport error
   {
     id: 'inv-1',
     variant: 'error',           // Error variant from concept spec
     output: { message: '...' }, // Error details
     // ... rest of completion fields
   }
   ```

2. **Transport errors** — The transport itself failed (network error, timeout, malformed response). These are thrown as Errors:
   ```typescript
   // HttpLiteAdapter
   if (response.status !== 200) {
     throw new Error(`HTTP invoke failed with status ${response.status}`);
   }

   // WebSocketAdapter on close
   pending.reject(new Error('Connection closed'));
   ```

### Error Propagation Rules

| Scenario | What Happens |
|----------|-------------|
| Concept action returns error variant | Normal completion returned, engine chains through syncs |
| Unknown action on concept | Error completion returned with `variant: 'error'` |
| HTTP non-200 response on invoke | `throw new Error(...)` — engine handles as transport failure |
| WebSocket message parse failure | Ignored (malformed message) |
| WebSocket connection closed | All pending requests rejected with Error |
| Network timeout | Depends on transport — usually `throw` or `{ available: false }` |

### Server-Side Error Handling

```typescript
// HttpConceptServer
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

// WebSocketConceptServer
try {
  // ... handle message
} catch (err: unknown) {
  const errorMsg = err instanceof Error ? err.message : String(err);
  return JSON.stringify({
    type: 'error',
    id: 'unknown',
    payload: errorMsg,
  });
}
```

## Pattern 5: Server-Side Handlers

Network adapters need a server-side counterpart. The pattern: wrap any `ConceptTransport` and expose it over the protocol.

### HTTP Server Handler

```typescript
function createHttpConceptServer(
  transport: ConceptTransport,
): (path: string, method: string, body: unknown) => Promise<{ status: number; body: unknown }> {
  return async (path, method, body) => {
    if (path === '/health' && method === 'GET') {
      const health = await transport.health();
      return { status: 200, body: health };
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
  };
}
```

**Endpoints:**

| Path | Method | Purpose | Request Body | Response Body |
|------|--------|---------|-------------|---------------|
| `/invoke` | POST | Invoke action | `ActionInvocation` | `ActionCompletion` |
| `/query` | POST | Lite query | `{ params: ConceptQuery }` | `Record<string, unknown>[]` |
| `/graphql` | POST | GraphQL query | `{ query: string }` | `{ data: { results } }` |
| `/health` | GET | Health check | (none) | `{ available, latency }` |

### WebSocket Server Handler

```typescript
function createWebSocketConceptServer(
  transport: ConceptTransport,
): (message: string) => Promise<string | null> {
  return async (message) => {
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
        return JSON.stringify({ type: 'error', id: msg.id, payload: `Unknown type` });
    }
  };
}
```

**Message types:**

| Type | Direction | Payload | Purpose |
|------|-----------|---------|---------|
| `invoke` | Client → Server | `ActionInvocation` | Invoke action |
| `query` | Client → Server | `ConceptQuery` | Query state |
| `health` | Client → Server | `null` | Health check |
| `response` | Server → Client | (varies) | Successful response |
| `error` | Server → Client | `string` (error message) | Error response |
| `completion` | Server → Client | `ActionCompletion` | Push completion (server-initiated) |

## Pattern 6: Injectable Dependencies for Testing

All network adapters accept mock dependencies so tests don't need real servers.

### HTTP Adapter — Injectable fetch

```typescript
type HttpFetchFn = (
  url: string,
  options: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;

function createHttpLiteAdapter(
  baseUrl: string,
  fetchFn?: HttpFetchFn,     // ← Injectable
): ConceptTransport {
  const doFetch = fetchFn || defaultFetch;
  // ... uses doFetch everywhere
}
```

### WebSocket Adapter — Injectable WebSocket factory

```typescript
interface MockWebSocket {
  send(data: string): void;
  onMessage(handler: (data: string) => void): void;
  close(): void;
  readyState: number;
}

type WebSocketFactory = (url: string) => MockWebSocket;

function createWebSocketAdapter(
  url: string,
  queryMode: 'graphql' | 'lite',
  wsFactory: WebSocketFactory,    // ← Injectable
): ConceptTransport { ... }
```

### Test Pattern

```typescript
it('invokes action via HTTP', async () => {
  const mockFetch: HttpFetchFn = async (url, options) => {
    expect(url).toBe('http://localhost:3000/invoke');
    const invocation = JSON.parse(options.body);
    return {
      status: 200,
      json: async () => ({
        ...invocation,
        variant: 'ok',
        output: { token: 'abc' },
        timestamp: new Date().toISOString(),
      }),
    };
  };

  const adapter = createHttpLiteAdapter('http://localhost:3000', mockFetch);
  const completion = await adapter.invoke(/* invocation */);
  expect(completion.variant).toBe('ok');
});
```

## Pattern 7: Push Completions (WebSocket Only)

WebSocket adapters support server-initiated push completions — the server can push `ActionCompletion` messages to the client without a request.

### Client-Side: Subscribe

```typescript
const adapter = createWebSocketAdapter(url, 'lite', wsFactory);

adapter.onPushCompletion((completion: ActionCompletion) => {
  // Handle server-pushed completion
  // e.g., forward to local sync engine
  console.log(`Push: ${completion.concept}.${completion.action} → ${completion.variant}`);
});
```

### Server-Side: Push

```typescript
// Server sends a completion message
const pushMsg: WsMessage = {
  type: 'completion',
  id: generateId(),
  payload: completion,
};
ws.send(JSON.stringify(pushMsg));
```

### Client-Side Message Handling

```typescript
socket.onMessage((data: string) => {
  const msg: WsMessage = JSON.parse(data);

  if (msg.type === 'response' || msg.type === 'error') {
    // Correlate with pending request
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      pendingRequests.delete(msg.id);
      msg.type === 'error' ? pending.reject(...) : pending.resolve(msg.payload);
    }
  }

  if (msg.type === 'completion') {
    // Push completion — notify all handlers
    const completion = msg.payload as ActionCompletion;
    for (const handler of pushHandlers) {
      handler(completion);
    }
  }
});
```

## Pattern 8: Connection Lifecycle (WebSocket)

```typescript
const adapter = createWebSocketAdapter(url, queryMode, wsFactory);

// Use the adapter...
await adapter.invoke(invocation);

// Close cleanly — rejects all pending requests
adapter.close();
```

On `close()`:
1. Close the underlying WebSocket
2. Reject all pending requests with `Error('Connection closed')`
3. Clear the pending requests map
