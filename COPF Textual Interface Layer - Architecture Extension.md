# COPF Interface Kit — Architecture Extension

## Design Principle

The same principle as the deploy kit: **the engine owns coordination mechanics, concepts own domain logic.** Interface generation is a domain — it has state (what interfaces have been generated, which versions, what broke), actions with meaningful variants (generate → ok | breakingChange | targetUnsupported), and coordination needs (syncs between parsing, projecting, generating, and emitting).

The interface kit plugs into the existing compiler pipeline at `SchemaGen/generate → ok(manifest)` — the same integration point as TypeScriptGen and RustGen. **ConceptManifest is already the IR.** The interface kit does not re-parse concept specs. It reads ConceptManifests, enriches them with interface-specific annotations from a manifest file, and generates target-specific output through the coordination + provider pattern.

### Integration with Existing Pipeline

```
SpecParser/parse → SchemaGen/generate → ConceptManifest
                                             │
                    ┌────────────────────────┤ (existing)
                    │                        │
              TypeScriptGen/generate    RustGen/generate
                                             │
                    ┌────────────────────────┤ (new — interface kit)
                    │                        │
              Projection/project    ──▶  Generator/generate
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                    Target/generate   Sdk/generate   Spec/emit
                         │                │              │
                    [routing]        [routing]       [routing]
                         │                │              │
                    RestTarget       TsSdkTarget    OpenApiTarget
                    GraphqlTarget    PySdkTarget    AsyncApiTarget
                    GrpcTarget       GoSdkTarget    ...
                    CliTarget        ...
                    McpTarget
```

### Relationship to COIF

COIF generates **visual** interfaces (forms, tables, dashboards) from concept specs. This kit generates **text-based, structured, composable** interfaces (APIs, CLIs, MCP servers, SDKs, spec documents) from the same specs. They share the same source of truth (ConceptManifest) and the same progressive customization principle:

| Level | COIF (UI) | Interface Kit (Non-UI) |
|-------|-----------|----------------------|
| Zero-config | Auto-generated CRUD forms | Auto-generated REST API + CLI |
| Annotated | Field display hints, layout overrides | `@http`, `@graphql`, `@cli` annotations |
| Custom | Headless components, custom renderers | Custom generator plugins, middleware |

---

## Conceptual Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         COPF Interface Kit                                    │
│                                                                              │
│  Orchestration Concepts:                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ Projection │ │ Generator  │ │  Emitter   │ │  Surface   │               │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘               │
│        │               │              │              │                       │
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
│  Cross-Cutting Concept:                                                      │
│  ┌────────────┐                                                              │
│  │ Middleware  │ (trait → per-target middleware projection)                   │
│  └────────────┘                                                              │
│                                                                              │
│  Syncs:                                                                      │
│  SchemaGen/generate → ok → Projection/project (entry point)                 │
│  Projection/project → ok → Generator/plan                                   │
│  Generator/generate → ok → Target/generate (per configured target)          │
│  Target/generate → [route] → RestTarget/generate (integration)              │
│  RestTarget/generate → ok → Middleware/inject                               │
│  Middleware/inject → ok → Emitter/write                                     │
│  [all targets complete] → Surface/compose                                   │
│  Surface/compose → ok → Emitter/write (composed output)                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Concepts

### 1.1 Projection

Takes ConceptManifests from SchemaGen and interface annotations from the interface manifest, produces enriched projections with resource mappings, trait bindings, and cross-concept type graphs. This is not a new IR — it's ConceptManifest + generation-specific metadata.

The academic term "projection" comes from multiparty session types (Honda, Yoshida, Carbone 2008): a global protocol projected into local endpoint interfaces. Here, a concept spec is the "global protocol" and each generated interface is a "local endpoint."

