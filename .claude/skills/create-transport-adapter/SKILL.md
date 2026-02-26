---
name: create-transport-adapter
description: Write a Clef transport adapter that bridges the sync engine to a concept over a specific communication protocol (in-process, HTTP, WebSocket, worker, or custom). Use when adding a new transport protocol or customizing how concepts communicate.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<transport-name>"
---

# Create a Clef Transport Adapter

Write a transport adapter for **$ARGUMENTS** that implements the `ConceptTransport` interface, bridging the sync engine to concepts over a specific communication protocol.

## What is a Transport Adapter?

A **transport adapter** wraps a communication protocol behind the `ConceptTransport` interface so the sync engine can invoke actions, query state, and check health on any concept — regardless of where it runs or what protocol it uses.

```
┌────────────────┐       ConceptTransport        ┌──────────────────┐
│   Sync Engine  │──────────────────────────────▶│    Concept       │
│                │  invoke() / query() / health() │  (any runtime)   │
└────────────────┘       ▲                        └──────────────────┘
                         │
                    Transport Adapter
                  (protocol-specific impl)
```

The engine is **protocol-agnostic** — it always calls `transport.invoke()`, `transport.query()`, and `transport.health()`. The adapter translates these into protocol-specific operations (direct calls, HTTP requests, WebSocket messages, postMessage, etc.).

### The ConceptTransport Interface

```typescript
interface ConceptTransport {
  invoke(invocation: ActionInvocation): Promise<ActionCompletion>;
  query(request: ConceptQuery): Promise<Record<string, unknown>[]>;
  health(): Promise<{ available: boolean; latency: number }>;
  queryMode: 'graphql' | 'lite';
}
```

Every adapter must implement these four members. See [references/transport-interface.md](references/transport-interface.md) for full type definitions.

## Step-by-Step Process

### Step 1: Choose the Query Mode

Every adapter declares its query mode — this determines how the engine sends state queries to the concept:

| Mode | Protocol | Best For |
|------|----------|----------|
| `graphql` | Full GraphQL query strings | Server concepts with complex state, nested relations |
| `lite` | JSON-RPC: lookup → filter → snapshot | Mobile, embedded, simple state, low bandwidth |

Read [references/query-protocols.md](references/query-protocols.md) for the complete protocol reference.

**Key difference**: In `graphql` mode, the engine sends a GraphQL query string (`request.graphql`). In `lite` mode, the engine sends relation name + filter args (`request.relation` + `request.args`).

### Step 2: Implement the Client-Side Adapter

The adapter is a factory function that returns a `ConceptTransport` object:

```typescript
import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';

export function createMyAdapter(
  /* protocol-specific config */
): ConceptTransport {
  return {
    queryMode: 'lite',  // or 'graphql'

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      // Send the invocation to the concept, return the completion
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      // Query the concept's state, return matching records
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      // Check concept availability and measure latency
    },
  };
}
```

Read [references/adapter-patterns.md](references/adapter-patterns.md) for patterns covering invoke, query, health, error handling, and testability.

**Patterns to follow:**
- **invoke**: Send the full `ActionInvocation` envelope, receive a complete `ActionCompletion`
- **query**: Translate `ConceptQuery` into the protocol's query format, return records as `Record<string, unknown>[]`
- **health**: Measure round-trip latency, catch errors and return `{ available: false }`
- **Error handling**: Return error completions for action errors; throw/reject for transport errors
- **Testability**: Accept injectable dependencies (fetch functions, socket factories) for testing without real servers

### Step 3: Implement the Server-Side Handler (if applicable)

For network transports, you need a server-side handler that receives protocol messages and delegates to a `ConceptTransport`:

```typescript
export function createMyConceptServer(
  transport: ConceptTransport,
): ServerHandler {
  // Parse incoming messages
  // Route to transport.invoke(), transport.query(), or transport.health()
  // Serialize and return responses
}
```

The server handler wraps **any** `ConceptTransport` (usually an `InProcessAdapter` on the server side) and exposes it over the network protocol.

See [references/adapter-patterns.md](references/adapter-patterns.md) for the server-side pattern.

### Step 4: Handle Protocol-Specific Concerns

Each transport protocol has unique concerns:

| Concern | In-Process | HTTP | WebSocket | Worker |
|---------|-----------|------|-----------|--------|
| Serialization | None (direct JS) | JSON | JSON | Structured clone |
| Request correlation | N/A | HTTP request/response | Message ID matching | Message ID matching |
| Push completions | N/A | Not supported (poll) | Supported (`completion` type) | Supported |
| Connection lifecycle | N/A | Stateless | Connect/disconnect/reconnect | Worker lifecycle |
| Error propagation | Direct throw | HTTP status codes | Error message type | postMessage errors |

