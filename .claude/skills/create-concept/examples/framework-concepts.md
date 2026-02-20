# Framework Concept Examples

Examples from the COPF framework layer (`specs/framework/`) — these are infrastructure concepts that the framework itself uses. They demonstrate how to apply concept design to tools, pipelines, and runtime infrastructure.

## Example 1: SchemaGen — Pure Transformation

**Design rationale**: SchemaGen transforms parsed concept ASTs into language-neutral ConceptManifests. It's a pure function with no real persistent state — it just maps input to output. The invariant uses record literals to pass a minimal-but-real AST.

```
concept SchemaGen [S] {

  purpose {
    Transform parsed concept ASTs into rich, language-neutral
    ConceptManifests. The manifest contains everything a code
    generator needs: relation schemas (after merge/grouping),
    fully typed action signatures, structured invariants with
    test values, GraphQL schema fragments, and JSON Schemas.
  }

  state {
    manifests: S -> ConceptManifest
  }

  actions {
    action generate(spec: S, ast: AST) {
      -> ok(manifest: ConceptManifest) {
        Apply state grouping/merge rules to produce relation schemas.
        Resolve all types into ResolvedType trees.
        Transform invariants into structured test scenarios with
        deterministic test IDs for free variables.
        Generate GraphQL schema fragment from relation schemas.
        Generate JSON Schemas for each action invocation/completion.
        Package everything into a ConceptManifest.
      }
      -> error(message: String) {
        If the AST contains unresolvable types or inconsistencies.
      }
    }
  }

  invariant {
    after generate(spec: "s1", ast: {
      name: "Ping", typeParams: ["T"], purpose: "A test.",
      state: [], actions: [{
        name: "ping", params: [],
        variants: [{ name: "ok", params: [], description: "Pong." }]
      }], invariants: [], capabilities: []
    }) -> ok(manifest: m)
    then generate(spec: "s2", ast: { name: "" }) -> error(message: e)
  }
}
```

**Design notes**:
- **Invariant via Pattern 8**: Passes a minimal ConceptAST record with one action and one variant for the happy path, then tests that an empty-name AST triggers an error. Uses nested record/list literals.
- **Custom types**: Uses `ConceptManifest` and `AST` — framework-specific types
- **Single action**: One transformation, two outcomes (ok/error)
- **State is output-focused**: `manifests: S -> ConceptManifest` stores results keyed by spec reference

## Example 2: Registry — Runtime Service Management

```
concept Registry [C] {

  purpose {
    Track deployed concepts, their locations, and availability.
  }

  state {
    concepts: set C
    uri: C -> String
    transport: C -> TransportConfig
    available: C -> Bool
  }

  actions {
    action register(uri: String, transport: TransportConfig) {
      -> ok(concept: C) {
        Register a concept at the given URI with its transport
        configuration. Assign a unique concept reference.
      }
      -> error(message: String) {
        If the URI is already registered, return error.
      }
    }

    action deregister(uri: String) {
      -> ok() {
        Remove the concept registration for the given URI.
      }
    }

    action heartbeat(uri: String) {
      -> ok(available: Bool) {
        Check whether the concept at the given URI is reachable
        and return its availability status.
      }
    }
  }

  invariant {
    after register(uri: "test://concept-a", transport: "in-process") -> ok(concept: c)
    then heartbeat(uri: "test://concept-a") -> ok(available: true)
  }
}
```

**Design notes**:
- **Create-then-query invariant**: Registers a concept then verifies it's available via heartbeat — demonstrates the operational principle
- **Entity collection pattern**: `concepts: set C` with associated properties
- **Runtime concept**: Manages live concept instances, not data entities
- **Domain-specific actions**: `register`/`deregister`/`heartbeat` instead of generic CRUD

## Example 3: SyncEngine — Complex Orchestration

**Design rationale**: SyncEngine is the most complex framework concept. It evaluates synchronization rules against completions, producing invocations. The invariant tests the core register-then-match flow with structured sync and completion records.

