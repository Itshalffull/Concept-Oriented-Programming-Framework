# Clef Clef Bind — Architecture Extension (v4)

> **Changelog**
>
> **v4 (2026-02-23):**
> - Added 3 new render patterns: `table-list`, `companion-link-list`, `example-walkthroughs` (§1.10)
> - Added `interpolateVars()` for `$VARIABLE` substitution in intro-template content (§1.10)
> - Added `filterByTier()` for tier-aware enrichment filtering: inline, reference, summary (§1.10)
> - Added multi-format handler registrations: `skill-md`, `cli-help`, `mcp-help`, `rest-help` (§1.10)
> - Added `companion-docs` and `example-walkthroughs` built-in handlers (§1.10)
> - Added enrichment-driven documentation generation to all text targets:
>   - CliTarget: `{concept}.help.md` using `cli-help` format (§2.4)
>   - McpTarget: `{concept}.help.md` using `mcp-help` format (§2.5)
>   - RestTarget: `{concept}/api-docs.md` using `rest-help` format (§2.1)
> - Added `intro-template` annotation with per-target variable vocabularies (§2.1–§2.6)
> - Added `skill-title` annotation for descriptive skill headings (§2.6)
> - Added `step-references` workflow key for per-step inline reference links (§2.6)
> - Added `checklist-labels` workflow key for named per-step checklists (§2.6)
> - Added `## wrapper + ### steps` heading hierarchy for workflow-based skills (§2.6)
> - Added companion file emission from `companion-docs` and `tier=reference` items (§2.6)
> - Added `getManifestEnrichment()` shared utility for merged workflow+annotation enrichment (§2.9)
> - Added concept-overrides fix for CLI generation — `concept-overrides` key now correctly applied (§2.4)
> - Added handmade-vs-generated parity tests: 127 skills tests + 111 CLI tests + 32 behavioral tests (Part 7)
>
> **v3 (2026-02-22):**
> - Added `@hierarchical` structural trait (§1.8) — general-purpose hierarchy support across all targets
> - Added per-target `@hierarchical` projection rules: nested REST routes, recursive GraphQL types, multi-level CLI subcommand trees, namespaced MCP tools, hierarchical skill groups
> - Added hierarchical inference rules to Projection (§1.1) — auto-derives children/ancestors/descendants endpoints
> - Added architectural decision: why trait-based hierarchy, not a Tree concept (Part 8)
> - Added interface manifest example with `@hierarchical` on Category concept (Part 4)
>
> **v2 (2026-02-22):**
> - Added Annotation concept (§1.9) — opaque metadata attachment for concepts and actions
> - Added Renderer concept (§1.10) — template-driven enrichment rendering with 13 built-in patterns
> - Added Workflow concept (§1.11) — ordered action sequences with opaque decorations
> - Added ClaudeSkillsTarget provider (§2.6) — Claude Code skill file generation
> - Updated Projection to v3 (§1.1) — added opaque `content` field for enrichment passthrough
> - Updated CliTarget to v2 (§2.4) — added `commandTree` state, `validate` and `listCommands` actions
> - Added enrichment pipeline syncs (§3.3) — AnnotateBeforeGenerate, WorkflowBeforeRender, RenderEnrichment
> - Added Claude Skills routing and middleware syncs (§3.5, §3.8)
> - Added Opaque Content Model architectural decision (Part 8)
> - Updated concept count table, suite.yaml, and integration diagrams
>
> **v1 (initial):**
> - Original architecture with 21 concepts across 5 categories

## Design Principle

The same principle as the deploy kit: **the engine owns coordination mechanics, concepts own domain logic.** Interface generation is a domain — it has state (what interfaces have been generated, which versions, what broke), actions with meaningful variants (generate → ok | breakingChange | targetUnsupported), and coordination needs (syncs between parsing, projecting, generating, and emitting).

The Clef Bind plugs into the existing compiler pipeline at `SchemaGen/generate → ok(manifest)` — the same integration point as TypeScriptGen and RustGen. **ConceptManifest is already the IR.** The Clef Bind does not re-parse concept specs. It reads ConceptManifests, enriches them with interface-specific annotations from a manifest file, and generates target-specific output through the coordination + provider pattern.

### Integration with Existing Pipeline

```
SpecParser/parse → SchemaGen/generate → ConceptManifest
                                             │
                    ┌────────────────────────┤ (existing)
                    │                        │
              TypeScriptGen/generate    RustGen/generate
                                             │
                    ┌────────────────────────┤ (new — Clef Bind)
                    │                        │
              Projection/project    ──▶  Generator/generate
                                             │
                              ┌──────────────┤
                              │              │
                     Annotation/resolve   Workflow/define
                              │              │
                              └──────┬───────┘
                                     │
                              Renderer/render (enrichment)
                                     │
                              Grouping/group
                                     │
                              ┌──────┼──────────────┐
                              ▼      ▼              ▼
                    Target/generate  Sdk/generate  Spec/emit
                         │               │              │
                    [routing]        [routing]       [routing]
                         │               │              │
                    RestTarget       TsSdkTarget    OpenApiTarget
                    GraphqlTarget    PySdkTarget    AsyncApiTarget
                    GrpcTarget       GoSdkTarget    ...
                    CliTarget        ...
                    McpTarget
                    ClaudeSkillsTarget
```

### Relationship to Clef Surface

Clef Surface generates **visual** interfaces (forms, tables, dashboards) from concept specs. This suite generates **text-based, structured, composable** interfaces (APIs, CLIs, MCP servers, SDKs, spec documents) from the same specs. They share the same source of truth (ConceptManifest) and the same progressive customization principle:

| Level | Clef Surface (UI) | Clef Bind (Non-UI) |
|-------|-----------|----------------------|
| Zero-config | Auto-generated CRUD forms | Auto-generated REST API + CLI |
| Annotated | Field display hints, layout overrides | `@http`, `@graphql`, `@cli` annotations |
| Custom | Headless components, custom renderers | Custom generator plugins, middleware |

---

## Conceptual Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Clef Clef Bind                                    │
│                                                                              │
│  Orchestration Concepts:                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ Projection │ │ Generator  │ │  Emitter   │ │  Surface   │               │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘               │
│        │               │              │              │                       │
│  Enrichment Concepts:                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                               │
│  │ Annotation │ │  Workflow  │ │  Renderer  │                               │
│  └────────────┘ └────────────┘ └────────────┘                               │
│  (opaque metadata) (step ordering) (patterns + templates)                    │
│                                                                              │
│  Coordination Concepts:          Provider Concepts:                          │
│  ┌────────────┐                  ┌────────────┐ ┌────────────┐              │
│  │   Target   │──[route syncs]──▶│ RestTarget │ │GraphqlTarget│ …           │
│  └────────────┘                  └────────────┘ └────────────┘              │
│  ┌────────────┐                  ┌────────────┐ ┌────────────┐              │
│  │    Sdk     │──[route syncs]──▶│TsSdkTarget │ │PySdkTarget │ …           │
│  └────────────┘                  └────────────┘ └────────────┘              │
│  ┌────────────┐                  ┌────────────┐ ┌────────────┐              │
│  │    Spec    │──[route syncs]──▶│OpenApiTarget│ │AsyncApiTarget│ …          │
│  └────────────┘                  └────────────┘ └────────────┘              │
│                                                                              │
│  Cross-Cutting Concepts:                                                     │
│  ┌────────────┐                                                              │
│  │ Middleware  │ (trait → per-target middleware projection)                   │
│  └────────────┘                                                              │
│  ┌────────────┐                                                              │
│  │  Grouping  │ (organize concepts into named groups by strategy)            │
│  └────────────┘                                                              │
│                                                                              │
│  Syncs:                                                                      │
│  SchemaGen/generate → ok → Projection/project (entry point)                 │
│  Projection/project → ok → Generator/plan                                   │
│  Generator/generate → ok → Annotation/resolve (enrichment)                  │
│  Generator/generate → ok → Workflow/define (enrichment)                     │
│  Workflow/define → ok → Renderer/render (format enrichment)                 │
│  Generator/generate → ok → Grouping/group (organize before dispatch)        │
│  Generator/generate → ok → Target/generate (per configured target)          │
│  Target/generate → [route] → RestTarget/generate (integration)              │
│  Target/generate → [route] → ClaudeSkillsTarget/generate (integration)      │
│  RestTarget/generate → ok → Middleware/inject                               │
│  Middleware/inject → ok → Emitter/write                                     │
│  [all targets complete] → Surface/compose                                   │
│  Surface/compose → ok → Emitter/write (composed output)                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Concepts

### 1.1 Projection

Takes ConceptManifests from SchemaGen and interface annotations from the interface manifest, produces enriched projections with resource mappings, trait bindings, cross-concept type graphs, and opaque enrichment content. This is not a new IR — it's ConceptManifest + generation-specific metadata.

The academic term "projection" comes from multiparty session types (Honda, Yoshida, Carbone 2008): a global protocol projected into local endpoint interfaces. Here, a concept spec is the "global protocol" and each generated interface is a "local endpoint."

The `content` field stores enrichment data (workflows, annotations, target configs) as opaque JSON — targets interpret keys they recognize and ignore the rest. See §8 for the opaque content model rationale.

```
@version(3)
concept Projection [P] {

  purpose {
    Enrich ConceptManifests with interface generation metadata.
    Reads concept specs (via ConceptManifest from SchemaGen) and
    interface annotations (from app.interface.yaml), produces
    generation-ready projections with resource mappings, trait
    bindings, cross-concept type graphs, and opaque enrichment
    content. Enrichment is stored as a single JSON string —
    targets interpret keys they recognize (workflows,
    annotations, command-tree, action-mappings) and ignore the
    rest. One projection per concept per generation run.
  }

  state {
    projections: set P
    manifest {
      concept: P -> String
      suiteName: P -> String
      kitVersion: P -> String
      conceptManifest: P -> String
    }
    annotations {
      traits: P -> list { name: String, scope: String, config: String }
      resourceMapping: P -> option { path: String, idField: String, actions: list String }
      targetOverrides: P -> list { target: String, config: String }
    }
    types {
      shapes: P -> list { name: String, kind: String, resolved: String }
      crossReferences: P -> list { from: String, to: String, relation: String }
    }
    content: P -> String
  }

  actions {
    action project(manifest: String, annotations: String) {
      -> ok(projection: P, shapes: Int, actions: Int, traits: Int) {
        Parse interface annotations. Merge with ConceptManifest.
        Compute resource mappings from state relations and action
        signatures. Bind traits to actions. Resolve cross-concept
        type references within the suite. Enrichment data from
        workflows, annotations, and target configs is serialized
        as opaque JSON into the content field.
      }
      -> annotationError(concept: String, errors: list String) {
        Interface manifest has invalid annotations for this concept.
      }
      -> unresolvedReference(concept: String, missing: list String) {
        Annotations reference actions or types that don't exist
        in the ConceptManifest.
      }
      -> traitConflict(concept: String, trait1: String, trait2: String, reason: String) {
        Two traits are incompatible on the same action
        (e.g. @paginated and @streaming on the same action).
      }
    }

    action validate(projection: P) {
      -> ok(projection: P, warnings: list String) {
        All annotations resolve. Resource mappings are consistent.
        No breaking changes from previous generation (if history exists).
      }
      -> breakingChange(projection: P, changes: list String) {
        Generated interface would break consumers. Lists the
        specific incompatibilities. Generation proceeds only
        with explicit --breaking flag.
      }
      -> incompleteAnnotation(projection: P, missing: list String) {
        Required annotations are missing for configured targets
        (e.g. REST target configured but no resource path for
        a concept with non-CRUD actions).
      }
    }

    action diff(projection: P, previous: P) {
      -> ok(added: list String, removed: list String, changed: list String) {
        Compare two projections. Used for breaking change detection
        and changelog generation.
      }
      -> incompatible(reason: String) {
        Projections are from different concepts — can't compare.
      }
    }

    action inferResources(projection: P) {
      -> ok(projection: P, resources: list String) {
        Auto-derive REST resource mappings from state relations
        and action signatures. Actions named create/add produce POST,
        delete/remove produce DELETE, list/find produce GET,
        update/edit produce PUT. Non-CRUD actions produce POST
        to /resource/{id}/action-name.
      }
    }
  }
}
```

#### Resource Inference Rules

When no explicit `@http` annotations are provided, Projection infers REST resource mappings from ConceptManifest:

```
For each concept with state relation `items: set T`:
  1. Resource path: /{kebab-case(concept-name)}
  2. Identifier: first type parameter of concept

For each action:
  Pattern match on action name prefix:
    create*, add*, new*     → POST   /{resource}
    get*, find*, read*      → GET    /{resource}/{id}
    list*, all*, search*    → GET    /{resource}
    update*, edit*, modify* → PUT    /{resource}/{id}
    delete*, remove*        → DELETE /{resource}/{id}
    (everything else)       → POST   /{resource}/{id}/{action-name}

  Pattern match on return variants:
    -> ok(...)              → 200 (GET/PUT/DELETE), 201 (POST create)
    -> notFound(...)        → 404
    -> unauthorized(...)    → 401
    -> forbidden(...)       → 403
    -> invalid*(...)        → 400
    -> conflict(...)        → 409
    -> *Error(...)          → 500
```

Similar heuristics exist for GraphQL (query vs mutation vs subscription), CLI (positional args vs flags), and MCP (tool vs resource vs resource-template).

#### Hierarchical Inference Rules

When `@hierarchical(relation: R)` is declared, Projection augments the base inference with hierarchy-aware mappings:

```
If concept has @hierarchical trait with relation R:

  1. Detect hierarchy relation:
     Look for state relation matching R (e.g. parentOf: T -> option T).
     Derive childrenOf from inverse of parentOf, or from explicit
     children state relation (e.g. childrenOf: T -> list T).

  2. Augment REST resource mappings:
     Add: GET    /{resource}/{id}/children          → list direct children
     Add: POST   /{resource}/{id}/children          → create child under parent
     Add: GET    /{resource}/{id}/ancestors          → list path to root
     Add: GET    /{resource}/{id}/descendants        → list full subtree
     Modify: POST /{resource}/{id}/move             → reparent (if move/reparent action exists)

  3. Augment GraphQL type:
     Add: children field (with Connection type if @paginated)
     Add: parent field (nullable, root nodes have null parent)
     Add: ancestors field (ordered list from self to root)
     Add: depth field (Int, computed from relation)

  4. Augment CLI command tree:
     Add: `tree` subcommand (display hierarchy, --depth flag)
     Add: `--parent` flag to create/list actions
     Add: `--depth` flag to list action
     Add: `--path` flag as alternative to --id (dot-separated ancestor path)

  5. Augment MCP:
     Modify: resource URI template to include parent path
       e.g. "{concept}://{parentPath}/{id}" instead of "{concept}://{id}"
     Add: list-children tool variant
     Add: get-ancestors tool variant
```


