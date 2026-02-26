# Clef Comprehensive Reference

## 1. Project Overview

Clef builds software as compositions of **fully independent, spec-driven services** called **concepts**, coordinated by declarative **synchronizations**. Inspired by Daniel Jackson's *The Essence of Software*, where software is modeled as a collection of independent concepts (each with purpose, state, actions, and operational principles) that compose through syncs.

**Core Principles:**
1. **Spec-first** -- Every concept begins as a `.concept` spec. Code is generated from specs, never the reverse.
2. **Total independence** -- No concept references state, types, or actions of another. All inter-concept coordination is in syncs.
3. **Sovereign storage** -- Each concept owns its data. No shared databases.
4. **Uniform protocol** -- Every concept exposes: accept action invocations, return completions, answer queries against state.
5. **Self-hosting** -- The framework itself (compiler, sync engine, generators) is implemented as concepts.

**System flow:** `.concept` specs compile to GraphQL schemas, JSON schemas, and language stubs. A sync engine matches completions against sync rules and emits invocations to other concepts. Concepts can run on servers, phones, browsers, embedded devices, or smart contracts.

---

## 2. Concept Design Rules

**The concept test** (Section 16.14): Does this thing have (1) independent state, (2) meaningful actions with domain-specific variants, and (3) operational principles that compose via syncs? If yes, it is a concept. Otherwise it is pre-conceptual infrastructure (storage adapters, transport adapters, SDKs, CLI).

**Independence rule:** A concept must never reference another concept's state, types, or actions. Type parameters (`[U]`, `[E]`) are opaque identifiers serialized as strings on the wire.

**Return variants replace exceptions:** Every action explicitly enumerates outcomes (`ok`, `error`, `notfound`, `invalid`, etc.). Variant tags are freeform. Syncs pattern-match on specific variants.

**Action bodies are informal prose:** They describe behavior in natural language. The formal contract is the signature plus invariants.

**Capabilities are deployment metadata:** `requires crypto`, `requires persistent-storage` -- used for deployment validation, not enforced in specs.

**`@version(N)`** increments when state schema changes require migration. Non-breaking changes (new actions/variants) do not bump.

**`@gate`** marks async gate concepts whose actions may complete after an arbitrarily long wait. Metadata for tooling only; the engine ignores it.

**Engine/Concept boundary (Section 16.11):** The engine only owns delivery semantics (`[eager]`, `[eventual]`, `[local]`, `[idempotent]`). Everything else (auth, finality, rate limiting, approval workflows) is a concept wired by syncs. If a behavior changes *what happens in a sync chain* (not how syncs evaluate), it belongs in a concept.

---

## 3. Concept Spec Format (`.concept` files)

```
@version(1)
@gate                              // optional annotations
concept Name [TypeParam1, TypeParam2] {

  purpose {
    Free-form prose describing the concept's reason to exist.
  }

  state {
    items: set T                   // set of references
    name: T -> String              // relation mapping
    config: T -> {                 // inline record type
      key: String,
      value: Int
    }
    group_name {                   // explicit grouping
      field1: T -> String
      field2: T -> Bytes
    }
    optional_field: T -> option String
    ordered: T -> list String
  }

  capabilities {
    requires persistent-storage
    requires crypto
  }

  actions {
    action doSomething(param1: T, param2: String) {
      -> ok(result: T) {
        Prose description of success behavior.
      }
      -> error(message: String) {
        Prose description of failure behavior.
      }
      -> notfound(message: String) {
        Prose description of not-found case.
      }
    }
  }

  invariant {
    after doSomething(param1: x, param2: "value") -> ok(result: x)
    then doSomething(param1: x, param2: "value") -> ok(result: x)
    and  doSomething(param1: y, param2: "other") -> error(message: m)
  }
}
```

**Primitive types:** `String`, `Int`, `Float`, `Bool`, `Bytes`, `DateTime`, `ID`
**Collection types:** `set T`, `list T`, `option T`, `A -> B` (mapping)
**State grouping:** Components sharing the same domain type merge into one relation by default. Explicit `group { }` blocks override this.

---

## 4. Sync Format (`.sync` files)

```
sync SyncName [eager]
when {
  Concept/action: [ field: ?variable; field2: "literal" ]
    => [ outField: ?outVar ]
  OtherConcept/action: [ field: ?variable ]
    => [ result: ?r ]
}
where {
  bind(uuid() as ?id)
  Concept: { ?item field: ?variable }
  filter(?amount > 10)
}
then {
  TargetConcept/action: [
    field1: ?variable;
    field2: ?outVar;
    field3: "literal" ]
}
```

**Annotations:** `[eager]` (default, synchronous), `[eventual]` (deferred/retry), `[local]` (same runtime), `[idempotent]` (safe to retry).

**when clause:** Pattern-matches on action completions. Variables (`?name`) bind values. Literals match exactly. `_` is wildcard. Multiple patterns in `when` act as a join -- all must match in the same flow.

