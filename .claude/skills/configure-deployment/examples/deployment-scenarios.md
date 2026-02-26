# Deployment Scenarios

Worked examples for common deployment topologies — single server, multi-runtime with mobile, browser frontend, and development setups.

## Scenario 1: Single Server (Simplest)

All concepts run in one Node.js process. No cross-runtime concerns.

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
  User:
    spec: ./specs/user.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/user.handler.ts
        runtime: server
        storage: sqlite
        queryMode: graphql

  Password:
    spec: ./specs/password.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/password.handler.ts
        runtime: server
        storage: sqlite
        queryMode: graphql

  JWT:
    spec: ./specs/jwt.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/jwt.handler.ts
        runtime: server
        storage: memory
        queryMode: lite

  Article:
    spec: ./specs/article.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/article.handler.ts
        runtime: server
        storage: sqlite
        queryMode: graphql

  Comment:
    spec: ./specs/comment.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/comment.handler.ts
        runtime: server
        storage: sqlite
        queryMode: graphql

syncs:
  - path: ./syncs/app/registration.sync
    engine: server
  - path: ./syncs/app/login.sync
    engine: server
  - path: ./syncs/app/articles.sync
    engine: server
  - path: ./syncs/app/comments.sync
    engine: server

engine:
  telemetry:
    enabled: false
```

**Key decisions:**
- One runtime, one engine — simplest possible setup
- `transport: in-process` — all concepts in the same process
- `storage: sqlite` for persistent data, `memory` for ephemeral (JWT tokens)
- `queryMode: graphql` for data-heavy concepts, `lite` for simple ones like JWT
- No `upstream`, no eventual syncs, no cross-runtime concerns

---

## Scenario 2: Server + iOS (Offline-First Mobile)

Server handles auth and data storage. iOS has a local Profile concept for offline use.

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

  ios:
    type: swift
    engine: true
    transport: websocket
    upstream: server

concepts:
  User:
    spec: ./specs/user.concept
    implementations:
      - language: typescript
        path: ./server/concepts/user
        runtime: server
        storage: postgres
        queryMode: graphql

  Password:
    spec: ./specs/password.concept
    implementations:
      - language: typescript
        path: ./server/concepts/password
        runtime: server
        storage: postgres
        queryMode: graphql

  JWT:
    spec: ./specs/jwt.concept
    implementations:
      - language: typescript
        path: ./server/concepts/jwt
        runtime: server
        storage: memory
        queryMode: lite

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

  Article:
    spec: ./specs/article.concept
    implementations:
      - language: typescript
        path: ./server/concepts/article
        runtime: server
        storage: postgres
        queryMode: graphql

syncs:
  # Server-only syncs (auth, CRUD)
  - path: ./syncs/auth.sync
    engine: server
  - path: ./syncs/registration.sync
    engine: server
  - path: ./syncs/articles.sync
    engine: server

  # Cross-runtime sync: replicate profile changes
  - path: ./syncs/profile-replicate.sync
    engine: server
    annotations:
      - eventual
      - idempotent

  # iOS-local sync: offline profile editing
  - path: ./syncs/local-profile.sync
    engine: ios
    annotations:
      - local

engine:
  liteQueryWarnThreshold: 1000
  telemetry:
    enabled: true
    exporter: otlp
    otlpEndpoint: http://localhost:4317
```

**Key decisions:**
- Two engines: server (primary) + ios (local for offline)
- `upstream: server` on ios — completions forwarded to server when online
- Profile has **two implementations**: server (postgres/graphql) + ios (coredata/lite)
- `profile-replicate.sync` is `[eventual]` — queues when ios is offline, replays on reconnect
- `local-profile.sync` is `[local]` — always evaluates on ios regardless of connectivity
- `cacheTtl: 10000` on ios Profile — engine caches snapshots for 10 seconds
- `idempotent` on replicate sync — safe to retry if delivery fails

**The profile-replicate.sync:**
```
sync ReplicateProfile [eventual] [idempotent]
when {
  Phone.Profile/update: [] => [ user: ?user; bio: ?bio; image: ?image ]
}
then {
  Server.Profile/replicate: [ user: ?user; bio: ?bio; image: ?image ]
}
```

---

## Scenario 3: Server + Browser Frontend

Server handles all business logic. Browser is a thin client using HTTP transport.

```yaml
app:
  name: conduit-web
  version: 0.1.0
  uri: urn:conduit-web

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
  User:
    spec: ./specs/user.concept
    implementations:
      - language: typescript
        path: ./server/concepts/user
        runtime: server
        storage: postgres
        queryMode: graphql

  Password:
    spec: ./specs/password.concept
    implementations:
      - language: typescript
        path: ./server/concepts/password
        runtime: server
        storage: postgres
        queryMode: graphql

  JWT:
    spec: ./specs/jwt.concept
    implementations:
      - language: typescript
        path: ./server/concepts/jwt
        runtime: server
        storage: memory
        queryMode: lite

  Article:
    spec: ./specs/article.concept
    implementations:
      - language: typescript
        path: ./server/concepts/article
        runtime: server
        storage: postgres
        queryMode: graphql

syncs:
  - path: ./syncs/registration.sync
    engine: server
  - path: ./syncs/login.sync
    engine: server
  - path: ./syncs/articles.sync
    engine: server
```