### 1.2 Generator

Central orchestration. Plans what to generate, tracks generation runs, coordinates target-specific generation. The deploy kit analogue of DeployPlan.

```
@version(1)
concept Generator [G] {

  purpose {
    Orchestrate multi-target interface generation from concept
    projections. Plans which targets and SDK languages to generate,
    coordinates the generation pipeline, tracks output files,
    and manages generation history for incremental regeneration.
  }

  state {
    plans: set G
    config {
      targets: G -> list String
      sdkLanguages: G -> list String
      specFormats: G -> list String
      outputDir: G -> String
      formatting: G -> String
    }
    execution {
      status: G -> String
      startedAt: G -> option DateTime
      completedAt: G -> option DateTime
      filesGenerated: G -> Int
      filesUnchanged: G -> Int
    }
    history: G -> list {
      generatedAt: DateTime
      kitVersion: String
      targets: list String
      filesGenerated: Int
      breaking: Bool
    }
  }

  actions {
    action plan(kit: String, interfaceManifest: String) {
      -> ok(plan: G, targets: list String, concepts: list String,
            estimatedFiles: Int) {
        Parse the interface manifest. Resolve which targets,
        SDK languages, and spec formats are configured.
        Validate that required provider concepts are loaded.
        Estimate output file count.
      }
      -> noTargetsConfigured(kit: String) {
        Interface manifest doesn't configure any generation targets.
      }
      -> missingProvider(target: String) {
        A configured target requires a provider concept that
        isn't loaded (e.g. rest target but RestTarget not in kit).
      }
      -> projectionFailed(concept: String, reason: String) {
        One or more concept projections failed.
      }
    }

    action generate(plan: G) {
      -> ok(plan: G, filesGenerated: Int, filesUnchanged: Int,
            duration: Int) {
        All configured targets generated successfully.
        Unchanged files (content-addressed) were skipped.
      }
      -> partial(plan: G, generated: list String, failed: list String) {
        Some targets generated, some failed.
      }
      -> blocked(plan: G, breakingChanges: list String) {
        Breaking changes detected. Use --breaking flag to proceed.
        Lists the specific changes for review.
      }
    }

    action status(plan: G) {
      -> ok(plan: G, phase: String, progress: Float,
            activeTargets: list String) {
        Current execution status.
      }
    }

    action regenerate(plan: G, targets: list String) {
      -> ok(plan: G, filesRegenerated: Int) {
        Regenerate only the specified targets. Uses cached
        projections if concept specs haven't changed.
      }
    }
  }
}
```


### 1.3 Target (Coordination Concept)

Stable interface for all generation targets. The rest of the system talks to Target. Routes to target-specific provider concepts via integration syncs based on `targetType`.

```
@version(1)
concept Target [T] {

  purpose {
    Coordinate code generation across interface targets (REST,
    GraphQL, gRPC, CLI, MCP). Owns the target registry, output
    file manifest per target, and generation history. Generator
    talks to Target — never to providers directly. Integration
    syncs route to the active provider based on targetType.
  }

  state {
    outputs: set T
    registry {
      targetType: T -> String
      concept: T -> String
      projection: T -> String
      generatedAt: T -> DateTime
      fileCount: T -> Int
    }
    files: T -> list { path: String, hash: String, sizeBytes: Int }
    previous: T -> option { generatedAt: DateTime, fileCount: Int, hash: String }
  }

  actions {
    action generate(projection: String, targetType: String, config: String) {
      -> ok(output: T, files: list String) {
        Generation complete. Files registered in manifest.
        Routes to provider via integration sync.
      }
      -> unsupportedAction(action: String, targetType: String, reason: String) {
        Concept action can't be expressed in this target
        (e.g. bidirectional streaming in REST). Non-fatal —
        action is skipped with a warning.
      }
      -> targetError(targetType: String, reason: String) {
        Provider-specific generation failure.
      }
    }

    action diff(output: T) {
      -> ok(output: T, added: list String, removed: list String,
            changed: list String) {
        Compare current generation against previous run.
        Content-addressed — unchanged files have matching hashes.
      }
      -> noPrevious(output: T) {
        First generation run for this concept+target.
      }
    }
  }
}
```


### 1.4 Sdk (Coordination Concept)

Stable interface for SDK/client library generation across languages. Follows the same coordination + provider pattern. Sdk owns the cross-language concerns: package naming, version strategy, transport configuration.

```
@version(1)
concept Sdk [S] {

  purpose {
    Coordinate SDK client library generation across programming
    languages. Owns the cross-language configuration (package
    naming, version strategy, transport configuration, auth
    setup), output file manifest per language, and compatibility
    tracking. Generator talks to Sdk — never to language
    providers directly.
  }

  state {
    packages: set S
    config {
      language: S -> String
      packageName: S -> String
      version: S -> String
      transport: S -> String
      authStrategy: S -> option String
    }
    output {
      files: S -> list { path: String, hash: String }
      generatedAt: S -> DateTime
    }
  }

  actions {
    action generate(projection: String, language: String, config: String) {
      -> ok(package: S, files: list String, packageJson: String) {
        SDK generated. Package manifest (package.json, pyproject.toml,
        go.mod, Cargo.toml) included. Types are idiomatic to the
        target language.
      }
      -> unsupportedType(typeName: String, language: String) {
        A concept type can't be expressed idiomatically in this
        language. Fallback type used (e.g. Any/interface{}).
      }
      -> languageError(language: String, reason: String) {
        Provider-specific generation failure.
      }
    }

    action publish(package: S, registry: String) {
      -> ok(package: S, publishedVersion: String) {
        Package published to language registry (npm, PyPI, etc.).
      }
      -> versionExists(package: S, version: String) {
        This version already published. Bump version first.
      }
      -> registryUnavailable(registry: String) {
        Can't reach the package registry.
      }
    }
  }
}
```


### 1.5 Spec (Coordination Concept)

Stable interface for specification document generation (OpenAPI, AsyncAPI, JSON Schema). These aren't code — they're machine-readable descriptions of the generated interfaces.

```
@version(1)
concept Spec [D] {

  purpose {
    Coordinate specification document generation. Owns the
    spec registry, versioning, and cross-concept composition
    (a single OpenAPI document covers all concepts in a suite).
    Generator talks to Spec — never to format providers directly.
  }

  state {
    documents: set D
    registry {
      format: D -> String
      suiteName: D -> String
      version: D -> String
      generatedAt: D -> DateTime
    }
    content: D -> String
  }

  actions {
    action emit(projections: list String, format: String, config: String) {
      -> ok(document: D, content: String) {
        Specification document generated covering all concepts
        in the projections list. Single document per suite per format.
      }
      -> formatError(format: String, reason: String) {
        Provider-specific spec generation failure.
      }
    }

    action validate(document: D) {
      -> ok(document: D) {
        Generated spec passes format-specific validation
        (OpenAPI linter, AsyncAPI parser, JSON Schema validator).
      }
      -> invalid(document: D, errors: list String) {
        Spec has structural errors.
      }
    }
  }
}
```


### 1.6 Emitter

Manages file output. Content-addressed (same input → same output hash → skip write). Handles formatting, diffing, and directory structure. The Clef Bind analogue of Artifact in the deploy kit.

```
@version(1)
concept Emitter [E] {

  purpose {
    Manage generated file output. Content-addressed — if the
    generated content hasn't changed, the file isn't rewritten
    (preserves timestamps for build tools). Handles formatting
    (prettier, black, gofmt, rustfmt), directory structure,
    and cleanup of orphaned files from previous runs.
  }

  state {
    files: set E
    metadata {
      path: E -> String
      hash: E -> String
      target: E -> String
      concept: E -> String
      generatedAt: E -> DateTime
      sizeBytes: E -> Int
      formatted: E -> Bool
    }
    manifest {
      outputDir: E -> String
      totalFiles: E -> Int
      totalBytes: E -> Int
    }
  }

  actions {
    action write(path: String, content: String, target: String, concept: String) {
      -> ok(file: E, hash: String, written: Bool) {
        If hash matches existing file, skip write (written: false).
        Otherwise write and update manifest.
      }
      -> directoryError(path: String, reason: String) {
        Can't create output directory.
      }
    }

    action format(file: E, formatter: String) {
      -> ok(file: E) {
        File formatted in place. Hash updated.
      }
      -> formatterUnavailable(formatter: String) {
        Formatter binary not found (prettier, black, etc.).
        File left unformatted — non-fatal.
      }
      -> formatError(file: E, reason: String) {
        Formatter failed. File left as-is.
      }
    }

    action clean(outputDir: String, currentFiles: list String) {
      -> ok(removed: list String) {
        Remove files in outputDir that aren't in currentFiles.
        Cleans up orphans from previous generation runs.
      }
    }

    action manifest(outputDir: String) {
      -> ok(files: list String, totalBytes: Int) {
        Return the complete manifest of generated files.
      }
    }
  }
}
```


### 1.7 Surface

Composes multiple concepts' generated interfaces into a cohesive API surface. A suite with 5 concepts should produce one REST API with routes for all 5, one GraphQL schema merging all 5, one CLI with subcommands for all 5 — not 5 separate interfaces.

```
@version(1)
concept Surface [S] {

  purpose {
    Compose generated interfaces from multiple concepts into
    a cohesive, unified API surface per target. For REST: a
    single router with concept-namespaced routes. For GraphQL:
    a merged schema with shared types. For CLI: a command tree
    with concept subcommands. For MCP: a combined tool set.
    For SDKs: a single client with concept-namespaced methods.
  }

  state {
    surfaces: set S
    config {
      kit: S -> String
      target: S -> String
      concepts: S -> list String
    }
    composed {
      entrypoint: S -> String
      routes: S -> option list { path: String, concept: String, action: String }
      sharedTypes: S -> option list { name: String, usedBy: list String }
    }
  }

  actions {
    action compose(kit: String, target: String, outputs: list String) {
      -> ok(surface: S, entrypoint: String, conceptCount: Int) {
        Merge per-concept generated outputs into a unified surface.
        Create shared entrypoint (router, schema, command root, etc.).
        Deduplicate shared types. Apply suite-level middleware.
      }
      -> conflictingRoutes(target: String, conflicts: list String) {
        Two concepts generate the same route/command/tool name.
        Requires explicit disambiguation in interface manifest.
      }
      -> cyclicDependency(target: String, cycle: list String) {
        Shared type resolution found a cycle.
      }
    }

    action entrypoint(surface: S) {
      -> ok(content: String) {
        Return the composed entrypoint file content.
      }
    }
  }
}
```

#### Per-Target Composition

| Target | Composition Strategy | Entrypoint | Documentation |
|--------|---------------------|------------|---------------|
| REST | Shared router, concept-prefixed routes (`/todos/*`, `/users/*`) | `router.ts` / `app.py` | `api-docs.md` (rest-help format) |
| GraphQL | Schema stitching, shared `Query`/`Mutation` root types | `schema.graphql` + `resolvers.ts` | — |
| gRPC | Multi-service proto package, shared message types | `service.proto` + `server.ts` | — |
| CLI | Root command, concept subcommands (`app todo add`, `app user list`) | `main.ts` / `main.go` | `help.md` (cli-help format) |
| MCP | Combined tool set, concept-namespaced tool names | `mcp-server.ts` | `help.md` (mcp-help format) |
| Claude Skills | Configurable grouping (per-concept, by-crud, custom, etc.) | Per-skill `SKILL.md` + `.commands.ts` | Companion files (skill-md format) |
| SDK | Single client class, concept-namespaced method groups | `client.ts` / `client.py` | — |


### 1.8 Middleware

Owns the mapping from abstract traits (`@auth`, `@paginated`, `@validated`, `@idempotent`) to concrete middleware implementations per target. A trait defined once in the interface manifest produces appropriate middleware code in every generated target.

```
@version(1)
concept Middleware [M] {

  purpose {
    Map abstract interface traits to concrete middleware
    implementations per target. @auth(bearer) produces
    Bearer token validation in REST, metadata interceptor
    in gRPC, env var check in CLI, OAuth flow in MCP.
    Owns trait definitions, per-target implementations,
    composition ordering, and compatibility rules.
  }

  state {
    definitions: set M
    trait {
      name: M -> String
      scope: M -> String
      config: M -> String
    }
    implementations: M -> list {
      target: String
      code: String
      position: String
    }
    composition {
      order: M -> Int
      dependsOn: M -> list String
      incompatibleWith: M -> list String
    }
  }

  actions {
    action resolve(traits: list String, target: String) {
      -> ok(middlewares: list String, order: list Int) {
        For each trait, find the per-target implementation.
        Order by declared position (before-auth, auth,
        after-auth, validation, business-logic, serialization).
        Return ordered middleware chain.
      }
      -> missingImplementation(trait: String, target: String) {
        No implementation registered for this trait+target pair.
        Non-fatal — trait is skipped with warning.
      }
      -> incompatibleTraits(trait1: String, trait2: String, reason: String) {
        Two requested traits conflict (e.g. @streaming and
        @paginated on the same action).
      }
    }

    action inject(output: String, middlewares: list String, target: String) {
      -> ok(output: String, injectedCount: Int) {
        Inject middleware code into the generated output.
        For REST: wrap route handlers in middleware chain.
        For gRPC: add interceptors to service definition.
        For CLI: add pre-command hooks.
        For MCP: add tool middleware.
      }
    }

    action register(trait: String, target: String, implementation: String, position: String) {
      -> ok(middleware: M) {
        Register a new trait→target implementation.
        Used by custom suites to extend middleware for their domains.
      }
      -> duplicateRegistration(trait: String, target: String) {
        Implementation already registered. Use replace instead.
      }
    }
  }
}
```

#### Built-in Trait Projections