**where clause:** Optional. `bind(expr as ?var)` introduces new variables. `Concept: { ?var field: ?val }` queries concept state. `filter(expr)` filters bindings.

**then clause:** Invokes actions on target concepts using bound variables.

**Scoping:** Variables are scoped to the entire sync. Multiple where-query results cause the then-clause to execute once per binding.

---

## 5. Complete Concept Inventory

### 5.1 Application Concepts (`specs/app/`) -- RealWorld Benchmark

| Concept | Type Param | Purpose | Key Actions |
|---------|-----------|---------|-------------|
| User | U | User identity and registration | register |
| Password | U | Salted credential hashing and validation | set, check, validate |
| JWT | T | Token generation and verification | generate, verify |
| Profile | U | User bio and image metadata | update, get |
| Article | A | Content creation and management | create, update, delete, get |
| Follow | U | Social follow relationships | follow, unfollow, isFollowing |
| Favorite | F | Content bookmarking | favorite, unfavorite, count |
| Echo | M | Simple request-response (test concept) | send |

*Note: Tag and Comment were moved to their respective suites (Classification and Content).*

### 5.2 Framework Concepts (`specs/framework/`)

| Concept | Purpose |
|---------|---------|
| SpecParser | Parse `.concept` files into ConceptAST |
| SyncParser | Parse `.sync` files into SyncAST |
| SyncCompiler | Compile SyncAST into executable CompiledSync |
| SyncEngine | Match completions, evaluate where-clauses, emit invocations |
| SchemaGen | Transform ConceptAST into language-neutral ConceptManifest |
| TypeScriptGen | Generate TypeScript handler skeletons from manifest |
| RustGen | Generate Rust handler skeletons from manifest |
| SwiftGen | Generate Swift handler skeletons from manifest |
| SolidityGen | Generate Solidity contract skeletons from manifest |
| Registry | Register and resolve concept URIs to transports |
| ActionLog | Append-only record of all invocations and completions |
| FlowTrace | Build debug trace trees from action log provenance |
| DeploymentValidator | Validate deployment manifests pre-deploy |
| DevServer | Hot-reloading development server |
| ProjectScaffold | Generate new Clef project structure |
| KitManager | Kit lifecycle management (install, update, dependency resolution) |
| *ScaffoldGen (x10) | Scaffold generators for concepts, syncs, suites, handlers, storage/transport adapters, deploy/interface manifests, Clef Surface components/themes |

*Note: Migration moved to Deploy Kit. Telemetry moved to Deploy Kit. CacheCompiler superseded by BuildCache in Generation Suite.*

### 5.3 Generation Suite (`kits/generation/`)

Shared generation infrastructure for all Clef generation families. Provides input tracking, pipeline topology, incremental build caching, content-addressed file emission, and unified run reporting.

| Concept | Purpose | Key Actions |
|---------|---------|-------------|
| Resource | Track input files with content hashing for change detection | upsert, remove, changed |
| KindSystem | Define IR/artifact kinds and dependency edges between generators | define, connect, dependents |
| BuildCache | Incremental build cache with input/output hash tracking | check, store, invalidateBySource, invalidateByKind |
| GenerationPlan | Orchestrate generation runs with step recording | begin, recordStep, complete |
| Emitter | Content-addressed file emission with formatting and orphan cleanup | write, format, clean |

Uses: Infrastructure Kit (PluginRegistry).

### 5.4 Deploy Kit (`kits/deploy/`)

Deployment orchestration with progressive delivery, migrations, health checks, and observability. Uses the coordination + provider pattern extensively for multi-cloud support.

| Concept | Purpose |
|---------|---------|
| DeployPlan | Compute, validate, execute deployment DAGs |
| Rollout | Progressive delivery (canary, blue-green, rolling) |
| Migration | Schema migration lifecycle (expand/migrate/contract) |
| Health | Health check verification |
| Env | Environment management (dev/staging/prod) |
| Telemetry | Deployment observability markers |
| Artifact | Immutable content-addressed build artifacts |
| **Coordination:** Runtime, Secret, IaC, GitOps, Builder, Toolchain | Route to pluggable providers |
| **Runtime providers (9):** | Lambda, ECS, CloudRun, GCF, Cloudflare, Vercel, K8s, DockerCompose, Local |
| **Secret providers (5):** | Vault, AWS SM, GCP SM, Env, Dotenv |
| **IaC providers (4):** | Pulumi, Terraform, CloudFormation, DockerCompose |
| **GitOps providers (2):** | ArgoCD, Flux |
| **Builder providers (4):** | TypeScript, Rust, Swift, Solidity |
| **Toolchain providers (4):** | TypeScript, Rust, Swift, Solidity |

### 5.5 Clef Bind (`kits/interface/`)

Multi-target interface generation. Generates REST APIs, GraphQL schemas, gRPC services, CLIs, MCP servers, SDKs, and spec documents from concept specs and an interface manifest.

