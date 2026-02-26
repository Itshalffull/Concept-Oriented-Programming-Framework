# Clef Generation Suite — Architecture Extension

## Design Principle

The same principle as the deploy and Clef Binds: **the engine owns coordination mechanics, concepts own domain logic.** Generation infrastructure — input tracking, pipeline topology, incremental caching, file emission, and run tracking — is a domain with sovereign state, meaningful action variants, and coordination needs. The generation suite provides shared infrastructure that all generation families (framework codegen, interface generation, deploy generation) consume through syncs.

**The generation suite does NOT replace existing generators.** TypeScriptGen, RestTarget, TerraformProvider, etc. remain independent concepts with their own domain logic. The generation suite wraps shared concerns around them via syncs: content-addressed file writes, incremental rebuild detection, pipeline topology analysis, input change tracking, and unified run reporting.

**The sync engine drives execution.** No generation suite concept sits in the execution path between triggers and generators. The sync engine connects SchemaGen → BuildCache → TypeScriptGen → Emitter → BuildCache directly. GenerationPlan is a passive observer and planner — it queries infrastructure for `--plan`/`--dry-run` and watches completions for `--status`, but never dispatches or blocks generation.

**PluginRegistry is the single registration point.** Generators register once with PluginRegistry (from the infrastructure kit). KindSystem and GenerationPlan both consume that registration through syncs. No generator needs to know about KindSystem or GenerationPlan directly.

### Position in the Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Source Files (.concept, .sync, interface.yaml, deploy.yaml)               │
│                                                                             │
│       │ filesystem events                                                   │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GENERATION KIT (shared infrastructure)                             │   │
│  │                                                                     │   │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────┐    │   │
│  │  │ Resource │  │KindSystem │  │ BuildCache │  │GenerationPlan│    │   │
│  │  │ (inputs) │  │(topology) │  │  (hashes)  │  │  (observer)  │    │   │
│  │  └────┬─────┘  └─────┬─────┘  └──────┬─────┘  └──────┬───────┘    │   │
│  │       │              │               │               │             │   │
│  │  ┌────┴──────────────┴───────────────┴───────────────┘             │   │
│  │  │                                                                 │   │
│  │  │  ┌──────────┐                                                   │   │
│  │  │  │ Emitter  │ (content-addressed writes, tracing, audit)        │   │
│  │  │  └──────────┘                                                   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│       │ cache-check syncs wrap existing generator triggers                 │
│       │ observer syncs feed GenerationPlan passively                       │
│       │                                                                     │
│  ┌────┴──────────────────┬──────────────────────┬──────────────────────┐   │
│  │                       │                      │                      │   │
│  │  Framework Family     │  Interface Family    │  Deploy Family       │   │
│  │  SpecParser           │  Projection          │  DeployPlan          │   │
│  │  SchemaGen            │  Generator           │  IaC → TfProvider    │   │
│  │  TypeScriptGen        │  Target → RestTarget │  GitOps → ArgoApp    │   │
│  │  RustGen              │  Sdk → TsSdkTarget   │  ...                 │   │
│  │  ...                  │  Spec → OpenApiTarget│                      │   │
│  │                       │  Surface, Middleware  │                      │   │
│  └───────────────────────┴──────────────────────┴──────────────────────┘   │
│                                                                             │
│       │ all file output flows through shared Emitter                       │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Generated Output (files, specs, manifests)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Execution Model

The sync engine drives all generation. No generation suite concept dispatches to generators. Cache checks intercept existing trigger syncs — on miss the generator runs, on hit it's skipped. GenerationPlan observes completions via syncs but never blocks.

```
# Example: password.concept changes

FileWatcher/detected ──sync──▶ Resource/upsert
                                   │
                        ┌── changed variant ──┐
                        ▼                     ▼
              BuildCache/invalidateBySource   KindSystem/dependents
                        │                     │
                        ▼                     ▼
              BuildCache/invalidateByKind  (cascade downstream kinds)
                        │
          ┌─────────────┤ (existing pipeline syncs trigger)
          ▼
    SpecParser/parse → ok(ast)
          │
          ▼
    SchemaGen/generate → ok(manifest)
          │
          ├──sync──▶ BuildCache/check("framework:TypeScriptGen:password")
          │              │
          │    ┌── changed ──┐         ┌── unchanged ──┐
          │    ▼                        ▼
          │  TypeScriptGen/generate    GenerationPlan/recordStep("cached")
          │    │
          │    ├──▶ Emitter/writeBatch
          │    │       │
          │    │       ▼
          │    │    Emitter/format (per file)
          │    │
          │    ├──▶ BuildCache/record
          │    │
          │    └──▶ GenerationPlan/recordStep("done", files: 3)
          │
          ├──sync──▶ BuildCache/check("framework:RustGen:password")
          │              │
          │         (same cache-check / generate / observe pattern)
          │
          └──sync──▶ BuildCache/check("interface:Projection:password")
                         │
               ┌── changed ──┐
               ▼
         Projection/project → ok(projection)
               │
               ├──sync──▶ BuildCache/check("interface:RestTarget:password")
               │              ...
               └──sync──▶ BuildCache/check("interface:CliTarget:password")
                              ...
```

### What Each Concept Owns

| Concept | Purpose | Execution Role |
|---|---|---|
| **Resource** | Track source inputs, detect changes | Entry point: filesystem events → upsert triggers invalidation |
| **KindSystem** | Pipeline topology, validation, ordering | Passive: queried for cascading, planning, validation |
| **BuildCache** | Incremental detection, skip unchanged | Active wrapper: cache-check syncs intercept triggers |
| **GenerationPlan** | Plan runs, track status, report results | Passive observer: queries for `--plan`, watches completions for `--status` |
| **Emitter** | Content-addressed file writes, tracing, audit | Active sink: file output flows through for writes and formatting |

### Relationship to Existing Kits

**Interface kit:** Emitter moves from Clef Bind to generation suite (shared). BuildCache wraps each target provider via syncs. All Clef Bind concepts (Projection, Generator, Target, Sdk, Spec, Surface, Middleware, all 13 providers) remain unchanged. Internal sync chains stay exactly as designed.

**Deploy kit:** IaC and GitOps provider output pipes through shared Emitter. BuildCache wraps each provider via syncs. All deploy kit concepts remain unchanged.

**Framework pipeline:** TypeScriptGen, RustGen, etc. pipe output through shared Emitter. BuildCache wraps each generator via syncs. Existing trigger syncs (SchemaGen → TypeScriptGen) are replaced by cache-aware versions.

**Infrastructure kit:** Generation kit imports PluginRegistry. Generators register as plugins. KindSystem auto-populates from registrations. GenerationPlan queries PluginRegistry for planning.

---

## Part 1: Concepts

### 1.1 Resource

Tracks source inputs to generation pipelines. Every generation run starts with inputs: `.concept` files, `.sync` files, `interface.yaml`, `deploy.yaml`, environment config. Resource centralizes input tracking so the generation suite knows what changed, when, and what's affected.

**Independent purpose test:** File watchers, CI systems, and dependency analyzers need to know "what are my inputs and which changed?" — independent of generation.

```
@version(1)
concept Resource [R] {

  purpose {
    Track input resources to generation pipelines: files, configs,
    environment facts. Each resource has a content digest for change
    detection. Centralizes "what are my sources and which changed?"
    so downstream systems (caching, planning, invalidation) have a
    single source of truth about inputs.
  }

  state {
    resources: set R
    locator: R -> String
    kind: R -> String
    digest: R -> String
    lastModified: R -> option DateTime
    size: R -> option Int
  }

  actions {
    action upsert(locator: String, kind: String, digest: String, lastModified: option DateTime, size: option Int) {
      -> created(resource: R) {
        New resource. First time this locator has been seen.
        Records kind, digest, and metadata. Downstream syncs
        should treat this as a new input requiring full generation.
      }
      -> changed(resource: R, previousDigest: String) {
        Known resource, digest differs from stored value.
        Returns previous digest so downstream can diff if needed.
        Downstream syncs should invalidate affected caches.
      }
      -> unchanged(resource: R) {
        Known resource, digest identical to stored value.
        No action needed downstream.
      }
    }

    action get(locator: String) {
      -> ok(resource: R, kind: String, digest: String) {
        Return current resource record for this locator.
      }
      -> notFound(locator: String) {
        No resource registered at this locator.
      }
    }

    action list(kind: option String) {
      -> ok(resources: list { locator: String, kind: String, digest: String }) {
        List all tracked resources, optionally filtered by kind.
      }
    }

    action remove(locator: String) {
      -> ok(resource: R) {
        Resource removed from tracking. Downstream syncs should
        treat this as a deletion — clean up generated outputs
        that depended on this resource.
      }
      -> notFound(locator: String) {
        No resource registered at this locator.
      }
    }

    action diff(locator: String, oldDigest: String, newDigest: String) {
      -> ok(changeType: String) {
        Classify the change type for this resource kind:
        "content" — same structure, different values.
        "structural" — fields/actions/types added or removed.
        "breaking" — types changed, fields removed, signatures altered.
        Classification depends on kind-specific diff logic.
      }
      -> unknown(message: String) {
        Cannot determine change type — no kind-specific differ
        registered for this resource kind.
      }
    }
  }

  invariant {
    after upsert(locator: "./specs/password.concept", kind: "concept-spec", digest: "abc123") -> created(resource: r)
    then  get(locator: "./specs/password.concept") -> ok(resource: r, kind: "concept-spec", digest: "abc123")
    and   upsert(locator: "./specs/password.concept", kind: "concept-spec", digest: "abc123") -> unchanged(resource: r)
    and   upsert(locator: "./specs/password.concept", kind: "concept-spec", digest: "def456") -> changed(resource: r, previousDigest: "abc123")
  }
}
```

