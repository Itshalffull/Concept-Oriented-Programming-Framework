# Deployment Manifest Templates

Copy-paste templates for common deployment topologies. Replace all `TODO` markers.

## Template 1: Single Server (Minimal)

```yaml
app:
  name: TODO_app_name
  version: 0.1.0
  uri: urn:TODO_app_name

runtimes:
  server:
    type: node
    engine: true
    transport: in-process

concepts:
  TODO_ConceptA:
    spec: ./specs/TODO_concept_a.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/TODO_concept_a.handler.ts
        runtime: server
        storage: sqlite
        queryMode: graphql

  TODO_ConceptB:
    spec: ./specs/TODO_concept_b.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/TODO_concept_b.handler.ts
        runtime: server
        storage: sqlite
        queryMode: graphql

syncs:
  - path: ./syncs/app/TODO_sync_file.sync
    engine: server
```

## Template 2: Single Server with Telemetry

```yaml
app:
  name: TODO_app_name
  version: 0.1.0
  uri: urn:TODO_app_name

runtimes:
  server:
    type: node
    engine: true
    transport: in-process

concepts:
  TODO_Concept:
    spec: ./specs/TODO_concept.concept
    implementations:
      - language: typescript
        path: ./implementations/TODO_concept.handler.ts
        runtime: server
        storage: postgres
        queryMode: graphql

syncs:
  - path: ./syncs/TODO_sync.sync
    engine: server

engine:
  liteQueryWarnThreshold: 1000
  telemetry:
    enabled: true
    exporter: TODO_exporter    # stdout | otlp | jaeger
    otlpEndpoint: TODO_endpoint  # e.g., http://localhost:4317
```

## Template 3: Server + Mobile (Offline-First)

```yaml
app:
  name: TODO_app_name
  version: 0.1.0
  uri: urn:TODO_app_name

runtimes:
  server:
    type: node
    engine: true
    transport: in-process

  mobile:
    type: swift
    engine: true
    transport: websocket
    upstream: server

concepts:
  # Server-only concepts
  TODO_ServerConcept:
    spec: ./specs/TODO_server_concept.concept
    implementations:
      - language: typescript
        path: ./server/concepts/TODO_server_concept
        runtime: server
        storage: postgres
        queryMode: graphql

  # Cross-runtime concept (server + mobile)
  TODO_SharedConcept:
    spec: ./specs/TODO_shared_concept.concept
    implementations:
      - language: typescript
        path: ./server/concepts/TODO_shared_concept
        runtime: server
        storage: postgres
        queryMode: graphql
      - language: swift
        path: ./mobile/concepts/TODO_shared_concept
        runtime: mobile
        storage: coredata
        queryMode: lite
        cacheTtl: 10000

syncs:
  # Server-only syncs
  - path: ./syncs/TODO_server_sync.sync
    engine: server

  # Cross-runtime replication
  - path: ./syncs/TODO_replicate.sync
    engine: server
    annotations:
      - eventual
      - idempotent

  # Mobile-local syncs
  - path: ./syncs/TODO_local.sync
    engine: mobile
    annotations:
      - local
```

## Template 4: Server + Browser

```yaml
app:
  name: TODO_app_name
  version: 0.1.0
  uri: urn:TODO_app_name

runtimes:
  server:
    type: node
    engine: true
    transport: in-process

  browser:
    type: browser
    engine: false
    transport: http

concepts:
  TODO_Concept:
    spec: ./specs/TODO_concept.concept
    implementations:
      - language: typescript
        path: ./server/concepts/TODO_concept
        runtime: server
        storage: postgres
        queryMode: graphql

syncs:
  - path: ./syncs/TODO_sync.sync
    engine: server
```

## Template 5: Microservices