| Concept | Purpose |
|---------|---------|
| Projection | Enrich concept specs with interface metadata (auth, pagination, rate limits) |
| Generator | Plan and orchestrate interface generation runs |
| ApiSurface | Compose projected concepts into a unified API surface |
| Middleware | Define cross-cutting concerns (auth, logging, CORS) per target |
| Grouping | Group concepts for API organization (REST resource groups, GraphQL namespaces) |
| ActionGuide | Define ordered action sequences for documentation and SDK generation |
| Annotation | Attach metadata to concepts/actions (deprecation, examples, descriptions) |
| EnrichmentRenderer | Register custom render handlers for target-specific output enrichment |
| **Coordination:** Target, Sdk, Spec | Route to target/SDK/spec providers |
| **Target providers (6):** | Rest, GraphQL, gRPC, CLI, MCP, ClaudeSkills |
| **Spec providers (2):** | OpenAPI, AsyncAPI |
| **SDK providers (6):** | TypeScript, Python, Go, Rust, Java, Swift |

Uses: Generation Suite (Emitter — shared file emission).

### 5.6 Scaffolding Kit (`kits/scaffolding/`)

Code generation scaffolding for all artifact types. Each scaffold generator creates starter files for a specific artifact category.

| Concept | Scaffolds |
|---------|-----------|
| ConceptScaffoldGen | `.concept` spec files |
| SyncScaffoldGen | `.sync` files |
| KitScaffoldGen | Kit directory with `suite.yaml` |
| HandlerScaffoldGen | TypeScript/Rust/Swift handler implementations |
| StorageAdapterScaffoldGen | Storage adapter implementations |
| TransportAdapterScaffoldGen | Transport adapter implementations |
| DeployScaffoldGen | Deployment manifests |
| InterfaceScaffoldGen | Interface manifests |
| CoifComponentScaffoldGen | Clef Surface component specs |
| CoifThemeScaffoldGen | Clef Surface theme definitions |

### 5.7 Framework Suite (`kits/framework/`)

Core framework generation. SchemaGen is the coordination concept; language generators are optional providers.

| Concept | Purpose |
|---------|---------|
| SchemaGen | Transform ConceptAST into language-neutral ConceptManifest (coordination) |
| TypeScriptGen | Generate TypeScript handler skeletons (provider) |
| RustGen | Generate Rust trait definitions and handler skeletons (provider) |
| SwiftGen | Generate Swift protocol definitions and handler skeletons (provider) |
| SolidityGen | Generate Solidity contract interfaces and Foundry tests (provider) |

### 5.8 Test Kit (`kits/test/`)

Cross-layer testing infrastructure for concept implementations.

| Concept | Purpose |
|---------|---------|
| Conformance | Verify concept implementations match their spec contracts |
| ContractTest | Cross-concept contract verification via sync chain testing |
| Snapshot | Golden-file snapshot testing for generated outputs |
| TestSelection | Intelligent test selection based on change impact |
| FlakyTest | Flaky test detection and quarantine |

### 5.9 Identity Kit (`kits/identity/`)

Authentication, authorization, and session management.

| Concept | Purpose |
|---------|---------|
| Authentication | Identity verification (login flows, MFA, OAuth) |
| Authorization | Permission evaluation (role-based, attribute-based) |
| AccessControl | Resource-level access policies |
| Session | Session lifecycle management |

### 5.10 Content Kit (`kits/content/`)

Content management with rich editing, versioning, and collaboration.

| Concept | Purpose |
|---------|---------|
| Canvas | Block-based rich content editing |
| Comment | Threaded discussion on content entities |
| DailyNote | Date-keyed journal entries |
| SyncedContent | Real-time collaborative content synchronization |
| Template | Reusable content templates with variable substitution |
| Version | Content version history tracking |

*Note: Version will be superseded by TemporalVersion (Versioning Kit). SyncedContent will be superseded by Replica + ConflictResolution (Collaboration Kit). See Section 6.5.*

### 5.11 Foundation Kit (`kits/foundation/`)

Core content models and type system.

| Concept | Purpose |
|---------|---------|
| ContentNode | Base file/content representation — every project file is a ContentNode |
| ContentParser | Parsing dispatch for structured content |
| ContentStorage | Raw file content storage backend |
| Intent | User intent capture for action routing |
| Outline | Hierarchical document structure |
| PageAsRecord | Structured content pages with field-value records |
| Property | Dynamic key-value property system with typed values |
| TypeSystem | Application-level type definitions and validation |

### 5.12 Infrastructure Kit (`kits/infrastructure/`)

Core application infrastructure.

| Concept | Purpose |
|---------|---------|
| Cache | Key-value caching with TTL and invalidation |
| ConfigSync | Configuration synchronization across environments |
| EventBus | Application-level pub/sub with priorities, dead-letter, and history |
| Pathauto | Automatic URL/path generation from content |
| PluginRegistry | Provider registration and resolution for coordination concepts |
| Validator | Write-time constraint enforcement with field-level errors |

### 5.13 Classification Kit (`kits/classification/`)

