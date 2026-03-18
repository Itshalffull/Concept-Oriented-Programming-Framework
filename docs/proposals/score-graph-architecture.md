# Score Graph Architecture Proposals

## Problem Statement

Score's purpose is to provide a queryable graph over a Clef application's
structure — concepts, actions, variants, syncs, handlers, widgets, themes,
tests, deployments, and their relationships. Currently:

1. **No unified graph.** ScoreQuery (GraphQL) and ScoreNavigator (interactive
   traversal) each reimplement relationship resolution with ad-hoc storage
   queries. They duplicate logic and diverge in what relationships they know
   about.

2. **ScoreIndex is flat.** It stores 10 denormalized collections (concepts,
   syncs, symbols, files, handlers, widgetImpls, themeImpls, deployments,
   suiteManifests, interfaces) but no relationships between them.

3. **Rich entity concepts are disconnected.** Score has 27 semantic entity
   concepts (ConceptEntity, ActionEntity, VariantEntity, HandlerEntity,
   TestEntity, etc.) with relationship-aware actions (e.g.,
   `ConceptEntity/participatingSyncs`, `SyncEntity/findByConcept`). But
   ScoreQuery and ScoreNavigator don't use them — they talk directly to
   ScoreIndex's flat storage.

4. **No runtime connection.** The MCP server seeds a static file-system
   snapshot into in-memory storage at boot. There's no connection to a live
   running app for RuntimeFlow, ErrorCorrelation, DeploymentHealth, etc.

5. **Derived concepts exist but aren't wired.** StaticSemanticModel,
   RuntimeTelemetry, StaticScore, RuntimeScore are declared but have no
   handlers and aren't used by the MCP server.

## Current Architecture

```
                    MCP Server (stdio)
                    ├── score_query  → ScoreQuery handler  → sharedStorage (flat)
                    ├── score_show   → ScoreNavigator handler → sharedStorage (flat)
                    ├── score_api_*  → ScoreApi handler → sharedStorage (flat)
                    └── seed at boot → seedScoreIndex() → regex parsing → sharedStorage

                    Entity concepts (ConceptEntity, SyncEntity, etc.)
                    → declared in specs but NOT instantiated by MCP server
                    → NOT connected to ScoreIndex or ScoreQuery

                    Runtime concepts (RuntimeFlow, ErrorCorrelation, DeploymentHealth)
                    → declared in specs but NO runtime data source
```

---

## Proposal A: Entity Dispatch (Minimal, Pragmatic)

**Core idea:** ScoreQuery and ScoreNavigator stop reimplementing graph logic.
Instead, they dispatch to the entity concepts' existing actions for
relationship resolution.

### Architecture

```
    MCP Server
    ├── score_query  → ScoreQuery handler
    │                   ├── flat field access → ScoreIndex storage
    │                   └── nested/relationship fields → dispatch to entity handler
    │                       e.g., concepts { syncs { ... } }
    │                       → ConceptEntity/participatingSyncs(entity)
    │
    ├── score_show   → ScoreNavigator handler
    │                   └── findRelated() → dispatch to entity handler
    │                       e.g., show concept User
    │                       → ConceptEntity/participatingSyncs(entity)
    │                       → HandlerEntity/findByConcept("User")
    │
    └── Entity handlers loaded at boot alongside ScoreIndex
        ConceptEntity, ActionEntity, SyncEntity, HandlerEntity, etc.
        Each gets shared storage
```

### Changes

1. MCP server instantiates entity concept handlers alongside ScoreIndex
2. `seedScoreIndex()` also seeds entity concepts (or entity concepts read
   from the same storage ScoreIndex writes to)
3. ScoreQuery's `resolveField()` detects relationship fields and dispatches
   to the appropriate entity handler action
4. ScoreNavigator's `findRelated()` dispatches to entity handler actions
   instead of doing ad-hoc storage scans
5. Both handlers share a registry of entity handlers

### Pros
- Minimal change — keeps existing handler structure
- Entity concepts' relationship logic becomes the single source of truth
- No new concepts needed
- Incremental — can migrate one relationship at a time

### Cons
- Entity concept handlers don't exist yet (only specs do)
- Entity concepts store state redundant with ScoreIndex
- No formalized graph model — the "graph" is implicit in the dispatch pattern
- Runtime score still disconnected

---

## Proposal B: ScoreGraph as Concept (Graph as First-Class State)

**Core idea:** Create a `ScoreGraph` concept that explicitly maintains a graph
(nodes + typed edges) derived from entity registrations. ScoreQuery and
ScoreNavigator query the graph directly.

### Architecture