### Step 5: Register the Adapter

Transport adapters are registered in the concept registry, which the engine uses to resolve concepts:

```typescript
import { createConceptRegistry } from './transport.js';
import { createMyAdapter } from './my-transport.js';

const registry = createConceptRegistry();

// Register a concept with your custom adapter
const transport = createMyAdapter(/* config */);
registry.register('urn:app:MyConcept', transport);

// Engine resolves concepts through the registry
const resolved = registry.resolve('urn:app:MyConcept');
// resolved.invoke(...), resolved.query(...), resolved.health()
```

### Step 6: Write Tests

Transport adapters should be tested with mock dependencies:

```typescript
import { describe, it, expect } from 'vitest';
import { createMyAdapter } from './my-transport.js';

describe('MyAdapter', () => {
  it('invokes actions and returns completions', async () => {
    // Create adapter with mock protocol dependency
    const adapter = createMyAdapter(/* mock */);

    const completion = await adapter.invoke({
      id: 'inv-1',
      concept: 'TestConcept',
      action: 'doSomething',
      input: { value: 42 },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    });

    expect(completion.variant).toBe('ok');
    expect(completion.concept).toBe('TestConcept');
    expect(completion.action).toBe('doSomething');
  });

  it('queries state', async () => {
    const adapter = createMyAdapter(/* mock */);
    const results = await adapter.query({ relation: 'items', args: { id: '1' } });
    expect(results).toHaveLength(1);
  });

  it('reports health', async () => {
    const adapter = createMyAdapter(/* mock */);
    const health = await adapter.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });
});
```

See [examples/existing-adapters.md](examples/existing-adapters.md) for complete walkthroughs of all four existing adapters.

### Step 7: Wire into Deployment Manifest

The deployment manifest maps runtimes to transport types. The engine uses this to select the right adapter:

```yaml
runtimes:
  remote-service:
    type: node
    engine: false
    transport: my-custom-transport  # Your new transport type
```

The engine bootstrap code reads the manifest and creates adapter instances based on the `transport` field.

## Existing Adapters

The framework ships four adapters. Study these as models:

| Adapter | File | Transport | Query Mode | Push? |
|---------|------|-----------|-----------|-------|
| `InProcessAdapter` | `kernel/src/transport.ts` | Direct function call | `lite` | N/A |
| `HttpLiteAdapter` | `kernel/src/http-transport.ts` | HTTP POST | `lite` | No |
| `HttpGraphQLAdapter` | `kernel/src/http-transport.ts` | HTTP POST | `graphql` | No |
| `WebSocketAdapter` | `kernel/src/ws-transport.ts` | WebSocket | Configurable | Yes |

See [examples/existing-adapters.md](examples/existing-adapters.md) for annotated walkthroughs.

## Design Guidelines

- **The engine is adapter-agnostic**: It calls `transport.invoke()`, `transport.query()`, `transport.health()` — nothing else. Your adapter can use any protocol internally.
- **Preserve the ActionInvocation/ActionCompletion envelope**: The engine depends on the full envelope structure (id, concept, action, input, variant, output, flow, timestamp).
- **Error completions vs transport errors**: If a concept action returns an error variant, that's a normal completion. If the transport itself fails (network error, timeout), throw an Error or return `{ available: false }` from health.
- **Accept injectable dependencies**: HTTP adapters accept `fetchFn`, WebSocket adapters accept `wsFactory`. This makes testing possible without real servers.
- **Latency in health()**: Always measure actual round-trip latency. The engine uses this for monitoring and could use it for routing decisions.
- **Server handlers wrap any transport**: The server-side handler (`createHttpConceptServer`, `createWebSocketConceptServer`) accepts a `ConceptTransport` and delegates to it — it doesn't care about the underlying implementation.

## Quick Reference

See [references/transport-interface.md](references/transport-interface.md) for the ConceptTransport interface, ConceptQuery, ActionInvocation, and ActionCompletion types.
See [references/query-protocols.md](references/query-protocols.md) for GraphQL vs Lite query protocols.
See [references/adapter-patterns.md](references/adapter-patterns.md) for invoke, query, health, error handling, and server-side patterns.
See [examples/existing-adapters.md](examples/existing-adapters.md) for annotated walkthroughs of all four existing adapters.
See [templates/adapter-scaffold.md](templates/adapter-scaffold.md) for copy-paste adapter templates.

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-storage-adapter` | Write the storage backend that persists concept state |
| `/create-implementation` | Write the concept handler this transport delivers actions to |
| `/configure-deployment` | Wire this transport into a deployment manifest |
| `/create-suite` | Bundle this transport into a domain suite's infrastructure |
