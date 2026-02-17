# Kernel LOC Analysis & Shrinkage Plan

## Current State: 4,254 code LOC across 16 files

The architecture doc (Section 10.3) targets a trusted kernel of ~500 lines. The kernel
is currently ~7-8x that target because it carries Stage 0 bootstrap scaffolding that has
been superseded by concept implementations but never removed.

---

## Classification of All Kernel Modules

### 1. ALREADY CONCEPTS — Stage 0 scaffolding, still load-bearing (~1,523 LOC)

These modules have full concept specs (`specs/framework/`) and hand-written
implementations (`implementations/typescript/framework/`). However, **the Stage 0 code
is NOT dead** — it is still on the active bootstrap path.

Evidence: `createKernel()` in `index.ts` directly instantiates `new SyncEngine(log, registry)`
and calls `parseConceptFile()` / `parseSyncFile()` at startup. The `copf dev` command in the
CLI does the same. Even `createSelfHostedKernel()` in `self-hosted.ts` still uses the Stage 0
parsers to load `.concept` and `.sync` files — it only replaces the engine, not the parsers.

| Kernel module | LOC | Concept counterpart | Status |
|---|---:|---|---|
| `parser.ts` | 579 | `spec-parser.concept` | Load-bearing bootstrap. Used at every startup. |
| `sync-parser.ts` | 500 | `sync-parser.concept` + `sync-compiler.concept` | Load-bearing bootstrap. Used at every startup. |
| `engine.ts` (SyncEngine) | ~300 | `sync-engine.concept` | Replaced by self-hosted path, but default path still uses it. |
| `engine.ts` (ActionLog) | ~100 | `action-log.concept` | Same — used by both paths. |
| `transport.ts` (registry) | ~40 | `registry.concept` | Inline in transport, not yet delegated. |

**Removal path — NOT simple deletion.** Requires a "Stage 3.5" milestone:

> **Stage 3.5: Eliminate bootstrap chain.** The kernel should load pre-compiled concept
> registrations from disk (e.g. a compiled `.copf-cache/` directory) instead of re-parsing
> specs at every startup. This would:
> 1. Let the parsers run as concepts during `copf compile` (build-time, not boot-time)
> 2. Let the kernel load only pre-compiled `CompiledSync` objects and concept registrations
> 3. Remove parser.ts and sync-parser.ts from the kernel entirely
> 4. Make `createSelfHostedKernel()` the default (and only) path
>
> Until then, the 1,523 LOC is load-bearing bootstrap scaffolding, not dead code.

### 2. SHOULD BECOME CONCEPTS — natural fit, no regress risk (~722 LOC)

#### FlowTrace (353 LOC) → `flow-trace.concept`

The architecture doc (Section 16.1) already places `flow-trace.ts` under
`implementations/typescript/framework/`, not the kernel. It's observability tooling
that reads from ActionLog (a concept) and produces debug trees.

```
concept FlowTrace [F] {
  purpose {
    Build and render interactive debug traces from action log records.
    Each flow becomes a navigable tree showing the causal chain of
    actions, syncs, and completions.
  }
  state {
    traces: set F
    tree: F -> FlowTree
    rendered: F -> String
  }
  actions {
    action build(flowId: String)
      -> ok(trace: F, tree: FlowTree)
      -> error(message: String)
    action render(trace: F, options: RenderOptions)
      -> ok(output: String)
  }
}
```

Sync: `ActionLog/query → ok ⟹ FlowTrace/build`

Pairs with existing `telemetry.concept` — telemetry exports OTel spans, FlowTrace
builds interactive debug trees. Different concerns, complementary.

#### DeploymentValidator (254 LOC) → `deployment-validator.concept`

Build/deploy-time tooling with zero runtime coupling. Has clear state (parsed manifests,
validation results, deployment plans) and meaningful action variants (validate can
produce ok vs warnings vs errors).

