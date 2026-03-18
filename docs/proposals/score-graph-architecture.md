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

## Score Layer Inventory: What's Real vs. Stub vs. Spec-Only

Score declares **6 suites** with **5 conceptual layers**. Here's what actually
works end-to-end in the MCP server today vs. what's declared but disconnected.

### Layer 1: Parse (score-parse suite)

Declares: `TreeSitterConceptSpec`, `TreeSitterSyncSpec`, `TreeSitterWidgetSpec`,
`TreeSitterThemeSpec` — grammar providers extending the `code-parse` suite's
`SyntaxTree`, `LanguageGrammar`, `FileArtifact`, `DefinitionUnit`, `ContentDigest`.

**Status: Bypassed.** The MCP server's `seedScoreIndex()` uses regex extractors
(`extractConceptName`, `extractActions`, `extractSyncs`, etc.) instead of the
tree-sitter parse pipeline. The tree-sitter WASM grammars are copied at install
time but never used for Score indexing. ScoreApi's `matchPattern` action returns
an empty stub (`matches: []`). `getFileContent` returns `[File: path]` — no
actual content or AST.

**What's missing:** Real tree-sitter parsing → SyntaxTree → DefinitionUnit →
ContentDigest pipeline. This would give Score structured ASTs instead of
regex-extracted field names.

### Layer 2: Symbol (score-symbol suite)

Declares: `ConceptSpecSymbolExtractor`, `SyncSpecSymbolExtractor`, etc. —
extractors feeding the `code-symbol` suite's `Symbol`, `SymbolOccurrence`,
`ScopeGraph`, `SymbolRelationship`.

**Status: Partially real.** `seedScoreIndex()` calls `extractSymbols()` which
does regex-based symbol extraction (function names, class names, exports) and
writes to the `symbols` collection. `SymbolIndex` handler exists but only has
an `initialize` action (stub). ScoreApi's `findSymbol` and `getDefinitions`
work against the flat symbol list. But:

- `getReferences` — returns the definition + other occurrences of same name,
  but no actual cross-file reference tracking (no SymbolOccurrence concept)
- `getScope` — finds nearest symbol by line number, no real scope graph
- `getRelationships` — **pure stub**, returns `relationships: []`

**What's missing:** Real `ScopeGraph` construction, `SymbolOccurrence` tracking
(definition vs reference vs import), `SymbolRelationship` edges (implements,
extends, overrides, generates, tests). These are the backbone for go-to-definition,
find-references, and rename refactoring.

### Layer 3: Semantic (semantic suite — the largest)

Declares 16 entity concepts in 3 groups:

**Clef entities** (6): `ConceptEntity`, `ActionEntity`, `VariantEntity`,
`StateField`, `SyncEntity`, `DerivedEntity`

**Surface entities** (6): `WidgetEntity`, `AnatomyPartEntity`,
`WidgetStateEntity`, `WidgetPropEntity`, `ThemeEntity`, `InteractorEntity`

**Runtime entities** (4): `RuntimeFlow`, `RuntimeCoverage`,
`PerformanceProfile`, `ErrorCorrelation`

Plus 8 required syncs, 9 recommended syncs, and 22 integration syncs.

**Status: Mixed.**