```yaml
app:
  name: TODO_app_name
  version: 0.1.0
  uri: urn:TODO_app_name

runtimes:
  gateway:
    type: node
    engine: true
    transport: in-process

  TODO_service_a:
    type: node
    engine: false
    transport: http

  TODO_service_b:
    type: node
    engine: false
    transport: http

concepts:
  TODO_ConceptA:
    spec: ./specs/TODO_concept_a.concept
    implementations:
      - language: typescript
        path: ./services/TODO_service_a/TODO_concept_a
        runtime: TODO_service_a
        storage: postgres
        queryMode: graphql

  TODO_ConceptB:
    spec: ./specs/TODO_concept_b.concept
    implementations:
      - language: typescript
        path: ./services/TODO_service_b/TODO_concept_b
        runtime: TODO_service_b
        storage: postgres
        queryMode: graphql

syncs:
  - path: ./syncs/TODO_sync.sync
    engine: gateway

engine:
  telemetry:
    enabled: true
    exporter: otlp
    otlpEndpoint: TODO_collector_endpoint
```

## Template 6: Development Setup

```yaml
app:
  name: TODO_app_name
  version: 0.0.0-dev
  uri: urn:TODO_app_name

runtimes:
  dev:
    type: node
    engine: true
    transport: in-process

concepts:
  TODO_Concept:
    spec: ./specs/TODO_concept.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/TODO_concept.handler.ts
        runtime: dev
        storage: memory
        queryMode: lite

syncs:
  - path: ./syncs/app/TODO_sync.sync
    engine: dev

engine:
  liteQueryWarnThreshold: 100
  telemetry:
    enabled: true
    exporter: stdout
  hotReload:
    enabled: true
    watchPaths:
      - ./specs/
      - ./syncs/
      - ./implementations/
```

## Template 7: Runtime Entry

```yaml
# Server runtime
TODO_name:
  type: node
  engine: true
  transport: in-process

# Mobile runtime (with upstream)
TODO_name:
  type: swift
  engine: true
  transport: websocket
  upstream: TODO_upstream_runtime

# Browser runtime (no engine)
TODO_name:
  type: browser
  engine: false
  transport: http

# Embedded runtime
TODO_name:
  type: embedded
  engine: false
  transport: http
```

## Template 8: Concept Entry

```yaml
# Single-runtime concept
TODO_Concept:
  spec: ./specs/TODO_concept.concept
  implementations:
    - language: typescript
      path: ./implementations/TODO_concept.handler.ts
      runtime: TODO_runtime
      storage: TODO_storage     # sqlite | postgres | memory
      queryMode: TODO_mode      # graphql | lite

# Multi-runtime concept
TODO_Concept:
  spec: ./specs/TODO_concept.concept
  implementations:
    - language: typescript
      path: ./server/concepts/TODO_concept
      runtime: server
      storage: postgres
      queryMode: graphql
    - language: swift
      path: ./mobile/concepts/TODO_concept
      runtime: mobile
      storage: coredata
      queryMode: lite
      cacheTtl: 10000
```

## Template 9: Sync Entry

```yaml
# Eager sync (default)
- path: ./syncs/TODO_sync.sync
  engine: TODO_runtime

# Eventual sync (cross-runtime, resilient)
- path: ./syncs/TODO_sync.sync
  engine: TODO_runtime
  annotations:
    - eventual
    - idempotent

# Local sync (same-runtime only)
- path: ./syncs/TODO_sync.sync
  engine: TODO_runtime
  annotations:
    - local
```

## Customization Guide

| TODO Marker | Replace With | Example |
|-------------|-------------|---------|
| `TODO_app_name` | Application name | `conduit` |
| `TODO_Concept` / `TODO_ConceptA` | Concept name in PascalCase | `Article` |
| `TODO_concept` / `TODO_concept_a` | Concept name in lowercase | `article` |
| `TODO_sync` / `TODO_sync_file` | Sync file name (without extension) | `articles` |
| `TODO_runtime` | Runtime name | `server` |
| `TODO_upstream_runtime` | Parent engine runtime | `server` |
| `TODO_service_a` | Service name | `auth-service` |
| `TODO_storage` | Storage backend | `sqlite`, `postgres`, `memory` |
| `TODO_mode` | Query mode | `graphql`, `lite` |
| `TODO_exporter` | Telemetry exporter | `stdout`, `otlp`, `jaeger` |
| `TODO_endpoint` | OTLP collector URL | `http://localhost:4317` |
| `TODO_collector_endpoint` | Jaeger/OTLP URL | `http://jaeger:4317` |