| Trait | REST | GraphQL | gRPC | CLI | MCP | Claude Skills |
|-------|------|---------|------|-----|-----|--------------|
| `@auth(bearer)` | `Authorization` header validation | Context auth check | Metadata interceptor | `--token` flag or env var | OAuth 2.1 token flow | `allowed-tools` frontmatter |
| `@auth(apiKey)` | `X-API-Key` header | Context auth check | Metadata interceptor | `--api-key` flag or env var | API key in config | `allowed-tools` frontmatter |
| `@paginated(cursor)` | `?cursor=X&limit=N` query params | Connection type (Relay spec) | Repeated field + page_token | `--page-token`, `--limit` flags | Paginated tool result | Argument hint note |
| `@paginated(offset)` | `?offset=N&limit=N` query params | `offset`/`limit` args | Offset + limit fields | `--offset`, `--limit` flags | Offset in input schema | Argument hint note |
| `@idempotent` | `Idempotency-Key` header | `idempotencyKey` arg | Metadata entry | Auto-retry safe | Tool retry hint | N/A (skip) |
| `@rateLimit(N)` | `429` response + `Retry-After` | Error extension | `RESOURCE_EXHAUSTED` status | Backoff + retry | Backoff + retry | N/A (skip) |
| `@validated` | Request body JSON Schema validation | Input type validation | Proto field validation | Flag/arg validation | `inputSchema` constraints | Checklist items |
| `@deprecated(msg)` | `Deprecated` header + OpenAPI flag | `@deprecated` directive | Proto option | `[DEPRECATED]` in help | Tool description note | Skill description note |
| `@streaming(server)` | SSE / `Transfer-Encoding: chunked` | Subscription | Server-streaming RPC | `--follow` / streaming stdout | Notification stream | N/A (skip) |
| `@streaming(bidi)` | WebSocket upgrade | Subscription + mutation | Bidirectional RPC | Interactive mode | Not supported (skip) | N/A (skip) |
| `@cached(ttl)` | `Cache-Control` headers | `@cacheControl` directive | N/A (skip) | Local file cache | N/A (skip) | N/A (skip) |
| `@hierarchical` | Nested resource routes | Recursive types + nested queries | Nested messages + scoped RPCs | Multi-level subcommand tree | Namespaced tool groups | Hierarchical skill groups |

#### `@hierarchical` Trait — Detailed Projection

The `@hierarchical` trait is a structural trait (unlike middleware traits which inject code, it reshapes the generated output structure). It tells each target that a concept's instances form a tree and the generated interface should reflect that nesting. Without it, targets produce flat structures (one level of concept → action). With it, targets produce nested structures that mirror the concept's parent-child state relation.

**Trait configuration:**

```yaml
traits:
  - name: hierarchical
    config:
      relation: parentOf       # state relation encoding parent → child
      maxDepth: 4              # optional depth limit (default: unlimited)
      labelField: name         # state field used for display name at each level
      style: nested            # nested | prefixed (see below)
    actions: [all]             # applies to all actions (default), or list specific ones
```

**Style modes:**

| Style | Behavior | Example (CLI) | Example (REST) |
|-------|----------|---------------|----------------|
| `nested` | Full tree structure — each level is a distinct routing node | `app region us-east cluster prod node web-1 status` | `GET /regions/{regionId}/clusters/{clusterId}/nodes/{nodeId}/status` |
| `prefixed` | Flat structure with path-prefix arguments — simpler but less discoverable | `app node status --path region/us-east/cluster/prod/node/web-1` | `GET /nodes/{nodeId}/status?path=regions.us-east.clusters.prod` |

**Per-target projection rules:**

| Target | `@hierarchical` Projection | Structural Mechanism |
|--------|---------------------------|---------------------|
| **REST** | Nested resource routes: `/{parent}/{parentId}/{child}/{childId}`. Parent ID propagated in path. Collection endpoints at each level. | Route nesting up to `maxDepth`. `GET /categories/{id}/children` returns direct children. `GET /categories/{id}/descendants?depth=N` for subtree queries. |
| **GraphQL** | Recursive object types: `type Category { children: [Category!]!, parent: Category }`. Connection types at each nesting level when combined with `@paginated`. | Self-referential types. `children` field resolver loads direct children. `ancestors` field resolver walks up the tree. |
| **gRPC** | Scoped service RPCs with hierarchical resource names: `ListChildren(parent: "categories/123")`. Google AIP-122 resource name pattern. | Hierarchical resource names in request messages. Repeated nested messages for tree responses. |
| **CLI** | Multi-level subcommand tree. Each tree level becomes a command group. Actions at each level become subcommands of that group. `--depth` flag for tree display. | `commandTree` state populated from concept's parent-child relation. Root nodes at depth 0, children at depth 1+. Shell completion walks the tree. `app category list --tree` for visual tree output. |
| **MCP** | Hierarchical tool grouping: `category_create`, `category_list_children`, `category_move`. Resource URIs encode path: `category://root/sub1/sub2`. | Tool names use hierarchy-aware naming. Resource templates include parent path. Tool descriptions include "operates on subtree" semantics. |
| **Claude Skills** | Skill instructions include tree navigation workflow: "First identify the parent, then list children at the target level." Checklist items for each tree level. | Workflow steps include tree-awareness. Enrichment content includes `tree-navigation` section rendered by Renderer. |
| **OpenAPI** | Nested path items with `$ref` to shared schemas. Discriminated tree response schemas. | `paths: /categories/{catId}/children` with shared `Category` schema. Tree query params documented. |
| **AsyncAPI** | Hierarchical channel names: `categories.{categoryId}.children.created`. Parent context in message headers. | Channel name segments mirror tree path. Messages include `parentPath` header. |

**CLI command tree generation in detail:**

Without `@hierarchical`, CliTarget generates a flat two-level tree:

```
app                          # root
├── category create          # concept → action
├── category list
├── category move
└── category delete
```

With `@hierarchical(relation: parentOf, style: nested)`, CliTarget reads the concept's parent-child state relation and generates a dynamic multi-level tree where intermediate levels come from actual data:

```
app                          # root (depth 0)
├── category                 # concept group
│   ├── create               # create at root level
│   ├── list                 # list root categories
│   ├── tree                 # auto-generated: show full tree
│   ├── move                 # move a category
│   └── delete               # delete a category
│
│   # Hierarchical navigation (when --parent is provided):
│   ├── list --parent {path} # list children of a specific node
│   └── create --parent {p}  # create under a specific parent
```

The key additions `@hierarchical` triggers in CLI generation:

1. **`--parent` flag** on `create` and `list` actions — positions the operation within the tree
2. **`tree` subcommand** — auto-generated, displays the full hierarchy as an indented tree with `--depth` flag to limit levels
3. **`--depth` flag** on `list` — controls how many levels deep to recurse (default 1 = direct children only)
4. **`--path` flag** on `get`/`update`/`delete` — alternative to ID, accepts dot-separated ancestor path for human-readable addressing (e.g. `--path "electronics/computers/laptops"`)
5. **Breadcrumb display** — when operating within a subtree, output shows the path context: `[electronics > computers >] Created: laptops`
6. **Shell completion** — tab-completion walks the live tree, offering children of the current parent as completions

**REST nested resource generation in detail:**

Without `@hierarchical`:
```
GET    /categories            # list all
POST   /categories            # create
GET    /categories/{id}       # get by id
PUT    /categories/{id}       # update
DELETE /categories/{id}       # delete
POST   /categories/{id}/move  # custom action
```

With `@hierarchical(relation: parentOf, style: nested)`:
```
GET    /categories                              # list root categories
POST   /categories                              # create root category
GET    /categories/{id}                         # get by id
PUT    /categories/{id}                         # update
DELETE /categories/{id}                         # delete
GET    /categories/{id}/children                # list direct children
POST   /categories/{id}/children                # create child under parent
GET    /categories/{id}/ancestors               # list ancestors to root
GET    /categories/{id}/descendants             # list full subtree
GET    /categories/{id}/descendants?depth=2     # subtree limited to 2 levels
POST   /categories/{id}/move                    # move within tree
```

### 1.9 Annotation

Attaches arbitrary metadata to concepts and actions for interface generation. The concept owns identity (which concept, which scope) and opaque content passthrough — targets read the keys they understand and ignore the rest. This is the input side of the enrichment pipeline (see §8).

Annotation was identified as independent through Jackson's decomposition: enrichment metadata is a distinct concern from projection (which produces structural mappings), workflow (which orders steps), and rendering (which formats output). Annotation functions without those concepts, and they function without it.

```
@version(3)
concept Annotation [N] {

  purpose {
    Attach arbitrary metadata to concepts and actions for
    interface generation. The concept owns identity (which
    concept, which scope) and opaque content passthrough.
    Each target reads the keys it understands and ignores
    the rest. New enrichment kinds require only a new YAML
    key and a renderer in the target provider — zero concept
    changes. See Architecture doc Section 1.9.
  }

  state {
    annotations: set N
    identity {
      targetConcept: N -> String
      scope: N -> String
    }
    content: N -> String
  }

  actions {
    action annotate(concept: String, scope: String, content: String) {
      description {
        Attach opaque metadata to a concept-level or action-level
        scope. The content string is JSON from the interface
        manifest — its internal structure is not constrained by
        this concept. Targets interpret keys they recognize
        (e.g. tool-permissions, examples, design-principles,
        scaffolds, trigger-description, validation-commands)
        and pass through the rest. Scope is either "concept"
        for concept-level or the action name for action-level.
      }
      -> ok(annotation: N, keyCount: Int) {
        Metadata attached. keyCount is the number of top-level
        keys in the content JSON.
      }
      -> invalidScope(scope: String) {
        The scope references an action not found in the concept.
      }
    }

    action resolve(concept: String) {
      description {
        Return all annotations for a concept and its actions.
        Merges concept-level and action-level content into a
        single result keyed by scope.
      }
      -> ok(annotations: list String) {
        All annotations for the concept, serialized as JSON
        with scope keys preserved.
      }
      -> notFound(concept: String) {
        No annotations exist for the specified concept.
      }
    }
  }
}
```

#### Annotation Scoping

Annotations attach at two levels, both stored as opaque JSON:

| Scope | Description | Example Keys |
|-------|-------------|-------------|
| `concept` | Concept-level metadata applied to the whole skill/CLI/API | `tool-permissions`, `trigger-description`, `design-principles`, `scaffolds` |
| `{actionName}` | Action-level metadata for a specific action | `examples`, `references`, `checklists` |

The interface manifest drives annotation content:

```yaml
concepts:
  Article:
    annotations:
      concept:
        tool-permissions: [Read, Bash, Grep, Glob]
        trigger-description: "When a user asks to create or manage articles"
        design-principles:
          - title: Slug Immutability
            rule: Once assigned, article slugs never change
      createArticle:
        examples:
          - label: "Create a draft"
            language: bash
            code: "clef article create --title 'My Post' --draft"
```


### 1.10 Renderer

Renders opaque enrichment JSON into formatted output strings using data-driven templates. The key architectural insight: **patterns are code (shipped once), handlers are data (YAML-shippable).** Adding a new enrichment kind requires only a data entry mapping it to a built-in pattern — zero code changes.

The Renderer sits between enrichment sources (Annotation, Workflow) and output consumers (target providers). It decouples _what_ to render from _how_ to render it, allowing the same enrichment data to produce different output for different formats (skill-md, cli-help, rest-guide, etc.).

```
@version(2)
concept Renderer [R] {

  purpose {
    Render opaque enrichment JSON into formatted output strings
    using data-driven templates. Handlers are declarative — each
    maps an enrichment key to a built-in render pattern (list,
    checklist, code-list, callout, heading-body, bad-good, etc.)
    plus a template config with {{field}} interpolation. Patterns
    are the small code surface shipped once; handlers are pure
    data that can live in YAML manifests. New enrichment kinds
    need only a YAML entry — zero code changes.
    See Architecture doc Section 1.10.
  }

  state {
    handlers: set R
    registry {
      key: R -> String
      format: R -> String
      order: R -> Int
      pattern: R -> String
      template: R -> String
    }
  }

  actions {
    action register(key: String, format: String, order: Int, pattern: String, template: String) {
      description {
        Register a handler for an enrichment key in a given format.
        Order determines rendering position — lower numbers render
        first. Pattern names a built-in render pattern (list,
        checklist, code-list, link-list, callout, heading-body,
        bad-good, scaffold-list, slash-list, keyed-checklist,
        inline-list). Template is a JSON config for the pattern
        with {{field}} interpolation placeholders. If a handler
        already exists for the (key, format) pair, it is replaced.
      }
      -> ok(handler: R) {
        Handler registered.
      }
      -> unknownPattern(pattern: String) {
        The named pattern does not exist.
      }
      -> invalidTemplate(template: String, reason: String) {
        Template config is malformed JSON.
      }
    }

    action render(content: String, format: String) {
      description {
        Render enrichment content in the given format. Parses the
        content JSON, walks top-level keys, dispatches each to the
        registered handler's pattern with its template config. Keys
        without a handler are collected in unhandledKeys for
        transparency. Output sections are ordered by handler order.
      }
      -> ok(output: String, sectionCount: Int, unhandledKeys: list String) {
        Rendered output with sections assembled in order.
        unhandledKeys lists content keys that had no registered
        handler for this format — not an error, just transparency.
      }
      -> invalidContent(reason: String) {
        Content string is not valid JSON.
      }
      -> unknownFormat(format: String) {
        No handlers registered for this format.
      }
    }

    action listHandlers(format: String) {
      -> ok(handlers: list String, count: Int) {
        Handler keys for the format, in render order.
      }
    }

    action listPatterns() {
      -> ok(patterns: list String) {
        Names of built-in patterns available for handler templates.
      }
    }
  }
}
```

#### Built-in Render Patterns

Patterns are small code functions shipped with the framework. Each accepts data (from enrichment JSON) and a template config (from handler registration):

| Pattern | Input Type | Output | Template Config |
|---------|-----------|--------|-----------------|
| `list` | `Array<object>` | Heading + bullet items | `heading?`, `prefix?`, `item` (with `{{field}}` interpolation) |
| `checklist` | `string[]` | Markdown checkboxes | `heading?` |
| `keyed-checklist` | `Record<string, string[]>` | Per-key checkbox groups | `keyHeading?` (with `{{key}}` interpolation) |
| `link-list` | `{path, label}[]` | Markdown reference links | `heading?` |
| `example-list` | `{label, language, code}[]` | Fenced code blocks | `heading?` |
| `code-list` | `{label, command}[]` | Labeled code blocks | `heading?`, `language?` |
| `heading-body` | `string` or `{heading?, body?}` | Single section | `heading?` |
| `heading-body-list` | `{heading, body}[]` | Multiple sections | `headingLevel?` |
| `callout` | `string` | Blockquote callout | `label` |
| `inline-list` | `string[]` | Comma-separated with prefix | `prefix?` |
| `bad-good` | `{title, description, bad?, good?}[]` | Comparison blocks | `heading?` |
| `scaffold-list` | `{name, path, description}[]` | Sections with links | `heading?` |
| `slash-list` | `(string \| {name, description})[]` | Skill references (`/name`) | `heading?` |
| `table-list` | `{name, description, ...}[]` | Markdown table | `heading?`, `headers` (column names), `fields` (data keys), `namePrefix?`, `nameSuffix?` |
| `companion-link-list` | `{path, label, tier?}[]` | Categorized link groups by tier | `heading?`, tiers: inline, reference, summary |
| `example-walkthroughs` | `{path, label, preamble?}[]` | Companion links with optional preamble text | `heading?` |

