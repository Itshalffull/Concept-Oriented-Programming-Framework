# Deployment Manifest Schema Reference

Complete schema for the COPF deployment manifest (`app.deploy.yaml` / `app.deploy.json`).

## Root Structure

```yaml
app:
  name: <string>         # Application name
  version: <string>      # Semantic version (e.g., "0.1.0")
  uri: <string>          # Application URN (e.g., "urn:conduit")

runtimes:
  <name>: <RuntimeConfig>

concepts:
  <name>: <ConceptDeployment>

syncs:
  - <SyncDeployment>

engine:                  # Optional global engine settings
  <EngineConfig>
```

All three top-level sections (`app`, `runtimes`, `concepts`) are required. `syncs` defaults to empty. `engine` is optional.

## TypeScript Types

```typescript
interface DeploymentManifest {
  app: {
    name: string;
    version: string;
    uri: string;
  };
  runtimes: Record<string, RuntimeConfig>;
  concepts: Record<string, ConceptDeployment>;
  syncs: SyncDeployment[];
}

interface RuntimeConfig {
  type: 'node' | 'swift' | 'browser' | 'embedded' | string;
  engine: boolean;
  transport: 'in-process' | 'http' | 'websocket' | 'worker';
  upstream?: string;
  liteQueryWarnThreshold?: number;
}

interface ConceptDeployment {
  spec: string;
  implementations: ConceptImplementation[];
}

interface ConceptImplementation {
  language: string;
  path: string;
  runtime: string;
  storage: string;
  queryMode: 'graphql' | 'lite';
  cacheTtl?: number;
}

interface SyncDeployment {
  path: string;
  engine: string;
  annotations?: string[];
}
```

## App Section

```yaml
app:
  name: conduit           # Required. Application identifier.
  version: 0.1.0          # Required. Semantic version.
  uri: urn:conduit         # Required. Application URN for concept namespacing.
```

All three fields are required. The parser will reject manifests missing any of them.

## Runtimes Section

Each entry defines an execution environment:

```yaml
runtimes:
  server:
    type: node             # Required. Runtime platform type.
    engine: true           # Required. Whether this runtime hosts a sync engine.
    transport: in-process  # Required. How the engine communicates with this runtime.
    upstream: null         # Optional. Parent engine for coordination.
    liteQueryWarnThreshold: 1000  # Optional. Override global threshold.
```

### Runtime Fields

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `type` | Yes | string | — | Platform: `node`, `swift`, `browser`, `embedded`, or custom |
| `engine` | Yes | boolean | — | Whether this runtime runs a sync engine instance |
| `transport` | Yes | string | — | Transport protocol: `in-process`, `http`, `websocket`, `worker` |
| `upstream` | No | string | — | Name of the upstream runtime for engine hierarchy |
| `liteQueryWarnThreshold` | No | number | 1000 | Override snapshot size warning threshold |

### Runtime Types and Capabilities

| Type | Provided Capabilities |
|------|----------------------|
| `node` | `crypto`, `fs`, `network`, `database`, `full-compute` |
| `swift` | `crypto`, `coredata`, `network`, `ui` |
| `browser` | `network`, `ui`, `localstorage` |
| `embedded` | `crypto`, `minimal-compute` |

Custom runtime types have no default capabilities. Concepts requiring capabilities can only be placed on runtimes that provide them.

### Transport Types

| Transport | Protocol | Adapters | Use Case |
|-----------|----------|----------|----------|
| `in-process` | Direct function call | `InProcessAdapter` | Same process (default) |
| `http` | HTTP request/response | `HttpGraphQLAdapter`, `HttpLiteAdapter` | Separate servers |
| `websocket` | Persistent WebSocket | `WebSocketAdapter` | Mobile ↔ server, push |
| `worker` | postMessage | `WorkerAdapter` | Web Workers, Node workers |

## Concepts Section

Each entry maps a concept spec to one or more implementations across runtimes:

```yaml
concepts:
  Profile:
    spec: ./specs/profile.concept      # Required. Path to concept spec.
    implementations:                    # Required. At least one implementation.
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

### Implementation Fields

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `language` | Yes | string | — | Implementation language (`typescript`, `swift`, `rust`, etc.) |
| `path` | Yes | string | — | Path to implementation source |
| `runtime` | Yes | string | — | Target runtime name (must match a key in `runtimes`) |
| `storage` | Yes | string | — | Storage backend (`sqlite`, `postgres`, `coredata`, `localstorage`, `memory`) |
| `queryMode` | Yes | string | `lite` | Query protocol: `graphql` or `lite` |
| `cacheTtl` | No | number | — | Engine-side snapshot cache duration in milliseconds (lite mode only) |

### Storage Backends

| Backend | Runtime | Description |
|---------|---------|-------------|
| `sqlite` | node | SQLite database file. Good for dev and small deployments. |
| `postgres` | node | PostgreSQL. Production server deployments. |
| `coredata` | swift | Core Data (Apple). iOS/macOS native storage. |
| `localstorage` | browser | Browser localStorage. Limited capacity. |
| `memory` | any | In-memory (lost on restart). Tests and ephemeral concepts. |

### Query Modes

| Mode | Protocol | Best For | Transport Adapter |
|------|----------|----------|-------------------|
| `graphql` | Full GraphQL | Server concepts, complex queries | `HttpGraphQLAdapter`, `InProcessGraphQLAdapter` |
| `lite` | lookup → filter → snapshot (JSON-RPC) | Mobile, embedded, simple state | `HttpLiteAdapter`, `InProcessLiteAdapter` |

## Syncs Section

Each entry assigns a sync file to a sync engine:

```yaml
syncs:
  - path: ./syncs/auth.sync            # Required. Path to .sync file.
    engine: server                     # Required. Runtime name (must have engine: true).
    annotations:                       # Optional. Override/declare annotations.
      - eventual
```

### Sync Fields

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `path` | Yes | string | — | Path to .sync file |
| `engine` | Yes | string | — | Runtime name of the engine that evaluates this sync |
| `annotations` | No | string[] | `[]` (eager) | Annotations: `eager`, `eventual`, `local`, `idempotent` |

### Annotation Defaults

If no annotations are specified, the sync is treated as **eager** (synchronous, all concepts must be reachable).

## Engine Section (Optional)

Global settings for the sync engine:

```yaml
engine:
  liteQueryWarnThreshold: 1000        # Warn on snapshot > N entries (0 to disable)
  telemetry:
    enabled: true                     # Enable ExportTelemetry sync
    exporter: stdout                  # stdout | otlp | jaeger
    otlpEndpoint: http://localhost:4317  # If exporter is otlp
  hotReload:
    enabled: true                     # Watch files and reload (dev only)
    watchPaths:
      - ./specs/
      - ./syncs/
      - ./implementations/
```

### Engine Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `liteQueryWarnThreshold` | number | 1000 | Warn when snapshot exceeds this many entries |
| `telemetry.enabled` | boolean | false | Enable telemetry export |
| `telemetry.exporter` | string | `stdout` | Export target |
| `telemetry.otlpEndpoint` | string | — | OTLP collector URL |
| `hotReload.enabled` | boolean | false | Watch and reload on file changes |
| `hotReload.watchPaths` | string[] | — | Directories to watch |

## Validation Output

The validator produces a `ValidationResult`:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];       // Fatal: must fix before deploying
  warnings: string[];     // Advisory: should review
  plan: DeploymentPlan | null;  // Only if valid (no errors)
}

interface DeploymentPlan {
  conceptPlacements: ConceptPlacement[];
  syncAssignments: SyncAssignment[];
}

interface ConceptPlacement {
  concept: string;
  runtime: string;
  language: string;
  transport: string;
  queryMode: 'graphql' | 'lite';
}

interface SyncAssignment {
  sync: string;
  engine: string;
  annotations: string[];
  crossRuntime: boolean;  // true if sync spans multiple runtimes
}
```