```
concept SyncEngine [F] {

  purpose {
    Evaluate synchronizations by matching completions,
    querying state, and producing invocations.
    Supports annotation-aware routing: eager syncs evaluate
    immediately, eventual syncs queue when targets are
    unavailable, local syncs execute on same runtime only.
  }

  state {
    syncs: set SyncRegistration
    pendingFlows: set F
    pendingQueue: list PendingSyncEntry
    conflicts: list ActionCompletion
  }

  actions {
    action registerSync(sync: CompiledSync) {
      -> ok() {
        Register a compiled synchronization for evaluation.
        Index it by concept/action pairs in its when clause.
      }
    }

    action onCompletion(completion: ActionCompletion) {
      -> ok(invocations: list ActionInvocation) {
        Receive a completion, find all syncs that should fire,
        evaluate their where clauses, and produce invocations.
      }
    }

    // ... additional actions: evaluateWhere, queueSync,
    //     onAvailabilityChange, drainConflicts
  }

  invariant {
    after registerSync(sync: {
      name: "TestSync", annotations: ["eager"],
      when: [{ concept: "urn:copf/Test", action: "act",
               inputFields: [], outputFields: [] }],
      where: [],
      then: [{ concept: "urn:copf/Other", action: "do", fields: [] }]
    }) -> ok()
    then onCompletion(completion: {
      id: "c1", concept: "urn:copf/Test", action: "act",
      input: {}, variant: "ok", output: {}, flow: "f1",
      timestamp: "2024-01-01T00:00:00Z"
    }) -> ok(invocations: inv)
  }
}
```

**Design notes**:
- **Two-step invariant with structured records**: Registers a compiled sync rule (with when/where/then structure), then fires a matching completion to verify invocations are produced
- **Rich custom types**: `CompiledSync`, `SyncRegistration`, `ActionInvocation`, `ActionCompletion`
- **Record literals are essential**: The sync and completion objects have deeply nested structure that can't be expressed with just strings and numbers

## Example 4: ActionLog — Append-Only Audit Trail

```
concept ActionLog [R] {

  purpose {
    Append-only log of action invocations and completions
    for audit, replay, and sync evaluation.
  }

  state {
    records: set R
    record: R -> ActionRecord
    edges: R -> list { target: R, sync: String }
  }

  actions {
    action append(id: R, record: ActionRecord) {
      -> ok(id: R) {
        Add the record to the log.
      }
    }

    action query(concept: String, action: String, flow: String) {
      -> ok(records: list ActionRecord) {
        Return matching records filtered by concept, action, and flow.
      }
    }

    action link(source: R, target: R, sync: String) {
      -> ok(source: R) {
        Create a causal edge from source to target labeled with sync name.
      }
    }
  }
}
```

**Design notes**:
- **Append-only**: No delete or update actions — immutable log
- **Edge state**: `edges` tracks causal relationships between records (which sync caused what)
- **Inline record type**: `list { target: R, sync: String }` for edge data
- **Three actions**: append, query, link — minimal but complete

## Example 5: DeploymentValidator — Multi-Outcome Validation

**Design rationale**: DeploymentValidator has TWO invariants — one testing the parse→validate pipeline, one testing valid vs. invalid JSON parsing. This demonstrates using multiple `invariant` blocks for different scenarios.

```
concept DeploymentValidator [M] {

  purpose {
    Parse and validate deployment manifests against compiled concepts
    and syncs. Produce deployment plans with transport assignments,
    runtime mappings, and sync-to-engine bindings.
  }

  state {
    manifests: set M
    plan: M -> DeploymentPlan
    issues: M -> list ValidationIssue
  }

  actions {
    action parse(raw: String) {
      -> ok(manifest: M) {
        Parse YAML deployment manifest into structured form.
        Validate basic structure (required fields, known runtime types).
      }
      -> error(message: String) {
        If YAML is malformed or required fields are missing.
      }
    }

    action validate(manifest: M, concepts: list ConceptManifest, syncs: list CompiledSync) {
      -> ok(plan: DeploymentPlan) {
        Cross-reference manifest against compiled concepts and syncs.
      }
      -> warning(plan: DeploymentPlan, issues: list String) {
        Validation passed but with non-fatal issues.
      }
      -> error(issues: list String) {
        Fatal validation failures.
      }
    }
  }

  invariant {
    after parse(raw: "{\"app\":{\"name\":\"myapp\",...}}") -> ok(manifest: m)
    then validate(manifest: m) -> error(issues: i)
  }

  invariant {
    after parse(raw: "{\"app\":{\"name\":\"t\",...}}") -> ok(manifest: m)
    then parse(raw: "not json") -> error(message: e)
  }
}
```