#### Built-in Handlers

Default handlers registered for all four text formats (`skill-md`, `cli-help`, `mcp-help`, `rest-help`):

| Enrichment Key | Order | Pattern | Purpose |
|---------------|-------|---------|---------|
| `tool-permissions` | 5 | `inline-list` | Allowed tools |
| `trigger-description` | 10 | `callout` | "When to use" callout |
| `design-principles` | 20 | `list` | Design principles with `**{{title}}:** {{rule}}` |
| `checklists` | 40 | `keyed-checklist` | Step-specific or global checklists |
| `examples` | 50 | `example-list` | Code examples |
| `references` | 60 | `link-list` | Reference links |
| `scaffolds` | 70 | `scaffold-list` | Scaffold templates |
| `content-sections` | 80 | `heading-body-list` | Multi-section content |
| `quick-reference` | 85 | `heading-body` | Single quick-reference section |
| `anti-patterns` | 90 | `bad-good` | Anti-patterns with bad/good examples |
| `validation-commands` | 95 | `code-list` | Bash validation commands |
| `related-workflows` | 100 | `table-list` (skill-md) / `slash-list` (cli-help) / `inline-list` (mcp-help) / `table-list` (rest-help) | Related skills — format-specific rendering |
| `companion-docs` | 105 | `companion-link-list` | Categorized companion document links |
| `example-walkthroughs` | 110 | `example-walkthroughs` | Walkthrough links with preamble |

#### Format-Specific Handler Overrides

The `related-workflows` handler demonstrates format-specific rendering — the same enrichment key produces different output per format:

| Format | Pattern | Output |
|--------|---------|--------|
| `skill-md` | `table-list` | Markdown table with `Skill` and `When to Use` columns |
| `cli-help` | `slash-list` | Bullet list with `/name — description` |
| `mcp-help` | `inline-list` | Comma-separated inline list |
| `rest-help` | `table-list` | Markdown table with `Endpoint` and `When to Use` columns |

#### Multi-Format Registration

Handlers are registered per format. All four text formats share the same enrichment keys but may use different patterns:

| Format | Used By | Variable Vocabulary |
|--------|---------|-------------------|
| `skill-md` | ClaudeSkillsTarget | `$ARGUMENTS`, `$CONCEPT` |
| `cli-help` | CliTarget | `<source>` (CLI positional arg style) |
| `mcp-help` | McpTarget | `{input}` (MCP input schema style) |
| `rest-help` | RestTarget | `{basePath}/{id}` (path parameter style) |

#### Utility Functions

**`interpolateVars(text, variables)`** — Replaces `$VARIABLE` placeholders in intro-template strings with target-specific values. Each target provides its own variable vocabulary:

```typescript
// Claude Skills
interpolateVars(template, { ARGUMENTS: 'concept spec file path', CONCEPT: 'SpecParser' });
// CLI
interpolateVars(template, { ARGUMENTS: '<source>' });
// MCP
interpolateVars(template, { ARGUMENTS: '{input}' });
// REST
interpolateVars(template, { ARGUMENTS: '{basePath}/{id}' });
```

**`filterByTier(items, tier)`** — Filters enrichment items by disclosure tier. Items without a `tier` field default to `inline`. Used for tier-based routing where `reference` items are emitted as companion files and `inline` items appear in the main document:

| Tier | Behavior |
|------|----------|
| `inline` | Rendered in the main document body (SKILL.md, help.md, api-docs.md) |
| `reference` | Emitted as a separate companion file alongside the main document |
| `summary` | Rendered as a compact summary with a link to the full companion file |

#### Adding a Custom Enrichment Kind

To render a new enrichment key (e.g. `migration-guide`), register a handler — no code needed:

```yaml
# In a YAML manifest or runtime registration
renderer:
  handlers:
    - key: migration-guide
      format: skill-md
      order: 75
      pattern: heading-body
      template: { heading: "Migration Guide" }
```

Or at runtime:
```typescript
registerCustomHandler('migration-guide', 'skill-md', 75, 'heading-body', { heading: 'Migration Guide' });
```


### 1.11 Workflow

Organizes concept actions into ordered, annotated workflow sequences for interface targets. The concept owns step ordering (structural) and opaque content passthrough for decorations. This is the structural enrichment companion to Annotation's metadata — Annotation says _what_ to enrich, Workflow says _in what order_.

Workflow was identified as independent through Jackson's decomposition: step ordering is a distinct concern from annotation (metadata), rendering (formatting), and projection (structural mappings). Each functions without the others.

```
@version(3)
concept Workflow [W] {

  purpose {
    Organize concept actions into ordered, annotated workflow
    sequences for interface targets. The concept owns step
    ordering (structural) and opaque content passthrough for
    decorations. Each target reads the content keys it
    understands (checklists, design-principles, anti-patterns,
    validation-commands, etc.) and ignores the rest. New
    decoration kinds require only a new YAML key and a
    renderer in the target provider — zero concept changes.
    See Architecture doc Section 1.11.
  }

  state {
    workflows: set W
    config {
      concept: W -> String
      steps: W -> list { action: String, title: String, prose: String, order: Int }
    }
    content: W -> String
  }

  actions {
    action define(concept: String, steps: list String, content: String) {
      -> ok(workflow: W, stepCount: Int) {
        Workflow created with ordered steps. Content JSON
        attached as opaque decoration.
      }
      -> invalidAction(action: String) {
        A step references an action not found in the concept.
      }
      -> emptySteps() {
        No steps were provided.
      }
    }

    action render(workflow: W, format: String) {
      -> ok(content: String) {
        Rendered workflow content in the requested format.
      }
      -> unknownFormat(format: String) {
        The requested format is not recognized.
      }
    }
  }
}
```

#### Workflow in the Interface Manifest

```yaml
concepts:
  Article:
    workflows:
      steps:
        - action: createArticle
          title: Create the article
          prose: Draft a new article with title, description, and body content
        - action: addTag
          title: Tag it
          prose: Add relevant tags for categorization
        - action: publishArticle
          title: Publish
          prose: Publish the article to make it visible to readers
      checklists:
        createArticle:
          - Provide title, description, body, and tags
          - Use markdown formatting for body content
      design-principles:
        - title: Slug Immutability
          rule: Once assigned, article slugs never change
      validation-commands:
        - label: Verify article created
          command: clef article list --limit 1
```

#### Step-Interleaved Content

Some enrichment keys support `afterStep` markers for step-specific placement:

```yaml
content-sections:
  - heading: "Important Note"
    body: "Check permissions before proceeding"
    afterStep: 1    # Rendered after step 1

validation-commands:
  - label: "Verify creation"
    command: "clef article list"
    afterStep: 1    # Rendered inline after step 1
  - label: "Verify full workflow"
    command: "clef article get --slug my-article"
    # No afterStep → rendered in global validation section
```

Targets that render workflows (e.g. ClaudeSkillsTarget) interleave step-specific content inline and collect global content into dedicated sections.


### 1.12 Grouping

Organizes concepts into named groups using structural or behavioral classification strategies. All interface targets can use grouping to organize their output (e.g., Claude Skills groups concepts into skill files, REST could group routes by domain, MCP could group tools vs resources). Each target has its own default grouping mode, but all 8 modes are available to all targets.

The Grouping concept was identified as independent through Jackson's decomposition methodology: adding grouping to Projection ("enrich AND organize") or Surface ("compose AND organize") would violate the singularity principle. Grouping doesn't reference other concepts' types, and they function without it.

```
@version(1)
concept Grouping [G] {

  purpose {
    Organize concepts into named groups using structural or
    behavioral classification strategies for interface generation
    targets. Structural strategies group by concept identity or
    kit membership. Behavioral strategies group by dominant action
    classification (CRUD role, read/write intent, event-producing
    status, or MCP resource type).
  }

  state {
    groupings: set G
    config {
      strategy: G -> String
      itemCount: G -> Int
    }
    result {
      entries: G -> list { name: String, description: String, members: list String }
    }
  }

  actions {
    action group(items: list String, config: String) {
      -> ok(grouping: G, groups: list String, groupCount: Int) {
        Apply the configured strategy to produce named groups.
        Each input item appears in exactly one group.
        Structural: per-concept, per-kit, single, custom.
        Behavioral: by-crud, by-intent, by-event, by-mcp-type.
      }
      -> invalidStrategy(strategy: String) {
        The config references an unknown grouping strategy.
      }
      -> emptyInput() {
        No items were provided to group.
      }
    }

    action classify(actionName: String) {
      -> ok(crudRole: String, intent: String, eventProducing: Bool, eventVerb: String, mcpType: String) {
        Classify a single action name by its operational properties.
        Pure computation, no state change.
        crudRole: create | read | update | delete | other.
        intent: read | write.
        eventProducing: true if side-effecting.
        mcpType: tool | resource | resource-template.
      }
    }
  }
}
```

#### Grouping Modes

| Mode | Type | Description | Example Use |
|------|------|-------------|-------------|
| `per-concept` | Structural | One group per concept (1:1) | Default for Claude Skills, CLI |
| `per-kit` | Structural | Group by kit membership | Kit-scoped API namespaces |
| `single` | Structural | All concepts in one group | Single OpenAPI spec, single MCP server |
| `custom` | Structural | Explicit user-defined groups | Manual domain grouping in manifest |
| `by-crud` | Behavioral | Group by dominant CRUD role | Separate read vs write API gateways |
| `by-intent` | Behavioral | Group by read vs write intent | Read replicas vs write endpoints |
| `by-event` | Behavioral | Event-producing vs read-only | AsyncAPI channel organization |
| `by-mcp-type` | Behavioral | Tool vs resource vs resource-template | MCP server capability grouping |

#### Action Classification

The `classify` action consolidates action classification heuristics previously scattered across handler implementations:

| Property | Source Logic | Values |
|----------|------------|--------|
| `crudRole` | Extracted from `inferHttpRoute` | create, read, update, delete, other |
| `intent` | Extracted from `inferGraphqlOp` | read, write |
| `eventProducing` | Moved from AsyncAPI target | true (side-effecting), false (read-only) |
| `eventVerb` | Moved from AsyncAPI target | created, updated, deleted, {name}Completed |
| `mcpType` | Extracted from `inferMcpType` | tool, resource, resource-template |

---

## Part 2: Target Provider Concepts

### 2.1 RestTarget

```
@version(2)
concept RestTarget [R] {

  purpose {
    Generate REST API code from concept projections. Owns
    HTTP method mappings, URL pattern derivation, status code
    tables, request/response serialization, and middleware
    integration. Produces route handlers, types, and enrichment-
    driven API documentation. Content field stores opaque
    enrichment for documentation rendering.
  }

  state {
    routes: set R
    config {
      basePath: R -> String
      framework: R -> String
      versioning: R -> option String
    }
    mapping {
      concept: R -> String
      action: R -> String
      method: R -> String
      path: R -> String
      statusCodes: R -> list { variant: String, code: Int }
    }
    content: R -> String
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(routes: list R, files: list String) {
        For each action in projection: derive HTTP method and
        path (from @http annotation or inference rules). Map
        action params to path params, query params, or request body.
        Map return variants to status codes. Generate route
        handler, request/response types, validation middleware.
        If enrichment exists, generate api-docs.md using the
        rest-help Renderer format.
      }
      -> ambiguousMapping(action: String, reason: String) {
        Can't determine HTTP method or path for a non-CRUD action
        without explicit @http annotation. Generates POST fallback
        with warning.
      }
    }
  }
}
```

#### Output Structure

Each concept produces route handlers and optional enrichment-driven documentation:

```
generated/interfaces/rest/{concept}/
├── routes.ts          # Hono route handler with kernel dispatch
└── api-docs.md        # Enrichment-driven API documentation (if enrichment exists)
```

**api-docs.md** is generated only when enrichment data exists in the interface manifest. It uses the `rest-help` Renderer format with path parameter variable vocabulary (`{basePath}/{id}`).

#### Intro-Template Support

RestTarget supports `intro-template` in annotations for customized API documentation introductions:

```yaml
annotations:
  concept:
    intro-template: >
      Manage $ARGUMENTS through the REST endpoint at {basePath}/{id}.
```

Variables are interpolated: `$ARGUMENTS` → action arguments, `{basePath}` → configured base path.


### 2.2 GraphqlTarget

```
@version(1)
concept GraphqlTarget [Q] {

  purpose {
    Generate GraphQL schema and resolvers from concept projections.
    Owns query/mutation/subscription classification, connection
    type generation (Relay spec), input/output type mapping,
    and DataLoader integration for cross-concept references.
  }

  state {
    types: set Q
    config {
      relay: Q -> Bool
      federation: Q -> Bool
      subscriptions: Q -> Bool
    }
    mapping {
      concept: Q -> String
      action: Q -> String
      operationType: Q -> String
      typeName: Q -> String
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(types: list Q, files: list String) {
        Classify actions as queries (read-only, no side effects),
        mutations (side-effecting), or subscriptions (streaming).
        Map concept state relations to GraphQL object types.
        Map action params to input types. Map return variants
        to union result types. Generate SDL schema + typed resolvers.
      }
      -> federationConflict(type: String, reason: String) {
        Type can't be federated (missing @key directive equivalent).
      }
    }
  }
}
```


### 2.3 GrpcTarget

```
@version(1)
concept GrpcTarget [G] {

  purpose {
    Generate Protocol Buffer definitions and gRPC service stubs
    from concept projections. Owns proto message derivation,
    service definition, streaming mode selection, and multi-
    language stub generation via protoc plugin architecture.
  }

  state {
    services: set G
    config {
      protoPackage: G -> String
      goPackage: G -> option String
      javaPackage: G -> option String
    }
    mapping {
      concept: G -> String
      action: G -> String
      rpcName: G -> String
      streamingMode: G -> String
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(services: list G, files: list String) {
        Map concept types to proto messages. Map actions to
        RPC methods. Map tagged union completions to oneof
        fields in response messages. Detect streaming actions
        and apply appropriate streaming mode (unary, server-stream,
        client-stream, bidirectional). Generate .proto file +
        server interface + client stubs.
      }
      -> protoIncompatible(type: String, reason: String) {
        A concept type can't be expressed in proto3
        (e.g. recursive types without indirection).
      }
    }
  }
}
```


### 2.4 CliTarget