**Resource kinds (convention, not enforced by concept):**

| Kind | Sources | Used by |
|---|---|---|
| `concept-spec` | `.concept` files | Framework pipeline, Clef Bind |
| `sync-spec` | `.sync` files | Framework pipeline |
| `interface-manifest` | `app.interface.yaml` | Interface kit |
| `deploy-manifest` | `app.deploy.yaml` | Deploy kit |
| `kit-manifest` | `suite.yaml` | All suites |
| `config` | `clef.config.yaml`, env vars | All suites |
| `static-asset` | Images, templates, static files | Auxiliary generation |


### 1.2 KindSystem

Defines the taxonomy of intermediate representations and artifacts across all generation pipelines. Tracks which IR kinds can transform into which others, enabling pipeline validation, execution ordering, and cascading invalidation — without any generator needing to know the full taxonomy.

**Independent purpose test:** "What kinds of IRs exist in this project? What can ConceptManifest transform into? What's the shortest pipeline from ConceptDSL to OpenApiDoc?" — answerable without running any generation.

**Auto-populated from PluginRegistry.** Generators don't interact with KindSystem directly. They register with PluginRegistry (including `inputKind` and `outputKind` in metadata), and a single sync creates the KindSystem edge automatically.

```
@version(1)
concept KindSystem [K] {

  purpose {
    Define the taxonomy of intermediate representations and
    artifacts in generation pipelines. Track which kinds can
    transform into which others. Enable pipeline validation,
    execution ordering, and cascading invalidation — without
    any concept needing to know the full taxonomy.
  }

  state {
    kinds: set K
    name: K -> String
    category: K -> String
    edges: K -> set {
      target: K
      relation: String
      transformName: option String
    }
  }

  actions {
    action define(name: String, category: String) {
      -> ok(kind: K) {
        Register a new kind in the taxonomy.

        Categories:
        "source" — raw input (files, configs, environment facts).
          Examples: ConceptDSL, SyncDSL, InterfaceManifest, DeployManifest.
        "model" — intermediate representation.
          Examples: ConceptAST, ConceptManifest, Projection, DeployPlan.
        "artifact" — terminal output (generated files, specs, tokens, images).
          Examples: TypeScriptFiles, RustFiles, RestRoutes, OpenApiDoc.
      }
      -> exists(kind: K) {
        Kind with this name already registered. Returns existing ref.
        Idempotent — not an error.
      }
    }

    action connect(from: K, to: K, relation: String, transformName: option String) {
      -> ok() {
        Declare that kind `from` can be transformed into kind `to`.

        Relations:
        "parses_to" — text source → structured AST.
        "normalizes_to" — AST → canonical model.
        "renders_to" — model → target-specific artifact.
        "materializes_to" — artifact → written files.

        transformName records which generator concept performs
        this transform. Used for analysis, planning, and display
        — not for dispatch (dispatch stays in syncs).
      }
      -> invalid(message: String) {
        Edge would create a cycle in the kind graph,
        or from/to kinds don't exist.
      }
    }

    action route(from: K, to: K) {
      -> ok(path: list { kind: K, relation: String, transform: option String }) {
        Compute shortest valid transform chain from `from` to `to`.
        Used by GenerationPlan for planning display and by
        `clef kinds path` CLI command.
      }
      -> unreachable(message: String) {
        No valid path exists between these kinds.
      }
    }

    action validate(from: K, to: K) {
      -> ok() {
        Confirm that a direct edge exists from `from` to `to`.
        Used by `clef check` to validate that sync chains form
        valid pipelines.
      }
      -> invalid(message: String) {
        No direct edge exists. Returns nearest valid target
        kinds reachable from `from` as suggestions.
      }
    }

    action dependents(kind: K) {
      -> ok(downstream: list K) {
        Return all kinds transitively reachable from this kind.
        Used by BuildCache for cascading invalidation: "if
        ConceptManifest changed, what other kinds are affected?"
      }
    }

    action producers(kind: K) {
      -> ok(transforms: list { fromKind: K, transformName: option String }) {
        What transforms can produce this kind?
        Used for discoverability and reverse dependency analysis.
      }
    }

    action consumers(kind: K) {
      -> ok(transforms: list { toKind: K, transformName: option String }) {
        What transforms consume this kind?
        Used for forward impact analysis.
      }
    }

    action graph() {
      -> ok(kinds: list { name: String, category: String }, edges: list { from: String, to: String, relation: String, transform: option String }) {
        Return the full topology graph. Used by
        `clef generate --plan` for dependency visualization.
      }
    }
  }

  invariant {
    after define(name: "ConceptAST", category: "model") -> ok(kind: ast)
    and   define(name: "ConceptManifest", category: "model") -> ok(kind: mfst)
    and   connect(from: ast, to: mfst, relation: "normalizes_to", transformName: "SchemaGen") -> ok()
    then  validate(from: ast, to: mfst) -> ok()
    and   route(from: ast, to: mfst) -> ok(path: p)
    and   dependents(kind: ast) -> ok(downstream: d)
  }
}
```

**Standard kind taxonomy (registered at kit load time):**

```
# Source kinds
ConceptDSL ──parses_to──▶ ConceptAST ──normalizes_to──▶ ConceptManifest
SyncDSL ──parses_to──▶ SyncAST ──normalizes_to──▶ CompiledSync
InterfaceManifest ──(input to Projection)
DeployManifest ──(input to DeployPlan)

# Framework family (auto-populated from PluginRegistry)
ConceptManifest ──renders_to──▶ TypeScriptFiles (TypeScriptGen)
ConceptManifest ──renders_to──▶ RustFiles (RustGen)
ConceptManifest ──renders_to──▶ SwiftFiles (SwiftGen)
ConceptManifest ──renders_to──▶ SolidityFiles (SolidityGen)

# Interface family (auto-populated from PluginRegistry)
ConceptManifest ──normalizes_to──▶ Projection (Projection)
Projection ──renders_to──▶ RestRoutes (RestTarget)
Projection ──renders_to──▶ GraphqlSchema (GraphqlTarget)
Projection ──renders_to──▶ GrpcServices (GrpcTarget)
Projection ──renders_to──▶ CliCommands (CliTarget)
Projection ──renders_to──▶ McpTools (McpTarget)
Projection ──renders_to──▶ OpenApiDoc (OpenApiTarget)
Projection ──renders_to──▶ AsyncApiDoc (AsyncApiTarget)
Projection ──renders_to──▶ TsSdkPackage (TsSdkTarget)
Projection ──renders_to──▶ PySdkPackage (PySdkTarget)

# Deploy family (auto-populated from PluginRegistry)
DeployManifest ──normalizes_to──▶ DeployPlan (DeployPlan)
DeployPlan ──renders_to──▶ TerraformModule (TfProvider)
DeployPlan ──renders_to──▶ PulumiProgram (PulumiProvider)
DeployPlan ──renders_to──▶ ArgoApp (ArgoProvider)

# All artifact kinds ──materializes_to──▶ WrittenFiles (Emitter)
```


### 1.3 BuildCache

Provides incremental detection for any generator. Instead of each generator reimplementing "has my input changed since the last successful run?", cache-check syncs intercept generator triggers: on miss the generator runs, on hit it's skipped. BuildCache is an active wrapper — it sits in sync chains between triggers and generators — but it does NOT dispatch. The sync engine handles the branching via variant matching (`changed` → generate, `unchanged` → skip).

**Independent purpose test:** "Is step X stale? When did it last run successfully? What depends on it?" — useful for build analysis independent of any specific generator.

