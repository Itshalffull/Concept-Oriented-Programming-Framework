# Existing Adapter Walkthroughs

Annotated walkthroughs of all four existing COPF transport adapters. Use these as models for new adapters.

## 1. InProcessAdapter — Direct Function Calls

**Source:** `kernel/src/transport.ts`
**Transport:** Direct JavaScript function calls (no serialization)
**Query Mode:** `lite` (always)
**Push Completions:** N/A (same process)

### Overview

The simplest adapter. Wraps a `ConceptHandler` + `ConceptStorage` pair into a `ConceptTransport`. No network, no serialization — just direct function calls.

```
┌─────────────┐   direct call   ┌───────────────┐
│ Sync Engine │───────────────▶│ handler[action]│
│             │◀───────────────│ (input,storage)│
└─────────────┘  return value   └───────────────┘
```

### Factory Function

```typescript
export function createInProcessAdapter(
  handler: ConceptHandler,    // The concept's action handlers
  storage: ConceptStorage,    // The concept's storage instance
): ConceptTransport {
```

Takes the handler and storage directly — no URLs, no connections.

### invoke() Implementation

```typescript
async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
  // 1. Look up the action function on the handler
  const actionFn = handler[invocation.action];

  // 2. Unknown action → error completion (not throw)
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

  // 3. Call the handler with input + storage
  const result = await actionFn(invocation.input, storage);

  // 4. Destructure variant from output, build completion
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

**Key pattern:** The handler returns `{ variant, ...output }`. The adapter separates `variant` from the rest and builds the full `ActionCompletion` envelope.

### query() Implementation

```typescript
async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
  // Delegates to storage.find() — the simplest possible query
  if (request.args && Object.keys(request.args).length > 0) {
    return storage.find(request.relation, request.args);
  }
  return storage.find(request.relation);
}
```

**Key pattern:** Lite mode queries delegate directly to `storage.find()`. No GraphQL, no JSON-RPC — just a function call.

### health() Implementation

```typescript
async health() {
  return { available: true, latency: 0 };
}
```

Always available, zero latency. The simplest health check.

### When to Use

- Single-process deployments (most common for development)
- All concepts in the same Node.js process
- Maximum performance (no serialization overhead)

---

## 2. HttpLiteAdapter — HTTP + JSON-RPC

**Source:** `kernel/src/http-transport.ts:57-119`
**Transport:** HTTP POST requests
**Query Mode:** `lite` (always)
**Push Completions:** No (stateless HTTP)

### Overview

Communicates with a remote concept over HTTP. Actions via `POST /invoke`, queries via `POST /query` (JSON-RPC), health via `GET /health`.

```
┌─────────────┐  POST /invoke  ┌──────────────────┐
│ Sync Engine │───────────────▶│ HttpConceptServer │
│             │◀───────────────│   (remote host)   │
└─────────────┘   JSON body    └──────────────────┘
```

### Factory Function

```typescript
export function createHttpLiteAdapter(
  baseUrl: string,         // e.g., "http://localhost:3000"
  fetchFn?: HttpFetchFn,   // Injectable for testing
): ConceptTransport {
  const doFetch = fetchFn || defaultFetch;
```

**Injectable fetch:** Accepts an optional `fetchFn` so tests can mock HTTP without a server. Falls back to `globalThis.fetch`.

### invoke() — POST /invoke

```typescript
async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
  const response = await doFetch(`${baseUrl}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invocation),   // Full invocation as JSON
  });

  if (response.status !== 200) {
    throw new Error(`HTTP invoke failed with status ${response.status}`);
  }

  return response.json() as Promise<ActionCompletion>;
}
```

**Pattern:** Send full `ActionInvocation` JSON → receive full `ActionCompletion` JSON. Non-200 throws.

### query() — POST /query (JSON-RPC)

```typescript
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

**Pattern:** Wraps the `ConceptQuery` in a JSON-RPC-style envelope `{ method, params }`. The server extracts `params` and delegates to the transport's `query()`.

### health() — GET /health

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

**Pattern:** Measure time before and after. Catch all errors → `{ available: false }`. Never throw.

### When to Use

- Concepts running in a separate process or server
- Microservice deployments
- Simple state that doesn't need GraphQL's query power
- When push completions aren't needed

---

## 3. HttpGraphQLAdapter — HTTP + GraphQL

**Source:** `kernel/src/http-transport.ts:128-191`
**Transport:** HTTP POST requests
**Query Mode:** `graphql` (always)
**Push Completions:** No (stateless HTTP)

### Overview

Same as HttpLiteAdapter for `invoke()` and `health()`, but queries go to a GraphQL endpoint (`POST /graphql`).

### Factory Function

```typescript
export function createHttpGraphQLAdapter(
  baseUrl: string,
  fetchFn?: HttpFetchFn,
): ConceptTransport {
  const doFetch = fetchFn || defaultFetch;
```

Same injectable pattern as HttpLiteAdapter.

### invoke() — Same as HttpLiteAdapter

```typescript
async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
  // Identical to HttpLiteAdapter — POST /invoke with JSON body
}
```

**Key insight:** `invoke()` is protocol-independent. Both HTTP adapters use the same invoke endpoint.

### query() — POST /graphql

```typescript
async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
  // Use provided GraphQL or build from relation + args
  const graphqlQuery = request.graphql ?? buildGraphQLQuery(request);

  const response = await doFetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: graphqlQuery }),
  });

  if (response.status !== 200) {
    throw new Error(`HTTP GraphQL query failed with status ${response.status}`);
  }

  // Extract records from GraphQL response structure
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