```
@version(2)
concept CliTarget [C] {

  purpose {
    Generate CLI command trees from concept projections. Owns
    command/subcommand structure, flag derivation, argument
    mapping, output formatting (JSON/table/YAML), shell
    completion generation, and interactive mode for streaming.
    See Architecture doc Section 2.4.
  }

  state {
    commands: set C
    config {
      binaryName: C -> String
      shell: C -> String
      outputFormats: C -> list String
    }
    commandTree {
      parent: C -> option C
      name: C -> String
      description: C -> String
      children: C -> list C
      depth: C -> Int
    }
    mapping {
      concept: C -> String
      action: C -> String
      command: C -> String
      args: C -> list { name: String, kind: String, required: Bool, positional: Bool, choices: list String, default: String }
      flags: C -> list { name: String, type: String, required: Bool, description: String, short: String }
    }
    help {
      synopsis: C -> String
      longDescription: C -> option String
      examples: C -> list { description: String, command: String }
      seeAlso: C -> list String
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(commands: list String, files: list String) {
        CLI command tree generated from projection. Concept
        names become top-level command groups. Action names
        become subcommands. Flags derived from action parameters.
        Shell completion scripts produced for configured shells.
        Output formatters attached per command. Help text
        generated from concept purpose and action prose.
      }
      -> tooManyPositional(action: String, count: Int) {
        Action has more positional arguments than CLI
        conventions allow. Excess arguments should be
        converted to flags via annotation.
      }
    }

    action validate(command: C) {
      -> ok(command: C) {
        Command tree is well-formed. No flag name collisions.
        All required arguments have consistent types. Shell
        completion scripts are syntactically valid.
      }
      -> flagCollision(command: C, flag: String, actions: list String) {
        Two actions in the same command subtree define flags
        with the same name but different types.
      }
    }

    action listCommands(concept: String) {
      -> ok(commands: list String, subcommands: list String) {
        Return all generated commands and subcommands for
        a concept, including the full command tree hierarchy.
      }
    }
  }
}
```

#### Output Structure

Each concept produces a command tree and optional enrichment-driven documentation:

```
generated/interfaces/cli/{concept}/
├── {concept}.command.ts   # Commander.js command tree with help text + examples
└── {concept}.help.md      # Enrichment-driven CLI help documentation (if enrichment exists)
```

**{concept}.help.md** is generated only when enrichment data exists in the interface manifest. It uses the `cli-help` Renderer format with CLI variable vocabulary (`<source>`).

#### Intro-Template Support

CliTarget supports `intro-template` in annotations for customized help documentation introductions:

```yaml
annotations:
  concept:
    intro-template: >
      Parse and validate $ARGUMENTS using the spec-parser command.
```

Variables are interpolated: `$ARGUMENTS` → `<source>` (CLI positional argument style).

#### Concept-Overrides

The CLI generator reads both `concepts` and `concept-overrides` keys from the interface manifest. The `concept-overrides` key is used by manifests that list concepts as file paths (e.g. devtools-style manifests) and supports command name overrides and positional argument mappings:

```yaml
concept-overrides:
  SpecParser:
    command: check          # Override default "parse" → "check"
    positional:
      source: specs         # Map "source" param to "specs" positional arg
```

#### CLI Argument Derivation Rules

```
For each action parameter:
  1. Type-based:
     String, Int, Float → positional (if required, ≤3 total) or --flag
     Bool               → --flag / --no-flag
     Enum               → --flag {choice1,choice2,...}
     List               → --flag val1 --flag val2 (repeatable)
     Record / nested    → --from-file path.json or --json '{...}'
     Option T           → optional --flag (omit = null)

  2. Name-based overrides:
     *id, *Id            → positional argument (always)
     verbose, debug      → boolean flag
     output, format      → --output {json,table,yaml}
     file, path          → --file with path completion

  3. Return variant mapping:
     -> ok(...)          → exit 0, print result to stdout
     -> notFound(...)    → exit 1, "Not found: {details}" to stderr
     -> *Error(...)      → exit 1, error message to stderr
     -> unauthorized(...)→ exit 2, "Unauthorized" to stderr
```


### 2.5 McpTarget

```
@version(1)
concept McpTarget [M] {

  purpose {
    Generate MCP (Model Context Protocol) server implementations
    from concept projections. Owns tool/resource/template
    classification, input schema derivation, description
    generation for LLM comprehension, and transport setup
    (stdio, SSE, HTTP).
  }

  state {
    tools: set M
    config {
      serverName: M -> String
      transport: M -> String
      version: M -> String
    }
    mapping {
      concept: M -> String
      action: M -> String
      mcpType: M -> String
      toolName: M -> String
      description: M -> String
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(tools: list M, files: list String) {
        Classify actions:
          Side-effecting actions → Tools
          Read-only with ID param → Resources (URI template)
          Read-only list/search → Resource templates
        Derive inputSchema from action params (JSON Schema).
        Derive outputSchema from return variants.
        Generate description from concept purpose + action prose.
        Generate MCP server with tool/resource handlers.
      }
      -> tooManyTools(count: Int, limit: Int) {
        Kit produces more tools than MCP client limits (~128).
        Suggest grouping or filtering.
      }
    }
  }
}
```

#### Output Structure

Each concept produces MCP tool/resource definitions and optional enrichment-driven documentation:

```
generated/interfaces/mcp/{concept}/
├── {concept}.tools.ts     # Exported MCP entries array with tool/resource/resource-template definitions
└── {concept}.help.md      # Enrichment-driven MCP tool guide (if enrichment exists)
```

**{concept}.help.md** is generated only when enrichment data exists in the interface manifest. It uses the `mcp-help` Renderer format with MCP variable vocabulary (`{input}`).

#### Intro-Template Support

McpTarget supports `intro-template` in annotations for customized tool guide introductions:

```yaml
annotations:
  concept:
    intro-template: >
      Manage $ARGUMENTS through the MCP tool interface. Provide {input}
      as a structured JSON object matching the input schema.
```

Variables are interpolated: `$ARGUMENTS` → `{input}` (MCP input schema style).

#### MCP Classification Rules

```
For each action:
  1. Side-effecting (create, update, delete, any state mutation)
     → MCP Tool
       name: "{concept}_{action}" (snake_case)
       inputSchema: JSON Schema from action params
       description: concept purpose + action variant prose

  2. Read-only, requires ID parameter
     → MCP Resource
       uri: "{concept}://{id}" (URI template)
       description: action variant prose

  3. Read-only, list/search (no required ID)
     → MCP Resource Template
       uriTemplate: "{concept}://search?{queryParams}"

  4. Streaming actions (@streaming)
     → Tool with notification side-channel
       (MCP streaming support varies by client)

Tool naming: "{concept}_{action}" in snake_case
  e.g. todo_add, todo_list, todo_markComplete
  Kit prefix optional: "content_management_entity_create"
```


### 2.6 ClaudeSkillsTarget

```
@version(2)
concept ClaudeSkillsTarget [K] {

  purpose {
    Generate Claude Code skill files from concept projections.
    The concept owns identity (name, concept, grouping),
    structure (frontmatter, body, action mappings), and opaque
    content passthrough for enrichment. Each renderer reads the
    enrichment keys it understands (design-principles, workflow,
    checklists, references, examples, scaffolds, anti-patterns,
    trigger-description, validation-commands, etc.) and ignores
    the rest. New enrichment kinds require only a new YAML key
    and a renderer update — zero concept changes.
    See Architecture doc Section 2.6.
  }

  state {
    skills: set K
    config {
      name: K -> String
      progressive: K -> Bool
      grouping: K -> String
    }
    skillContent {
      concept: K -> String
      frontmatter: K -> String
      body: K -> String
    }
    content: K -> String
    mapping {
      concept: K -> String
      actionToCommand: K -> list { action: String, command: String }
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(skills: list K, files: list String) {
        Skill files generated. SKILL.md contains YAML frontmatter
        with name, description, allowed-tools, and argument-hint.
        Body contains either rich workflow-based content or flat
        command listing depending on available enrichment data.
      }
      -> missingProjection(concept: String) {
        No projection found for the specified concept.
      }
    }

    action validate(skill: K) {
      -> ok(skill: K) {
        SKILL.md has valid YAML frontmatter. All referenced
        scaffold files exist. All related skill names resolve.
      }
      -> invalidFrontmatter(skill: K, errors: list String) {
        YAML frontmatter is malformed or missing required fields.
      }
      -> brokenReferences(skill: K, missing: list String) {
        Referenced scaffold files or related skills do not exist.
      }
    }

    action listSkills(kit: String) {
      -> ok(skills: list String, enriched: list String, flat: list String) {
        Return all generated skills grouped by whether they
        have rich workflow-based content or flat command listings.
      }
    }
  }
}
```

#### Output Structure

Each concept produces two files, plus optional companion files:

```
generated/interfaces/claude-skills/{concept}/
├── SKILL.md                  # Markdown skill file with YAML frontmatter
├── {concept}.commands.ts     # TypeScript command runner
├── references/               # Companion files (from companion-docs or tier=reference items)
│   ├── sync-syntax.md
│   └── projection-rules.md
└── examples/                 # Example walkthroughs (from example-walkthroughs)
    └── basic-workflow.md
```

**Companion files** are emitted from two sources:
1. `companion-docs` enrichment key — explicitly declared companion documents
2. Items with `tier: reference` — automatically routed to separate files via `filterByTier()`

The main SKILL.md links to companion files where they're emitted. Reference-tier items appear as links rather than inline content.

**SKILL.md structure:**
```markdown
---
name: {concept-name}
description: {description from manifest}
argument-hint: {argument template or per-action hints}
allowed-tools: Read, Bash, Grep, Glob
---

# Create a New Clef Concept

> **When to use:** {trigger description or intro-template with $ARGUMENTS interpolated}

## Design Principles

- **Slug Immutability:** Once assigned, article slugs never change

## Step-by-Step Process

### Step 1: Create the article
{prose description}

Read [Concept Design Guide](references/concept-design.md) for context.

**Arguments:**
- `--title` (required): Article title
- `--body` (required): Article body

**Purpose checklist:**
- [ ] Provide title, description, body, and tags

*Verify creation:*
```bash
clef article list --limit 1
\```

#### Important Note
{content-section with afterStep: 1 rendered here}

### Step 2: Tag it
...

## Anti-Patterns
...

## Validation
...

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design concepts that syncs connect |
| `/create-sync` | Write syncs that connect concepts together |
```

#### Key Structural Features

| Feature | Annotation/Workflow Key | Behavior |
|---------|----------------------|----------|
| **Skill title** | `skill-title` (annotation) | Descriptive heading (e.g. "Create a New Clef Concept") instead of PascalCase concept name |
| **Intro-template** | `intro-template` (annotation) | Customized introduction with `$ARGUMENTS` and `$CONCEPT` variable interpolation |
| **Step references** | `step-references` (workflow) | Per-step inline reference links rendered as "Read [label](path) for context." |
| **Checklist labels** | `checklist-labels` (workflow) | Named checklists per step (e.g. "Purpose checklist") instead of generic "Checklist" |
| **Heading hierarchy** | (structural) | `## Step-by-Step Process` wrapper section with `### Step N` steps; content sections under steps use `####` |
| **Companion docs** | `companion-docs` (annotation) | Separate files emitted alongside SKILL.md with links in the main document |
| **Tier routing** | `tier` field on enrichment items | `inline` → main doc, `reference` → companion file, `summary` → compact link |

#### Intro-Template Variable Interpolation

```yaml
annotations:
  concept:
    intro-template: >
      Design a new concept named **$ARGUMENTS** following Jackson's
      methodology. The $CONCEPT concept handles parsing and validation.
```

`$ARGUMENTS` is replaced with the concept's argument-template value. `$CONCEPT` is replaced with the concept name. Without an intro-template, the generator falls back to the manifest's purpose statement.

#### Three Rendering Modes

| Mode | When | Content |
|------|------|---------|
| **Workflow-based** | `workflows[concept]` exists in manifest | Numbered steps with interleaved enrichment |
| **Flat** | Single concept, no workflow | Commands section with per-action subsections |
| **Multi-concept** | Grouping groups multiple concepts | Single SKILL.md per group with concept subsections |

#### Enrichment Merge Priority

When both Workflow and Annotation provide content for the same concept, workflow keys override annotation keys:

```
1. Annotation content (lower priority)
2. Workflow content (overrides annotation)
3. Structural keys excluded from merge: concept, steps, trigger-patterns,
   tool-permissions, argument-template, trigger-exclude
```


### 2.7 Spec Document Targets

#### OpenApiTarget

```
@version(1)
concept OpenApiTarget [O] {

  purpose {
    Generate OpenAPI 3.1 specification documents from concept
    projections. Produces a single document per suite covering
    all concepts. Includes paths, schemas, security schemes,
    and examples derived from concept invariants.
  }

  state {
    specs: set O
    document {
      version: O -> String
      paths: O -> Int
      schemas: O -> Int
    }
  }

  actions {
    action generate(projections: list String, config: String) {
      -> ok(spec: O, content: String) {
        Merge all concept projections into one OpenAPI document.
        Action params → request schemas. Return variants →
        response schemas per status code. Invariants → example
        request/response pairs. Traits → security schemes,
        pagination parameters.
      }
    }
  }
}
```

#### AsyncApiTarget

```
@version(1)
concept AsyncApiTarget [A] {

  purpose {
    Generate AsyncAPI 3.0 specification documents for event-
    driven concept interfaces. Covers sync-triggered events,
    streaming actions, and pub/sub patterns. Complements
    OpenAPI for request/response.
  }

  state {
    specs: set A
    document {
      version: A -> String
      channels: A -> Int
      operations: A -> Int
    }
  }

  actions {
    action generate(projections: list String, syncSpecs: list String, config: String) {
      -> ok(spec: A, content: String) {
        Map sync completions to channels. Map streaming actions
        to operations. Derive message schemas from completion
        variant types. Include protocol bindings (WebSocket,
        Kafka, AMQP) based on configured transport.
      }
    }
  }
}
```


### 2.8 SDK Language Targets

Each follows the same pattern. Two-layer architecture: generated outer layer (types, method signatures, serialization) + hand-maintained runtime (HTTP client, auth, retries, pagination helpers).

#### TsSdkTarget

```
@version(1)
concept TsSdkTarget [S] {

  purpose {
    Generate idiomatic TypeScript/JavaScript SDK client libraries.
    Produces typed methods, discriminated union return types,
    async/await patterns, and package.json with dependencies.
    Runtime layer handles fetch, auth, retries, serialization.
  }

  state {
    packages: set S
    config {
      packageName: S -> String
      runtime: S -> String
      moduleSystem: S -> String
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(package: S, files: list String) {
        Map concept types to TypeScript types. Map actions to
        async methods on client class. Map tagged union completions
        to discriminated unions ({ type: 'ok', ... } | { type: 'notFound', ... }).
        Generate client class with concept-namespaced method groups.
        Generate package.json, tsconfig.json, README.md.
      }
    }
  }
}
```

#### PySdkTarget