```
@version(1)
concept BuildCache [E] {

  purpose {
    Track input/output hashes for generation steps.
    Enable incremental rebuilds: skip generation when
    inputs haven't changed since the last successful run.
    Support cascading invalidation when upstream kinds change.
  }

  state {
    entries: set E
    stepKey: E -> String
    inputHash: E -> String
    outputHash: E -> String
    outputRef: E -> option String
    lastRun: E -> DateTime
    sourceLocator: E -> option String
    deterministic: E -> Bool
  }

  actions {
    action check(stepKey: String, inputHash: String, deterministic: Bool) {
      -> unchanged(lastRun: DateTime, outputRef: option String) {
        The input hash matches the stored hash for this step key,
        AND the transform is deterministic (so same input guarantees
        same output). The generator can skip execution.

        Returns outputRef if available — the caller can load the
        cached output directly from .clef-cache/ without re-running.

        If deterministic is false, this variant is never returned —
        nondeterministic transforms always re-run.
      }
      -> changed(previousHash: option String) {
        The input hash differs from stored, OR no entry exists,
        OR the transform is nondeterministic. The generator should
        execute. Returns previous hash if one existed.
      }
    }

    action record(stepKey: String, inputHash: String, outputHash: String, outputRef: option String, sourceLocator: option String, deterministic: Bool) {
      -> ok(entry: E) {
        Record a successful generation. Store input hash, output hash,
        timestamp, optional output reference path, and the source
        locator that produced this step's input.

        outputRef points to the cached output in .clef-cache/ so
        future cache hits can retrieve the output without re-running.

        sourceLocator tracks which Resource produced this step's input,
        enabling Resource → BuildCache invalidation chains.
      }
    }

    action invalidate(stepKey: String) {
      -> ok() {
        Force a step to re-run next time by clearing its entry.
      }
      -> notFound() {
        No entry exists for this step key.
      }
    }

    action invalidateBySource(sourceLocator: String) {
      -> ok(invalidated: list String) {
        Invalidate all cache entries whose sourceLocator matches.
        Used when Resource/upsert reports a changed source —
        all steps derived from that source are invalidated.
        Returns list of invalidated step keys.
      }
    }

    action invalidateByKind(kindName: String) {
      -> ok(invalidated: list String) {
        Invalidate all cache entries whose step key contains
        generators that produce the given kind. Used for cascading:
        KindSystem/dependents returns affected kinds, then
        BuildCache invalidates all steps producing those kinds.
        Returns list of invalidated step keys.
      }
    }

    action invalidateAll() {
      -> ok(cleared: Int) {
        Clear all cache entries. Full rebuild on next run.
      }
    }

    action status() {
      -> ok(entries: list { stepKey: String, inputHash: String, lastRun: DateTime, stale: Bool }) {
        Return current cache status for all entries.
        An entry is stale if it has been invalidated since lastRun.
        Used by `clef generate --status`.
      }
    }

    action staleSteps() {
      -> ok(steps: list String) {
        Return step keys for all stale entries — entries that
        have been invalidated and need re-running.
        Used by GenerationPlan/plan for planning display.
      }
    }
  }

  invariant {
    after record(stepKey: "framework:TypeScriptGen:password", inputHash: "abc", outputHash: "xyz", outputRef: ".clef-cache/ts/password", sourceLocator: "./specs/password.concept", deterministic: true) -> ok(entry: e)
    then  check(stepKey: "framework:TypeScriptGen:password", inputHash: "abc", deterministic: true) -> unchanged(lastRun: t, outputRef: ".clef-cache/ts/password")
    and   check(stepKey: "framework:TypeScriptGen:password", inputHash: "def", deterministic: true) -> changed(previousHash: "abc")

    after invalidate(stepKey: "framework:TypeScriptGen:password") -> ok()
    then  check(stepKey: "framework:TypeScriptGen:password", inputHash: "abc", deterministic: true) -> changed(previousHash: "abc")
  }
}
```

**Step key convention:** `{family}:{generator}:{target}` — e.g., `framework:TypeScriptGen:password`, `interface:RestTarget:todo`, `deploy:TfProvider:main`.


### 1.4 GenerationPlan

Plans generation runs and tracks execution status. **Passive observer** — does not dispatch generators or sit in the execution path. Two roles:

1. **Planning (pre-execution analysis).** Queries PluginRegistry for registered generators, KindSystem for topology, BuildCache for staleness. Returns what would run without triggering anything. Used by `clef generate --plan` and `--dry-run`.

2. **Status tracking (during execution).** Observer syncs watch generator completions and call `recordStep` to build up run status. Used by `clef generate --status` and post-run reporting.

**Independent purpose test:** "What generators are registered? What would run? What's the dependency graph? How long did each step take?" — useful for build planning and monitoring without affecting execution.

```
@version(1)
concept GenerationPlan [R] {

  purpose {
    Plan generation runs and track execution status.
    Read-only planning: query PluginRegistry, KindSystem,
    and BuildCache to analyze what would run.
    Passive tracking: observe generator completions via
    syncs and record what happened. Does NOT dispatch
    generators — the sync engine handles all execution.
  }

  state {
    runs: set R
    steps: R -> list {
      stepKey: String
      generator: String
      family: String
      status: String
      filesProduced: Int
      duration: Int
      cached: Bool
    }
    activeRun: option R
  }

  actions {
    action plan(families: option list String, targets: option list String, force: Bool) {
      -> ok(run: R, steps: list {
        stepKey: String,
        generator: String,
        family: String,
        inputKind: String,
        outputKind: String,
        willRun: Bool,
        reason: String
      }) {
        Query PluginRegistry/getDefinitions for all generators
        of type "generator". Filter by families/targets if provided.
        Query KindSystem/graph for topology and execution ordering.
        Query BuildCache/staleSteps for cache status.

        Returns the plan: what would run, what's cached, what
        the execution order would be, and why each step will
        or won't run.

        Does NOT trigger generation. Read-only analysis.

        Reasons: "input changed", "cached — skip",
        "dependency stale", "forced", "filtered out",
        "no cache entry — first run".
      }
      -> empty(message: String) {
        No generators registered, or all filtered out by
        family/target constraints.
      }
    }

    action begin() {
      -> ok(run: R) {
        Mark a new run as started. Called when `clef generate`
        begins, before the entry-point action is triggered.
        Sets activeRun. Subsequent recordStep calls associate
        with this run.
      }
    }

    action recordStep(stepKey: String, status: String, filesProduced: option Int, duration: option Int, cached: Bool) {
      -> ok() {
        Record a step's outcome. Called by observer syncs that
        watch generator completions, cache hits, Emitter writes,
        and errors.

        Statuses: "running", "done", "cached", "failed", "skipped".

        This is the only action called during execution, and it
        is called by observer syncs — never by generators themselves
        and never in the execution path. If GenerationPlan is down,
        generation proceeds normally; only status tracking is lost.
      }
    }

    action complete() {
      -> ok(run: R) {
        Mark the active run as complete. Called when all pipeline
        syncs have quiesced. Clears activeRun.
      }
    }

    action status(run: R) {
      -> ok(steps: list { stepKey: String, status: String, duration: Int, cached: Bool, filesProduced: Int }) {
        Return current execution status for all steps in a run.
      }
    }

    action summary(run: R) {
      -> ok(total: Int, executed: Int, cached: Int, failed: Int, totalDuration: Int, filesProduced: Int) {
        Return summary statistics for a completed run.
        Used by CLI post-run reporting.
      }
    }

    action diff(families: option list String, targets: option list String) {
      -> ok(changes: list { path: String, changeType: String }) {
        Compare what generation would produce against what's on
        disk. Does not write. Used for --dry-run.

        Queries Emitter/manifest for current file state. For
        deterministic/pure generators, can compute would-be
        output. For effectful generators, shows
        "would execute (side effect)".

        changeType: "add", "modify", "remove".
      }
    }

    action history(limit: option Int) {
      -> ok(runs: list { run: R, startedAt: DateTime, completedAt: option DateTime, total: Int, executed: Int, cached: Int, failed: Int }) {
        Return recent generation runs. Used by `clef generate --history`.
      }
    }
  }
}
```

### 1.5 Emitter

Materializes generated content as files. Content-addressed: same content produces same hash, skip-write preserves timestamps. Handles formatting, directory structure, orphan cleanup, source traceability, and drift detection.

**Promoted from Clef Bind to generation suite.** Every generation family needs content-addressed file emission — not just interface generation.

**Independent purpose test:** "What files were generated? What source produced this file? Has anyone hand-edited generated output? What orphans should be cleaned?" — useful for build output management.