```
    MCP Server
    ├── score_query  → ScoreQuery handler → ScoreGraph storage
    │                   GraphQL resolves over graph edges directly
    │
    ├── score_show   → ScoreNavigator handler → ScoreGraph storage
    │                   Navigation follows graph edges directly
    │
    └── ScoreGraph handler
        ├── state: nodes (id, kind, data), edges (source, target, relation)
        ├── addNode / addEdge / removeByFile — called by seedScoreIndex
        ├── neighbors(nodeId, relation?) — used by ScoreQuery and ScoreNavigator
        ├── traverse(from, relation, depth) — multi-hop traversal
        └── query(pattern) — subgraph pattern matching

    Syncs wire entity registrations to graph mutations:
        ConceptEntity/register → ScoreGraph/addNode(kind: concept)
        SyncEntity/register    → ScoreGraph/addNode(kind: sync) + addEdge(concept→sync)
```

### Changes

1. New `ScoreGraph` concept with nodes/edges state
2. New handler implementing graph operations
3. Syncs from entity registration → graph mutation
4. ScoreQuery resolves nested fields by calling `ScoreGraph/neighbors`
5. ScoreNavigator's `findRelated` calls `ScoreGraph/neighbors`
6. `seedScoreIndex()` also populates graph edges

### Pros
- Explicit, queryable graph model — edges are first-class data
- Single source of truth for all relationships
- Can support multi-hop traversal, path finding, subgraph queries
- Graph operations are testable with invariants
- Natural fit for the repertoire `Graph` concept pattern

### Cons
- New concept with significant state — nodes + edges for entire codebase
- Redundant with entity concepts that already encode relationships
- Edge maintenance burden — must keep edges in sync with entity state
- Doesn't solve the runtime connection problem

---

## Proposal C: Kernel Bridge (Full Architecture)

**Core idea:** The MCP server connects to a live Clef kernel instance instead
of maintaining its own isolated storage. The kernel boots all Score concepts
(entities, derived concepts, syncs) and the MCP server is just one interface
into it — alongside REST, CLI, etc.

### Architecture

```
    Live Clef Kernel
    ├── Concepts: ConceptEntity, ActionEntity, SyncEntity, HandlerEntity,
    │             WidgetEntity, ThemeEntity, TestEntity, RuntimeFlow,
    │             ErrorCorrelation, DeploymentHealth, ...
    ├── Derived:  StaticSemanticModel, RuntimeTelemetry, StaticScore, RuntimeScore
    ├── Syncs:    spec-semantic, sync-semantic, flow-correlation, error-correlation, ...
    ├── ScoreIndex (materialized view, kept in sync by syncs)
    │
    └── Interfaces:
        ├── MCP Server (stdio) ─── ScoreQuery, ScoreNavigator, ScoreApi tools
        ├── REST API ─── /api/score/concepts, /api/score/syncs, ...
        ├── CLI ─── clef score query "...", clef score show concept User
        └── Dev Server ─── file watcher → re-index on change

    Runtime App (separate process or same kernel)
    ├── Dispatches actions → ActionLog
    ├── ActionLog → syncs → RuntimeFlow/correlate, ErrorCorrelation/record
    └── DeploymentHealth/record periodically

    MCP Server connects to kernel via:
        Option 1: In-process (kernel boots in MCP server process)
        Option 2: Transport adapter (HTTP/WebSocket to running kernel)
        Option 3: Shared storage (both read/write same DB)
```

### Changes

1. MCP server uses `kernel-boot` to start a real kernel with all Score concepts
2. `seedScoreIndex()` replaced by kernel boot + file watcher syncs
3. Entity concepts get real handlers (or functional handlers via StorageProgram)
4. Derived concepts (StaticScore, RuntimeScore) are activated
5. Runtime connection via transport adapter to the live app's kernel
6. ScoreQuery/ScoreNavigator dispatch through the kernel's action system
   instead of directly calling handler methods

### Runtime Connection Options

**Option 1: Shared storage backend**
- Both MCP server kernel and app kernel use the same PostgreSQL/SQLite
- RuntimeFlow, ErrorCorrelation write to shared tables
- Score reads from them
- Simple but requires shared infra

**Option 2: Transport bridge**
- MCP kernel connects to app kernel via HTTP/WebSocket transport adapter
- Score queries dispatch to app kernel for runtime data
- Clean separation but adds network hop

**Option 3: Event stream**
- App kernel publishes action log events to a ChangeStream
- MCP kernel subscribes and ingests into local RuntimeFlow/ErrorCorrelation
- Eventually consistent but decoupled

### Pros
- Full architecture — all Score concepts are live, including runtime
- Single kernel model — same as how the app itself runs
- Derived concepts work naturally through sync wiring
- File watching enables live re-indexing (no manual reindex)
- MCP server is just another interface, not a special snowflake
- Enables future: multiple MCP sessions share one kernel