```
@version(1)
concept PySdkTarget [S] {

  purpose {
    Generate idiomatic Python SDK client libraries. Produces
    typed methods with dataclass return types, async support,
    and pyproject.toml. Follows Stripe/OpenAI SDK patterns.
  }

  state {
    packages: set S
    config {
      packageName: S -> String
      asyncSupport: S -> Bool
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(package: S, files: list String) {
        Map concept types to Python types with type hints.
        Map actions to methods. Map return variants to
        dataclasses with discriminator field. Generate client
        class, models module, pyproject.toml, py.typed marker.
      }
    }
  }
}
```

#### Other SDK Targets (same pattern)

| Provider | Sovereign State | Idiomatic Patterns |
|----------|----------------|-------------------|
| `GoSdkTarget` | Module path, go.mod | Structs, error returns `(T, error)`, context.Context |
| `RustSdkTarget` | Crate name, Cargo.toml | `Result<T, E>` enums, async/tokio, builder pattern |
| `JavaSdkTarget` | Maven coordinates, pom.xml | Sealed interfaces (17+), CompletableFuture, builder |
| `SwiftSdkTarget` | Package.swift, SPM config | Result type, Codable, async/await |


### 2.9 Shared Code Generation Utilities (codegen-utils)

All target providers share a common utility module that consolidates inference heuristics, enrichment extraction, type mapping, and naming conventions. This is implementation infrastructure, not a concept — it has no state, no actions, no invariants.

#### Enrichment Extraction

**`getManifestEnrichment(manifestYaml, conceptName)`** — Merges workflow and annotation enrichment from the interface manifest into a single record. Workflow keys take precedence over annotation keys. Structural keys (`concept`, `steps`, `trigger-patterns`, `tool-permissions`, `argument-template`, `trigger-exclude`) are excluded from the merge:

```typescript
const enrichment = getManifestEnrichment(manifest, 'SpecParser');
// Returns: { 'design-principles': [...], 'checklists': {...}, 'examples': [...], ... }
```

**`getEnrichmentContent(projection)`** — Extracts and parses the opaque `content` field from a projection into a typed record.

#### Hierarchical Trait Extraction

**`getHierarchicalTrait(manifestYaml, conceptName)`** — Extracts `@hierarchical` trait configuration from the manifest. Returns `null` if the concept has no hierarchical trait:

```typescript
const trait = getHierarchicalTrait(manifest, 'Category');
// Returns: { relation: 'parentOf', labelField: 'name', maxDepth: 5, style: 'nested' }
```

**`inferHierarchicalRoutes(basePath)`** — Generates children, ancestors, and descendants routes for hierarchical concepts.

#### Action Classification

**`classifyAction(actionName)`** — Consolidates action classification heuristics into a single call. Returns CRUD role, intent (read/write), event-producing flag, event verb, and MCP type. Used by Grouping and by targets for inference.

#### Concept Grouping

**`buildConceptGroups(manifests, config)`** — Organizes concepts into named groups using 8 strategies (see §1.12).

#### Type Mapping

Cross-language type mapping functions: `typeToTypeScript()`, `typeToPython()`, `typeToGo()`, `typeToRust()`, `typeToJava()`, `typeToSwift()`, `typeToProtobuf()`, `typeToGraphQL()`, `typeToJsonSchema()`.


### 2.10 Cross-Target Enrichment Rendering

All four text-generating targets (REST, CLI, MCP, Claude Skills) follow the same enrichment rendering pattern. The target owns structural rendering (route handlers, command trees, tool definitions, frontmatter), while the Renderer owns content formatting. This separation means enrichment keys added to any target's manifest are automatically rendered without target-specific code changes.

```
┌──────────────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Interface Manifest   │────▶│  codegen-utils│────▶│  Renderer        │
│ (workflows,          │     │  getManifest  │     │  renderContent() │
│  annotations)        │     │  Enrichment() │     │  (format-aware)  │
└──────────────────────┘     └──────────────┘     └────────┬─────────┘
                                                           │
                              ┌─────────────────────────────┤
                              ▼              ▼              ▼              ▼
                        ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
                        │ skill-md │  │ cli-help │  │ mcp-help │  │ rest-help│
                        │ SKILL.md │  │ help.md  │  │ help.md  │  │api-docs.md│
                        └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

Each target:
1. Calls `getManifestEnrichment()` to extract merged workflow+annotation enrichment
2. Calls `renderContent(enrichment, format)` with its target-specific format
3. Appends the rendered output to its documentation file
4. Only emits the documentation file if enrichment data exists

This design ensures that adding a new enrichment key to a manifest (e.g. `migration-guide`) and registering a handler for it in the Renderer causes all four targets to render it automatically — no per-target code changes needed.

---

## Part 3: Syncs — The Generation Flow

### 3.1 Entry Point: Pipeline Integration

```
# ConceptManifest generated → project for interface generation
sync ProjectOnManifest [eager] {
  when {
    SchemaGen/generate: [ spec: ?spec ]
      => ok[ manifest: ?manifest ]
  }
  where {
    # Only if interface generation is configured for this suite
    Generator: { ?plan config.targets: ?targets }
    filter(length(?targets) > 0)
  }
  then {
    Projection/project: [ manifest: ?manifest; annotations: ?annotations ]
  }
}
```


### 3.2 Core Generation Chain

```
# Projection complete → validate
sync ValidateProjection [eager] {
  when {
    Projection/project: [ manifest: ?manifest ]
      => ok[ projection: ?p ]
  }
  then {
    Projection/validate: [ projection: ?p ]
  }
}

# Validation passed → plan generation
sync PlanOnValid [eager] {
  when {
    Projection/validate: [ projection: ?p ]
      => ok[ projection: ?p ]
  }
  then {
    Generator/plan: [ kit: ?kit; interfaceManifest: ?manifest ]
  }
}

# Validation found breaking change → block unless forced
sync BlockOnBreaking [eager] {
  when {
    Projection/validate: [ projection: ?p ]
      => breakingChange[ projection: ?p; changes: ?changes ]
  }
  then {
    Generator/plan: [ kit: ?kit; interfaceManifest: ?manifest ]
    # Generator/plan checks for --breaking flag internally
  }
}

# Plan ready → generate
sync GenerateOnPlan [eager] {
  when {
    Generator/plan: [ kit: ?kit ]
      => ok[ plan: ?plan; targets: ?targets ]
  }
  then {
    Generator/generate: [ plan: ?plan ]
  }
}
```


### 3.3 Enrichment Pipeline

Before target dispatch, the Generator triggers the enrichment pipeline: annotations are resolved, workflows are defined, and the Renderer processes opaque enrichment JSON into format-specific output.

```
# Generator resolves annotations before target rendering.
# Annotations provide rich metadata (examples, references,
# tool permissions) that targets consume during output generation.
sync AnnotateBeforeGenerate [eager] {
  when {
    Generator/generate: [ plan: ?plan ]
      => [ plan: ?plan ]
  }
  then {
    Annotation/resolve: [ concept: ?concept ]
  }
}

# Generator triggers workflow definition before rendering target output.
# Workflow organizes actions into ordered, annotated sequences that
# each target renders in its natural format.
sync WorkflowBeforeRender [eager] {
  when {
    Generator/generate: [ plan: ?plan ]
      => [ plan: ?plan ]
  }
  then {
    Workflow/define: [ concept: ?concept; steps: ?steps; config: ?config ]
  }
}

