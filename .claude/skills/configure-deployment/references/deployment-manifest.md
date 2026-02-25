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

build:                   # Optional per-language build tooling preferences
  <name>: <BuildConfig>

engine:                  # Optional global engine settings
  <EngineConfig>
```

All three top-level sections (`app`, `runtimes`, `concepts`) are required. `syncs` defaults to empty. `build` and `engine` are optional.

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
  build?: Record<string, BuildConfig>;
}

interface BuildConfig {
  compiler?: string;
  testRunner?: string;
  testTypes?: string[];
  e2eRunner?: string;
  uiRunner?: string;
  visualRunner?: string;
  integrationRunner?: string;
  benchmarkRunner?: string;
  versionConstraint?: string;
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

## Build Section (Optional)

Per-language tooling preferences for compilation, testing, and packaging. Each entry is keyed by language name and specifies which tools to use for that language. When these values are set, Toolchain/resolve uses the `toolName` parameter to select the specified tool instead of the default.

```yaml
build:
  typescript:
    compiler: tsc                  # Compiler tool name (default: tsc)
    testRunner: jest               # Unit test runner (default: vitest)
    testTypes:                     # Which test types to run in pipelines
      - unit
      - integration
      - e2e
    e2eRunner: playwright          # E2E test runner (default: playwright)
    versionConstraint: ">=5.4"     # Compiler version constraint
  solidity:
    compiler: hardhat              # Use Hardhat instead of Foundry (default: foundry)
    testRunner: hardhat            # Use Hardhat test runner (default: foundry)
    testTypes:
      - unit
      - e2e
  rust:
    testRunner: nextest            # Use cargo-nextest instead of cargo test
    testTypes:
      - unit
      - benchmark
    benchmarkRunner: criterion     # Benchmark runner (default: criterion)
```

### Build Fields

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `compiler` | No | string | language default | Compiler tool name passed as `toolName` to Toolchain/resolve(category: "compiler") |
| `testRunner` | No | string | language default | Unit test runner name passed as `toolName` to Toolchain/resolve(category: "unit-runner") |
| `testTypes` | No | string[] | `["unit"]` | Which test categories to execute during build pipelines |
| `e2eRunner` | No | string | language default | E2E runner name passed as `toolName` to Toolchain/resolve(category: "e2e-runner") |
| `uiRunner` | No | string | language default | UI test runner name |
| `visualRunner` | No | string | language default | Visual regression runner name |
| `integrationRunner` | No | string | language default | Integration test runner name |
| `benchmarkRunner` | No | string | language default | Benchmark runner name |
| `versionConstraint` | No | string | — | Version constraint for the compiler |

### Test Types

| Type | Category | Description |
|------|----------|-------------|
| `unit` | `unit-runner` | Unit tests (default, always included) |
| `integration` | `integration-runner` | Integration tests (database, API) |
| `e2e` | `e2e-runner` | End-to-end tests |
| `ui` | `ui-runner` | UI component tests |
| `visual` | `visual-runner` | Visual regression tests |
| `benchmark` | `benchmark-runner` | Performance benchmarks |

### Tool Resolution Flow

When the deploy plan executes, the `build` section is used as follows:

1. For each concept implementation, the `language` field determines which `build.<language>` config applies
2. **Compilation**: Toolchain/resolve(language, platform, category: "compiler", toolName: build.compiler)
3. **Testing**: For each entry in `testTypes`, Toolchain/resolve(language, platform, category: "<type>-runner", toolName: build.<type>Runner or build.testRunner)
4. The resolved invocation profiles are passed to the language-specific Builder provider

### Available Tools Per Language

| Language | Category | Available Tools | Default |
|----------|----------|----------------|---------|
| TypeScript | compiler | `tsc` | `tsc` |
| TypeScript | unit-runner | `vitest`, `jest` | `vitest` |
| TypeScript | e2e-runner | `playwright`, `cypress` | `playwright` |
| TypeScript | ui-runner | `storybook` | `storybook` |
| TypeScript | visual-runner | `chromatic` | `chromatic` |
| TypeScript | integration-runner | `vitest` | `vitest` |
| Swift | compiler | `swiftc` | `swiftc` |
| Swift | unit-runner | `xctest` | `xctest` |
| Swift | ui-runner | `xcuitest` | `xcuitest` |
| Swift | e2e-runner | `swift-e2e` | `swift-e2e` |
| Rust | compiler | `rustc` | `rustc` |
| Rust | unit-runner | `cargo-test`, `nextest` | `cargo-test` |
| Rust | e2e-runner | `nextest` | `nextest` |
| Rust | benchmark-runner | `criterion` | `criterion` |
| Solidity | compiler | `foundry`, `hardhat`, `solc` | `foundry` |
| Solidity | unit-runner | `foundry`, `hardhat` | `foundry` |
| Solidity | e2e-runner | `foundry` | `foundry` |

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