```
@version(1)
concept Emitter [F] {

  purpose {
    Materialize generated content as files. Content-addressed:
    same input produces same hash, skip-write preserves timestamps.
    Handles formatting, directory structure, orphan cleanup,
    source traceability, and drift detection.
  }

  state {
    manifest: F -> {
      path: String
      contentHash: String
      written: Bool
      lastWritten: DateTime
    }
    formatters: String -> String
    sourceMap: F -> list {
      sourcePath: String
      sourceRange: option String
      conceptName: option String
      actionName: option String
    }
  }

  actions {
    action write(path: String, content: String, formatHint: option String, sources: option list { sourcePath: String, sourceRange: option String, conceptName: option String, actionName: option String }) {
      -> ok(written: Bool, path: String, contentHash: String) {
        Compute content hash. Compare against manifest.
        If unchanged, skip write (written: false).
        If changed or new, write file (written: true).
        Update manifest with new hash and timestamp.

        If sources is provided, record in sourceMap for
        traceability. Generators that know provenance pass it;
        generators that don't, don't.
      }
      -> error(message: String, path: String) {
        Write failed (permissions, disk full, invalid path).
      }
    }

    action writeBatch(files: list { path: String, content: String, formatHint: option String, sources: option list { sourcePath: String, sourceRange: option String, conceptName: option String, actionName: option String } }) {
      -> ok(results: list { path: String, written: Bool, contentHash: String }) {
        Write multiple files atomically. If any file fails,
        none are written. Returns per-file results.
        More efficient — single manifest update, single format pass.
      }
      -> error(message: String, failedPath: String) {
        Batch write failed. No files were written.
      }
    }

    action format(path: String) {
      -> ok(changed: Bool) {
        Apply configured formatter (prettier, black, gofmt, rustfmt,
        buf format) based on file extension. No-op if no formatter
        configured for this extension.
      }
      -> error(message: String) {
        Formatter failed.
      }
    }

    action clean(outputDir: String, currentManifest: list String) {
      -> ok(removed: list String) {
        Remove files in outputDir that are NOT in currentManifest.
        These are orphans from previous generations. Only removes
        files tracked in the Emitter manifest — never removes
        files that weren't generated by the system.
      }
    }

    action manifest(outputDir: String) {
      -> ok(files: list { path: String, hash: String, lastWritten: DateTime }) {
        Return the current output manifest for an output directory.
        Used by dry-run, status, and diff commands.
      }
    }

    action trace(outputPath: String) {
      -> ok(sources: list { sourcePath: String, sourceRange: option String, conceptName: option String, actionName: option String }) {
        Return all source elements that contributed to this
        output file. Enables "which spec produced this generated
        code?" queries.
      }
      -> notFound(path: String) {
        Output path not in manifest.
      }
    }

    action affected(sourcePath: String) {
      -> ok(outputs: list String) {
        Return all output files whose sourceMap includes this
        source path. Enables "what regenerates if I change this
        spec?" queries.
      }
    }

    action audit(outputDir: String) {
      -> ok(status: list {
        path: String
        state: String
        expectedHash: option String
        actualHash: option String
      }) {
        Compare manifest against filesystem for drift detection.

        States:
        "current" — file exists, hash matches manifest.
        "drifted" — file exists, hash differs (manually edited).
        "missing" — in manifest but not on disk.
        "orphaned" — on disk in a generated dir but not in manifest.
      }
    }
  }

  invariant {
    after write(path: "src/password.ts", content: "...", formatHint: "typescript", sources: []) -> ok(written: true, path: "src/password.ts", contentHash: "abc")
    then  write(path: "src/password.ts", content: "...", formatHint: "typescript", sources: []) -> ok(written: false, path: "src/password.ts", contentHash: "abc")

    after write(path: "src/password.ts", content: "...", formatHint: "typescript", sources: [{ sourcePath: "./specs/password.concept" }]) -> ok(written: true, path: p, contentHash: h)
    then  trace(outputPath: "src/password.ts") -> ok(sources: s)
    and   affected(sourcePath: "./specs/password.concept") -> ok(outputs: o)
  }
}
```

---

## Part 2: Syncs

### 2.1 Input Tracking

FileWatcher events → Resource upserts. This replaces bespoke file-change logic.

```
sync FileChanged [eager]
  purpose { Translate filesystem events into Resource upserts. }
when {
  FileWatcher/detected: [ path: ?path; hash: ?hash; event: "create" ]
    => []
}
where {
  bind(kindFromExtension(?path) as ?kind)
}
then {
  Resource/upsert: [ locator: ?path; kind: ?kind; digest: ?hash ]
}
```

```
sync FileModified [eager]
  purpose { Translate file modification into Resource upsert. }
when {
  FileWatcher/detected: [ path: ?path; hash: ?hash; event: "modify" ]
    => []
}
where {
  bind(kindFromExtension(?path) as ?kind)
}
then {
  Resource/upsert: [ locator: ?path; kind: ?kind; digest: ?hash ]
}
```

```
sync FileRemoved [eager]
  purpose { Track file deletions. }
when {
  FileWatcher/detected: [ path: ?path; event: "delete" ]
    => []
}
then {
  Resource/remove: [ locator: ?path ]
}
```

### 2.2 Kind Registration via PluginRegistry

Generators register with PluginRegistry. A single sync auto-populates KindSystem edges from those registrations. No generator ever calls KindSystem directly.

```
sync RegisterGeneratorKinds [eager]
  purpose { Auto-populate KindSystem edges from PluginRegistry generator registrations. }
when {
  PluginRegistry/register: [
    type: "generator";
    metadata: ?meta
  ] => ok(plugin: ?p)
}
where {
  bind(?meta.inputKind as ?inputKind)
  bind(?meta.outputKind as ?outputKind)
  bind(?meta.name as ?transformName)
}
then {
  KindSystem/connect: [
    from: ?inputKind;
    to: ?outputKind;
    relation: "renders_to";
    transformName: ?transformName
  ]
}
```

> **Note:** KindSystem/define for each kind must happen before KindSystem/connect. The standard kind taxonomy (ConceptDSL, ConceptAST, ConceptManifest, etc.) is registered at kit load time via bootstrap syncs. Generator-specific artifact kinds (TypeScriptFiles, RestRoutes, etc.) are defined in the same registration flow — the PluginRegistry metadata includes `inputKind` and `outputKind` as string names, and the sync above auto-creates edges. A companion sync ensures the kinds exist:

```
sync EnsureKindsDefined [eager]
  purpose { Auto-define kinds referenced by generator registrations. }
when {
  PluginRegistry/register: [
    type: "generator";
    metadata: ?meta
  ] => ok(plugin: ?p)
}
where {
  bind(?meta.outputKind as ?outputKind)
}
then {
  KindSystem/define: [ name: ?outputKind; category: "artifact" ]
}
```

### 2.3 Change Propagation

When a source changes, cascade invalidation through BuildCache using KindSystem topology.

```
sync InvalidateOnResourceChange [eager]
  purpose { Source change triggers direct cache invalidation. }
when {
  Resource/upsert: [ locator: ?loc; kind: ?kind ]
    => changed(resource: ?r; previousDigest: ?prev)
}
then {
  BuildCache/invalidateBySource: [ sourceLocator: ?loc ]
}
```

```
sync CascadeInvalidation [eager]
  purpose { After direct invalidation, find downstream kinds via KindSystem. }
when {
  BuildCache/invalidateBySource: [ sourceLocator: ?loc ]
    => ok(invalidated: ?steps)
}
where {
  bind(kindFromSourceLocator(?loc) as ?kind)
}
then {
  KindSystem/dependents: [ kind: ?kind ]
}
```

```
sync InvalidateDependentKinds [eager]
  purpose { Invalidate cache entries for all downstream kinds. }
when {
  KindSystem/dependents: [ kind: ?kind ]
    => ok(downstream: ?kinds)
}
then {
  BuildCache/invalidateByKind: [ kindName: ?kinds ]
}
```

```
sync InvalidateOnResourceRemove [eager]
  purpose { When a source file is deleted, invalidate its cache entries. }
when {
  Resource/remove: [ locator: ?loc ]
    => ok(resource: ?r)
}
then {
  BuildCache/invalidateBySource: [ sourceLocator: ?loc ]
}
```

### 2.4 Cache-Check Wrappers

This is the core pattern that makes BuildCache work without GenerationPlan dispatching. Each generator's existing trigger sync is replaced by a two-sync pair: (1) check cache, (2) generate on miss. The sync engine handles the branching via variant matching.

**Pattern template (one pair per generator):**

```
# Sync 1: Check cache before generating
sync CheckCacheBefore{Generator} [eager]
  purpose { Intercept trigger and check cache before {Generator} runs. }
when {
  {UpstreamConcept}/{upstreamAction}: [ {fields} ]
    => ok({outputFields including ?inputData})
}
where {
  bind(hash(?inputData) as ?inputHash)
  bind("{family}:{Generator}:{target}" as ?stepKey)
}
then {
  BuildCache/check: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    deterministic: {true|false}
  ]
}

# Sync 2: Generate on cache miss only
sync {Generator}OnCacheMiss [eager]
  purpose { Run {Generator} only when cache reports changed. }
when {
  {UpstreamConcept}/{upstreamAction}: [ {fields} ]
    => ok({outputFields including ?inputData})
  BuildCache/check: [ stepKey: ?stepKey ]
    => changed(previousHash: ?prev)
}
where {
  # stepKey must match the pattern from Sync 1
  bind("{family}:{Generator}:{target}" as ?expectedKey)
  guard(?stepKey == ?expectedKey)
}
then {
  {Generator}/generate: [ {generatorInputs} ]
}
```

**Framework family — concrete examples:**

```
# TypeScriptGen cache-check wrapper
sync CheckCacheBeforeTypeScriptGen [eager]
  purpose { Check cache before TypeScriptGen runs. }
when {
  SchemaGen/generate: [ spec: ?spec ]
    => ok(manifest: ?manifest)
}
where {
  bind(hash(?manifest) as ?inputHash)
  bind(concat("framework:TypeScriptGen:", ?spec) as ?stepKey)
}
then {
  BuildCache/check: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    deterministic: true
  ]
}

sync TypeScriptGenOnCacheMiss [eager]
  purpose { Run TypeScriptGen only on cache miss. }
when {
  SchemaGen/generate: [ spec: ?spec ]
    => ok(manifest: ?manifest)
  BuildCache/check: [ stepKey: ?stepKey ]
    => changed(previousHash: ?prev)
}
where {
  bind(concat("framework:TypeScriptGen:", ?spec) as ?expectedKey)
  guard(?stepKey == ?expectedKey)
}
then {
  TypeScriptGen/generate: [ spec: ?spec; manifest: ?manifest ]
}
```