Content organization and categorization.

| Concept | Purpose |
|---------|---------|
| Namespace | Hierarchical namespace management |
| Schema | Structural schema definitions for metadata |
| Tag | Content categorization labels (tagging and folksonomy) |
| Taxonomy | Hierarchical vocabulary with parent-child relationships |

### 5.14 Automation Kit (`kits/automation/`)

Automated workflows and user-configurable rules.

| Concept | Purpose |
|---------|---------|
| AutomationRule | User-configurable event-condition-action rules |
| Control | UI controls for automation management |
| Queue | Queued action processing with priority and retry |
| Workflow | Multi-step workflow orchestration with state transitions |

### 5.15 Data Integration Kit (`kits/data-integration/`)

ETL, data quality, provenance, and transformation.

| Concept | Purpose |
|---------|---------|
| Capture | Change data capture from external sources |
| Connector | Integration with external systems and APIs |
| DataQuality | Pipeline-level data assessment with scoring and quarantine |
| DataSource | Treating directories and file sets as data sources |
| Enricher | Adding resolved types, cross-references, metadata |
| FieldMapping | Type parameter binding and field mapping resolution |
| ProgressiveSchema | Schema discovery as new data is parsed |
| Provenance | W3C PROV-style data lineage tracking |
| SyncPair | Bidirectional sync between external systems |
| Transform | Data reshaping and transformation pipelines |

*Note: Capture will be narrowed in scope (CDC adapter role) when ChangeStream ships. Provenance keeps its identity but defers content-region attribution to Attribution concept. See Section 6.5.*

### 5.16 Data Organization Kit (`kits/data-organization/`)

Graph and collection data structures.

| Concept | Purpose |
|---------|---------|
| Collection | Ordered/filtered content collections |
| Graph | Typed graph overlays with nodes, edges, and traversal |

### 5.17 Computation Kit (`kits/computation/`)

Expression evaluation and formula processing.

| Concept | Purpose |
|---------|---------|
| ExpressionLanguage | Custom expression language parsing and evaluation |
| Formula | Spreadsheet-style formula definitions and computation |
| Token | Tokenization for expression parsing |

### 5.18 Collaboration Kit (`kits/collaboration/`)

Group collaboration features.

| Concept | Purpose |
|---------|---------|
| Flag | Content flagging for review/moderation |
| Group | User group management and membership |

*Note: This suite will be significantly expanded by the new Collaboration Kit (Section 6.5) which adds CausalClock, Replica, ConflictResolution, Attribution, Signature, InlineAnnotation, and PessimisticLock.*

### 5.19 Linking Kit (`kits/linking/`)

Cross-entity references and relationships.

| Concept | Purpose |
|---------|---------|
| Alias | Alternative names/URLs for entities |
| Backlink | Reverse index of references (auto-populated via sync) |
| Reference | Forward links between entities (schema-less) |
| Relation | Typed, labeled, bidirectional relationships with cardinality |

### 5.20 Presentation Kit (`kits/presentation/`)

Display and form rendering.

| Concept | Purpose |
|---------|---------|
| DisplayMode | Content display mode management (read/edit/preview) |
| FormBuilder | Dynamic form generation from schemas |
| Renderer | Content rendering pipeline |
| View | Configurable content views with field selection and ordering |

### 5.21 Query/Retrieval Kit (`kits/query-retrieval/`)

Search and query execution.

| Concept | Purpose |
|---------|---------|
| ExposedFilter | User-facing filter configuration |
| Query | Query execution against the entity graph |
| SearchIndex | Coordination point for search — providers register here |

### 5.22 Other Domain Suites

| Kit | Concepts | Purpose |
|-----|----------|---------|
| **Layout** (`kits/layout/`) | Component | UI component composition and layout |
| **Media** (`kits/media/`) | FileManagement, MediaAsset | File upload, processing, and media management |
| **Notification** (`kits/notification/`) | Notification | Multi-channel notification delivery |
| **Web3** (`kits/web3/`) | ChainMonitor (@gate), Content, Wallet | Blockchain finality tracking, IPFS storage, signature verification |

### 5.23 Clef Surface Kits (`concept-interface/kits/`) -- Clef Surface (v0.4.0)

Clef Surface is the interface companion to Clef. Every abstraction is a concept, every coordination is a sync, every bundle is a suite. Clef Surface generates working interfaces from concept specs — zero config gets a functional interface, progressive customization gets a beautiful one. Two-step semantic widget selection: abstract interaction types (Interactor) are classified from field metadata, then matched against widget capability declarations (Affordance) parameterized by runtime context.

**surface-core** — Foundation: design tokens, abstract elements (enriched with interactor classification and widget resolution), UI schemas, concept bindings, reactive signals.
- DesignToken, Element, UISchema, Binding, Signal

**surface-component** — Headless behaviors, semantic interaction classification, and context-aware widget resolution. Widgets are parsed ASTs from `.widget` specs. Interactors classify WHAT the user does, Affordances declare WHEN a widget is suitable, WidgetResolver decides WHICH widget for a given context.
- Widget, Machine, Slot, Interactor, Affordance, WidgetResolver