```
concept DeploymentValidator [M] {
  purpose {
    Parse and validate deployment manifests against compiled concepts
    and syncs. Produce deployment plans with transport assignments.
  }
  state {
    manifests: set M
    plan: M -> DeploymentPlan
    issues: M -> list ValidationIssue
  }
  actions {
    action parse(raw: String)
      -> ok(manifest: M) | error(message: String)
    action validate(manifest: M, concepts: list ConceptManifest, syncs: list CompiledSync)
      -> ok(plan: DeploymentPlan) | warning(issues: list String)
  }
}
```

Sync: `SchemaGen/generate → ok ⟹ DeploymentValidator/validate`

#### Migration (115 LOC) → `migration.concept`

Schema migration is a genuine domain concern with state (version per concept,
pending migrations), actions (check, complete), and meaningful variants (ok vs
needsMigration). Natural sync: `Registry/register → ok ⟹ Migration/check`.

```
concept Migration [C] {
  purpose {
    Track concept schema versions and gate upgrades. Detect when a
    concept's deployed schema differs from its current spec and
    coordinate migration steps.
  }
  state {
    versions: C -> Int
    pending: set C
  }
  actions {
    action check(concept: C, specVersion: Int)
      -> ok() | needsMigration(from: Int, to: Int)
    action complete(concept: C, version: Int)
      -> ok()
  }
}
```

### 3. PRE-CONCEPTUAL — must stay in kernel (~584 LOC)

Per Section 10.3, these cause infinite regress if conceptualized:

| Module | LOC | Reason |
|---|---:|---|
| `http-transport.ts` | 212 | Transport adapter instantiation is pre-conceptual. Creates the connections concepts communicate over. |
| `ws-transport.ts` | 162 | Same — WebSocket transport adapter. |
| `storage.ts` | 117 | In-memory storage backs every concept. Below the concept abstraction. |
| `transport.ts` (in-process adapter) | 53 | Most primitive transport. Pre-conceptual. |
| `index.ts` (processFlow, message dispatch) | ~40 | Message dispatch routing is pre-conceptual. |

**Target: ~584 LOC.** Matches the architecture doc's "~500 lines" prediction.

### 4. MOVE TO TOOLING — not concepts, not kernel (~248 LOC)

| Module | LOC | Destination | Rationale |
|---|---:|---|---|
| `test-helpers.ts` | 106 | `implementations/typescript/framework/mock-handler.ts` | Architecture doc already lists it there. Generates mock handlers from ASTs — dev tooling, not runtime. |
| `lite-query.ts` (adapter) | 142 | `implementations/typescript/framework/lite-query-adapter.ts` | Transport-adjacent caching. The `LiteQueryProtocol` interface stays in types; the adapter is plumbing. |

### 5. EVENTUAL-QUEUE: fold into SyncEngine, not a separate concept (299 LOC)

**Updated assessment based on code review:**

The `DistributedSyncEngine` is **very tightly coupled** to engine internals. It:
- Imports `matchWhenClause()`, `evaluateWhere()`, `buildInvocations()`, `indexKey()` from engine.ts
- Duplicates ~60% of `SyncEngine.onCompletion()` logic
- Directly accesses ActionLog for provenance edges (`hasSyncEdge`, `addSyncEdgeForMatch`)
- Maintains its own `syncIndex: Map<string, Set<CompiledSync>>` mirroring the engine's

Making this a separate `EventualQueue` concept with a delegation sync would require:
- Exposing all internal matching/evaluation functions as concept actions (leaking abstractions)
- Sharing ActionLog state across concept boundaries (violates sovereign storage)
- The sync indirection would add latency to every completion in the distributed path

**Better approach:** Fold annotation-aware routing (`[eventual]`, `[local]`, `[eager]`) and
queuing directly into the `sync-engine.concept` spec as additional actions:

```
// Extensions to sync-engine.concept
action queueSync(sync: CompiledSync, bindings: Bindings, flow: String)
  -> ok(pendingId: String)
action onAvailabilityChange(conceptUri: String, available: Bool)
  -> ok(drained: list ActionInvocation)
action drainConflicts()
  -> ok(conflicts: list ActionCompletion)
```