```
# RustGen cache-check wrapper
sync CheckCacheBeforeRustGen [eager]
  purpose { Check cache before RustGen runs. }
when {
  SchemaGen/generate: [ spec: ?spec ]
    => ok(manifest: ?manifest)
}
where {
  bind(hash(?manifest) as ?inputHash)
  bind(concat("framework:RustGen:", ?spec) as ?stepKey)
}
then {
  BuildCache/check: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    deterministic: true
  ]
}

sync RustGenOnCacheMiss [eager]
  purpose { Run RustGen only on cache miss. }
when {
  SchemaGen/generate: [ spec: ?spec ]
    => ok(manifest: ?manifest)
  BuildCache/check: [ stepKey: ?stepKey ]
    => changed(previousHash: ?prev)
}
where {
  bind(concat("framework:RustGen:", ?spec) as ?expectedKey)
  guard(?stepKey == ?expectedKey)
}
then {
  RustGen/generate: [ spec: ?spec; manifest: ?manifest ]
}
```

**Interface family — concrete example:**

```
# RestTarget cache-check wrapper
sync CheckCacheBeforeRestTarget [eager]
  purpose { Check cache before RestTarget runs. }
when {
  Projection/project: [ concept: ?concept ]
    => ok(projection: ?projection)
}
where {
  bind(hash(?projection) as ?inputHash)
  bind(concat("interface:RestTarget:", ?concept) as ?stepKey)
}
then {
  BuildCache/check: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    deterministic: true
  ]
}

sync RestTargetOnCacheMiss [eager]
  purpose { Run RestTarget only on cache miss. }
when {
  Projection/project: [ concept: ?concept ]
    => ok(projection: ?projection)
  BuildCache/check: [ stepKey: ?stepKey ]
    => changed(previousHash: ?prev)
}
where {
  bind(concat("interface:RestTarget:", ?concept) as ?expectedKey)
  guard(?stepKey == ?expectedKey)
}
then {
  RestTarget/generate: [ projection: ?projection ]
}
```

*(Same pattern for every generator: GraphqlTarget, GrpcTarget, CliTarget, McpTarget, OpenApiTarget, TsSdkTarget, TfProvider, PulumiProvider, etc.)*

> **Note for implementers:** These cache-check wrappers are mechanical — identical pattern, two syncs per generator. They can be auto-generated: `clef generate --cache-syncs` reads PluginRegistry and emits `generated/syncs/cache-check-{name}.sync` and `generated/syncs/{name}-on-miss.sync` for each registered generator.

### 2.5 Output: Generator → Emitter

After any generator completes with files, pipe output through shared Emitter. One such sync per generator that produces file output.

```
sync EmitTypeScriptFiles [eager]
  purpose { Route TypeScriptGen file output through Emitter. }
when {
  TypeScriptGen/generate: [ spec: ?spec ]
    => ok(files: ?files)
}
then {
  Emitter/writeBatch: [ files: ?files ]
}
```

```
sync EmitRustFiles [eager]
  purpose { Route RustGen file output through Emitter. }
when {
  RustGen/generate: [ spec: ?spec ]
    => ok(files: ?files)
}
then {
  Emitter/writeBatch: [ files: ?files ]
}
```

```
sync EmitRestTargetFiles [eager]
  purpose { Route RestTarget file output through Emitter. }
when {
  RestTarget/generate: [ projection: ?proj ]
    => ok(files: ?files)
}
then {
  Emitter/writeBatch: [ files: ?files ]
}
```

*(Same pattern for every file-producing generator.)*

### 2.6 Post-Write: Format and Record Cache

```
sync FormatAfterWrite [eager]
  purpose { Apply language-specific formatting after each file write. }
when {
  Emitter/write: [ path: ?path; formatHint: ?hint ]
    => ok(written: true)
}
then {
  Emitter/format: [ path: ?path ]
}
```

```
sync FormatBatchAfterWrite [eager]
  purpose { Format all files after batch write. }
when {
  Emitter/writeBatch: []
    => ok(results: ?results)
}
then {
  # Format each written file
  # Implementation: iterate results where written=true, call format
  Emitter/format: [ paths: writtenPaths(?results) ]
}
```

```
sync RecordCacheAfterTypeScriptGen [eager]
  purpose { Record TypeScriptGen success in BuildCache. }
when {
  TypeScriptGen/generate: [ spec: ?spec ]
    => ok(files: ?files)
  Emitter/writeBatch: []
    => ok(results: ?results)
}
where {
  bind(hash(?files) as ?outputHash)
  bind(concat("framework:TypeScriptGen:", ?spec) as ?stepKey)
}
then {
  BuildCache/record: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    outputHash: ?outputHash;
    sourceLocator: specLocator(?spec);
    deterministic: true
  ]
}
```

*(Same pattern per generator — record cache after Emitter confirms write.)*

### 2.7 GenerationPlan Observer Syncs

These syncs feed GenerationPlan passively. They watch completions from generators, cache hits, and Emitter writes. If GenerationPlan is down, generation proceeds normally — only status tracking is lost.

```
sync ObserveRunBegin [eager]
  purpose { Mark a generation run as started. }
when {
  # Triggered by CLI clef generate command
  CliCommand/generate: []
    => []
}
then {
  GenerationPlan/begin: []
}
```

```
sync ObserveCacheHit [eager]
  purpose { Record cache hits in GenerationPlan. }
when {
  BuildCache/check: [ stepKey: ?stepKey ]
    => unchanged(lastRun: ?t)
}
then {
  GenerationPlan/recordStep: [
    stepKey: ?stepKey;
    status: "cached";
    cached: true
  ]
}
```

```
sync ObserveGeneratorComplete [eager]
  purpose { Record generator completion in GenerationPlan. }
when {
  TypeScriptGen/generate: [ spec: ?spec ]
    => ok(files: ?files)
}
then {
  GenerationPlan/recordStep: [
    stepKey: concat("framework:TypeScriptGen:", ?spec);
    status: "done";
    filesProduced: count(?files);
    cached: false
  ]
}
```

```
sync ObserveGeneratorFailed [eager]
  purpose { Record generator failure in GenerationPlan. }
when {
  TypeScriptGen/generate: []
    => error(message: ?msg)
}
then {
  GenerationPlan/recordStep: [
    stepKey: ?stepKey;
    status: "failed";
    cached: false
  ]
}
```

*(Observer syncs for each generator — mechanical, same pattern.)*

```
sync ObserveRunComplete [eager]
  purpose { Mark a generation run as complete when pipeline quiesces. }
when {
  # Triggered when sync engine reports quiescence
  SyncEngine/quiesced: []
    => []
}
where {
  GenerationPlan: { activeRun: ?run }
}
then {
  GenerationPlan/complete: []
}
```

### 2.8 Orphan Cleanup

```
sync CleanOrphansAfterRun [eager]
  purpose { Remove orphaned files after a complete generation run. }
when {
  GenerationPlan/complete: []
    => ok(run: ?run)
}
then {
  Emitter/clean: [ outputDir: "./generated"; currentManifest: currentPaths() ]
}
```

---

## Part 3: Generator Registration

Each generator concept needs a lightweight `register` action that returns metadata for PluginRegistry. This is the only change to existing generator concepts. Generators never interact with KindSystem or GenerationPlan directly — PluginRegistry is the single registration point, and syncs propagate metadata to other kit concepts.

### Registration action (added to each generator)

```
# Added to TypeScriptGen, RustGen, RestTarget, etc.
action register() {
  -> ok(
    name: String,
    family: String,
    inputKind: String,
    outputKind: String,
    deterministic: Bool,
    pure: Bool
  ) {
    Return static metadata about this generator.

    Example for TypeScriptGen:
      name: "TypeScriptGen"
      family: "framework"
      inputKind: "ConceptManifest"
      outputKind: "TypeScriptFiles"
      deterministic: true (same input → same output)
      pure: true (no external side effects)

    Example for RestTarget:
      name: "RestTarget"
      family: "interface"
      inputKind: "Projection"
      outputKind: "RestRoutes"
      deterministic: true
      pure: true
  }
}
```

### Registration sync (one per generator)

```
sync RegisterTypeScriptGen [eager]
  purpose { Register TypeScriptGen with PluginRegistry for discovery. }
when {
  TypeScriptGen/register: []
    => ok(name: ?name; family: ?family; inputKind: ?ik; outputKind: ?ok; deterministic: ?det; pure: ?pure)
}
then {
  PluginRegistry/register: [
    type: "generator";
    name: ?name;
    metadata: {
      family: ?family;
      inputKind: ?ik;
      outputKind: ?ok;
      concept: "TypeScriptGen";
      action: "generate";
      deterministic: ?det;
      pure: ?pure
    }
  ]
}
```

### Registration flow

```
Generator/register → ok(metadata)
       │
       ▼ (registration sync)
PluginRegistry/register → ok(plugin)
       │
       ├──▶ KindSystem/define (ensure kinds exist)     ← EnsureKindsDefined sync
       │
       └──▶ KindSystem/connect (create topology edge)  ← RegisterGeneratorKinds sync

# Result: GenerationPlan can now discover this generator via
# PluginRegistry/getDefinitions, and KindSystem knows its
# place in the pipeline topology.
```

### Registration metadata fields