**surface-render** — Framework adapters that translate headless widget props into platform-specific bindings.
- FrameworkAdapter, Surface, Layout, Viewport
- 15 adapters: React, Solid, Vue, Svelte, Ink, Vanilla, SwiftUI, AppKit, Compose, ReactNative, NativeScript, GTK, WinUI, WatchKit, WearCompose

**surface-theme** — Visual design system with WCAG accessibility enforcement. Inputs from ThemeParser output; runtime concepts store resolved values.
- Theme, Palette, Typography, Motion, Elevation

**surface-app** — Application orchestration: navigation, lifecycle, network transport, platform composition. All specs corrected per Clef independence rule.
- Navigator, Host, Transport, Shell, PlatformAdapter
- 5 platform adapters: Browser, Desktop, Mobile, Terminal, Watch

**surface-spec** — Build-time parsing and generation for `.widget` and `.theme` spec files. Uses Clef generation suite infrastructure (Resource, KindSystem, BuildCache, Emitter).
- WidgetParser, ThemeParser, WidgetGen, ThemeGen

**surface-integration** — Syncs-only kit bridging Clef domain concepts to Clef Surface interface concepts. No new concepts. Includes IntentImprovesClassification and CustomizationOverridesResolver syncs.

---

## 6. Concept Relationships

### 6.1 Suite Manifest (`suite.yaml`)

Kits bundle concepts, syncs, and type parameter mappings. The `uses` section declares cross-suite dependencies (only syncs reference external concepts; concepts remain independent).

```yaml
kit:
  name: kit-name
  version: 0.1.0
  description: "Kit purpose"

concepts:
  ConceptName:
    spec: ./concept-file.concept
    params:
      T: { as: shared-type-name, description: "..." }
    optional: true  # optional provider plugin

syncs:
  required: [...]      # cannot be disabled
  recommended: [...]   # can be overridden
  integration: [...]   # load when provider present

uses:
  - kit: other-kit
    optional: true     # conditional loading
    concepts:
      - name: ExternalConcept
```

### 6.2 Sync Tiers
- **Required:** Removing causes data corruption or invariant violations.
- **Recommended:** Useful defaults that apps can override or disable.
- **Integration:** Plugin syncs that activate per loaded provider.

### 6.3 Key Sync Chains

**Registration flow:** `Web/request -> Password/validate -> User/register -> Password/set -> JWT/generate -> Web/respond`

**Compiler pipeline:** `SpecParser/parse -> SchemaGen/generate -> TypeScriptGen/generate (+ RustGen, SwiftGen, SolidityGen)`

**Deploy flow:** `DeployPlan/plan -> validate -> Migration/run -> execute -> Rollout/begin -> Health/check -> Telemetry/analyze`

**Interface generation pipeline:** `Projection/project -> ApiSurface/compose -> Generator/plan -> Target/dispatch -> Emitter/write`

**Finality gate pattern:** `Contract/call -> ChainMonitor/awaitFinality -> [ok] -> downstream action; [reorged] -> compensating action`

### 6.4 Coordination + Provider Pattern

Many suites use a coordination concept with multiple optional provider plugins. Routing syncs dispatch to the correct provider via PluginRegistry. Examples:

| Coordination Concept | Providers | Selection Basis |
|---------------------|-----------|-----------------|
| Runtime (Deploy) | Lambda, ECS, CloudRun, K8s, etc. | Deployment target |
| Target (Interface) | REST, GraphQL, gRPC, CLI, MCP | Interface manifest |
| Diff (Versioning) | Myers, Patience, Histogram, Tree | Content type |
| Merge (Versioning) | ThreeWay, Recursive, Lattice, Semantic | Content type + strategy |
| ConflictResolution (Collab) | LWW, AddWins, Manual, MultiValue | Data type + domain policy |

### 6.5 In-Progress Kit Additions (Separate Worktrees)

Three major design documents are being implemented on separate worktrees:

#### Code Representation & Semantic Query System (`kits/code-representation-design.md`)

Adds 5 new suites that make every file in a Clef project a queryable node at syntactic, symbolic, and semantic levels:

**Parse Kit** (`kits/parse/`) — Universal file parsing via Tree-sitter, structural identity, and pattern matching.
- SyntaxTree: Lossless CST for any parsed file, wrapping Tree-sitter output
- LanguageGrammar: Grammar definitions mapping extensions to parsers (coordination concept with ~15 grammar providers)
- DefinitionUnit: Individual definitions (function, class, concept spec) as first-class entities
- ContentDigest: Structural content hash for content-addressed identity
- StructuralPattern: Reusable search/match patterns (coordination concept with Tree-sitter, ast-grep, Comby, Regex providers)
- FileArtifact: Software-engineering metadata for project files (role, provenance, dependencies)