This keeps SyncEngine's single-responsibility (process completions → emit invocations)
while acknowledging that "process" includes annotation-aware routing in distributed mode.
The 60% code duplication goes away because evaluation logic is shared, not reimplemented.

### 6. RE-EXPORTS / BARREL (~200 LOC)

`index.ts` is ~411 LOC but ~200 of that is re-exports and barrel module patterns.
After the Stage 0 scaffolding removal, this shrinks to the pre-conceptual dispatch
code (~40 LOC) plus minimal exports.

---

## Feedback Items: Validated Against Code

### TypeChecker as separate concept: NO

**Investigated.** Type checking is not a separate phase in the codebase:

- `parser.ts` does minimal type validation: `typeParams.includes(tok.value)` decides
  if an identifier is a param reference or a primitive name. No semantic validation.
- `schema-gen.impl.ts` contains `typeExprToResolvedType()` (lines 42-70) which converts
  `TypeExpr` AST nodes to `ResolvedType` IR nodes. This is structural transformation,
  not validation — it doesn't check whether types are valid.
- The CLI's `check` command (`tools/copf-cli/src/commands/check.ts`) has a `validateAST()`
  that checks structural completeness (purpose exists, state non-empty, actions exist,
  invariant references valid). No type validation.
- **Undefined type parameters silently become primitives.** Writing `x: V -> String`
  where `V` is not declared produces `{ kind: 'primitive', name: 'V' }` — no error.

A TypeChecker concept is a good *future* idea (type parameter validation, cross-concept
type alignment for kits, custom type constraints), but there is no existing code to
extract. It would be net-new functionality, not a kernel extraction.

### Dev file watcher: CONFIRMED — already in tooling, not kernel

**Found at:** `tools/copf-cli/src/commands/dev.ts` (lines 188-317)

Uses Node.js `fs.watch()` with 200ms debounce. Watches `.concept`, `.sync`, and
`.impl.ts` files. Triggers hot-reload: `reloadAllSyncs()`, `reloadSpec()`, `reloadConcept()`.

**Already in the right place.** It's CLI tooling, not kernel code. The feedback's
suggestion to move it to tooling is already the case — no action needed.

### Stage 0 shedding path: CONFIRMED — load-bearing, needs Stage 3.5

See Section 1 above. The Stage 0 code is NOT dead — it's the active bootstrap path.
The self-hosted kernel (`self-hosted.ts`) exists but still depends on Stage 0 parsers.
Removal requires a pre-compilation step (Stage 3.5).

---

## Summary: Path to ~500 LOC Kernel

```
Current kernel:                4,254 code LOC

Phase 1: Extract to tooling      -248 LOC   (test-helpers, lite-query adapter)
Phase 2: Conceptualize              -722 LOC   (flow-trace, deploy, migration)
Phase 3: Fold eventual-queue         -299 LOC   (into sync-engine.concept)
Phase 4: Stage 3.5 (pre-compilation) -1,523 LOC (parsers, engine, action-log, registry)
Phase 5: Shrink barrel exports       -200 LOC   (index.ts cleanup)

─────────────────────────────────────────────
Residual trusted kernel:           ~584 LOC   (transports, storage, dispatch)
                                   ≈ 500 LOC target ✓
```

**Dependencies between phases:**
- Phases 1-3 are independent of each other — can be done in any order
- Phase 4 requires a pre-compilation build step and is the largest single change
- Phase 5 is cleanup that follows Phase 4

**New concept specs needed:** 4 total
- `flow-trace.concept` (from kernel/src/flow-trace.ts)
- `deployment-validator.concept` (from kernel/src/deploy.ts)
- `migration.concept` (from kernel/src/migration.ts)
- SyncEngine extensions (fold eventual-queue.ts into sync-engine.concept)