```
@version(1)
concept Projection [P] {

  purpose {
    Enrich ConceptManifests with interface generation metadata.
    Reads concept specs (via ConceptManifest from SchemaGen) and
    interface annotations (from app.interface.yaml), produces
    generation-ready projections with resource mappings, trait
    bindings, and cross-concept type graphs. One projection per
    concept per generation run.
  }

  state {
    projections: set P
    manifest {
      concept: P -> String
      kitName: P -> String
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
  }

  actions {
    action project(manifest: String, annotations: String) {
      -> ok(projection: P, shapes: Int, actions: Int, traits: Int) {
        Parse interface annotations. Merge with ConceptManifest.
        Compute resource mappings from state relations and action
        signatures. Bind traits to actions. Resolve cross-concept
        type references within the kit.
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
        and action signatures. Actions named create/add → POST,
        delete/remove → DELETE, list/find → GET, update/edit → PUT.
        Non-CRUD actions → POST to /resource/{id}/action-name.
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
    (a single OpenAPI document covers all concepts in a kit).
    Generator talks to Spec — never to format providers directly.
  }

  state {
    documents: set D
    registry {
      format: D -> String
      kitName: D -> String
      version: D -> String
      generatedAt: D -> DateTime
    }
    content: D -> String
  }

  actions {
    action emit(projections: list String, format: String, config: String) {
      -> ok(document: D, content: String) {
        Specification document generated covering all concepts
        in the projections list. Single document per kit per format.
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

Manages file output. Content-addressed (same input → same output hash → skip write). Handles formatting, diffing, and directory structure. The interface kit analogue of Artifact in the deploy kit.

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

Composes multiple concepts' generated interfaces into a cohesive API surface. A kit with 5 concepts should produce one REST API with routes for all 5, one GraphQL schema merging all 5, one CLI with subcommands for all 5 — not 5 separate interfaces.

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
        Deduplicate shared types. Apply kit-level middleware.
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

| Target | Composition Strategy | Entrypoint |
|--------|---------------------|------------|
| REST | Shared router, concept-prefixed routes (`/todos/*`, `/users/*`) | `router.ts` / `app.py` |
| GraphQL | Schema stitching, shared `Query`/`Mutation` root types | `schema.graphql` + `resolvers.ts` |
| gRPC | Multi-service proto package, shared message types | `service.proto` + `server.ts` |
| CLI | Root command, concept subcommands (`app todo add`, `app user list`) | `main.ts` / `main.go` |
| MCP | Combined tool set, concept-namespaced tool names | `mcp-server.ts` |
| SDK | Single client class, concept-namespaced method groups | `client.ts` / `client.py` |


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
        Used by custom kits to extend middleware for their domains.
      }
      -> duplicateRegistration(trait: String, target: String) {
        Implementation already registered. Use replace instead.
      }
    }
  }
}
```

#### Built-in Trait Projections

| Trait | REST | GraphQL | gRPC | CLI | MCP |
|-------|------|---------|------|-----|-----|
| `@auth(bearer)` | `Authorization` header validation | Context auth check | Metadata interceptor | `--token` flag or env var | OAuth 2.1 token flow |
| `@auth(apiKey)` | `X-API-Key` header | Context auth check | Metadata interceptor | `--api-key` flag or env var | API key in config |
| `@paginated(cursor)` | `?cursor=X&limit=N` query params | Connection type (Relay spec) | Repeated field + page_token | `--page-token`, `--limit` flags | Paginated tool result |
| `@paginated(offset)` | `?offset=N&limit=N` query params | `offset`/`limit` args | Offset + limit fields | `--offset`, `--limit` flags | Offset in input schema |
| `@idempotent` | `Idempotency-Key` header | `idempotencyKey` arg | Metadata entry | Auto-retry safe | Tool retry hint |
| `@rateLimit(N)` | `429` response + `Retry-After` | Error extension | `RESOURCE_EXHAUSTED` status | Backoff + retry | Backoff + retry |
| `@validated` | Request body JSON Schema validation | Input type validation | Proto field validation | Flag/arg validation | `inputSchema` constraints |
| `@deprecated(msg)` | `Deprecated` header + OpenAPI flag | `@deprecated` directive | Proto option | `[DEPRECATED]` in help | Tool description note |
| `@streaming(server)` | SSE / `Transfer-Encoding: chunked` | Subscription | Server-streaming RPC | `--follow` / streaming stdout | Notification stream |
| `@streaming(bidi)` | WebSocket upgrade | Subscription + mutation | Bidirectional RPC | Interactive mode | Not supported (skip) |
| `@cached(ttl)` | `Cache-Control` headers | `@cacheControl` directive | N/A (skip) | Local file cache | N/A (skip) |

---

## Part 2: Target Provider Concepts

### 2.1 RestTarget

```
@version(1)
concept RestTarget [R] {

  purpose {
    Generate REST API code from concept projections. Owns
    HTTP method mappings, URL pattern derivation, status code
    tables, request/response serialization, and middleware
    integration. Produces route handlers + types.
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
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(routes: list R, files: list String) {
        For each action in projection: derive HTTP method and
        path (from @http annotation or inference rules). Map
        action params to path params, query params, or request body.
        Map return variants to status codes. Generate route
        handler, request/response types, validation middleware.
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
@version(1)
concept CliTarget [C] {

  purpose {
    Generate CLI command trees from concept projections. Owns
    command/subcommand structure, flag derivation, argument
    mapping, output formatting (JSON/table/YAML), shell
    completion generation, and interactive mode for streaming.
  }

  state {
    commands: set C
    config {
      binaryName: C -> String
      shell: C -> option String
      outputFormats: C -> list String
    }
    mapping {
      concept: C -> String
      action: C -> String
      command: C -> String
      args: C -> list { name: String, kind: String, required: Bool }
    }
  }

  actions {
    action generate(projection: String, config: String) {
      -> ok(commands: list C, files: list String) {
        Concept name → command group. Action name → subcommand.
        Required scalar params → positional arguments.
        Optional params → flags (--flag value).
        Enum params → flag with choices (--status active|archived).
        Bool params → boolean flags (--verbose/--no-verbose).
        Complex params → JSON string or --from-file flag.
        Return variants → formatted stdout + exit codes.
        Generate command tree, completions, man pages.
      }
      -> tooManyPositional(action: String, count: Int) {
        More than 3 required params — CLI ergonomics suffer.
        Generates all as flags with warning.
      }
    }
  }
}
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


### 2.6 Spec Document Targets

#### OpenApiTarget

```
@version(1)
concept OpenApiTarget [O] {

  purpose {
    Generate OpenAPI 3.1 specification documents from concept
    projections. Produces a single document per kit covering
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


### 2.7 SDK Language Targets

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
    # Only if interface generation is configured for this kit
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


### 3.3 Target Routing

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
```


### 3.4 SDK Routing

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


### 3.5 Spec Document Routing

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


### 3.6 Middleware Injection

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


### 3.7 Output Chain

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


### 3.8 Surface Composition

```
# All targets for a kit complete → compose surface
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

The interface manifest (`app.interface.yaml`) declares generation targets and concept-level annotations. It's the interface kit analogue of `app.deploy.yaml`.

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
```

### Progressive Customization

The manifest supports three levels, matching COIF's ladder:

**Level 0 — Zero-config:** Omit the `concepts:` section entirely. All mappings are inferred from action names and types using the rules in §1.1.

**Level 1 — Annotated:** Add per-concept overrides for specific actions that need non-default mappings. Everything else still inferred.

**Level 2 — Full control:** Specify every action's mapping explicitly. Override framework choices, add custom middleware, provide hand-written route handlers that the generated code calls.

---

## Part 5: Kit Packaging

```yaml
# kit.yaml for the interface kit
kit:
  name: interface
  version: 0.1.0
  description: >
    Multi-target interface generation for COPF applications.
    Generates REST APIs, GraphQL schemas, gRPC services, CLIs,
    MCP servers, SDKs, and specification documents from concept
    specs and an interface manifest.

concepts:
  # ─── Orchestration Concepts ─────────────────────────
  Projection:
    spec: ./concepts/projection.concept
    params:
      P: { as: projection-ref }

  Generator:
    spec: ./concepts/generator.concept
    params:
      G: { as: generator-plan-ref }

  Emitter:
    spec: ./concepts/emitter.concept
    params:
      E: { as: emitter-file-ref }

  Surface:
    spec: ./concepts/surface.concept
    params:
      S: { as: surface-ref }

  Middleware:
    spec: ./concepts/middleware.concept
    params:
      M: { as: middleware-ref }

  # ─── Coordination Concepts ──────────────────────────
  Target:
    spec: ./concepts/target.concept
    params:
      T: { as: target-output-ref }

  Sdk:
    spec: ./concepts/sdk.concept
    params:
      S: { as: sdk-package-ref }

  Spec:
    spec: ./concepts/spec.concept
    params:
      D: { as: spec-document-ref }

  # ─── Target Provider Concepts (load what you need) ──
  RestTarget:
    spec: ./concepts/providers/rest-target.concept
    optional: true

  GraphqlTarget:
    spec: ./concepts/providers/graphql-target.concept
    optional: true

  GrpcTarget:
    spec: ./concepts/providers/grpc-target.concept
    optional: true

  CliTarget:
    spec: ./concepts/providers/cli-target.concept
    optional: true

  McpTarget:
    spec: ./concepts/providers/mcp-target.concept
    optional: true

  # ─── Spec Document Providers ────────────────────────
  OpenApiTarget:
    spec: ./concepts/providers/openapi-target.concept
    optional: true

  AsyncApiTarget:
    spec: ./concepts/providers/asyncapi-target.concept
    optional: true

  # ─── SDK Language Providers (load what you need) ────
  TsSdkTarget:
    spec: ./concepts/providers/ts-sdk-target.concept
    optional: true

  PySdkTarget:
    spec: ./concepts/providers/py-sdk-target.concept
    optional: true

  GoSdkTarget:
    spec: ./concepts/providers/go-sdk-target.concept
    optional: true

  RustSdkTarget:
    spec: ./concepts/providers/rust-sdk-target.concept
    optional: true

  JavaSdkTarget:
    spec: ./concepts/providers/java-sdk-target.concept
    optional: true

  SwiftSdkTarget:
    spec: ./concepts/providers/swift-sdk-target.concept
    optional: true

syncs:
  required:
    - path: ./syncs/project-on-manifest.sync
    - path: ./syncs/validate-projection.sync
    - path: ./syncs/plan-on-valid.sync
    - path: ./syncs/generate-on-plan.sync
    - path: ./syncs/write-on-inject.sync
    - path: ./syncs/format-on-write.sync

  recommended:
    - path: ./syncs/compose-on-complete.sync
      name: SurfaceComposition
    - path: ./syncs/clean-orphans.sync
      name: OrphanCleanup
    - path: ./syncs/block-on-breaking.sync
      name: BreakingChangeGuard

  # ─── Target Routing Syncs ──────────────────────────
  integration:
    # Target routing
    - path: ./syncs/routing/route-to-rest.sync
    - path: ./syncs/routing/route-to-graphql.sync
    - path: ./syncs/routing/route-to-grpc.sync
    - path: ./syncs/routing/route-to-cli.sync
    - path: ./syncs/routing/route-to-mcp.sync

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
```

---

## Part 6: CLI Extensions

```bash
# ─── Generation ──────────────────────────────────────
copf interface generate                          # all configured targets
copf interface generate --target rest            # single target
copf interface generate --target rest,cli,mcp    # multiple targets
copf interface generate --sdk typescript         # single SDK language
copf interface generate --breaking               # allow breaking changes
copf interface generate --dry-run                # show what would be generated

# ─── Inspection ──────────────────────────────────────
copf interface plan                              # show generation plan
copf interface diff                              # diff against previous run
copf interface diff --target rest                # diff specific target
copf interface breaking                          # list breaking changes only

# ─── Projection ──────────────────────────────────────
copf interface project                           # project all concepts
copf interface project --concept Todo            # project single concept
copf interface project --show-inference          # show inferred mappings
copf interface project --show-traits             # show trait bindings

# ─── Surface ─────────────────────────────────────────
copf interface surface --target rest             # show composed REST surface
copf interface surface --target cli              # show CLI command tree
copf interface surface --target mcp              # show MCP tool listing

# ─── Validation ──────────────────────────────────────
copf interface validate                          # validate manifest + projections
copf interface lint --target openapi             # lint generated spec

# ─── SDK Publishing ──────────────────────────────────
copf interface publish --sdk typescript          # publish to npm
copf interface publish --sdk python              # publish to PyPI
copf interface publish --all                     # publish all configured SDKs

# ─── Emitter ─────────────────────────────────────────
copf interface files                             # list generated files
copf interface files --target rest               # list REST files only
copf interface clean                             # remove orphaned files
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
# sdk:
#   typescript: { packageName: "@myapp/client" }
# specs:
#   openapi: true

# One command to generate everything:
copf interface generate

# Output:
# Interface Generation Plan
# ├─ Kit: todo-app v1.0.0 (3 concepts: Todo, User, Session)
# ├─ Projection: 3 concepts, 12 actions, 8 traits
# ├─ Targets:
# │  ├─ REST: 12 routes (4 inferred, 8 annotated)
# │  ├─ CLI: 12 commands under 3 groups
# │  └─ MCP: 8 tools, 3 resources, 1 resource template
# ├─ SDK: TypeScript (@myapp/client)
# ├─ Specs: OpenAPI 3.1
# ├─ Middleware: auth(bearer), rateLimit(100/60s), validated
# └─ Estimated: 47 files
#
# Pre-generation validation:
#   ✅ All annotations resolve
#   ✅ No breaking changes from previous run
#   ✅ Resource mappings consistent
#   ⚠  Todo.archiveCompleted: no @http annotation, inferred POST /todos/archive-completed
#
# Generated 47 files (12 unchanged, 35 written) in 2.3s
```

### What happens under the hood

1. `SchemaGen/generate` produces ConceptManifests for Todo, User, Session
2. `Projection/project` enriches each manifest with interface annotations
3. `Projection/validate` checks for breaking changes against previous run
4. `Generator/plan` computes target list, concept list, estimated files
5. `Generator/generate` dispatches to Target, Sdk, and Spec coordination concepts
6. Target routing: `Target/generate(targetType: "rest")` → `RestTarget/generate` (integration sync)
7. `RestTarget/generate` produces route handlers + types per concept
8. `Middleware/resolve(traits: [auth, rateLimit, validated], target: "rest")` → ordered middleware chain
9. `Middleware/inject` wraps route handlers in middleware
10. `Emitter/write` writes files (content-addressed — skips unchanged)
11. `Emitter/format` runs prettier on written TypeScript files
12. `Surface/compose` merges per-concept REST routes into unified router
13. `Emitter/write` writes composed entrypoint (router.ts)
14. `Emitter/clean` removes orphaned files from previous runs
15. Parallel: same flow for CLI, MCP, TypeScript SDK, OpenAPI spec
16. `Spec/validate` runs OpenAPI linter on generated spec document

### Concept count

| Category | Concepts | Notes |
|----------|----------|-------|
| Orchestration | 5 | Projection, Generator, Emitter, Surface, Middleware |
| Coordination | 3 | Target, Sdk, Spec |
| Target providers | 5 | RestTarget, GraphqlTarget, GrpcTarget, CliTarget, McpTarget |
| Spec providers | 2 | OpenApiTarget, AsyncApiTarget |
| SDK providers | 6 | TypeScript, Python, Go, Rust, Java, Swift |
| **Total** | **21** | 8 required + 13 optional providers |

### Integration with deploy kit

The interface kit and deploy kit compose naturally:

```yaml
# app.deploy.yaml references generated interfaces
runtimes:
  api:
    type: ecs-fargate
    entrypoint: ./generated/rest/router.ts    # from interface kit
  mcp:
    type: aws-lambda
    entrypoint: ./generated/mcp/server.ts     # from interface kit
```

The deploy kit deploys what the interface kit generates. The interface kit generates what concept specs declare. Concept specs are the single source of truth.

---

## Part 8: Architectural Decisions

### Why Projection is separate from SchemaGen

SchemaGen produces ConceptManifest — the language-neutral IR for code generation (types, handlers, tests). Projection enriches this with interface-specific metadata (HTTP mappings, CLI argument rules, trait bindings). Keeping them separate means:

1. ConceptManifest stays pure — no interface concerns leak into the core IR
2. The same ConceptManifest feeds TypeScriptGen, RustGen, AND the interface kit
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
2. Custom kits can register domain-specific middleware without modifying the interface kit
3. Middleware composition ordering is a real domain concern with its own state and conflict rules

### Why Surface exists

Without Surface, generating a kit with 5 concepts produces 5 independent REST APIs, 5 separate CLI binaries, 5 MCP servers. Surface composes them into cohesive interfaces — one API, one CLI, one MCP server. This is the interface kit analogue of COIF's Composition kit (Dashboard, Workflow, App).

### What remains pre-conceptual

Only the formatter binaries (prettier, black, gofmt, rustfmt, buf) and package registry clients (npm, pip, cargo). These are external tools with no state, no variants, no domain logic. Emitter calls them; they're `import` statements in handler implementations.