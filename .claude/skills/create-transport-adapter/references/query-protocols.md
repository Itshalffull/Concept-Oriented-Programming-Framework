# Query Protocol Reference

How the sync engine queries concept state through transport adapters. Two protocols: GraphQL (full query language) and Lite (three-tier fallback).

## Overview

During sync evaluation, the engine needs to read concept state for `where`-clause queries. The query protocol determines how these reads happen:

```
Sync Engine                    Transport Adapter               Concept
    │                                │                            │
    │  transport.query(request)      │                            │
    │──────────────────────────────▶│                            │
    │                                │  (protocol-specific call)  │
    │                                │──────────────────────────▶│
    │                                │◀──────────────────────────│
    │  Record<string, unknown>[]     │                            │
    │◀──────────────────────────────│                            │
```

The engine always calls `transport.query(request: ConceptQuery)`. What the adapter does with that request depends on the query mode.

## GraphQL Mode (`queryMode: 'graphql'`)

Full GraphQL query support. The engine sends a GraphQL query string; the adapter sends it to a GraphQL endpoint.

### How It Works

1. Engine builds a `ConceptQuery` with `graphql` field populated:
   ```typescript
   const request: ConceptQuery = {
     relation: 'articles',
     args: { authorId: 'user-1' },
     graphql: '{ articles(authorId: "user-1") { id title slug } }',
   };
   ```

2. Adapter sends the GraphQL query to the concept:
   ```typescript
   // HttpGraphQLAdapter
   const response = await fetch(`${baseUrl}/graphql`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ query: request.graphql }),
   });
   ```

3. Adapter extracts records from the GraphQL response:
   ```typescript
   const result = await response.json();
   // result = { data: { articles: [{ id: '1', title: '...', slug: '...' }] } }
   return result.data.articles;  // → Record<string, unknown>[]
   ```

### Schema Auto-Generation

The engine auto-generates a GraphQL schema from the concept spec's `state` section. Each relation becomes a root query field:

```
concept Article<ID>
  state
    articles: ID -> { title: String, slug: String, body: String }
```

Generates:
```graphql
type Query {
  articles(id: ID): [Article!]!
}

type Article {
  id: ID!
  title: String!
  slug: String!
  body: String!
}
```

### Building Queries from ConceptQuery

If `request.graphql` is not set, the adapter builds a query from `relation` and `args`:

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

`__all` is a meta-field that selects all fields (similar to `SELECT *`).

### When to Use GraphQL

- Server-side concepts with complex state structures
- Concepts with nested relations that benefit from selective field queries
- When bandwidth is not a concern (server-to-server)
- When you need arbitrary filtering and selection

### Adapters Supporting GraphQL

| Adapter | Endpoint | Protocol |
|---------|----------|----------|
| `HttpGraphQLAdapter` | `POST /graphql` | HTTP + JSON body `{ query }` |
| `WebSocketAdapter` (graphql mode) | WsMessage type `query` | WebSocket + JSON `{ graphql }` |

## Lite Mode (`queryMode: 'lite'`)

Lightweight three-tier fallback protocol. Lower bandwidth, simpler implementation, works offline.

### Three Tiers

The engine falls through tiers in order until it gets results:

```
Tier 1: Lookup     ─── Key-based. O(1).      ─── "Find by exact key"
    │ (not implemented? fall through)
    ▼
Tier 2: Filter     ─── Criteria-based. O(n).  ─── "Find matching records"
    │ (not implemented? fall through)
    ▼
Tier 3: Snapshot   ─── Full scan. O(n).       ─── "Get everything, engine filters"
```

### Tier 1: Lookup

Key-based retrieval. The most efficient tier.

```typescript
lookup?(relation: string, key: string): Promise<Record<string, unknown> | null>
```

- Input: relation name + primary key value
- Output: single record or `null`
- Complexity: O(1)
- Example: `lookup('credentials', 'user@example.com')` → `{ username: '...', hash: '...' }`

### Tier 2: Filter

Criteria-based filtering. Middle tier.

```typescript
filter?(criteria: LiteFilter[]): Promise<Record<string, unknown>[]>
```

- Input: array of filter criteria
- Output: matching records
- Complexity: O(n) with index, O(n*m) without
- Example: `filter([{ field: 'authorId', op: 'eq', value: 'user-1' }])` → matching articles

```typescript
interface LiteFilter {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}
```

### Tier 3: Snapshot

Full state dump. Last resort — the engine receives all records and filters locally.

```typescript
snapshot(): Promise<ConceptStateSnapshot>
```

- Input: none
- Output: all relations with all records
- Complexity: O(n) per relation
- The engine caches snapshots using `cacheTtl` from the deployment manifest

```typescript
interface ConceptStateSnapshot {
  asOf: string;                                      // ISO timestamp
  relations: Record<string, Record<string, unknown>[]>;  // All data
}
```

### How the InProcessAdapter Handles Lite Queries

The in-process adapter delegates directly to `storage.find()`:

```typescript
async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
  if (request.args && Object.keys(request.args).length > 0) {
    return storage.find(request.relation, request.args);
  }
  return storage.find(request.relation);
}
```

### How the HttpLiteAdapter Handles Lite Queries

The HTTP adapter sends a JSON-RPC call:

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

  return response.json() as Promise<Record<string, unknown>[]>;
}
```

### Snapshot Caching

The engine caches snapshots to avoid re-fetching on every query:

```yaml
implementations:
  - runtime: ios
    queryMode: lite
    cacheTtl: 10000    # Cache for 10 seconds
```

**Cache behavior:**
- First query triggers a snapshot fetch
- Subsequent queries within `cacheTtl` use the cached snapshot
- After `cacheTtl` expires, next query re-fetches
- Set `cacheTtl: 0` to disable caching

### Lite Query Warn Threshold

The engine warns when a snapshot exceeds a threshold:

```yaml
engine:
  liteQueryWarnThreshold: 1000    # Warn on snapshot > 1000 entries
```

This nudges developers to implement `lookup`/`filter` or switch to GraphQL mode.

### When to Use Lite Mode

- Mobile/embedded concepts (low bandwidth)
- Simple state structures (few relations, small records)
- Offline-first patterns (snapshots work without network)
- Concepts primarily queried by key (lookup tier)

### Adapters Supporting Lite

| Adapter | Endpoint | Protocol |
|---------|----------|----------|
| `InProcessAdapter` | Direct `storage.find()` | In-process function call |
| `HttpLiteAdapter` | `POST /query` | HTTP + JSON-RPC `{ method, params }` |
| `WebSocketAdapter` (lite mode) | WsMessage type `query` | WebSocket + JSON `{ relation, args }` |

## Protocol Comparison

| Aspect | GraphQL | Lite |
|--------|---------|------|
| Query language | Full GraphQL | lookup / filter / snapshot |
| Field selection | Yes (selective) | No (all fields) |
| Nested queries | Yes | No |
| Bandwidth | Higher (query strings) | Lower (minimal payloads) |
| Implementation effort | Higher (GraphQL resolver) | Lower (storage.find) |
| Offline support | Harder (need full resolver) | Easier (snapshots) |
| Caching | Not built-in | `cacheTtl` in manifest |
| Best for | Server concepts | Mobile/embedded concepts |