**Symbol Kit** (`kits/symbol/`) — Cross-file identity, occurrence tracking, and scope resolution.
- Symbol: Globally unique identifiers for named entities (`clef/concept/Article`, `ts/function/...`)
- SymbolOccurrence: Where symbols appear with exact locations and semantic roles
- ScopeGraph: Lexical scoping and name resolution model
- SymbolRelationship: Typed semantic relationships (implements, extends, generates, tests)
- Providers: TypeScript/Rust/Concept/Sync/Universal extractors; TypeScript/Concept/Sync scope providers

**Semantic Kit** (`kits/semantic/`) — Clef-specific semantic entities as queryable nodes.
- ConceptEntity: Parsed concept linked to generated artifacts and runtime behavior
- ActionEntity: Action with full lifecycle tracing (spec → sync → implementation → interface)
- VariantEntity: Action return variant as a first-class branching point in sync chains
- StateField: State declaration traced through generation and storage
- SyncEntity: Compiled sync rule as a queryable node connecting concepts

**Analysis Kit** (`kits/analysis/`) — Program analysis overlays.
- DependenceGraph: Data/control dependency edges (coordination concept with TypeScript/Rust/Concept/Sync/Datalog providers)
- DataFlowPath: Traced data flow from source to sink (taint tracking, config propagation)
- ProgramSlice: Minimal subgraph preserving behavior relative to a slicing criterion
- AnalysisRule: Declarative analysis rules for custom queries, linting, architecture constraints

**Discovery Kit** (`kits/discovery/`) — Search, embedding, and indexing.
- SemanticEmbedding: Vector embeddings for similarity search and NL code search (coordination concept with CodeBERT, UniXcoder, OpenAI, Voyage providers)
- Search index providers (Trigram, SuffixArray, SymbolIndex) register with existing SearchIndex

Reuses 22 existing concepts directly (ContentNode, Graph, Reference, Provenance, FieldMapping, DataQuality, etc.). Several proposed concepts collapsed into existing ones (FlowGraph/CallGraph/ImportGraph → typed Graph instances; InvariantCoverage → DataQuality; TypeBinding → FieldMapping).

#### Versioning & Collaboration System (`kits/versioning-kit-design.md`)

Adds 2 new suites with 18 new concepts providing version control, change tracking, concurrent editing, and compliance.

**Versioning Kit** (`kits/versioning/`) — Immutable storage primitives, change representation, and history.
- ContentHash: Content-addressed identity via cryptographic digest (deduplication, integrity)
- Ref: Mutable human-readable names for immutable content-addressed objects (compare-and-swap)
- DAGHistory: Directed acyclic graph of versions (branching, merging, topological traversal)
- Patch: First-class invertible, composable change objects (apply, invert, compose, commute)
- Diff: Compute minimal differences between content states (coordination concept; Myers/Patience/Histogram/Tree providers)
- Merge: Combine divergent versions with common ancestor (coordination concept; ThreeWay/Recursive/Lattice/Semantic providers)
- Branch: Named parallel lines of development with lifecycle management
- TemporalVersion: Bitemporal version tracking (system time + valid time). Supersedes Version.
- SchemaEvolution: Versioned structural definitions with compatibility guarantees (forward/backward/full)
- ChangeStream: Ordered, resumable stream of atomic change events. Downstream consumer for Capture.
- RetentionPolicy: Retention periods, legal holds, and compliance-grade disposition logging

**Collaboration Kit** (expands existing `kits/collaboration/`) — Distributed collaboration and concurrent editing.
- CausalClock: Happens-before ordering via vector clocks (tick, merge, compare, dominates)
- Replica: Locally-modifiable copy of shared state with peer synchronization (@gate)
- ConflictResolution: Detect and resolve concurrent modifications (coordination concept; LWW/AddWins/Manual/MultiValue providers)
- Attribution: Agent identity bound to content regions (blame, ownership, history)
- Signature: Cryptographic proof of authorship, integrity, and temporal existence
- InlineAnnotation: Embedded change markers for accept/reject review workflows (track changes)
- PessimisticLock: Exclusive write access with queuing, expiration, and break-lock (@gate)

**Supersession plan:**
- Version (Content Kit) → TemporalVersion (Versioning Kit) — compatibility sync, then deprecate, then remove
- SyncedContent (Content Kit) → Replica + ConflictResolution — facade sync, then deprecate, then remove
- Capture (Data Integration) → narrowed scope (CDC adapter only); ChangeStream handles downstream streaming
- Provenance (Data Integration) → keeps identity; Attribution handles content-region authorship

**Design principles:** Snapshot-patch duality is a composition. Conflict detection and resolution are always separate concepts. Causality is the universal ordering primitive. Algorithms are providers (Diff, Merge, ConflictResolution). Mutable pointers (Ref, Branch) over immutable data (ContentHash, DAGHistory, Patch).

#### Clef Surface v0.4.0 — Clef Surface (`concept-interface/surface-spec-v4.md`)

Three-pass architectural revision of the Clef Surface interface system:

1. **Idiom alignment** — All concept specs corrected to follow Clef independence rule; action bodies describe own state only, sync chains live in syncs; JSON blob state replaced with typed relations.
2. **Spec-first pipeline** — New `.widget` and `.theme` file formats with grammar, parser, and generator concepts in new surface-spec suite; Anatomy absorbed into `.widget` files; Widget stores validated ASTs not JSON blobs; uses Clef generation suite (Resource, KindSystem, BuildCache, Emitter).
3. **Semantic widget selection** — New Interactor (abstract interaction taxonomy), Affordance (widget capability declarations), WidgetResolver (context-aware matching engine) replace flat type-mapping table with two-step classify→resolve pipeline.

**Changes:**
- +1 new suite: surface-spec (WidgetParser, ThemeParser, WidgetGen, ThemeGen)
- +3 new concepts in surface-component: Interactor, Affordance, WidgetResolver
- -1 absorbed concept: Anatomy (into `.widget` files)
- Element enriched with interactorType, interactorProps, resolvedWidget state fields
- All surface-app concepts (Navigator, Host, Transport, Shell, PlatformAdapter) rewritten per independence rule
- Net: 29 Clef Surface concepts across 7 suites (was 24 across 6 suites)

---

## 7. Framework Architecture

### 7.1 Type System (`kernel/src/types.ts`)

**ConceptAST** -- Parsed concept structure: name, typeParams, purpose, version, annotations, state (StateEntry[]), actions (ActionDecl[]), invariants, capabilities.

**SyncAST** -- Parsed sync: name, annotations, when (SyncWhenPattern[]), where (SyncWhereEntry[]), then (SyncThenAction[]).

**ConceptManifest** -- Language-neutral IR: uri, name, typeParams, relations (RelationSchema[]), actions (ActionSchema[]), invariants (InvariantSchema[]), graphqlSchema, jsonSchemas, capabilities, purpose, gate, category, visibility.

**KitManifest** -- Kit metadata: kit info, concepts with param mappings, syncs by tier, uses declarations, dependencies.

**Wire protocol:** `ActionInvocation` (id, concept, action, input, flow, sync, timestamp) and `ActionCompletion` (+ variant, output).

**ConceptStorage** interface: `put`, `get`, `find`, `del`, `delMany`, `getMeta`, `onConflict`.

**ConceptTransport** interface: `invoke`, `query`, `health`, `queryMode` (graphql or lite).

### 7.2 Parser (`implementations/typescript/framework/parser.ts`)

Hand-written recursive descent parser with tokenizer. Produces ConceptAST from `.concept` source strings. Handles annotations, type params, state groups, inline records, action variants with prose bodies, and invariants.

### 7.3 Sync Engine (`implementations/typescript/framework/sync-engine.impl.ts`)

Maintains an index from `(concept, action)` pairs to syncs. On completion: find candidates, gather flow completions, match when-clause patterns via cross-product with consistent variable bindings, check firing guard (provenance edge dedup), evaluate where-clauses, build invocations.

### 7.4 Code Generators

`SchemaGen` produces `ConceptManifest` from `ConceptAST`. Per-language generators consume the manifest:
- **TypeScriptGen** -- Handler skeletons, conformance tests
- **RustGen** -- Trait definitions, handler skeletons
- **SwiftGen** -- Protocol definitions, handler skeletons
- **SolidityGen** -- Contract interfaces, Foundry tests

### 7.5 CLI (`tools/clef-cli/`)

Commands: `init`, `generate`, `compile-syncs`, `compile-cache`, `check` (with `--pattern async-gate`), `trace` (with `--gates`), `deploy`, `dev`, `test`, `migrate`, `kit`, `interface`, `kinds`, `impact`.

### 7.6 Query Modes

**Full GraphQL** -- For server concepts with complex state. Concept runs its own GraphQL endpoint.
**Lite Query Protocol** -- For phones/embedded/lightweight. Concept implements `snapshot()`, optional `lookup()`, `filter()`. Engine-side adapter translates to GraphQL-compatible responses.

---

## 8. Naming Conventions

- **Never reference implementation phases or ordering** in code comments, file names, test names, or descriptions. Organize by logical function.
- Reference architecture doc section numbers (e.g., "Section 16.12") not phase numbers.
- Bad: "Phase 19: Async Gate Tests" / Good: "Async Gate Convention & Pattern Validation Tests"

---

## 9. Creating New Concepts -- Quick Checklist

1. Apply the concept test: independent state, meaningful actions with domain-specific variants, operational principles that compose via syncs.
2. Choose a single-letter type parameter for entity references (`[T]`, `[E]`, etc.).
3. Write the purpose section -- one clear sentence about why this concept exists.
4. Define state as typed relations using the type parameter as domain.
5. Define actions with explicit return variants (always include `ok` + at least one error/edge case).
6. Write prose descriptions for each variant.
7. Write invariants as after/then/and chains testing key operational principles.
8. Add `@version(1)` if the concept has persistent state.
9. Add `@gate` if any action may complete asynchronously.
10. Add `capabilities` if the concept requires `persistent-storage`, `crypto`, or `network`.
11. Place in appropriate kit directory or `specs/` for framework concepts.
12. Write syncs in separate `.sync` files to wire to other concepts.
13. Update `suite.yaml` with the concept entry and param mapping.

