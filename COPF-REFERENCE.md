# COPF Comprehensive Reference

## 1. Project Overview

COPF (Concept-Oriented Programming Framework) builds software as compositions of **fully independent, spec-driven services** called **concepts**, coordinated by declarative **synchronizations**. Inspired by Daniel Jackson's *The Essence of Software*, where software is modeled as a collection of independent concepts (each with purpose, state, actions, and operational principles) that compose through syncs.

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
| Comment | C | Threaded discussion on articles | add, delete, list |
| Follow | U | Social follow relationships | follow, unfollow, isFollowing |
| Favorite | F | Content bookmarking | favorite, unfavorite, count |
| Tag | T | Content categorization labels | add, remove, list |
| Echo | M | Simple request-response (test concept) | send |

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
| Migration | Schema version migration (expand/migrate/contract) |
| Telemetry | Collect and export observability data |
| DevServer | Hot-reloading development server |
| ProjectScaffold | Generate new COPF project structure |
| *ScaffoldGen (x10) | Scaffold generators for concepts, syncs, kits, handlers, storage/transport adapters, deploy/interface manifests, COIF components/themes |

### 5.3 Generation Kit (`kits/generation/`)

| Concept | Purpose |
|---------|---------|
| Resource | Track input files with content hashing for change detection |
| KindSystem | Define IR/artifact kinds and dependency edges between generators |
| BuildCache | Incremental build cache with input/output hash tracking |
| GenerationPlan | Orchestrate generation runs with step recording |
| Emitter | Content-addressed file emission with formatting and orphan cleanup |

### 5.4 Deploy Kit (`kits/deploy/`)

| Concept | Purpose |
|---------|---------|
| DeployPlan | Compute, validate, execute deployment DAGs |
| Rollout | Progressive delivery (canary, blue-green, rolling) |
| Migration | Schema migration lifecycle |
| Health | Health check verification |
| Env | Environment management (dev/staging/prod) |
| Telemetry | Deployment observability markers |
| Artifact | Immutable content-addressed build artifacts |
| Runtime | Coordination concept for runtime providers |
| Secret | Coordination concept for secret providers |
| IaC | Coordination concept for infrastructure-as-code |
| GitOps | Coordination concept for GitOps providers |
| Builder | Multi-language build coordination |
| Toolchain | Language toolchain resolution |
| **Providers (25+):** LambdaRuntime, EcsRuntime, CloudRunRuntime, K8sRuntime, DockerComposeRuntime, VercelRuntime, CloudflareRuntime, LocalRuntime, VaultProvider, AwsSmProvider, GcpSmProvider, EnvProvider, DotenvProvider, PulumiProvider, TerraformProvider, CloudFormationProvider, ArgoCDProvider, FluxProvider, TypeScript/Rust/Swift/Solidity Builder and Toolchain providers |

### 5.5 Interface Kit (`kits/interface/`)

| Concept | Purpose |
|---------|---------|
| Projection | Enriched concept projection with metadata |
| Generator | Interface generation planning |
| Surface | Composed API surface aggregation |
| Middleware | Cross-cutting middleware definitions |
| Grouping | Concept grouping for API organization |
| Workflow | Ordered action sequences |
| Annotation | Concept/action metadata enrichment |
| Renderer | Render handler registration |
| Target | Target generation output coordination |
| Sdk | SDK package generation coordination |
| Spec | Spec document generation coordination |
| **Providers (14):** RestTarget, GraphqlTarget, GrpcTarget, CliTarget, McpTarget, ClaudeSkillsTarget, OpenApiTarget, AsyncApiTarget, TsSdkTarget, PySdkTarget, GoSdkTarget, RustSdkTarget, JavaSdkTarget, SwiftSdkTarget |

### 5.6 Identity Kit (`kits/identity/`)
Authentication, Authorization, AccessControl, Session

### 5.7 Content Kit (`kits/content/`)
Canvas, Comment, DailyNote, SyncedContent, Template, Version

### 5.8 Foundation Kit (`kits/foundation/`)
ContentNode, ContentParser, ContentStorage, Intent, Outline, PageAsRecord, Property, TypeSystem

### 5.9 Infrastructure Kit (`kits/infrastructure/`)
Cache, ConfigSync, EventBus, Pathauto, PluginRegistry, Validator

### 5.10 Classification Kit (`kits/classification/`)
Namespace, Schema, Tag, Taxonomy

### 5.11 Automation Kit (`kits/automation/`)
AutomationRule, Control, Queue, Workflow

### 5.12 Data Integration Kit (`kits/data-integration/`)
Capture, Connector, DataQuality, DataSource, Enricher, FieldMapping, ProgressiveSchema, Provenance, SyncPair, Transform

### 5.13 Data Organization Kit (`kits/data-organization/`)
Collection, Graph

### 5.14 Computation Kit (`kits/computation/`)
ExpressionLanguage, Formula, Token

### 5.15 Collaboration Kit (`kits/collaboration/`)
Flag, Group

### 5.16 Linking Kit (`kits/linking/`)
Alias, Backlink, Reference, Relation

### 5.17 Presentation Kit (`kits/presentation/`)
DisplayMode, FormBuilder, Renderer, View

### 5.18 Query/Retrieval Kit (`kits/query-retrieval/`)
ExposedFilter, Query, SearchIndex

### 5.19 Layout Kit (`kits/layout/`)
Component

### 5.20 Media Kit (`kits/media/`)
FileManagement, MediaAsset

### 5.21 Notification Kit (`kits/notification/`)
Notification

### 5.22 Test Kit (`kits/test/`)
Conformance, ContractTest, FlakyTest, Snapshot, TestSelection

### 5.23 Web3 Kit (`kits/web3/`)
ChainMonitor (@gate -- finality tracking), Content (IPFS storage), Wallet (signature verification)

### 5.24 COIF Kits (`concept-interface/kits/`) -- Concept-Oriented Interface Format

**coif-core:** DesignToken, Element, UISchema, Binding, Signal
**coif-component:** Anatomy, Machine, Slot, Widget
**coif-render:** Layout, Surface, Viewport, FrameworkAdapter, + 14 platform adapters (React, Vue, Svelte, Solid, SwiftUI, Compose, ReactNative, etc.)
**coif-theme:** Elevation, Motion, Palette, Theme, Typography
**coif-app:** Host, Navigator, Shell, Transport, PlatformAdapter, + 5 platform adapters (Browser, Desktop, Mobile, Terminal, Watch)

---

## 6. Concept Relationships

### 6.1 Kit Manifest (`kit.yaml`)

Kits bundle concepts, syncs, and type parameter mappings. The `uses` section declares cross-kit dependencies (only syncs reference external concepts; concepts remain independent).

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

**Finality gate pattern:** `Contract/call -> ChainMonitor/awaitFinality -> [ok] -> downstream action; [reorged] -> compensating action`

### 6.4 Coordination + Provider Pattern

Many kits use a coordination concept (e.g., `Runtime`, `Builder`, `Secret`) with multiple optional provider plugins (e.g., `LambdaRuntime`, `K8sRuntime`). Routing syncs dispatch to the correct provider based on configuration.

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

### 7.5 CLI (`tools/copf-cli/`)

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
13. Update `kit.yaml` with the concept entry and param mapping.