### Cons
- Significant infrastructure change — MCP server becomes a kernel host
- Entity concept handlers need to be implemented (27+ handlers)
- Runtime connection requires a running app to connect to
- Complexity: kernel boot, sync engine, storage adapters all in MCP process
- May be slow to start (kernel boot + full index vs current quick seed)

---

## Proposal D: Layered (Incremental Path to C)

**Core idea:** Implement in layers, each independently valuable, building
toward the full kernel bridge.

### Layer 1: Shared Graph Resolution (Now)

Extract the ad-hoc relationship logic from ScoreQuery and ScoreNavigator
into a shared module. Not a concept — a stateless utility that both handlers
import. This fixes the immediate duplication bug.

- **What:** `score-graph.ts` utility with `findRelated()`, `derivedField()`,
  `lookupItem()` — single source of truth for relationship computation
- **Where:** `handlers/ts/framework/score-graph.ts`
- **Impact:** Both handlers become single-purpose (query parsing / navigation
  session), graph logic lives in one place
- **Runtime:** No change — still static file system snapshot

### Layer 2: Entity Handler Dispatch (Next)

Implement handlers for the key entity concepts and have the shared graph
module dispatch to them instead of doing raw storage scans.

- **What:** Implement `ConceptEntity`, `SyncEntity`, `HandlerEntity` handlers;
  update `seedScoreIndex()` to populate their storage; graph module calls
  entity actions for relationship queries
- **Where:** `handlers/ts/score/concept-entity.handler.ts`, etc.
- **Impact:** Entity concepts become the source of truth for their own
  relationships; ScoreIndex becomes a materialized cache
- **Runtime:** No change yet

### Layer 3: Kernel Boot in MCP (Later)

Replace the ad-hoc MCP server boot with a real kernel boot that registers
all Score concepts and compiles syncs.

- **What:** Use `kernel-boot` to start a kernel with Score concepts;
  replace `seedScoreIndex()` with file watcher → SpecParser/parse syncs;
  derived concepts activate naturally
- **Where:** Refactor `bootMcpServer()` in `mcp-server.handler.ts`
- **Impact:** Full concept lifecycle; syncs fire on file changes; derived
  concepts (StaticSemanticModel, etc.) work
- **Runtime:** Still static, but incremental re-indexing via file watcher

### Layer 4: Runtime Bridge (Future)

Connect MCP kernel to a live app kernel for runtime telemetry.

- **What:** Transport adapter from MCP kernel to app kernel; subscribe to
  action log events; ingest into RuntimeFlow, ErrorCorrelation,
  DeploymentHealth
- **Where:** New transport adapter + configuration
- **Impact:** Full Score — static + runtime, all queryable through
  ScoreQuery, ScoreNavigator, ScoreApi
- **Runtime:** Live connection to running app

### Pros
- Each layer is independently shippable and valuable
- Layer 1 fixes the immediate bug with minimal risk
- Clear migration path — no big-bang rewrite
- Can stop at any layer if the value/cost ratio changes

### Cons
- Layer 1's utility module isn't "architecturally pure" (it's not a concept)
- Temporary scaffolding that gets replaced in later layers
- Multiple migration steps means multiple rounds of changes

---

## Recommendation

**Start with Proposal D (Layered), Layer 1 now.**

Layer 1 (shared graph resolution) fixes the immediate bug — `score_query`
returns null for relationship fields. It's small, testable, and doesn't
require new concepts or infrastructure. The derived concept question becomes
relevant at Layer 3 when the kernel boots and derived concepts activate
naturally through sync wiring.

The key insight from applying Jackson's tests: the graph resolution is a
**derived view** (stateless computation over existing state), not a concept
(independent state + actions). It becomes a concept-level concern only when
the kernel is involved (Layer 3), at which point the existing derived concept
declarations (StaticSemanticModel, RuntimeScore) are the right abstraction.

### What About the Derived Concept?

The `StaticSemanticModel` and `RuntimeScore` derived concepts already exist
and declare exactly the composition we want. They don't need handlers — they
need the kernel's sync engine to activate them. That's Layer 3. Until then,
the shared utility module serves the same purpose at the handler level.

### What About Runtime?

Runtime connection (Layer 4) requires:
1. A running app kernel to connect to
2. A transport adapter bridging MCP kernel ↔ app kernel
3. Event ingestion from action logs into RuntimeFlow/ErrorCorrelation

This is orthogonal to the graph architecture — it's a transport/deployment
concern. The Score entity concepts and derived concepts are already designed
for it (RuntimeTelemetry composes RuntimeFlow, ErrorCorrelation, etc.). The
architecture just needs the plumbing.