---

## 10. Architecture Notes

### 10.1 Three-Tier Dispatch Model

Clef has three distinct layers for event/action routing, each at a different abstraction level:

| Tier | Concept | Layer | Purpose | Authored by |
|------|---------|-------|---------|-------------|
| 1 | **SyncEngine** | Framework | Evaluates declarative sync rules on action completions. Routes via `when`/`where`/`then` pattern matching. The fundamental wiring mechanism. | Framework (built-in) |
| 2 | **EventBus** | Infrastructure | Application-level pub/sub with subscriber management, priority ordering, dead-letter queues, and event history. | Developer |
| 3 | **AutomationRule** | Automation | User-configurable event-condition-action rules with enable/disable toggles. Condition evaluation delegates to SyncEngine's `evaluateWhere` via the `AutomationConditionEval` sync. | End user |

**When to use each:**
- **SyncEngine (syncs)**: For structural concept wiring defined at design time. Every cross-concept delegation uses syncs.
- **EventBus**: When you need subscriber management, priority ordering, dead-letter handling, or event history that syncs don't provide. Application-level pub/sub where the set of listeners is dynamic.
- **AutomationRule**: When end users need to configure their own event-condition-action rules at runtime (e.g., "when order placed and total > $100, send VIP notification").

### 10.2 Linking Concepts: Reference/Backlink vs Relation

The linking kit provides three concepts at two complexity levels:

**Lightweight (schema-less):**
- **Reference** — Forward links: `addRef(source, target)`, `removeRef`, `getRefs`
- **Backlink** — Reverse index: `getBacklinks`, `reindex`
- Wired together by `bidirectional-links.sync` (Reference changes trigger Backlink reindex)

**Typed (schema-aware):**
- **Relation** — Typed, labeled, bidirectional connections with cardinality constraints: `defineRelation(schema)`, `link`, `unlink`, `getRelated`

**Bridge:** The `relation-reference-bridge.sync` mirrors Relation links as Reference entries, so Backlink stays consistent automatically. This means:
- Use **Reference/Backlink** when you need simple, untyped "this points to that" links
- Use **Relation** when you need typed relationships with cardinality constraints, labels, and directionality
- Both systems stay in sync via the bridge sync — a Relation link automatically appears in Reference/Backlink queries

### 10.3 DataQuality vs Validator Scope Boundaries

Both concepts deal with "checking correctness" but at different points in the data lifecycle:

| Concept | Scope | When it runs | What it returns |
|---------|-------|-------------|----------------|
| **Validator** (`kits/infrastructure/`) | Write-time constraint enforcement | On CRUD operations, form submissions, property changes | Pass/fail with field-level error messages |
| **DataQuality** (`kits/data-integration/`) | Pipeline-level data assessment | During ETL/integration flows | Quality scores, quarantine decisions, pipeline gate verdicts |

**Delegation:** DataQuality delegates rule evaluation to Validator via the `DataQualityValidation` sync. DataQuality adds pipeline-specific wrapping (scoring, gating, quarantine) while Validator handles the underlying constraint checking.

**Coercion:** Validation failures can trigger Transform (`kits/data-integration/`) to attempt coercion before rejecting, via the `CoercionFallback` sync in `kits/infrastructure/syncs/`.

### 10.4 Concept Overlap Prevention Guidelines

When designing new concepts, check for these common overlap patterns:

1. **Action already exists elsewhere** — Before adding a `validate`, `transform`, `render`, or `compute` action, check if an existing concept already provides it. Delegate via sync instead.
2. **"And" in purpose** — If your purpose statement uses "and" to connect unrelated concerns, consider splitting or delegating. Exception: when the "and" connects tightly cohesive facets of a single concern (e.g., Widget's "state machine and anatomy and a11y").
3. **Naming collision** — Search existing concepts before naming. If a name is taken, use a qualifier that reflects the concept's specific domain (e.g., EnrichmentRenderer vs Renderer, ApiSurface vs Surface).
4. **Cross-layer bleeding** — Data structure concepts should not contain visualization logic. Validation concepts should not contain transformation logic. Use syncs to bridge layers.

---

## 11. Kit Summary

**Current:** 23 suites with ~145 concepts across `kits/`, 34 framework/app specs in `specs/`, plus 7 Clef Surface suites with 29 core + ~20 adapter concepts in `concept-interface/`.

**In-progress (worktrees):**
- Code Representation: +5 suites, +20 coordination concepts, +~35 providers
- Versioning & Collaboration: +1 new suite (Versioning), expansion of Collaboration kit, +18 concepts, +~12 providers, −2 superseded concepts (Version, SyncedContent)