# Render enrichment content before target output assembly.
# After workflow and annotation resolution, the Renderer
# processes opaque JSON into format-specific output that
# targets embed in their generated files.
sync RenderEnrichment [eager] {
  when {
    Workflow/define: [ concept: ?concept; steps: ?steps; content: ?content ]
      => [ workflow: ?w; stepCount: ?sc ]
  }
  then {
    Renderer/render: [ content: ?content; format: ?format ]
  }
}
```

The enrichment pipeline flows: `Generator/generate` → `Annotation/resolve` + `Workflow/define` → `Renderer/render` → target dispatch.


### 3.4 Concept Grouping

```
# Generator triggers concept grouping before dispatching to targets.
# Grouping organizes concepts into named groups using the configured
# strategy (per-concept, per-kit, single, custom, or behavioral modes).
sync GroupBeforeDispatch [eager] {
  when {
    Generator/generate: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  then {
    Grouping/group: [ items: ?items; config: ?config ]
  }
}
```


### 3.5 Target Routing

```
# Generator dispatches to Target for each configured target type
sync DispatchToTarget [eager] {
  when {
    Generator/generate: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  then {
    Target/generate: [ projection: ?projection; targetType: ?targetType;
      config: ?config ]
  }
}

# ─── Target Routing Syncs ───────────────────────────

sync RouteToRest [eager] {
  when {
    Target/generate: [ projection: ?p; targetType: "rest"; config: ?c ]
      => ok[ output: ?o ]
  }
  then {
    RestTarget/generate: [ projection: ?p; config: ?c ]
  }
}

sync RouteToGraphql [eager] {
  when {
    Target/generate: [ projection: ?p; targetType: "graphql"; config: ?c ]
      => ok[ output: ?o ]
  }
  then {
    GraphqlTarget/generate: [ projection: ?p; config: ?c ]
  }
}

sync RouteToGrpc [eager] {
  when {
    Target/generate: [ projection: ?p; targetType: "grpc"; config: ?c ]
      => ok[ output: ?o ]
  }
  then {
    GrpcTarget/generate: [ projection: ?p; config: ?c ]
  }
}

sync RouteToCli [eager] {
  when {
    Target/generate: [ projection: ?p; targetType: "cli"; config: ?c ]
      => ok[ output: ?o ]
  }
  then {
    CliTarget/generate: [ projection: ?p; config: ?c ]
  }
}

sync RouteToMcp [eager] {
  when {
    Target/generate: [ projection: ?p; targetType: "mcp"; config: ?c ]
      => ok[ output: ?o ]
  }
  then {
    McpTarget/generate: [ projection: ?p; config: ?c ]
  }
}

sync RouteToClaudeSkills [eager] {
  when {
    Target/generate: [ projection: ?p; targetType: "claude-skills"; config: ?c ]
      => ok[ output: ?o ]
  }
  then {
    ClaudeSkillsTarget/generate: [ projection: ?p; config: ?c ]
  }
}
```


### 3.6 SDK Routing

```
# Generator dispatches to Sdk for each configured language
sync DispatchToSdk [eager] {
  when {
    Generator/generate: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  then {
    Sdk/generate: [ projection: ?projection; language: ?lang;
      config: ?config ]
  }
}

sync RouteToTsSdk [eager] {
  when {
    Sdk/generate: [ projection: ?p; language: "typescript"; config: ?c ]
      => ok[ package: ?pkg ]
  }
  then {
    TsSdkTarget/generate: [ projection: ?p; config: ?c ]
  }
}

sync RouteToPySdk [eager] {
  when {
    Sdk/generate: [ projection: ?p; language: "python"; config: ?c ]
      => ok[ package: ?pkg ]
  }
  then {
    PySdkTarget/generate: [ projection: ?p; config: ?c ]
  }
}

# Same pattern for Go, Rust, Java, Swift...
```


### 3.7 Spec Document Routing

```
# Generator dispatches to Spec for each configured format
sync DispatchToSpec [eager] {
  when {
    Generator/generate: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  then {
    Spec/emit: [ projections: ?projections; format: ?format;
      config: ?config ]
  }
}

sync RouteToOpenApi [eager] {
  when {
    Spec/emit: [ projections: ?ps; format: "openapi"; config: ?c ]
      => ok[ document: ?d ]
  }
  then {
    OpenApiTarget/generate: [ projections: ?ps; config: ?c ]
  }
}

sync RouteToAsyncApi [eager] {
  when {
    Spec/emit: [ projections: ?ps; format: "asyncapi"; config: ?c ]
      => ok[ document: ?d ]
  }
  then {
    AsyncApiTarget/generate: [ projections: ?ps; syncSpecs: ?syncs;
      config: ?c ]
  }
}
```


### 3.8 Middleware Injection

```
# Any target provider complete → inject middleware
sync InjectMiddlewareRest [eager] {
  when {
    RestTarget/generate: [ projection: ?p ]
      => ok[ routes: ?routes; files: ?files ]
  }
  then {
    Middleware/resolve: [ traits: ?traits; target: "rest" ]
  }
}

sync InjectMiddlewareGraphql [eager] {
  when {
    GraphqlTarget/generate: [ projection: ?p ]
      => ok[ types: ?types; files: ?files ]
  }
  then {
    Middleware/resolve: [ traits: ?traits; target: "graphql" ]
  }
}

# Same pattern for gRPC, CLI, MCP...

sync InjectMiddlewareClaudeSkills [eager] {
  when {
    ClaudeSkillsTarget/generate: [ projection: ?p ]
      => ok[ skills: ?skills; files: ?files ]
  }
  then {
    Middleware/resolve: [ traits: ?traits; target: "claude-skills" ]
  }
}

# Middleware resolved → inject into output
sync ApplyMiddleware [eager] {
  when {
    Middleware/resolve: [ traits: ?traits; target: ?target ]
      => ok[ middlewares: ?middlewares; order: ?order ]
  }
  then {
    Middleware/inject: [ output: ?output; middlewares: ?middlewares;
      target: ?target ]
  }
}
```


### 3.9 Output Chain

```
# Middleware injected → write files
sync WriteOnInject [eager] {
  when {
    Middleware/inject: [ output: ?output; target: ?target ]
      => ok[ output: ?output; injectedCount: ?count ]
  }
  then {
    Emitter/write: [ path: ?path; content: ?content;
      target: ?target; concept: ?concept ]
  }
}

# File written → format
sync FormatOnWrite [eager] {
  when {
    Emitter/write: [ path: ?path ]
      => ok[ file: ?f; hash: ?h; written: true ]
  }
  then {
    Emitter/format: [ file: ?f; formatter: ?formatter ]
  }
}

# Skip formatting for unchanged files (written: false)
# — no sync fires, which is correct
```


### 3.10 Surface Composition

```
# All targets for a suite complete → compose surface
sync ComposeOnComplete [eager] {
  when {
    Generator/generate: [ plan: ?plan ]
      => ok[ plan: ?plan; filesGenerated: ?count ]
  }
  then {
    Surface/compose: [ kit: ?kit; target: ?target;
      outputs: ?outputs ]
  }
}

# Surface composed → write entrypoint
sync WriteEntrypoint [eager] {
  when {
    Surface/compose: [ kit: ?kit; target: ?target ]
      => ok[ surface: ?s; entrypoint: ?entry ]
  }
  then {
    Emitter/write: [ path: ?entryPath; content: ?entry;
      target: ?target; concept: "surface" ]
  }
}

# All writing complete → clean orphans
sync CleanOrphans [eventual] {
  when {
    Generator/generate: [ plan: ?plan ]
      => ok[ plan: ?plan ]
  }
  then {
    Emitter/clean: [ outputDir: ?dir; currentFiles: ?files ]
  }
}
```

---

## Part 4: Interface Manifest

The interface manifest (`app.interface.yaml`) declares generation targets and concept-level annotations. It's the Clef Bind analogue of `app.deploy.yaml`.

```yaml
# app.interface.yaml
interface:
  name: my-app
  version: 1.0.0

# ─── GENERATION TARGETS ──────────────────────────────
targets:
  rest:
    basePath: /api/v1
    framework: hono           # hono | express | fastify
    versioning: url           # url | header | none

  graphql:
    path: /graphql
    relay: true               # Relay-spec connections
    subscriptions: true
    federation: false

  grpc:
    package: myapp.v1
    goPackage: github.com/myapp/proto

  cli:
    name: myapp
    shell: bash,zsh,fish      # shell completion targets

  mcp:
    name: my-app-mcp
    transport: stdio          # stdio | sse | http

  claude-skills:
    progressive: true         # Level 0/1/2 progressive output
    grouping: per-concept     # per-concept | per-kit | single | custom | by-crud | ...

# ─── SDK LANGUAGES ────────────────────────────────────
sdk:
  typescript:
    packageName: "@myapp/client"
    moduleSystem: esm
  python:
    packageName: myapp-client
    asyncSupport: true
  go:
    modulePath: github.com/myapp/client-go

# ─── SPECIFICATION DOCUMENTS ─────────────────────────
specs:
  openapi: true
  asyncapi: true
  jsonschema: true

# ─── OUTPUT CONFIGURATION ────────────────────────────
output:
  dir: ./generated
  formatting:
    typescript: prettier
    python: black
    go: gofmt
    proto: buf
  clean: true                 # remove orphaned files

# ─── GLOBAL TRAITS ────────────────────────────────────
traits:
  - name: auth
    config:
      scheme: bearer
      scope: kit              # applies to all actions in kit

  - name: rateLimit
    config:
      requests: 100
      window: 60

  - name: validated
    scope: kit

# ─── PER-CONCEPT OVERRIDES ───────────────────────────
concepts:
  Todo:
    traits:
      - name: paginated
        config: { style: cursor }
        actions: [listTodos, searchTodos]

    # ─── ENRICHMENT (opaque content) ───────────────────
    annotations:
      concept:
        tool-permissions: [Read, Bash, Grep, Glob]
        trigger-description: "When a user asks to create or manage todos"
        design-principles:
          - title: Single Responsibility
            rule: Each todo owns its own completion state
      addTodo:
        examples:
          - label: "Create a simple todo"
            language: bash
            code: "clef todo add 'Buy groceries'"

    workflows:
      steps:
        - action: addTodo
          title: Create the todo
          prose: Add a new todo item to the list
        - action: markComplete
          title: Complete it
          prose: Mark the todo as done
      checklists:
        addTodo:
          - Provide descriptive todo text
          - Set priority if needed

    # ─── TARGET OVERRIDES ──────────────────────────────
    rest:
      path: /todos
      actions:
        addTodo:
          method: POST
          path: /todos
        removeTodo:
          method: DELETE
          path: /todos/{id}
        listTodos:
          method: GET
          path: /todos
          paginated: true
        markComplete:
          method: POST
          path: /todos/{id}/complete

    graphql:
      actions:
        addTodo: mutation
        removeTodo: mutation
        listTodos: query
        markComplete: mutation
        onTodoAdded: subscription    # maps to streaming action

    cli:
      actions:
        addTodo:
          command: add
          args:
            text: { positional: true }
        listTodos:
          command: list
          flags:
            status: { choices: [active, completed, all], default: all }

    mcp:
      actions:
        listTodos:
          type: resource-template   # override default classification
          uriTemplate: "todos://search?status={status}"

  User:
    rest:
      path: /users
    # Other targets use inference defaults

  Category:
    traits:
      - name: hierarchical
        config:
          relation: parentOf          # state relation encoding hierarchy
          labelField: name            # used for display/path resolution
          maxDepth: 5                 # optional depth limit
          style: nested               # nested | prefixed
        actions: [all]                # applies to all actions

    # Hierarchical concepts auto-generate additional routes/commands:
    # - REST: /categories/{id}/children, /categories/{id}/ancestors,
    #         /categories/{id}/descendants?depth=N
    # - CLI: `category tree`, --parent/--depth/--path flags
    # - GraphQL: children/parent/ancestors fields on Category type
    # - MCP: category://root/sub1/sub2 resource URIs
```

### Progressive Customization

The manifest supports three levels, matching Clef Surface's ladder:

**Level 0 — Zero-config:** Omit the `concepts:` section entirely. All mappings are inferred from action names and types using the rules in §1.1.

**Level 1 — Annotated:** Add per-concept overrides for specific actions that need non-default mappings. Everything else still inferred.

**Level 2 — Full control:** Specify every action's mapping explicitly. Override framework choices, add custom middleware, provide hand-written route handlers that the generated code calls.

---

## Part 5: Kit Packaging

```yaml
# suite.yaml for the Clef Bind
kit:
  name: interface
  version: 0.1.0
  description: >
    Multi-target interface generation for Clef applications.
    Generates REST APIs, GraphQL schemas, gRPC services, CLIs,
    MCP servers, SDKs, and specification documents from concept
    specs and an interface manifest.

concepts:
  # ─── Orchestration Concepts ─────────────────────────
  Projection:
    spec: ./concepts/projection.concept
    params:
      P: { as: projection-ref, description: "Reference to an enriched concept projection" }

  Generator:
    spec: ./concepts/generator.concept
    params:
      G: { as: generator-plan-ref, description: "Reference to a generation plan" }

  Emitter:
    spec: ./concepts/emitter.concept
    params:
      E: { as: emitter-file-ref, description: "Reference to a generated file" }

  Surface:
    spec: ./concepts/surface.concept
    params:
      S: { as: surface-ref, description: "Reference to a composed API surface" }

  Middleware:
    spec: ./concepts/middleware.concept
    params:
      M: { as: middleware-ref, description: "Reference to a middleware definition" }

  Grouping:
    spec: ./concepts/grouping.concept
    params:
      G: { as: grouping-ref, description: "Reference to a concept grouping result" }

  Workflow:
    spec: ./concepts/workflow.concept
    params:
      W: { as: workflow-ref, description: "Reference to an ordered action sequence" }

  Annotation:
    spec: ./concepts/annotation.concept
    params:
      N: { as: annotation-ref, description: "Reference to concept/action metadata" }

  Renderer:
    spec: ./concepts/renderer.concept
    params:
      R: { as: renderer-handler-ref, description: "Reference to a registered render handler" }

  # ─── Coordination Concepts ──────────────────────────
  Target:
    spec: ./concepts/target.concept
    params:
      T: { as: target-output-ref, description: "Reference to a target generation output" }

  Sdk:
    spec: ./concepts/sdk.concept
    params:
      S: { as: sdk-package-ref, description: "Reference to a generated SDK package" }

  Spec:
    spec: ./concepts/spec.concept
    params:
      D: { as: spec-document-ref, description: "Reference to a generated spec document" }

  # ─── Target Provider Concepts (load what you need) ──
  RestTarget:
    spec: ./concepts/providers/rest-target.concept
    params:
      R: { as: rest-route-ref, description: "Reference to a generated REST route" }
    optional: true

  GraphqlTarget:
    spec: ./concepts/providers/graphql-target.concept
    params:
      Q: { as: graphql-type-ref, description: "Reference to a generated GraphQL type" }
    optional: true

  GrpcTarget:
    spec: ./concepts/providers/grpc-target.concept
    params:
      G: { as: grpc-service-ref, description: "Reference to a generated gRPC service" }
    optional: true

  CliTarget:
    spec: ./concepts/providers/cli-target.concept
    params:
      C: { as: cli-command-ref, description: "Reference to a generated CLI command" }
    optional: true

  McpTarget:
    spec: ./concepts/providers/mcp-target.concept
    params:
      M: { as: mcp-tool-ref, description: "Reference to a generated MCP tool" }
    optional: true

  ClaudeSkillsTarget:
    spec: ./concepts/providers/claude-skills-target.concept
    params:
      K: { as: claude-skill-ref, description: "Reference to a generated Claude Code skill" }
    optional: true

  # ─── Spec Document Providers ────────────────────────
  OpenApiTarget:
    spec: ./concepts/providers/openapi-target.concept
    params:
      O: { as: openapi-spec-ref, description: "Reference to a generated OpenAPI spec" }
    optional: true

  AsyncApiTarget:
    spec: ./concepts/providers/asyncapi-target.concept
    params:
      A: { as: asyncapi-spec-ref, description: "Reference to a generated AsyncAPI spec" }
    optional: true

  # ─── SDK Language Providers (load what you need) ────
  TsSdkTarget:
    spec: ./concepts/providers/ts-sdk-target.concept
    params:
      S: { as: ts-sdk-package-ref, description: "Reference to a generated TypeScript SDK" }
    optional: true

  PySdkTarget:
    spec: ./concepts/providers/py-sdk-target.concept
    params:
      S: { as: py-sdk-package-ref, description: "Reference to a generated Python SDK" }
    optional: true

  GoSdkTarget:
    spec: ./concepts/providers/go-sdk-target.concept
    params:
      S: { as: go-sdk-module-ref, description: "Reference to a generated Go SDK module" }
    optional: true

  RustSdkTarget:
    spec: ./concepts/providers/rust-sdk-target.concept
    params:
      S: { as: rust-sdk-crate-ref, description: "Reference to a generated Rust SDK crate" }
    optional: true

  JavaSdkTarget:
    spec: ./concepts/providers/java-sdk-target.concept
    params:
      S: { as: java-sdk-artifact-ref, description: "Reference to a generated Java SDK artifact" }
    optional: true

  SwiftSdkTarget:
    spec: ./concepts/providers/swift-sdk-target.concept
    params:
      S: { as: swift-sdk-package-ref, description: "Reference to a generated Swift SDK package" }
    optional: true

syncs:
  required:
    - path: ./syncs/project-on-manifest.sync
    - path: ./syncs/validate-projection.sync
    - path: ./syncs/plan-on-valid.sync
    - path: ./syncs/generate-on-plan.sync
    - path: ./syncs/write-on-inject.sync
    - path: ./syncs/format-on-write.sync
    - path: ./syncs/group-before-dispatch.sync
    - path: ./syncs/workflow-before-render.sync
    - path: ./syncs/annotate-before-generate.sync
    - path: ./syncs/render-enrichment.sync

  recommended:
    - path: ./syncs/compose-on-complete.sync
      name: SurfaceComposition
    - path: ./syncs/clean-orphans.sync
      name: OrphanCleanup
    - path: ./syncs/block-on-breaking.sync
      name: BreakingChangeGuard

  integration:
    # Target dispatch and routing
    - path: ./syncs/dispatch-to-target.sync
    - path: ./syncs/dispatch-to-sdk.sync
    - path: ./syncs/dispatch-to-spec.sync
    - path: ./syncs/apply-middleware.sync
    - path: ./syncs/write-entrypoint.sync

    # Target routing
    - path: ./syncs/routing/route-to-rest.sync
    - path: ./syncs/routing/route-to-graphql.sync
    - path: ./syncs/routing/route-to-grpc.sync
    - path: ./syncs/routing/route-to-cli.sync
    - path: ./syncs/routing/route-to-mcp.sync
    - path: ./syncs/routing/route-to-claude-skills.sync

    # Spec routing
    - path: ./syncs/routing/route-to-openapi.sync
    - path: ./syncs/routing/route-to-asyncapi.sync

    # SDK routing
    - path: ./syncs/routing/route-to-ts-sdk.sync
    - path: ./syncs/routing/route-to-py-sdk.sync
    - path: ./syncs/routing/route-to-go-sdk.sync
    - path: ./syncs/routing/route-to-rust-sdk.sync
    - path: ./syncs/routing/route-to-java-sdk.sync
    - path: ./syncs/routing/route-to-swift-sdk.sync

    # Middleware injection
    - path: ./syncs/routing/inject-middleware-rest.sync
    - path: ./syncs/routing/inject-middleware-graphql.sync
    - path: ./syncs/routing/inject-middleware-grpc.sync
    - path: ./syncs/routing/inject-middleware-cli.sync
    - path: ./syncs/routing/inject-middleware-mcp.sync
    - path: ./syncs/routing/inject-middleware-claude-skills.sync
```

---

## Part 6: CLI Extensions

```bash
# ─── Generation ──────────────────────────────────────
clef interface generate                          # all configured targets
clef interface generate --target rest            # single target
clef interface generate --target rest,cli,mcp    # multiple targets
clef interface generate --sdk typescript         # single SDK language
clef interface generate --breaking               # allow breaking changes
clef interface generate --dry-run                # show what would be generated

# ─── Inspection ──────────────────────────────────────
clef interface plan                              # show generation plan
clef interface diff                              # diff against previous run
clef interface diff --target rest                # diff specific target
clef interface breaking                          # list breaking changes only

# ─── Projection ──────────────────────────────────────
clef interface project                           # project all concepts
clef interface project --concept Todo            # project single concept
clef interface project --show-inference          # show inferred mappings
clef interface project --show-traits             # show trait bindings

# ─── Surface ─────────────────────────────────────────
clef interface surface --target rest             # show composed REST surface
clef interface surface --target cli              # show CLI command tree
clef interface surface --target mcp              # show MCP tool listing

# ─── Validation ──────────────────────────────────────
clef interface validate                          # validate manifest + projections
clef interface lint --target openapi             # lint generated spec

# ─── SDK Publishing ──────────────────────────────────
clef interface publish --sdk typescript          # publish to npm
clef interface publish --sdk python              # publish to PyPI
clef interface publish --all                     # publish all configured SDKs

# ─── Emitter ─────────────────────────────────────────
clef interface files                             # list generated files
clef interface files --target rest               # list REST files only
clef interface clean                             # remove orphaned files
```

---

## Part 7: What This Enables

### The developer experience

```bash
# Write concepts and syncs (existing workflow)
# Add interface manifest:
cat app.interface.yaml
# targets:
#   rest: { basePath: /api/v1 }
#   cli: { name: myapp }
#   mcp: { name: myapp-mcp }
#   claude-skills: { progressive: true }
# sdk:
#   typescript: { packageName: "@myapp/client" }
# specs:
#   openapi: true

# One command to generate everything:
clef interface generate

# Output:
# Interface Generation Plan
# ├─ Kit: todo-app v1.0.0 (3 concepts: Todo, User, Session)
# ├─ Projection: 3 concepts, 12 actions, 8 traits
# ├─ Enrichment: 3 workflows, 9 annotations, 12 render handlers
# ├─ Targets:
# │  ├─ REST: 12 routes (4 inferred, 8 annotated) + 3 api-docs.md
# │  ├─ CLI: 12 commands under 3 groups + 3 help.md
# │  ├─ MCP: 8 tools, 3 resources, 1 resource template + 3 help.md
# │  └─ Claude Skills: 3 skills (3 workflow-enriched, 0 flat) + 5 companion files
# ├─ SDK: TypeScript (@myapp/client)
# ├─ Specs: OpenAPI 3.1
# ├─ Middleware: auth(bearer), rateLimit(100/60s), validated
# ├─ Enrichment docs: 12 files across 4 targets (rest-help, cli-help, mcp-help, skill-md)
# └─ Estimated: 65 files
#
# Pre-generation validation:
#   ✅ All annotations resolve
#   ✅ No breaking changes from previous run
#   ✅ Resource mappings consistent
#   ⚠  Todo.archiveCompleted: no @http annotation, inferred POST /todos/archive-completed
#
# Generated 53 files (12 unchanged, 41 written) in 2.3s
```

### What happens under the hood

1. `SchemaGen/generate` produces ConceptManifests for Todo, User, Session
2. `Projection/project` enriches each manifest with interface annotations + opaque content
3. `Projection/validate` checks for breaking changes against previous run
4. `Generator/plan` computes target list, concept list, estimated files
5. `Generator/generate` triggers the enrichment pipeline:
   - `Annotation/resolve` resolves per-concept and per-action metadata
   - `Workflow/define` creates ordered step sequences from manifest
   - `Renderer/render` processes enrichment JSON into format-specific output
6. `Grouping/group` organizes concepts into named groups (per-concept, by-crud, etc.)
7. `Generator/generate` dispatches to Target, Sdk, and Spec coordination concepts
8. Target routing: `Target/generate(targetType: "rest")` → `RestTarget/generate` (integration sync)
9. Target routing: `Target/generate(targetType: "claude-skills")` → `ClaudeSkillsTarget/generate`
10. `RestTarget/generate` produces route handlers + types + api-docs.md (enrichment-driven) per concept
11. `CliTarget/generate` produces command trees + help.md (enrichment-driven) per concept
12. `McpTarget/generate` produces tool/resource definitions + help.md (enrichment-driven) per concept
13. `ClaudeSkillsTarget/generate` produces SKILL.md + .commands.ts + companion files with enrichment rendering
14. Each text target calls `getManifestEnrichment()` → `renderContent(enrichment, format)` for documentation
15. `Middleware/resolve(traits: [auth, rateLimit, validated], target: "rest")` → ordered middleware chain
16. `Middleware/inject` wraps route handlers in middleware
17. `Emitter/write` writes files (content-addressed — skips unchanged)
18. `Emitter/format` runs prettier on written TypeScript files
19. `Surface/compose` merges per-concept REST routes into unified router
20. `Emitter/write` writes composed entrypoint (router.ts)
21. `Emitter/clean` removes orphaned files from previous runs
22. Parallel: same flow for all configured targets, SDKs, spec formats
23. `Spec/validate` runs OpenAPI linter on generated spec document

### Concept count

| Category | Concepts | Notes |
|----------|----------|-------|
| Orchestration | 5 | Projection, Generator, Emitter, Surface, Middleware |
| Enrichment | 3 | Annotation, Renderer, Workflow |
| Cross-cutting | 1 | Grouping |
| Coordination | 3 | Target, Sdk, Spec |
| Target providers | 6 | RestTarget, GraphqlTarget, GrpcTarget, CliTarget, McpTarget, ClaudeSkillsTarget |
| Spec providers | 2 | OpenApiTarget, AsyncApiTarget |
| SDK providers | 6 | TypeScript, Python, Go, Rust, Java, Swift |
| **Total** | **26** | 12 required + 14 optional providers |

### Integration with deploy kit

The Clef Bind and deploy kit compose naturally:

```yaml
# app.deploy.yaml references generated interfaces
runtimes:
  api:
    type: ecs-fargate
    entrypoint: ./generated/rest/router.ts    # from Clef Bind
  mcp:
    type: aws-lambda
    entrypoint: ./generated/mcp/server.ts     # from Clef Bind

# Claude Skills are deployed to .claude/skills/ (local, not remote)
# clef interface generate --target claude-skills copies to .claude/skills/
```

The deploy kit deploys what the Clef Bind generates. The Clef Bind generates what concept specs declare. Concept specs are the single source of truth.

### Parity Testing

The Clef Bind includes comprehensive parity tests ensuring generated output matches the quality and structure of handmade equivalents:

| Test Suite | Tests | Coverage |
|-----------|-------|---------|
| **CLI generation regression** | 111 | Per-command: subcommand names, positional args, required options, optional flags, --json flag, parameter types. Cross-cutting: concept-overrides applied, flag parity. |
| **Claude Skills generation parity** | 74 | Manifest → generated SKILL.md: frontmatter field coverage, workflow step titles/prose/checklists, annotation examples/references, command dispatch, per-concept structural checks, cross-target consistency. |
| **Handmade-vs-generated skills convention** | 53 | Generated skills follow handmade skill conventions: frontmatter fields (name, description, allowed-tools, argument-hint), markdown structure (H1, description paragraph, numbered steps), content quality (no truncated descriptions, valid tools), checklist/code block formatting. |
| **Behavioral parity (handler vs kernel)** | 32 | Direct handler calls produce identical results to kernel dispatch. Tests SpecParser, SchemaGen, and SyncCompiler across success/error/edge cases, full pipeline, storage side effects, and variant field consistency. |
| **Total** | **270** | |

These tests guard against convention drift — if a handmade skill is updated, the corresponding generated skill must match. The test infrastructure compares structural properties (heading levels, frontmatter keys, step counts) rather than exact string matching, allowing generated content to evolve while maintaining structural parity.

---

## Part 8: Architectural Decisions

### Why Projection is separate from SchemaGen

SchemaGen produces ConceptManifest — the language-neutral IR for code generation (types, handlers, tests). Projection enriches this with interface-specific metadata (HTTP mappings, CLI argument rules, trait bindings). Keeping them separate means:

1. ConceptManifest stays pure — no interface concerns leak into the core IR
2. The same ConceptManifest feeds TypeScriptGen, RustGen, AND the Clef Bind
3. Interface annotations can change without re-running SchemaGen
4. Multiple interface manifests can project the same concepts differently (e.g. internal API vs public API)

### Why three coordination concepts (Target, Sdk, Spec)

These are genuinely different domains despite surface similarity:

- **Target** generates runtime code (servers, handlers, command trees). Its providers produce code that _runs_.
- **Sdk** generates client libraries with package manifests, publish workflows, and cross-language consistency concerns. Its providers produce code that _calls_.
- **Spec** generates documents, not code. Its providers produce machine-readable descriptions that _describe_.

Different state, different lifecycle, different consumers. They pass the concept test independently.

### Why Middleware is a concept, not traits on Projection

Traits on Projection declare _intent_ (`@auth(bearer)`). Middleware owns the _implementation_ mapping from intent to per-target code. This separation means:

1. Adding a new target only requires registering middleware implementations — not changing trait definitions
2. Custom suites can register domain-specific middleware without modifying the Clef Bind
3. Middleware composition ordering is a real domain concern with its own state and conflict rules

### Why Surface exists

Without Surface, generating a suite with 5 concepts produces 5 independent REST APIs, 5 separate CLI binaries, 5 MCP servers. Surface composes them into cohesive interfaces — one API, one CLI, one MCP server. This is the Clef Bind analogue of Clef Surface's Composition kit (Dashboard, Workflow, App).

### Why Annotation, Workflow, and Renderer are separate concepts

These three enrichment concepts could appear to be one concept ("enrichment") but are genuinely independent through Jackson's decomposition:

- **Annotation** owns _what_ metadata exists for a concept (opaque key-value content). It functions without Workflow and Renderer.
- **Workflow** owns _step ordering_ — how actions sequence into a guided process. It functions without Annotation (steps can exist without metadata) and without Renderer (workflows can be consumed directly by targets).
- **Renderer** owns _formatting_ — how enrichment data produces output strings. It functions without Annotation (it renders any JSON) and without Workflow (it renders non-workflow content too).

This decomposition enables several composition patterns:
1. Annotation alone → flat skill with per-action metadata (examples, references)
2. Annotation + Workflow → workflow skill with step-interleaved metadata
3. Annotation + Renderer → auto-formatted enrichment for any target
4. All three → full enrichment pipeline with ordered, rendered output


### Why the opaque content model

The enrichment concepts (Annotation, Workflow, Projection) store metadata as `content: X -> String` — an opaque JSON string rather than typed fields. This design was chosen over hardcoded enrichment fields for extensibility:

1. **Zero concept changes for new enrichment kinds.** Adding a `migration-guide` enrichment key requires only a YAML entry and a Renderer handler — no concept spec updates.
2. **Targets interpret what they understand.** ClaudeSkillsTarget reads `tool-permissions` and `trigger-description`; a future RestTarget reads `rate-limit-config`. Each ignores the other's keys.
3. **YAML-shippable handlers.** The Renderer's pattern + template model means handler definitions are pure data. They can ship in kit YAML manifests, not code.
4. **Decoupled evolution.** New targets can introduce new enrichment keys without coordination with existing targets or concept specs.

The trade-off is weaker static guarantees — enrichment keys are strings, not typed fields. This is mitigated by the Renderer's `unhandledKeys` transparency: if a key has no handler, it appears in the render result for the target to decide how to handle.


### Why `@hierarchical` is a trait, not a Tree concept

The parent/children/depth pattern appears in at least 6 concepts across the Clef codebase (CliTarget, Outline, Namespace, Taxonomy, Clef Surface Element, Clef Surface Navigator). A general `Tree [T]` concept was considered — it would own reparent, getSubtree, cycle detection, and tree traversal as a reusable concept that domain concepts sync with.

The trait approach was chosen instead because:

1. **No shared state.** The tree structure _is_ the domain concept's state — a Category's parent-child relation is Category state, not Tree state. A Tree concept would either duplicate state or own state that belongs to Category. This violates concept independence.
2. **No shared actions.** "Reparent" means different things in different domains. Moving a CLI command is a generation-time restructuring. Moving an Outline node is a user action. Moving a Category is a domain operation with business rules. A generic `reparent` action would need domain-specific variants, defeating the purpose of generalization.
3. **The Clef Bind only needs the _shape_, not the _behavior_.** When Projection sees `@hierarchical(relation: parentOf)`, it reads the concept's state relation to derive nesting structure. It doesn't need tree traversal or cycle detection — those are implementation concerns handled by the concept's own handler.
4. **The trait composes with other traits.** `@hierarchical` + `@paginated` produces paginated children endpoints. `@hierarchical` + `@cached` produces cached subtree queries. A Tree concept would need explicit syncs to coordinate with each of these.

The trade-off is that concepts with hierarchical state must each implement their own tree operations (cycle detection, subtree queries, etc.). This is acceptable because those operations have domain-specific semantics — and existing concepts (Outline, Namespace, Taxonomy) already implement them independently.

The framework concept library _does_ provide tree-shaped concepts (Outline for content trees, Taxonomy for classification trees, Namespace for naming hierarchies) — but these are domain concepts, not structural abstractions. They pass the concept test independently.


### Why ClaudeSkillsTarget exists alongside CliTarget

Claude Code skills and CLIs serve different audiences and have different constraints:

- **CliTarget** produces command-line binaries with shell completion, man pages, and exit codes. Its audience is human developers running terminal commands.
- **ClaudeSkillsTarget** produces SKILL.md files with YAML frontmatter, guided workflows, and design principles. Its audience is an LLM (Claude) interpreting natural-language instructions.

The output formats are fundamentally different: CLIs need argument parsing, flag derivation, and exit code mapping. Skills need trigger descriptions, step-by-step prose, checklists, and anti-patterns. Conflating them would violate the singularity principle.


### Why enrichment-driven documentation generation across all text targets

All four text-generating targets (REST, CLI, MCP, Claude Skills) emit enrichment-driven documentation files (api-docs.md, help.md, SKILL.md) using the same Renderer infrastructure. This was a deliberate design choice over target-specific rendering:

1. **Single rendering codebase.** Adding a new enrichment key (e.g. `migration-guide`) with a Renderer handler causes all four targets to render it automatically. Without this, each target would need per-key rendering code — 4x the maintenance surface.
2. **Format-specific rendering via handler overrides.** The same `related-workflows` key renders as a table in skill-md, a slash-list in cli-help, and an inline-list in mcp-help. The Renderer's per-format handler registry handles this without conditional logic in targets.
3. **Documentation only when enrichment exists.** Targets only emit documentation files when the manifest provides enrichment data. A concept with no workflows or annotations gets no help.md — no empty file clutter.

The trade-off is an additional dependency: targets now depend on the Renderer concept. This is acceptable because enrichment rendering is Renderer's sole purpose, and targets already depend on Annotation and Workflow for structural enrichment data.


### Why intro-template variable interpolation

Handmade skills include contextual introductions like "Write a sync rule named **$ARGUMENTS** that connects concepts through completion chaining." Generated skills previously used the manifest's purpose statement verbatim, which reads like documentation rather than instruction.

The `intro-template` annotation with `$ARGUMENTS`/`$CONCEPT` variable interpolation bridges this gap:

1. **Each target provides its own variable vocabulary.** CLI uses `<source>` (positional arg style), MCP uses `{input}` (JSON schema style), REST uses `{basePath}/{id}` (path parameter style), Claude Skills uses the argument-template value. The shared `interpolateVars()` function handles substitution.
2. **Falls back gracefully.** Without an intro-template, targets use the manifest purpose — the same behavior as before the feature existed. No manifest changes required for existing concepts.
3. **One template, multiple targets.** The same intro-template produces target-appropriate introductions by interpolating target-specific variable values.


### Why companion file emission via tier routing

Handmade Claude Skills include 6–10 supporting files per skill (references, examples, templates). Generated skills previously emitted only SKILL.md + .commands.ts. Tier routing bridges this gap:

1. **`tier: reference` items** in enrichment data are automatically emitted as companion files alongside the main document. The main document includes links to these files.
2. **`companion-docs` enrichment key** allows explicit declaration of companion documents with path, content, and categorization.
3. **`filterByTier()`** partitions enrichment items into inline (main document), reference (companion file), and summary (compact link) tiers.

This design means the manifest controls progressive disclosure — what goes inline vs. what gets a separate file — without code changes in the generator.


### What remains pre-conceptual

Only the formatter binaries (prettier, black, gofmt, rustfmt, buf) and package registry clients (npm, pip, cargo). These are external tools with no state, no variants, no domain logic. Emitter calls them; they're `import` statements in handler implementations.