**Key patterns:**
- Prefers `request.graphql` if the engine provides a pre-built query
- Falls back to `buildGraphQLQuery()` which constructs from `relation` + `args`
- Extracts the first field's array from GraphQL's `{ data: { fieldName: [...] } }` structure

### buildGraphQLQuery Helper

```typescript
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
```

Produces queries like `{ articles(authorId: "user-1") { __all } }`.

### When to Use

- Server-side concepts with complex state
- Concepts queried with arbitrary filters and field selections
- When you need nested relation queries

---

## 4. WebSocketAdapter — Persistent Connection

**Source:** `kernel/src/ws-transport.ts`
**Transport:** WebSocket with JSON messages
**Query Mode:** Configurable (`graphql` or `lite`)
**Push Completions:** Yes

### Overview

Persistent bidirectional connection. Supports request-response (invoke, query, health) and server-pushed completions.

```
┌─────────────┐  ◀─── persistent ───▶  ┌──────────────────────┐
│ Sync Engine │     WebSocket conn      │ WebSocketConceptServer│
│             │                         │   (remote host)       │
└─────────────┘  ◀─── push completions  └──────────────────────┘
```

### Factory Function

```typescript
export function createWebSocketAdapter(
  url: string,
  queryMode: 'graphql' | 'lite',      // Configurable query mode
  wsFactory: WebSocketFactory,          // Injectable for testing
): ConceptTransport & {
  close(): void;                        // Clean shutdown
  onPushCompletion(handler: (c: ActionCompletion) => void): void;  // Push subscription
} {
```

Returns an extended `ConceptTransport` with `close()` and `onPushCompletion()`.

### Message Protocol

All communication uses the `WsMessage` envelope:

```typescript
interface WsMessage {
  type: 'invoke' | 'query' | 'health' | 'completion' | 'response' | 'error';
  id: string;       // Correlation ID for request-response matching
  payload: unknown;  // Type-specific payload
}
```

### Request-Response Correlation

The adapter maintains a map of pending requests:

```typescript
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}>();
let messageId = 0;

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

**Pattern:** Each outgoing message gets a unique ID. The response handler matches the ID to resolve the correct promise.

### Message Handler

```typescript
socket.onMessage((data: string) => {
  try {
    const msg: WsMessage = JSON.parse(data);

    // Request-response: match by ID
    if (msg.type === 'response' || msg.type === 'error') {
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        pendingRequests.delete(msg.id);
        if (msg.type === 'error') {
          pending.reject(new Error(msg.payload as string));
        } else {
          pending.resolve(msg.payload);
        }
      }
    }

    // Push completions: broadcast to all handlers
    if (msg.type === 'completion') {
      const completion = msg.payload as ActionCompletion;
      for (const handler of pushHandlers) {
        handler(completion);
      }
    }
  } catch {
    // Ignore malformed messages
  }
});
```

**Two message flows:**
1. **Request-response** (`response`/`error`): Correlate by ID, resolve/reject the pending promise
2. **Push completions** (`completion`): Broadcast to all registered handlers

### invoke(), query(), health()

All three delegate to `sendAndWait`:

```typescript
async invoke(invocation) { return sendAndWait<ActionCompletion>('invoke', invocation); }
async query(request)     { return sendAndWait<Record<string, unknown>[]>('query', request); }
async health() {
  const start = Date.now();
  try {
    await sendAndWait<void>('health', null);
    return { available: true, latency: Date.now() - start };
  } catch {
    return { available: false, latency: Date.now() - start };
  }
}
```

### Push Completions

```typescript
onPushCompletion(handler: (c: ActionCompletion) => void): void {
  pushHandlers.push(handler);
}
```

Registers a callback for server-pushed completions. Used by downstream engines to receive completions from concepts on remote runtimes.

### Connection Lifecycle

```typescript
close(): void {
  ws.close();
  // Reject all pending requests
  for (const [id, pending] of pendingRequests) {
    pending.reject(new Error('Connection closed'));
  }
  pendingRequests.clear();
}
```

**Clean shutdown:** Close the socket, reject all in-flight requests, clear the map.

### When to Use

- Mobile ↔ server communication (iOS, Android)
- Real-time flows that need push completions
- Engine hierarchy (downstream engine → upstream engine)
- When you need low-latency persistent connections

---

## 5. HttpConceptServer — Server-Side HTTP Router

**Source:** `kernel/src/http-transport.ts:220-265`

Not an adapter itself — this is the server-side counterpart that exposes any `ConceptTransport` over HTTP.

```typescript
export function createHttpConceptServer(
  transport: ConceptTransport,  // Usually an InProcessAdapter
): (path: string, method: string, body: unknown) => Promise<{ status: number; body: unknown }>
```

### Route Table

| Path | Method | Action | Request | Response |
|------|--------|--------|---------|----------|
| `/health` | GET | Health check | — | `{ available, latency }` |
| `/invoke` | POST | Invoke action | `ActionInvocation` | `ActionCompletion` |
| `/query` | POST | Lite query | `{ params: ConceptQuery }` | `Record[]` |
| `/graphql` | POST | GraphQL query | `{ query: string }` | `{ data: { results } }` |
| (other) | * | Not found | — | `{ error: 'Not found' }` |

### Integration Example

```typescript
// Server side
const handler = createPasswordHandler();
const storage = createMemoryStorage();
const inProcess = createInProcessAdapter(handler, storage);
const server = createHttpConceptServer(inProcess);

// Framework integration (e.g., Express)
app.all('/concepts/password/*', async (req, res) => {
  const path = req.path.replace('/concepts/password', '');
  const result = await server(path, req.method, req.body);
  res.status(result.status).json(result.body);
});
```

---

## 6. WebSocketConceptServer — Server-Side WebSocket Handler

**Source:** `kernel/src/ws-transport.ts:150-206`

Server-side counterpart for WebSocket connections.

```typescript
export function createWebSocketConceptServer(
  transport: ConceptTransport,
): (message: string) => Promise<string | null>
```

### Message Handling

```typescript
return async (message: string): Promise<string | null> => {
  const msg: WsMessage = JSON.parse(message);

  switch (msg.type) {
    case 'invoke':
      const completion = await transport.invoke(msg.payload as ActionInvocation);
      return JSON.stringify({ type: 'response', id: msg.id, payload: completion });

    case 'query':
      const results = await transport.query(msg.payload as ConceptQuery);
      return JSON.stringify({ type: 'response', id: msg.id, payload: results });

    case 'health':
      const health = await transport.health();
      return JSON.stringify({ type: 'response', id: msg.id, payload: health });

    default:
      return JSON.stringify({ type: 'error', id: msg.id, payload: `Unknown type` });
  }
};
```

**Pattern:** Parse message → route by type → call transport method → wrap response with matching ID.