| Field | Type | Purpose | Consumed by |
|---|---|---|---|
| `name` | String | Generator identity | PluginRegistry (lookup), GenerationPlan (display) |
| `family` | String | Which generation family | GenerationPlan (filtering), `clef generate --family` |
| `inputKind` | String | What IR kind this consumes | KindSystem (edge source), BuildCache (step key) |
| `outputKind` | String | What artifact kind this produces | KindSystem (edge target) |
| `deterministic` | Bool | Same input → same output | BuildCache (cache-hit policy) |
| `pure` | Bool | No external side effects | GenerationPlan/diff (dry-run safety) |
| `concept` | String | Which Clef concept implements this | Documentation, analysis |
| `action` | String | Which action to invoke | Documentation, analysis |

---

## Part 4: Kit Packaging

```yaml
# kits/generation/suite.yaml
kit:
  name: generation
  version: 0.1.0
  description: >
    Shared generation infrastructure for all Clef generation families.
    Provides input tracking, pipeline topology, incremental build caching,
    content-addressed file emission, traceability, drift detection, and
    unified run reporting.

concepts:
  Resource:
    spec: ./resource.concept
    params:
      R: { as: resource-ref, description: "Reference to a tracked input resource" }

  KindSystem:
    spec: ./kind-system.concept
    params:
      K: { as: kind-ref, description: "Reference to an IR/artifact kind" }

  BuildCache:
    spec: ./build-cache.concept
    params:
      E: { as: cache-entry-ref, description: "Reference to a cache entry" }

  GenerationPlan:
    spec: ./generation-plan.concept
    params:
      R: { as: run-ref, description: "Reference to a generation run" }

  Emitter:
    spec: ./emitter.concept
    params:
      F: { as: file-ref, description: "Reference to an output file entry" }

syncs:
  required:
    - path: ./syncs/file-changed.sync
      description: "FileWatcher create → Resource/upsert"

    - path: ./syncs/file-modified.sync
      description: "FileWatcher modify → Resource/upsert"

    - path: ./syncs/file-removed.sync
      description: "FileWatcher delete → Resource/remove"

    - path: ./syncs/register-generator-kinds.sync
      description: "PluginRegistry registration → KindSystem/connect"

    - path: ./syncs/ensure-kinds-defined.sync
      description: "PluginRegistry registration → KindSystem/define"

    - path: ./syncs/format-after-write.sync
      description: "Emitter/write → Emitter/format"

  recommended:
    - path: ./syncs/invalidate-on-resource-change.sync
      name: InvalidateOnResourceChange
      description: "Resource/changed → BuildCache/invalidateBySource"

    - path: ./syncs/cascade-invalidation.sync
      name: CascadeInvalidation
      description: "BuildCache invalidation → KindSystem/dependents"

    - path: ./syncs/invalidate-dependent-kinds.sync
      name: InvalidateDependentKinds
      description: "KindSystem/dependents → BuildCache/invalidateByKind"

    - path: ./syncs/invalidate-on-resource-remove.sync
      name: InvalidateOnResourceRemove
      description: "Resource/remove → BuildCache/invalidateBySource"

    - path: ./syncs/observe-cache-hit.sync
      name: ObserveCacheHit
      description: "BuildCache/unchanged → GenerationPlan/recordStep(cached)"

    - path: ./syncs/observe-run-begin.sync
      name: ObserveRunBegin
      description: "CLI generate → GenerationPlan/begin"

    - path: ./syncs/observe-run-complete.sync
      name: ObserveRunComplete
      description: "SyncEngine quiesced → GenerationPlan/complete"

    - path: ./syncs/clean-orphans-after-run.sync
      name: CleanOrphansAfterRun
      description: "GenerationPlan/complete → Emitter/clean"

  # Per-generator syncs (cache-check wrappers, output routing,
  # observer syncs, registration syncs) live in each family's
  # kit because they name family-specific concepts.

uses:
  - kit: infrastructure
    concepts:
      - name: PluginRegistry
```

### Directory structure

```
kits/generation/
├── suite.yaml
├── resource.concept
├── kind-system.concept
├── build-cache.concept
├── generation-plan.concept
├── emitter.concept
├── syncs/
│   ├── file-changed.sync                      # required
│   ├── file-modified.sync                     # required
│   ├── file-removed.sync                      # required
│   ├── register-generator-kinds.sync          # required
│   ├── ensure-kinds-defined.sync              # required
│   ├── format-after-write.sync                # required
│   ├── invalidate-on-resource-change.sync     # recommended
│   ├── invalidate-on-resource-remove.sync     # recommended
│   ├── cascade-invalidation.sync              # recommended
│   ├── invalidate-dependent-kinds.sync        # recommended
│   ├── observe-cache-hit.sync                 # recommended
│   ├── observe-run-begin.sync                 # recommended
│   ├── observe-run-complete.sync              # recommended
│   └── clean-orphans-after-run.sync           # recommended
├── implementations/
│   └── typescript/
│       ├── resource.impl.ts
│       ├── kind-system.impl.ts
│       ├── build-cache.impl.ts
│       ├── generation-plan.impl.ts
│       └── emitter.impl.ts
└── tests/
    ├── conformance/
    │   ├── resource.test.ts
    │   ├── kind-system.test.ts
    │   ├── build-cache.test.ts
    │   ├── generation-plan.test.ts
    │   └── emitter.test.ts
    └── integration/
        ├── incremental-rebuild.test.ts
        ├── cascade-invalidation.test.ts
        ├── multi-family-generation.test.ts
        └── orphan-cleanup.test.ts
```

---

## Part 5: Per-Family Integration

### 5.1 Framework Family

**Changes to existing concepts:**

- TypeScriptGen, RustGen, SwiftGen, SolidityGen: add `register` action (5 lines each)
- TypeScriptGen, RustGen: return `{ files }` from `generate` instead of writing directly (Emitter handles writes)
- CacheCompiler: caching concern migrates to BuildCache; precompilation concern stays or retires

**Existing pipeline syncs are REPLACED by cache-aware versions:**

The sync `GenerateTypeScript` that currently says:
```
when { SchemaGen/generate → ok(manifest) }
then { TypeScriptGen/generate }
```

Is replaced by the two-sync cache-check wrapper:
```
CheckCacheBeforeTypeScriptGen + TypeScriptGenOnCacheMiss
```

Everything else (SpecParser → SchemaGen chain, SchemaGen internals) is unchanged.

**New syncs in kits/framework/:**

```yaml
# kits/framework/suite.yaml (updated)
kit:
  name: framework
  version: 0.x.0

uses:
  - kit: generation
    concepts:
      - name: Emitter
      - name: BuildCache
      - name: GenerationPlan

syncs:
  integration:
    # Registration (one per generator)
    - path: ./syncs/register-typescript-gen.sync
    - path: ./syncs/register-rust-gen.sync

    # Cache-check wrappers (two per generator)
    - path: ./syncs/cache-check-before-typescript-gen.sync
    - path: ./syncs/typescript-gen-on-miss.sync
    - path: ./syncs/cache-check-before-rust-gen.sync
    - path: ./syncs/rust-gen-on-miss.sync

    # Output routing (one per generator)
    - path: ./syncs/emit-typescript-files.sync
    - path: ./syncs/emit-rust-files.sync

    # Cache recording (one per generator)
    - path: ./syncs/record-cache-typescript-gen.sync
    - path: ./syncs/record-cache-rust-gen.sync

    # Observer syncs (one per generator for GenerationPlan)
    - path: ./syncs/observe-typescript-gen.sync
    - path: ./syncs/observe-rust-gen.sync
```

**Sync count per generator:** 6 syncs (1 registration, 2 cache-check, 1 output, 1 cache-record, 1 observer). Mechanical, auto-generatable.

### 5.2 Interface Family

**Changes to existing concepts:**

