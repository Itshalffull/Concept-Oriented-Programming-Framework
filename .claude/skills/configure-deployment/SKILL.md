---
name: configure-deployment
description: Configure a Clef deployment manifest that maps concepts to runtimes, assigns syncs to engines, sets up transport adapters, and validates capability requirements. Use when deploying concepts across one or more runtimes.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<app-name>"
---

# Configure a Clef Deployment

Write a deployment manifest for **$ARGUMENTS** that maps concepts to runtimes, assigns syncs to engines, and configures transport, storage, and observability.

## What is a Deployment Manifest?

A **deployment manifest** is a YAML/JSON file that declares how an application's concepts and syncs are distributed across runtimes. It is the single source of truth for:

- Which **runtimes** exist (server, mobile, browser, embedded)
- Where each **concept** runs (which runtime, language, storage backend, query mode)
- Which **sync engine** evaluates each sync
- How runtimes **coordinate** (engine hierarchy, transport protocols)
- **Operational settings** (telemetry, hot reload, query thresholds)

```yaml
app:
  name: conduit
  version: 0.1.0
  uri: urn:conduit

runtimes:
  server:
    type: node
    engine: true
    transport: in-process

concepts:
  Password:
    spec: ./specs/password.concept
    implementations:
      - language: typescript
        path: ./server/concepts/password
        runtime: server
        storage: sqlite
        queryMode: graphql

syncs:
  - path: ./syncs/auth.sync
    engine: server
```

## Step-by-Step Process

### Step 1: Define Runtimes

A **runtime** is an execution environment where concepts run. Each runtime declares its type, whether it hosts a sync engine, and how it communicates.

```yaml
runtimes:
  server:
    type: node            # node | swift | browser | embedded
    engine: true          # Runs a sync engine instance
    transport: in-process # in-process | http | websocket | worker
```

Read [references/runtime-configuration.md](references/runtime-configuration.md) for the complete runtime configuration reference.

**Runtime types and their capabilities:**

| Type | Capabilities | Typical Use |
|------|-------------|-------------|
| `node` | crypto, fs, network, database, full-compute | Server, API backend |
| `swift` | crypto, coredata, network, ui | iOS/macOS native app |
| `browser` | network, ui, localstorage | Web frontend |
| `embedded` | crypto, minimal-compute | IoT, edge devices |

**Key decisions:**
- **`engine: true`** — Does this runtime evaluate syncs? At least one runtime must be an engine.
- **`transport`** — How does the engine reach concepts on this runtime?
  - `in-process`: Same process (fastest, default for single-runtime)
  - `http`: HTTP endpoints (REST-like, stateless)
  - `websocket`: Persistent connection (push completions, lower latency)
  - `worker`: Web Worker or Node worker thread
- **`upstream`** — For multi-engine deployments, which engine does this one coordinate with?

### Step 2: Place Concepts on Runtimes

Each concept needs at least one implementation mapped to a runtime. A concept can have multiple implementations on different runtimes (e.g., server + mobile).

```yaml
concepts:
  Profile:
    spec: ./specs/profile.concept
    implementations:
      - language: typescript
        path: ./server/concepts/profile
        runtime: server
        storage: postgres
        queryMode: graphql
      - language: swift
        path: ./ios/concepts/profile
        runtime: ios
        storage: coredata
        queryMode: lite
        cacheTtl: 10000
```

Read [references/deployment-manifest.md](references/deployment-manifest.md) for the full manifest schema.

**Concept implementation fields:**

| Field | Required | Values | Purpose |
|-------|----------|--------|---------|
| `language` | Yes | typescript, swift, rust, etc. | Implementation language |
| `path` | Yes | Relative path | Path to implementation code |
| `runtime` | Yes | Runtime name | Which runtime hosts this implementation |
| `storage` | Yes | sqlite, postgres, coredata, localstorage, memory | Storage backend |
| `queryMode` | Yes | graphql, lite | How the engine queries this concept's state |
| `cacheTtl` | No | Integer (ms) | Engine-side snapshot caching for lite mode |

**Capability matching**: The validator checks that each concept's required capabilities (from its spec's `capabilities` section) are provided by the target runtime. For example, a concept requiring `crypto` cannot run on a `browser` runtime.

### Step 3: Assign Syncs to Engines

Each sync file must be assigned to a sync engine (a runtime with `engine: true`).

```yaml
syncs:
  - path: ./syncs/auth.sync
    engine: server

  - path: ./syncs/profile-sync.sync
    engine: server
    annotations:
      - eventual

  - path: ./syncs/local-profile.sync
    engine: ios
    annotations:
      - local
```

**Annotation semantics in deployment:**

| Annotation | Engine Behavior | Use Case |
|-----------|----------------|----------|
| (none) / `eager` | Evaluate synchronously. All concepts must be reachable. | Default. Most server-side syncs. |
| `eventual` | Queue if concepts unavailable. Retry on availability. | Cross-runtime syncs, offline-capable flows. |
| `local` | Only evaluate if all concepts on same runtime. | Offline-first mobile syncs. |
| `idempotent` | Safe to re-execute on retry. | Hint for the engine's retry logic. |

**Deployment rules:**
- Every sync must target a runtime with `engine: true`
- If a sync references concepts on multiple runtimes, consider `[eventual]` annotation
- Eager syncs spanning runtimes produce a validation warning (latency concern)

### Step 4: Configure Engine Hierarchy (Multi-Runtime)

For deployments with multiple engines, use `upstream` to form a coordination hierarchy:

```yaml
runtimes:
  server:
    type: node
    engine: true
    transport: in-process

  ios:
    type: swift
    engine: true
    transport: websocket
    upstream: server        # Forwards completions to server engine
```

Read [references/runtime-configuration.md](references/runtime-configuration.md) for engine hierarchy details.

**How it works:**
- The downstream engine (ios) evaluates `[local]` syncs independently
- Cross-runtime completions are forwarded to the upstream engine (server)
- `[eventual]` syncs queue when the upstream is unreachable and replay on reconnection
- The hierarchy must be acyclic (no cycles in `upstream` references)

### Step 5: Configure Operational Settings

```yaml
engine:
  liteQueryWarnThreshold: 1000   # Warn on snapshot > N entries
  telemetry:
    enabled: true
    exporter: stdout             # stdout | otlp | jaeger
    otlpEndpoint: http://localhost:4317
  hotReload:
    enabled: true                # Dev only
    watchPaths:
      - ./specs/
      - ./syncs/
      - ./implementations/
```

**Telemetry** maps to OpenTelemetry: flows → traces, actions → spans, provenance → parent spans. Enable per environment.

**Hot reload** watches files and reloads syncs/concepts without engine restart. Dev only — disable in production.

**Lite query threshold** warns when the snapshot slow path returns too many entries, nudging developers to implement `lookup`/`filter` or switch to GraphQL.

### Step 6: Validate

```bash
# Validate the deployment manifest
npx tsx cli/src/index.ts deploy --manifest app.deploy.json

# With custom specs directory
npx tsx cli/src/index.ts deploy --manifest app.deploy.json --specs specs
```

Read [references/validation-rules.md](references/validation-rules.md) for all validation rules and their error messages.

The validator checks:
1. Every concept referenced by syncs has a deployment entry
2. Every concept's capabilities are satisfied by its runtime
3. Every sync's engine is a runtime with `engine: true`
4. Eager syncs spanning multiple runtimes get a warning
5. Runtime `upstream` references form a valid acyclic hierarchy

On success, the validator produces a **deployment plan** with concept placements and sync assignments (including cross-runtime flags).

### Step 7: Choose Query Modes

Two query modes for how the sync engine reads concept state during `where`-clause evaluation:

**GraphQL mode** (`queryMode: graphql`):
- Full query language with schema auto-generated from concept spec
- Best for: server-side concepts with complex queries
- Requires: concept runs a GraphQL resolver
- Transport: `InProcessGraphQLAdapter` or `HttpGraphQLAdapter`

**Lite mode** (`queryMode: lite`):
- Three-tier fallback: lookup (key) → filter (criteria) → snapshot (full scan)
- Lower bandwidth, simpler implementation
- Best for: mobile/embedded concepts, simple state
- Transport: `InProcessLiteAdapter` or `HttpLiteAdapter`
- Optional `cacheTtl` for engine-side snapshot caching

```yaml
implementations:
  - runtime: server
    queryMode: graphql         # Server: full GraphQL
  - runtime: ios
    queryMode: lite            # Mobile: lightweight protocol
    cacheTtl: 10000            # Cache snapshots for 10 seconds
```

## Transport Adapters

The engine communicates with concepts through transport adapters, selected by the deployment manifest:

| Transport | Adapter | Protocol | Use Case |
|-----------|---------|----------|----------|
| `in-process` | `InProcessAdapter` | Direct function call | Same process (fastest) |
| `http` + graphql | `HttpGraphQLAdapter` | HTTP + GraphQL | Remote server concept |
| `http` + lite | `HttpLiteAdapter` | HTTP + JSON-RPC | Remote lightweight concept |
| `websocket` | `WebSocketAdapter` | WebSocket + negotiated | Persistent connection, push |
| `worker` | `WorkerAdapter` | postMessage | Web/Node worker thread |

The engine is **agnostic** to query mode — it always goes through `ConceptTransport.query()`, and the adapter translates to the appropriate protocol.

## Design Guidelines

- **Start single-runtime**: Begin with one `node` runtime with `engine: true` and `transport: in-process`. Add runtimes only when you need them.
- **Use `graphql` for server concepts**: Full query power, no bandwidth concern.
- **Use `lite` for mobile/edge concepts**: Lower overhead, works offline with snapshots.
- **Mark cross-runtime syncs `[eventual]`**: Avoids blocking on unreachable runtimes.
- **Keep `[local]` syncs on the same engine as their concepts**: For offline-first flows.
- **One engine per runtime at most**: The `engine: true` flag is per-runtime, not per-concept.
- **Capabilities gate concept placement**: Don't fight it — if a concept needs `crypto`, it can't run in the browser.

## Quick Reference

See [references/deployment-manifest.md](references/deployment-manifest.md) for the full manifest schema.
See [references/runtime-configuration.md](references/runtime-configuration.md) for runtime types, transport, and engine hierarchy.
See [references/validation-rules.md](references/validation-rules.md) for all validation rules and error messages.
See [examples/deployment-scenarios.md](examples/deployment-scenarios.md) for single-runtime, multi-runtime, and offline-first deployments.
See [templates/deployment-scaffold.md](templates/deployment-scaffold.md) for copy-paste manifest templates.

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-transport-adapter` | Write custom transport adapters referenced in the manifest |
| `/create-storage-adapter` | Write custom storage backends referenced in the manifest |
| `/create-suite` | Create suites whose deploy templates this manifest can use |
| `/create-implementation` | Write implementations assigned to runtimes in the manifest |
