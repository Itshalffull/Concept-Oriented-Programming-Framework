# Runtime Configuration Reference

How to configure runtimes, transport adapters, engine hierarchy, and query modes in a COPF deployment.

## Runtime Types

Each runtime has a `type` that determines its platform capabilities:

### Node.js (`type: node`)

The primary server-side runtime. Full capability set.

```yaml
server:
  type: node
  engine: true
  transport: in-process
```

**Capabilities**: `crypto`, `fs`, `network`, `database`, `full-compute`
**Storage backends**: `sqlite`, `postgres`, `memory`
**Query modes**: `graphql` (recommended), `lite`
**Use cases**: API servers, background workers, CLI tools

### Swift (`type: swift`)

Native Apple platform runtime for iOS/macOS apps.

```yaml
ios:
  type: swift
  engine: true
  transport: websocket
  upstream: server
```

**Capabilities**: `crypto`, `coredata`, `network`, `ui`
**Storage backends**: `coredata`
**Query modes**: `lite` (recommended), `graphql`
**Use cases**: iOS/macOS native apps, offline-first mobile

### Browser (`type: browser`)

Web browser runtime. Limited capabilities.

```yaml
web:
  type: browser
  engine: false
  transport: http
```

**Capabilities**: `network`, `ui`, `localstorage`
**Storage backends**: `localstorage`, `memory`
**Query modes**: `lite` (recommended)
**Use cases**: Web frontends, PWAs
**Note**: No `crypto` — concepts requiring crypto cannot run in the browser

### Embedded (`type: embedded`)

Minimal runtime for IoT and edge devices.

```yaml
edge:
  type: embedded
  engine: false
  transport: http
```

**Capabilities**: `crypto`, `minimal-compute`
**Storage backends**: `sqlite`, `memory`
**Query modes**: `lite`
**Use cases**: IoT devices, edge gateways

### Custom Types

Any string is valid as a type. Custom types have **no default capabilities** — concepts requiring capabilities will fail validation unless the runtime provides them through a custom capability mapping.

```yaml
custom-runtime:
  type: my-custom-platform
  engine: false
  transport: http
```

## Transport Configuration

The `transport` field determines how the sync engine communicates with concepts on that runtime.

### In-Process (`transport: in-process`)

Direct function calls within the same process. Fastest possible transport.

```yaml
server:
  type: node
  engine: true
  transport: in-process
```

- **Latency**: ~0ms (direct call)
- **Adapter**: `InProcessAdapter` (wraps handler + storage directly)
- **Best for**: Single-process deployments, all concepts on one server
- **Limitation**: Concepts must run in the same Node.js process as the engine

### HTTP (`transport: http`)

Standard HTTP request/response. Stateless, works across networks.

```yaml
api-server:
  type: node
  engine: false
  transport: http
```

- **Latency**: Network round-trip per action
- **Adapters**:
  - `HttpGraphQLAdapter` — GraphQL queries over HTTP POST
  - `HttpLiteAdapter` — JSON-RPC (snapshot/lookup/filter) over HTTP POST
- **Endpoints**: `/invoke`, `/query` (or `/graphql`), `/health`
- **Best for**: Microservice deployments, separate processes
- **Limitation**: No push completions (polling only)

### WebSocket (`transport: websocket`)

Persistent bidirectional connection. Supports push completions.

```yaml
ios:
  type: swift
  engine: true
  transport: websocket
  upstream: server
```

- **Latency**: Low (persistent connection, no handshake per request)
- **Adapter**: `WebSocketAdapter` — negotiates query mode on handshake
- **Message types**: `invoke`, `query`, `health`, `completion`, `response`, `error`
- **Best for**: Mobile ↔ server, real-time flows, push completions
- **Features**: Reconnection, push completion subscription via `AsyncIterable`

### Worker (`transport: worker`)

Communication via `postMessage`. For isolated execution contexts.

```yaml
worker:
  type: browser
  engine: false
  transport: worker
```

- **Latency**: Very low (same machine, structured clone)
- **Adapter**: `WorkerAdapter` — wraps postMessage protocol
- **Best for**: Web Workers (browser), Node worker threads
- **Limitation**: Same machine only, no cross-network

## Engine Configuration

### Single Engine (Simple)

The most common setup — one runtime runs the engine:

```yaml
runtimes:
  server:
    type: node
    engine: true          # This runtime evaluates all syncs
    transport: in-process
```

All syncs are assigned to `server`. All concepts communicate via in-process calls.

### Multiple Engines (Engine Hierarchy)

For multi-runtime deployments with offline capability:

```yaml
runtimes:
  server:
    type: node
    engine: true           # Primary engine
    transport: in-process

  ios:
    type: swift
    engine: true           # Secondary engine for offline syncs
    transport: websocket
    upstream: server       # Coordinates with server engine
```

**Hierarchy behavior:**

1. **Normal operation** (ios connected to server):
   - `[local]` syncs on ios evaluate independently on the ios engine
   - `[eager]` syncs on server evaluate on the server engine (cross-runtime calls to ios via WebSocket)
   - `[eventual]` syncs on server evaluate immediately if ios is reachable

2. **Offline** (ios disconnected from server):
   - `[local]` syncs on ios continue evaluating normally
   - `[eventual]` syncs queue on the server, replay when ios reconnects
   - `[eager]` syncs on server that reference ios concepts **fail** (concept unavailable)
   - Completions from ios are forwarded to server once reconnected

3. **Reconnection**:
   - Queued `[eventual]` syncs are replayed
   - Forwarded completions may trigger additional syncs on server
   - Conflict detection via `onConflict` hooks if concurrent writes occurred

### Upstream Rules

- `upstream` must reference a defined runtime
- The referenced runtime must have `engine: true`
- The hierarchy must be **acyclic** (no A→B→A)
- Only runtimes with `engine: true` should set `upstream`
- A runtime without `upstream` is either the root engine or standalone

## Query Mode Selection

### GraphQL Mode (`queryMode: graphql`)

Full GraphQL query support. The engine sends GraphQL query strings to the concept.

```yaml
- runtime: server
  queryMode: graphql
```

**When to use:**
- Server-side concepts with complex state
- Concepts queried with arbitrary filters
- Concepts with nested relations
- Bandwidth is not a constraint

**How it works:**
- Schema auto-generated from concept spec's `state` section
- Engine sends `ConceptQuery` with `graphql` field populated
- Adapter translates to GraphQL HTTP POST or in-process resolver call
- Full query language available (selections, filters, nested)

### Lite Mode (`queryMode: lite`)

Lightweight three-tier protocol. The engine falls back through tiers:

```yaml
- runtime: ios
  queryMode: lite
  cacheTtl: 10000          # Cache snapshots for 10 seconds
```

**Three tiers:**

1. **Lookup** — Key-based. `lookup(relation, key)` → single record. O(1).
2. **Filter** — Criteria-based. `filter(relation, criteria)` → matching records. O(n) with index.
3. **Snapshot** — Full scan. `snapshot()` → all records. O(n). Last resort.

The engine tries tiers in order: lookup → filter → snapshot. If a tier is not implemented by the concept, falls through to the next.

**`cacheTtl`**: How long the engine caches a snapshot before re-fetching. Set this for concepts that are queried frequently but change rarely.

**When to use:**
- Mobile/embedded concepts (low bandwidth)
- Simple state (few relations, small records)
- Offline-first (snapshots work without network)
- Concepts with only key-based lookups

## Capability Validation

The deployment validator checks that each concept's required capabilities are provided by its target runtime:

```
Concept "Password" requires: [crypto]
Runtime "server" (node) provides: [crypto, fs, network, database, full-compute]
→ ✅ Capability satisfied

Concept "Password" requires: [crypto]
Runtime "web" (browser) provides: [network, ui, localstorage]
→ ❌ ERROR: Concept "Password" requires capability "crypto" but runtime "web" (browser) does not provide it
```

**Common capability requirements:**

| Concept Pattern | Required Capabilities | Compatible Runtimes |
|----------------|----------------------|---------------------|
| Password hashing | `crypto` | node, swift, embedded |
| JWT tokens | `crypto` | node, swift, embedded |
| File processing | `fs` | node |
| Database queries | `database` | node |
| UI rendering | `ui` | swift, browser |
| Local storage | `localstorage` | browser |
| Core Data | `coredata` | swift |

## Hot Reload (Development)

```yaml
engine:
  hotReload:
    enabled: true
    watchPaths:
      - ./specs/
      - ./syncs/
      - ./implementations/
```

**What gets reloaded:**
- **Sync files changed**: `reloadSyncs()` — atomically replaces sync index. In-flight flows use old syncs, new completions use new index.
- **Concept implementation changed**: `reloadConcept()` — new invocations route to new transport. In-flight invocations drain naturally.
- **Concept spec changed**: Triggers recompilation (`copf compile-syncs`). If compilation fails, old syncs remain active.
- **Concept removed**: `deregisterConcept()` — syncs referencing it are marked degraded (skipped with warning).

**Production**: Always set `hotReload.enabled: false`. Use rolling deployments instead.