- Emitter moves to generation suite (shared) — Clef Bind imports via `uses:`
- All target providers: add `register` action
- Generator concept: unchanged (it coordinates interface-specific orchestration, which is different from GenerationPlan's cross-family planning)

**Internal sync chains stay exactly as designed.** The Clef Bind's Projection → Generator → Target → RestTarget → Middleware → Emitter → Surface chain is unchanged. BuildCache wraps each target provider via cache-check syncs.

```yaml
# kits/interface/suite.yaml (updated)
kit:
  name: interface
  version: 0.2.0

uses:
  - kit: generation
    concepts:
      - name: Emitter        # shared, no longer local
      - name: BuildCache
      - name: GenerationPlan

syncs:
  integration:
    # Registration (one per target provider)
    - path: ./syncs/register-rest-target.sync
    - path: ./syncs/register-graphql-target.sync
    - path: ./syncs/register-grpc-target.sync
    - path: ./syncs/register-cli-target.sync
    - path: ./syncs/register-mcp-target.sync
    - path: ./syncs/register-openapi-target.sync
    - path: ./syncs/register-asyncapi-target.sync
    - path: ./syncs/register-ts-sdk-target.sync
    - path: ./syncs/register-py-sdk-target.sync

    # Cache-check wrappers (two per target provider)
    - path: ./syncs/cache-check-before-rest-target.sync
    - path: ./syncs/rest-target-on-miss.sync
    # ... same pattern for each target

    # Output routing (one per target provider)
    - path: ./syncs/emit-rest-target-files.sync
    # ... same pattern for each target

    # Cache recording (one per target provider)
    - path: ./syncs/record-cache-rest-target.sync
    # ... same pattern for each target

    # Observer syncs (one per target provider)
    - path: ./syncs/observe-rest-target.sync
    # ... same pattern for each target
```

### 5.3 Deploy Family

Same pattern. IaC and GitOps provider output pipes through shared Emitter.

```yaml
# kits/deploy/suite.yaml (updated)
kit:
  name: deploy
  version: 0.x.0

uses:
  - kit: generation
    concepts:
      - name: Emitter
      - name: BuildCache
      - name: GenerationPlan

syncs:
  integration:
    - path: ./syncs/register-tf-provider.sync
    - path: ./syncs/register-pulumi-provider.sync
    - path: ./syncs/cache-check-before-tf-provider.sync
    - path: ./syncs/tf-provider-on-miss.sync
    - path: ./syncs/emit-tf-files.sync
    - path: ./syncs/record-cache-tf-provider.sync
    - path: ./syncs/observe-tf-provider.sync
    # ... same pattern for PulumiProvider, ArgoProvider, etc.
```

### 5.4 Auxiliary Generation

JWT, MediaAsset, Palette, Elevation, Pathauto — these do NOT use the generation suite. They're standalone transformations that produce values (not files), don't need caching, and don't need orchestration. They remain exactly as they are.

---

## Part 6: CLI Integration

GenerationPlan's passive planning + status tracking enables a unified CLI. `clef generate` triggers the pipeline entry point (SpecParser/parse, etc.) and the sync engine runs everything. GenerationPlan observes and reports.

```bash
# Plan: show what would run (read-only, does not trigger generation)
clef generate --plan
#   ┌─ ConceptDSL
#   ├──▶ ConceptAST (SpecParser) — will run: input changed
#   ├──▶ ConceptManifest (SchemaGen) — will run: dependency stale
#   │    ├──▶ TypeScriptFiles (TypeScriptGen) — will run: dependency stale
#   │    ├──▶ RustFiles (RustGen) — cached, skip
#   │    └──▶ Projection (Projection) — will run: dependency stale
#   │         ├──▶ RestRoutes (RestTarget) — will run: dependency stale
#   │         ├──▶ CliCommands (CliTarget) — will run: dependency stale
#   │         └──▶ OpenApiDoc (OpenApiTarget) — will run: dependency stale
#   └─ DeployManifest
#        └──▶ TerraformModule (TfProvider) — cached, skip
#
#   Steps: 9 total, 2 cached, 7 to execute

# Execute all (sync engine drives, BuildCache skips cached steps)
clef generate

# Execute one family (only trigger that family's entry points)
clef generate --family framework
clef generate --family interface
clef generate --family deploy

# Execute specific generators
clef generate --target TypeScriptGen
clef generate --target RestTarget,CliTarget

# Dry-run (show diff without writing)
clef generate --dry-run

# Force full rebuild (BuildCache/invalidateAll before triggering)
clef generate --force

# Status of a running generation
clef generate --status

# Run summary (after completion)
clef generate --summary
#   Run #42: 7 executed, 2 cached, 0 failed
#   Duration: 1.2s | Files: 23 written, 8 unchanged
#   Fastest: RustGen (12ms) | Slowest: RestTarget (340ms)

# History
clef generate --history
#   #42  2026-02-24 14:30  7 executed  2 cached  0 failed  1.2s
#   #41  2026-02-24 14:15  2 executed  7 cached  0 failed  0.3s
#   #40  2026-02-24 13:00  9 executed  0 cached  1 failed  2.1s

# Audit generated files for drift
clef generate --audit
#   src/password.ts — current
#   src/user.ts — DRIFTED (manually edited)
#   src/old-concept.ts — orphaned

# Clean orphaned files
clef generate --clean

# Trace: what source produced this file?
clef trace src/password.ts
#   Sources:
#   - ./specs/password.concept (lines 1-45)
#   - Generated by: TypeScriptGen

# Impact: what regenerates if I change this?
clef impact ./specs/password.concept
#   Affected outputs:
#   - src/password.ts (TypeScriptGen)
#   - api/routes/password.ts (RestTarget)
#   - cli/commands/password.ts (CliTarget)
#   - docs/openapi/password.yaml (OpenApiTarget)

# Kind system queries
clef kinds list
clef kinds path ConceptDSL OpenApiDoc
clef kinds consumers ConceptManifest
clef kinds producers Projection
```

---

## Part 7: The "Add a New Generator" Workflow

### Before (current architecture)

1. Write the generator concept spec (`kotlin-gen.concept`)
2. Write the generator implementation (`kotlin-gen.impl.ts`)
3. Write one sync wiring it to SchemaGen output
4. Done — but: no caching, no shared orchestration, no status tracking, no dry-run, no traceability, files written directly

### After (with generation suite)

1. Write the generator concept spec (`kotlin-gen.concept`) — **same as before**, plus add `register` action (5 lines)
2. Write the generator implementation — **same as before**, but return `{ files }` instead of writing directly
3. Write six syncs (mechanical, identical pattern, auto-generatable):

```
# 1. Registration: register with PluginRegistry
sync RegisterKotlinGen [eager]
when { KotlinGen/register → ok(...) }
then { PluginRegistry/register [type: "generator", name: "KotlinGen", ...] }

# 2. Cache check: intercept SchemaGen trigger
sync CheckCacheBeforeKotlinGen [eager]
when { SchemaGen/generate → ok(manifest) }
then { BuildCache/check [stepKey: "framework:KotlinGen:...", ...] }

# 3. Generate on miss: run only when cache reports changed
sync KotlinGenOnCacheMiss [eager]
when { SchemaGen/generate → ok(manifest) AND BuildCache/check → changed() }
then { KotlinGen/generate [manifest] }

# 4. Output: pipe files through Emitter
sync EmitKotlinFiles [eager]
when { KotlinGen/generate → ok(files) }
then { Emitter/writeBatch [files] }

# 5. Cache record: save result for next run
sync RecordCacheKotlinGen [eager]
when { KotlinGen/generate → ok(files) AND Emitter/writeBatch → ok(results) }
then { BuildCache/record [stepKey, inputHash, outputHash, ...] }

# 6. Observer: feed GenerationPlan for reporting
sync ObserveKotlinGen [eager]
when { KotlinGen/generate → ok(files) }
then { GenerationPlan/recordStep [stepKey, status: "done", ...] }
```

4. Done — and you **automatically get**:
   - Caching (BuildCache skips if ConceptManifest unchanged)
   - Content-addressed emission (Emitter handles writes, formatting, orphan cleanup)
   - Topology (KindSystem knows ConceptManifest → KotlinFiles via PluginRegistry)
   - Cascading invalidation (change password.concept → KotlinGen re-runs)
   - Dry-run (`clef generate --dry-run` includes this target)
   - Status tracking (`clef generate --status` shows this target)
   - Traceability (`clef trace` and `clef impact` include this generator's outputs)
   - Drift detection (`clef generate --audit` checks this generator's files)
   - Plan visualization (`clef generate --plan` shows this in the dependency graph)
   - History (`clef generate --history` includes this target's run data)

### Auto-generating per-generator syncs

The six syncs per generator follow an identical pattern. A meta-generator can produce them:

```bash
clef generate --generator-syncs
# Reads PluginRegistry, emits for each registered generator:
#   generated/syncs/register-{name}.sync
#   generated/syncs/cache-check-before-{name}.sync
#   generated/syncs/{name}-on-miss.sync
#   generated/syncs/emit-{name}-files.sync
#   generated/syncs/record-cache-{name}.sync
#   generated/syncs/observe-{name}.sync
```

This reduces the "add a generator" workflow to:

1. Write the concept spec + implementation (with `register` action and `{ files }` return)
2. Run `clef generate --generator-syncs`

---

## Part 8: Design Decisions

### Why GenerationPlan is passive, not an orchestrator

**The sync engine already orchestrates.** It handles sequencing (A → B → C), fan-out (A → B and A → C), dependency resolution (C waits for B), and variant-based branching (ok → proceed, error → stop). Putting GenerationPlan in the execution path as a dispatcher would create a second orchestration layer that must stay in agreement with the sync engine — a maintenance burden with no benefit.

**If GenerationPlan is down, generation still works.** Every sync chain from source → cache check → generator → emitter → cache record operates independently of GenerationPlan. The only loss is status tracking. This is the right failure mode — generation is critical, reporting is nice-to-have.

**Planning is read-only analysis.** `clef generate --plan` queries three concepts (PluginRegistry, KindSystem, BuildCache) and computes what would happen. No side effects, no state changes, no triggers. This is the appropriate role for a planning concept.

### Cross-Concept Contamination — Design Violation Caught During Implementation

During initial implementation, two cross-concept contamination violations were introduced and subsequently corrected:

1. **Generator `register` actions.** TypeScriptGen, RustGen, SwiftGen, and SolidityGen were given `register` actions that returned metadata (name, family, inputKind, outputKind, deterministic, pure). This embedded knowledge of the plugin registration system directly inside each generator concept. **Fix:** Removed all `register` actions. Generator metadata (name, family, inputKind, outputKind, deterministic, pure) is declared statically in `suite.yaml` under each generator's entry, and syncs wire that metadata to PluginRegistry. Generators never interact with PluginRegistry.

2. **GenerationPlan `plan` action.** The original spec included a `plan` action that accepted `generators: list`, `staleSteps: list`, and `topology: graph` as input parameters. These are typed references to data owned by PluginRegistry, BuildCache, and KindSystem respectively — making GenerationPlan aware of three other concepts. **Fix:** Removed the `plan` action entirely. GenerationPlan is now purely passive: `begin`, `recordStep`, `complete`, `status`, `summary`, `history`. Planning queries (what would run, what's cached) are handled by the CLI layer, which queries PluginRegistry, KindSystem, and BuildCache independently and composes the plan view — no concept needs to know about the others.

**Lesson:** Even when a concept *receives* other concepts' data as input parameters (rather than querying them directly), it still violates concept independence if the parameter types or semantics are specific to other concepts. The test is: "Could this concept be used without the other concepts existing?" If the parameters only make sense in the presence of specific other concepts, that's contamination.

### Why PluginRegistry is the single registration point

Generators should know about exactly one infrastructure concept: PluginRegistry. The registration sync carries all metadata (name, family, inputKind, outputKind, deterministic, pure). Downstream syncs propagate this to KindSystem (topology) and make it available to GenerationPlan (planning). This means:

- Adding KindSystem later doesn't require changing any generators
- Adding GenerationPlan later doesn't require changing any generators
- The only per-generator sync that touches infrastructure is the registration sync
- All other per-generator syncs (cache-check, output, cache-record, observer) use generation suite concepts but don't require generators to know about them — the syncs wrap around generators transparently

### Why 6 syncs per generator (and why that's acceptable)

Six syncs per generator sounds like a lot compared to the current one sync. But:

1. **All six are mechanical** — identical pattern, same structure, only names differ
2. **They're auto-generatable** — `clef generate --generator-syncs` produces them from PluginRegistry metadata
3. **Each serves a distinct, independently disableable purpose** — disable cache-check syncs for always-regenerate, disable observer syncs if you don't need status tracking, disable output syncs if the generator writes files itself
4. **The alternative is worse** — putting caching, emission, and tracking logic inside each generator creates coupling and duplication across 20+ generators

### Why Emitter but not Parser as a shared concept

Emitter's purpose — "materialize generated content as files with content-addressed optimization" — is identical regardless of what's being generated. All file-producing generators benefit from the same infrastructure.

Parsers share an abstract shape (text → structure) but no concrete infrastructure. SpecParser's grammar, error handling, and AST have nothing in common with SyncParser's. Merging them would add dispatch complexity without removing duplication.

### What happens to CacheCompiler

CacheCompiler currently handles framework pipeline caching AND precompilation (`.clef-cache/`). With this design:

- **Caching concern** migrates to BuildCache (shared across all families)
- **Precompilation concern** (Stage 3.5 bootstrap optimization) stays separate — it's a build artifact concern, not generation step caching
- CacheCompiler can either become a thin wrapper calling BuildCache, or retire in favor of framework syncs using BuildCache directly

### Design comparison with ChatGPT's proposal

An external analysis proposed a 6-concept kernel (Resource, Model, TransformSpec, DerivationGraph, ArtifactStore, TraceMap). After applying Clef constraints:

| External Concept | Verdict | Disposition |
|---|---|---|
| **Resource** | ✅ Adopted | Genuine gap — tracks inputs with digests |
| **Model/ModelStore** | ❌ Absorbed | BuildCache `outputRef` handles cached IR retrieval; sovereign storage means concepts own their IRs |
| **TransformSpec** | ❌ Absorbed | `deterministic`/`pure` become PluginRegistry metadata fields |
| **DerivationGraph** | ❌ Absorbed | Planning → GenerationPlan (passive); topology → KindSystem; execution → sync engine |
| **ArtifactStore** | ❌ Absorbed | File artifacts → Emitter; non-file outputs flow through syncs |
| **TraceMap** | ❌ Absorbed | Emitter gains `sourceMap` state + `trace`/`affected` actions |

The external kernel had a fundamental problem: every concept referenced every other concept's ID types (ModelId in DerivationGraph, ResourceId in Model, etc.), violating Clef Design Principle 2 (total independence). Additionally, DerivationGraph reimplemented the sync engine's orchestration role. The corrected design keeps generation suite concepts independent and lets the sync engine do what it already does.

---

## Part 9: Concept Count Summary

| Layer | Concepts | Count |
|---|---|---|
| **Generation kit (new, shared)** | Resource, KindSystem, BuildCache, GenerationPlan, Emitter | **5** |
| Framework generators (existing) | SpecParser, SchemaGen, TypeScriptGen, RustGen, SwiftGen, SolidityGen, CacheCompiler | 7 |
| Interface kit (existing) | Projection, Generator, Surface, Middleware, Target, Sdk, Spec, + 13 providers | 20 |
| Deploy kit (existing) | DeployPlan, Rollout, Migration, Health, Env, Telemetry, Artifact, Runtime, Secret, IaC, GitOps, + providers | 15+ |
| Infrastructure kit (existing) | PluginRegistry, + others | varies |
| Parsers/compilers (existing) | SyncParser, SyncCompiler, ContentParser, ExpressionLanguage, Query | 5 |
| Auxiliary (existing) | JWT, MediaAsset, Palette, Elevation, Pathauto | 5+ |

**Net change:** +5 new concepts. Emitter moves from Clef Bind. CacheCompiler's caching concern absorbed.

**Syncs per generator:** 6 (registration, cache-check pair, output, cache-record, observer). All mechanical, auto-generatable.

**The real win:** adding a new generator anywhere in the system automatically gets caching, content-addressed emission, formatting, orphan cleanup, cascading invalidation, pipeline topology, dry-run, status tracking, traceability, drift detection, plan visualization, and history — by writing one concept spec, one implementation, and running `clef generate --generator-syncs`.

---

## Part 10: Implementation Plan

### Phase 1: Emitter (standalone, highest leverage)

**Goal:** All file-producing generators use shared Emitter instead of writing directly.

1. Implement Emitter concept (write, writeBatch, format, clean, manifest)
2. Add format-after-write sync
3. Migrate TypeScriptGen to return `{ files }` → Emitter writes
4. Validate: same output files, fewer direct writes, content-addressed skip-write

**Acceptance:** `clef generate` produces identical output. Second run with no changes: all files skip-written (written: false). Output hash matches input hash.

### Phase 2: BuildCache (incremental detection)

**Goal:** Generators skip execution when inputs haven't changed.

1. Implement BuildCache concept (check, record, invalidate, invalidateAll, status, staleSteps)
2. Write cache-check wrapper syncs for TypeScriptGen (template for all generators)
3. Write cache-record sync for TypeScriptGen
4. Migrate CacheCompiler's hash logic into BuildCache
5. Validate: unchanged spec → TypeScriptGen skipped

**Acceptance:** `clef generate` with no changes completes in <100ms (all cached). `clef generate --force` (calling invalidateAll first) forces full rebuild.

### Phase 3: Resource (input tracking)

**Goal:** Source file changes trigger targeted invalidation.

1. Implement Resource concept (upsert, get, list, remove, diff)
2. Wire FileWatcher → Resource/upsert syncs
3. Wire Resource/changed → BuildCache/invalidateBySource
4. Validate: changing one `.concept` file → only affected generators re-run

**Acceptance:** `clef dev` watches files. Change `password.concept` → TypeScriptGen and RustGen for password re-run, all other generators skipped.

### Phase 4: KindSystem (pipeline topology)

**Goal:** Pipeline ordering, validation, and cascading invalidation are data-driven.

1. Implement KindSystem concept (define, connect, route, validate, dependents, graph)
2. Register standard kind taxonomy at kit load time
3. Wire PluginRegistry → KindSystem via RegisterGeneratorKinds + EnsureKindsDefined syncs
4. Wire BuildCache cascading through KindSystem/dependents
5. Add `clef kinds` CLI commands
6. Add `clef check` pipeline validation

**Acceptance:** `clef kinds path ConceptDSL OpenApiDoc` returns valid path. `clef check` flags invalid sync topology. Cascading invalidation works: invalidating ConceptManifest → all downstream generators re-run.

### Phase 5: GenerationPlan (passive planning + tracking)

**Goal:** Unified planning and status reporting across all families.

1. Implement GenerationPlan concept (plan, begin, recordStep, complete, status, summary, diff, history)
2. Wire observer syncs for all generators (cache hits + completions + failures)
3. Wire begin/complete syncs to CLI trigger and sync engine quiescence
4. Implement `clef generate --plan`, `--status`, `--summary`, `--history`, `--dry-run`, `--family`, `--target`
5. Write `clef generate --generator-syncs` auto-generation command

**Acceptance:** `clef generate --plan` shows full dependency graph with cache status. `clef generate --status` shows live progress. `clef generate --summary` shows post-run statistics. `clef generate --generator-syncs` produces valid sync files.

### Phase 6: Traceability and Audit (polish)

**Goal:** Full source-to-output tracing and drift detection.

1. Add Emitter sourceMap state + trace/affected/audit actions
2. Migrate generators to pass source provenance in `sources` parameter of write/writeBatch
3. Implement `clef trace`, `clef impact`, `clef generate --audit` CLI commands

**Acceptance:** `clef trace src/password.ts` shows source spec. `clef impact ./specs/password.concept` shows all affected outputs. `clef generate --audit` detects hand-edited generated files and orphans.