**Key decisions:**
- Browser has `engine: false` — no local sync evaluation
- All concepts live on the server (browser can't do crypto, database, etc.)
- Browser communicates via `transport: http`
- All syncs run on the server engine
- No `[eventual]` or `[local]` syncs needed — server handles everything

---

## Scenario 4: Microservices (Multiple Node Runtimes)

Split concepts across multiple server processes for scaling.

```yaml
app:
  name: conduit-micro
  version: 0.1.0
  uri: urn:conduit-micro

runtimes:
  gateway:
    type: node
    engine: true
    transport: in-process

  auth-service:
    type: node
    engine: false
    transport: http

  content-service:
    type: node
    engine: false
    transport: http

concepts:
  User:
    spec: ./specs/user.concept
    implementations:
      - language: typescript
        path: ./services/auth/user
        runtime: auth-service
        storage: postgres
        queryMode: graphql

  Password:
    spec: ./specs/password.concept
    implementations:
      - language: typescript
        path: ./services/auth/password
        runtime: auth-service
        storage: postgres
        queryMode: graphql

  JWT:
    spec: ./specs/jwt.concept
    implementations:
      - language: typescript
        path: ./services/auth/jwt
        runtime: auth-service
        storage: memory
        queryMode: lite

  Article:
    spec: ./specs/article.concept
    implementations:
      - language: typescript
        path: ./services/content/article
        runtime: content-service
        storage: postgres
        queryMode: graphql

  Comment:
    spec: ./specs/comment.concept
    implementations:
      - language: typescript
        path: ./services/content/comment
        runtime: content-service
        storage: postgres
        queryMode: graphql

syncs:
  - path: ./syncs/registration.sync
    engine: gateway
  - path: ./syncs/login.sync
    engine: gateway
  - path: ./syncs/articles.sync
    engine: gateway
  - path: ./syncs/comments.sync
    engine: gateway

engine:
  telemetry:
    enabled: true
    exporter: otlp
    otlpEndpoint: http://jaeger:4317
```

**Key decisions:**
- Gateway runtime is the single engine — evaluates all syncs
- Auth and content services run concepts but not engines
- `transport: http` for cross-process communication
- Gateway makes HTTP calls to auth-service and content-service
- All syncs are eager — services must be reachable
- Telemetry exported to Jaeger for distributed tracing

---

## Scenario 5: Development Setup

Full hot reload, verbose telemetry, memory storage.

```yaml
app:
  name: conduit-dev
  version: 0.0.0-dev
  uri: urn:conduit-dev

runtimes:
  dev:
    type: node
    engine: true
    transport: in-process

concepts:
  User:
    spec: ./specs/user.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/user.handler.ts
        runtime: dev
        storage: memory
        queryMode: lite

  Password:
    spec: ./specs/password.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/password.handler.ts
        runtime: dev
        storage: memory
        queryMode: lite

  JWT:
    spec: ./specs/jwt.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/jwt.handler.ts
        runtime: dev
        storage: memory
        queryMode: lite

  Article:
    spec: ./specs/article.concept
    implementations:
      - language: typescript
        path: ./handlers/ts/app/article.handler.ts
        runtime: dev
        storage: memory
        queryMode: lite

syncs:
  - path: ./syncs/app/registration.sync
    engine: dev
  - path: ./syncs/app/login.sync
    engine: dev
  - path: ./syncs/app/articles.sync
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

**Key decisions:**
- Single `dev` runtime with everything in-process
- `storage: memory` — fast, no persistence needed during dev
- `queryMode: lite` — simpler, lower overhead for dev
- `hotReload.enabled: true` — file watchers for live development
- `telemetry.exporter: stdout` — see traces in the terminal
- `liteQueryWarnThreshold: 100` — catch performance issues early
- Version `0.0.0-dev` — signals non-production

---

## Scenario Comparison

| | Single Server | Server + iOS | Server + Browser | Microservices | Dev |
|---|---|---|---|---|---|
| Runtimes | 1 | 2 | 2 | 3 | 1 |
| Engines | 1 | 2 | 1 | 1 | 1 |
| Transport | in-process | in-process + ws | in-process + http | in-process + http | in-process |
| Eventual syncs | No | Yes | No | No | No |
| Local syncs | No | Yes | No | No | No |
| Storage | sqlite | postgres + coredata | postgres | postgres | memory |
| Query mode | graphql | graphql + lite | graphql | graphql | lite |
| Hot reload | No | No | No | No | Yes |
| Telemetry | Off | OTLP | Off | OTLP | stdout |