**Design notes**:
- **Two invariants**: One tests the parse→validate flow (parsed but empty manifest fails validation), another tests valid vs. invalid JSON parsing
- **Three-outcome variant**: `ok`, `warning`, `error` — the only concept with `warning`
- **String literals for JSON**: The raw input is a JSON string, showing how string literals can carry structured data when the handler itself does the parsing

## Example 6: TypeScriptGen — Code Generator with Structured Manifest

**Design rationale**: Code generators accept a ConceptManifest record and produce files. The invariant uses the manifest's actual schema structure (`tag`/`fields`/`prose` for variants, not AST-level `name`/`params`/`description`).

```
concept TypeScriptGen [S] {

  purpose {
    Generate TypeScript skeleton code from a ConceptManifest.
    Produces type definitions, handler interface, transport adapter,
    lite query implementation, and conformance tests.
  }

  state {
    outputs: S -> list { path: String, content: String }
  }

  actions {
    action generate(spec: S, manifest: ConceptManifest) {
      -> ok(files: list { path: String, content: String }) {
        Map ResolvedTypes to TypeScript types.
        Emit type definitions, handler interface, transport adapter,
        lite query protocol, and conformance tests from invariants.
      }
      -> error(message: String) {
        If the manifest contains types not mappable to TypeScript.
      }
    }
  }

  invariant {
    after generate(spec: "s1", manifest: {
      name: "Ping", uri: "urn:copf/Ping", typeParams: [], relations: [],
      actions: [{ name: "ping", params: [],
        variants: [{ tag: "ok", fields: [], prose: "Pong." }] }],
      invariants: [], graphqlSchema: "",
      jsonSchemas: { invocations: {}, completions: {} },
      capabilities: [], purpose: "A test."
    }) -> ok(files: f)
    then generate(spec: "s2", manifest: { name: "" }) -> error(message: e)
  }
}
```

**Design notes**:
- **Manifest record uses `tag`/`prose`** (not `name`/`description`): This matches the `VariantSchema` type in `kernel/src/types.ts`. Getting these field names right is essential.
- **All required fields present**: The manifest record includes `uri`, `typeParams`, `relations`, `actions`, `invariants`, `graphqlSchema`, `jsonSchemas`, `capabilities`, `purpose` — everything the handler checks.
- **Same pattern for RustGen, SwiftGen, SolidityGen**: All four code generators use this identical invariant structure since they share the same `ConceptManifest` input type.

## Key Differences: Framework vs Domain Concepts

| Aspect | Domain Concepts | Framework Concepts |
|--------|----------------|-------------------|
| Purpose wording | User-facing value | Technical capability |
| State types | Primitives + sets | Custom types (ConceptManifest, etc.) |
| Actions | CRUD / toggle / auth | Transform / evaluate / validate |
| Invariants | Scalars + free variables | Record/list literals for structured inputs |
| Type parameter | Represents user-visible entity | Represents internal reference |
| Complexity | 1-8 state fields | 1-5 state fields |
| Capabilities | Rarely needed | Occasionally needed |

## When to Create a Framework Concept

Create a framework concept when:
- The functionality is about **processing concept specifications** (parsing, generating, validating)
- The functionality is about **runtime infrastructure** (registry, logging, transport)
- The concept will be used by the COPF toolchain itself
- Users of the concept are developers, not end users

**Always include at least one invariant**, even for framework concepts. Use record `{ }` and list `[ ]` literals to pass minimal-but-real structured inputs (see Pattern 8 in [invariant-design.md](../references/invariant-design.md)).

Place framework concepts in `specs/framework/` and their implementations in `implementations/typescript/framework/`.
