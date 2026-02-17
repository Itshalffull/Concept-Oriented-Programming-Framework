# Framework Concept Examples

Examples from the COPF framework layer (`specs/framework/`) — these are infrastructure concepts that the framework itself uses. They demonstrate how to apply concept design to tools, pipelines, and runtime infrastructure.

## Example 1: SchemaGen — Pure Transformation

**Design rationale**: SchemaGen transforms parsed concept ASTs into language-neutral ConceptManifests. It's a pure function with no real persistent state — it just maps input to output.

```
concept SchemaGen [S] {

  purpose {
    Transform parsed concept ASTs into language-neutral
    ConceptManifests containing everything a per-language
    code generator needs: typed actions, relations, invariants,
    GraphQL schema fragments, and JSON validation schemas.
  }

  state {
    manifests: S -> ConceptManifest
  }

  actions {
    action generate(spec: S, ast: ConceptAST) {
      -> ok(manifest: ConceptManifest) {
        Walk the AST and produce a ConceptManifest containing:
        resolved types, relation schemas (with merge rules applied),
        action schemas, invariant schemas, GraphQL schema fragment,
        and JSON validation schemas.
      }
      -> error(message: String) {
        If the AST contains invalid type references or
        unsupported state declarations, return an error.
      }
    }
  }
}
```

**Design notes**:
- **No invariants**: Pure transformation — the output is determined by the input, no behavioral contract to test
- **Custom types**: Uses `ConceptManifest` and `ConceptAST` — framework-specific types
- **Single action**: One transformation, two outcomes (ok/error)
- **State is output-focused**: `manifests: S -> ConceptManifest` stores results keyed by spec reference
- **Longer purpose**: More technical explanation needed for infrastructure concepts

## Example 2: Registry — Runtime Service Management

```
concept Registry [C] {

  purpose {
    Register, resolve, and health-check concept instances
    at runtime. Acts as a service locator for the concept
    transport layer.
  }

  state {
    concepts: set C
    transport: C -> ConceptTransport
    health: C -> Bool
  }

  actions {
    action register(concept: C, transport: ConceptTransport) {
      -> ok(concept: C) {
        Add concept to registry and store its transport.
        Mark as healthy.
      }
      -> error(message: String) {
        If concept is already registered, return error.
      }
    }

    action deregister(concept: C) {
      -> ok(concept: C) {
        Remove concept from registry.
      }
      -> notfound(message: String) {
        If concept is not registered.
      }
    }

    action heartbeat(concept: C) {
      -> ok(concept: C, available: Bool, latency: Int) {
        Query transport health and update status.
      }
      -> notfound(message: String) {
        If concept is not registered.
      }
    }
  }
}
```

**Design notes**:
- **Entity collection pattern**: `concepts: set C` with associated properties
- **Runtime concept**: Manages live concept instances, not data entities
- **Domain-specific actions**: `register`/`deregister`/`heartbeat` instead of generic CRUD
- **No invariants**: Infrastructure behavior — registration is tested at the integration level
- **Custom types in state**: `ConceptTransport` is a runtime type

## Example 3: SyncEngine — Complex Orchestration

**Design rationale**: SyncEngine is the most complex framework concept. It evaluates synchronization rules against action logs, managing binding state and execution tracking.

```
concept SyncEngine [F] {

  purpose {
    Evaluate synchronizations against the action log,
    producing new action invocations when sync rules
    match. Supports annotation-aware routing (eager vs deferred)
    and guards against re-firing for idempotency.
  }

  state {
    syncs: set CompiledSync
    bindings: F -> list Binding
    pending: F -> list ActionInvocation
    executed: F -> set String
    annotations: F -> list String
  }

  actions {
    action loadSyncs(syncs: list CompiledSync) {
      -> ok(count: Int) {
        Replace the sync rule set. Return number loaded.
      }
    }

    action evaluate(flow: F, completion: ActionCompletion) {
      -> ok(newInvocations: list ActionInvocation) {
        Match completion against all sync when-clauses.
        For each match, bind variables, evaluate where-clauses,
        produce then-clause invocations. Return new invocations.
      }
      -> error(message: String) {
        If evaluation encounters an invalid state.
      }
    }

    action getPending(flow: F) {
      -> ok(invocations: list ActionInvocation) {
        Return pending invocations for the flow.
      }
    }

    action markExecuted(flow: F, invocationId: String) {
      -> ok(flow: F) {
        Mark invocation as executed for idempotency guard.
      }
    }

    action listAnnotations(sync: String) {
      -> ok(annotations: list String) {
        Return annotations for a named sync.
      }
    }

    action reset(flow: F) {
      -> ok(flow: F) {
        Clear all bindings, pending, and executed state for flow.
      }
    }
  }
}
```

**Design notes**:
- **5 state fields**: The upper end of complexity for a single concept
- **6 actions**: The most of any concept — but all serve the single purpose of sync evaluation
- **Rich custom types**: `CompiledSync`, `Binding`, `ActionInvocation`, `ActionCompletion`
- **No invariants**: The behavioral contract is too complex for simple invariant patterns — tested via integration tests
- **Idempotency state**: `executed: F -> set String` prevents re-firing syncs

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

```
concept DeploymentValidator [M] {

  purpose {
    Parse and validate deployment manifests against registered
    concepts and compiled syncs. Produce deployment plans
    or report configuration issues.
  }

  state {
    manifests: set M
    plan: M -> DeploymentPlan
    issues: M -> list String
  }

  actions {
    action validate(manifest: M, concepts: list ConceptManifest, syncs: list CompiledSync) {
      -> ok(plan: DeploymentPlan) {
        All checks pass. Return the validated deployment plan.
      }
      -> warning(plan: DeploymentPlan, issues: list String) {
        Plan is valid but has non-fatal issues (e.g., unused concepts).
      }
      -> error(issues: list String) {
        Critical issues prevent deployment (missing concepts, broken syncs).
      }
    }

    action check(manifest: M) {
      -> ok(valid: Bool) {
        Quick check if a previously validated manifest is still valid.
      }
      -> notfound(message: String) {
        If manifest has not been validated yet.
      }
    }
  }
}
```

**Design notes**:
- **Three-outcome variant**: `ok`, `warning`, `error` — the only concept with `warning`
- **Warning variant carries data**: Returns both the plan AND the issues
- **Structured error data**: `issues: list String` instead of single `message: String`
- **Two actions with different purposes**: `validate` for full validation, `check` for quick re-check

## Key Differences: Framework vs Domain Concepts

| Aspect | Domain Concepts | Framework Concepts |
|--------|----------------|-------------------|
| Purpose wording | User-facing value | Technical capability |
| State types | Primitives + sets | Custom types (ConceptManifest, etc.) |
| Actions | CRUD / toggle / auth | Transform / evaluate / validate |
| Invariants | Almost always present | Often absent |
| Type parameter | Represents user-visible entity | Represents internal reference |
| Complexity | 1-8 state fields | 1-5 state fields |
| Capabilities | Rarely needed | Occasionally needed |

## When to Create a Framework Concept

Create a framework concept when:
- The functionality is about **processing concept specifications** (parsing, generating, validating)
- The functionality is about **runtime infrastructure** (registry, logging, transport)
- The concept will be used by the COPF toolchain itself
- Users of the concept are developers, not end users

Place framework concepts in `specs/framework/` and their implementations in `implementations/typescript/framework/`.