| Entity | Handler exists? | Seeded by MCP? | Used by ScoreApi? |
|--------|----------------|----------------|-------------------|
| ConceptEntity | No handler file | seedScoreIndex writes to `concepts` collection | ScoreApi reads `concepts` directly |
| ActionEntity | No | No (actions are string arrays on concept entries) | getAction returns stub with empty params/variants |
| VariantEntity | No | No | Not exposed |
| StateField | No | No (state fields are string arrays on concept entries) | getConcept returns stub with `type: 'unknown'` |
| SyncEntity | No | seedScoreIndex writes to `syncs` collection | ScoreApi reads `syncs` directly |
| DerivedEntity | No | No | Not exposed |
| WidgetEntity | No | No (seedScoreIndex doesn't parse .widget files) | Not exposed |
| AnatomyPartEntity | No | No | Not exposed |
| WidgetStateEntity | No | No | Not exposed |
| WidgetPropEntity | No | No | Not exposed |
| ThemeEntity | No | No (seedScoreIndex doesn't parse .theme files) | Not exposed |
| InteractorEntity | No | No | Not exposed |
| RuntimeFlow | No | No (no runtime connection) | Not exposed |
| RuntimeCoverage | No | No | Not exposed |
| PerformanceProfile | No | No | Not exposed |
| ErrorCorrelation | No | No | Not exposed |

**However**, these entity handlers DO exist in `handlers/ts/score/`:
- `HandlerEntity` — register, get, getByFile, findByConcept (real implementation)
- `TestEntity` — register, get, findByConcept (real implementation)
- `DeploymentEntity` — register, get (real implementation)
- `SuiteManifestEntity` — register, get (real implementation)
- `InterfaceEntity` — register, get (real implementation)
- `InfrastructureEntity` — register, get (real implementation)
- `EnvironmentEntity` — register, get (real implementation)
- `DeploymentHealth` — record, get (real implementation)
- `GenerationProvenance` — record, get (real implementation)
- `WidgetImplementationEntity` — register, get (real implementation)
- `ThemeImplementationEntity` — register, get (real implementation)

**Key gap:** The 6 core Clef entities (Concept, Action, Variant, StateField,
Sync, Derived) and 6 Surface entities don't have handler files. The MCP server
bypasses them entirely — `seedScoreIndex()` writes flat denormalized records
and `ScoreApi` reads those directly. The entity handlers that DO exist
(HandlerEntity, TestEntity, etc.) are never called by the MCP server either —
they're orphaned.

### Layer 4: Analysis (score-analysis suite)

Declares: `ConceptDependenceProvider`, `SyncDependenceProvider`, etc. —
extending `code-analysis`'s `DependenceGraph`, `DataFlowPath`, `ProgramSlice`,
`AnalysisRule`. Plus graph analysis providers for centrality and community
detection.

**Status: Pure stubs.** ScoreApi actions:
- `getDependencies` — returns `{ directDeps: [], transitiveDeps: [] }`
- `getDependents` — returns `{ directDeps: [], transitiveDeps: [] }`
- `getImpact` — returns `{ directImpact: [], transitiveImpact: [] }`
- `getDataFlow` — returns `{ paths: [] }`

No dependence graph is built. No data flow tracking. No program slicing.
The `getFlow` action does work — it walks syncs BFS-style to trace action
chains — but it's ad-hoc string matching, not a real graph traversal.

### Layer 5: Discovery (score-discovery suite)

Declares: Re-exports `code-discovery`'s `SemanticEmbedding`.

**Status: Stub.** ScoreApi's `search` does substring matching over concept
names, sync names, and symbol names. No embeddings, no vector search, no
semantic similarity. The `explain` action works reasonably well — it looks
up concepts, syncs, and symbols and generates natural language summaries.

### Layer 6: Auto (score-auto suite)

Declares: `ScoreApi`, `ScoreIndex` + 4 syncs for auto-registration and
incremental indexing.

**Status: Partially real.** ScoreApi and ScoreIndex handlers exist and work.
But the syncs (auto-register on boot, index on parse, score on generate,
score on deploy) are spec-only — there's no sync engine running in the MCP
server to fire them. Instead, `seedScoreIndex()` does a one-shot walk.

### Summary: The Gap Map

```
                    REAL                          STUB                         SPEC-ONLY
                    ────                          ────                         ─────────
Parse:              regex extractors              matchPattern                 TreeSitter grammars
                                                  getFileContent               SyntaxTree/DefinitionUnit

Symbol:             flat symbol list              getReferences (no xref)      ScopeGraph
                    findSymbol                    getScope (nearest line)      SymbolOccurrence
                    getDefinitions                getRelationships (empty)     SymbolRelationship

Semantic:           concepts/syncs/handlers       getAction (no params/vars)   ConceptEntity handler
                    in flat collections           getConcept (type: unknown)   ActionEntity handler
                    HandlerEntity handler         Surface entities             VariantEntity handler
                    TestEntity handler            Runtime entities             StateField handler
                    DeploymentEntity handler                                   SyncEntity handler
                    + 8 more entity handlers                                   DerivedEntity handler
                    (all orphaned from MCP)                                    + 6 Surface entity handlers

Analysis:           getFlow (ad-hoc BFS)          getDependencies (empty)      DependenceGraph
                                                  getDependents (empty)        DataFlowPath
                                                  getImpact (empty)            ProgramSlice
                                                  getDataFlow (empty)          AnalysisRule

Discovery:          search (substring match)                                   SemanticEmbedding
                    explain (works well)                                       Vector search

Auto:               ScoreApi handler                                           Auto-register sync
                    ScoreIndex handler                                         Index-on-parse sync
                    seedScoreIndex (one-shot)                                  Score-on-generate sync
```

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

---

## Appendix: Per-Layer Connection Strategy

Each Score layer has different data sources and different runtime needs.
The right connection strategy depends on the layer.

### Parse Layer → File System + Tree-Sitter

**Data source:** Files on disk.
**Connection:** File watcher (chokidar/fs.watch) fires on change →
`SyntaxTree/parse` → `DefinitionUnit/extract` → ScoreIndex upsert.

**Runtime aspect:** The parse layer is purely static — no live app needed.
A file watcher in the MCP server process is sufficient. Tree-sitter WASM
grammars already ship with the project.

**Current gap:** `seedScoreIndex()` does one-shot regex extraction.
Replace with: file watcher → tree-sitter parse → entity registration.

### Symbol Layer → Parse Layer + Cross-File Resolution

**Data source:** Parsed ASTs from the parse layer.
**Connection:** Syncs from `SyntaxTree/parse` completion →
`SymbolExtractor/extract` → `Symbol/register`, `SymbolOccurrence/record`,
`ScopeGraph/build`.

**Runtime aspect:** Static — derives from parsed files. Cross-file
resolution (imports, re-exports) requires the scope graph to walk
import edges.

**Current gap:** Regex extracts function/class names. No scope graph,
no cross-file resolution, no reference tracking.

### Semantic Layer → Parse + Symbol + File System (static entities) / App Runtime (runtime entities)

**Static entities (Concept, Action, Variant, StateField, Sync, Derived,
Widget, Theme):**
- Data source: Parsed spec files.
- Connection: Syncs from `SpecParser/parse` → entity registration.
- Purely static — no live app needed.

**Implementation entities (Handler, WidgetImpl, ThemeImpl, Test):**
- Data source: Parsed handler/generated files.
- Connection: File watcher + AST parsing.
- Partially static, partially build-time (generation provenance).

**Runtime entities (RuntimeFlow, RuntimeCoverage, PerformanceProfile,
ErrorCorrelation):**
- Data source: **Live running app** — ActionLog events, SyncEngine
  firings, Telemetry flushes.
- Connection options:
  1. **ChangeStream subscription** — app publishes ActionLog events,
     Score kernel subscribes and ingests.
  2. **Shared storage** — app writes ActionLog to shared DB, Score reads.
  3. **Transport bridge** — Score queries app kernel on demand.
- Option 1 (ChangeStream) is best: decoupled, resumable, supports
  offline/replay. The `ChangeStream` concept already exists in the
  repertoire.

### Analysis Layer → Semantic + Symbol Layers

**Data source:** Computed from semantic entities and symbol graph.
**Connection:** Syncs from entity registration → DependenceGraph/addEdge,
DataFlowPath/trace. Analysis is materialized incrementally.

**Runtime aspect:** Mostly static analysis over the codebase structure.
Runtime data flow tracing (actual paths taken) comes from RuntimeFlow
correlation in the semantic layer.

### Discovery Layer → All Other Layers

**Data source:** Embeddings computed from DefinitionUnits.
**Connection:** Sync from `DefinitionUnit/extract` completion →
`SemanticEmbedding/compute`. Cached by content digest.

**Runtime aspect:** Static. Embeddings are recomputed only when code changes.

### Runtime Bridge Architecture (for Layer 4)

```
    App Kernel (running app process)
    ├── ActionLog ──┐
    ├── SyncEngine ──┤──→ ChangeStream/publish
    ├── Telemetry ──┘
    │
    ├── ChangeStream (ordered, resumable event stream)
    │   └── Events: action-dispatched, sync-fired, action-completed,
    │               error-occurred, telemetry-flushed
    │
    └── Transport: WebSocket / SSE / shared DB

    Score Kernel (MCP server process)
    ├── ChangeStream/subscribe (resumes from last acknowledged offset)
    │   └── Ingestion syncs:
    │       ActionLog event → RuntimeFlow/correlate
    │       SyncEngine event → RuntimeCoverage/record
    │       Error event → ErrorCorrelation/record
    │       Telemetry event → PerformanceProfile/aggregate
    │
    ├── DeploymentHealth/record (periodic probe or push from app)
    │
    └── All runtime entities now queryable through ScoreApi
        "show me failing syncs" → ErrorCorrelation + SyncEntity
        "what's slow?" → PerformanceProfile + ActionEntity
        "what code paths are untested?" → RuntimeCoverage + VariantEntity
```

**Key insight:** The `ChangeStream` concept (already in repertoire) is the
natural transport. It provides ordered, resumable, exactly-once delivery
with consumer offset tracking. The app kernel publishes; the Score kernel
subscribes. If the MCP server restarts, it resumes from its last acknowledged
offset — no data loss, no duplicate processing.

This means the runtime bridge is not a custom integration — it's a standard
Clef sync pattern: `ChangeStream/receive → RuntimeFlow/correlate`. The only
new thing is the transport adapter connecting the two kernels.
