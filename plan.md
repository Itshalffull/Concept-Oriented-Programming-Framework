# Monadic Concept Handlers — Implementation Plan

## Design Philosophy

Following Jackson's concept methodology: each concept below is **independently meaningful** with its own purpose. The monadic handler system is not one monolith — it decomposes into five independent concepts wired by syncs, composed into a derived concept, and integrated with the existing FlowTrace and FormalProperty infrastructure.

---

## Concept Decomposition

### 1. `StorageProgram [P]` — The Free Monad

**Purpose:** Represent a concept handler's storage operations as an inspectable, composable data structure — separating the *description* of effects from their *execution*.

**Independent motivation:** Even without interpretation or verification, a StorageProgram is useful as a portable, serializable representation of "what a handler intends to do." It can be logged, diffed, replayed, or sent across a wire.

```
concept StorageProgram [P] {
  purpose {
    Represent storage operations as an inspectable, composable program
    description. A StorageProgram is a sequence of storage instructions
    (get, put, find, del) that can be analyzed, transformed, and
    interpreted without executing side effects.
  }

  state {
    programs: set P
    instructions: P -> list Instruction
    readSet: P -> set String           // relations read by this program
    writeSet: P -> set String          // relations written by this program
    purity: P -> Purity               // pure | read-only | read-write
    bindings: P -> list Binding        // variable bindings accumulated during build
  }

  actions {
    action create(program: P) {
      -> ok() { Empty program created, ready to receive instructions. }
      -> exists() { Program with this ID already exists. }
    }

    action get(program: P, relation: String, key: String, bindAs: String) {
      -> ok(program: P) {
        Append a Get instruction. The result will be bound to bindAs
        when interpreted. Adds relation to the readSet.
      }
      -> notfound() { Program does not exist. }
    }

    action find(program: P, relation: String, criteria: String, bindAs: String) {
      -> ok(program: P) {
        Append a Find instruction with criteria filter.
        Adds relation to the readSet.
      }
      -> notfound() { Program does not exist. }
    }

    action put(program: P, relation: String, key: String, value: String) {
      -> ok(program: P) {
        Append a Put instruction. Adds relation to the writeSet.
      }
      -> notfound() { Program does not exist. }
    }

    action del(program: P, relation: String, key: String) {
      -> ok(program: P) {
        Append a Del instruction. Adds relation to the writeSet.
      }
      -> notfound() { Program does not exist. }
    }

    action branch(program: P, condition: String, thenBranch: P, elseBranch: P) {
      -> ok(program: P) {
        Append a conditional branch. Both branches are themselves
        StoragePrograms. The readSet/writeSet is the union of both
        branches (conservative approximation for static analysis).
      }
      -> notfound() { Program or branch programs do not exist. }
    }

    action pure(program: P, variant: String, output: String) {
      -> ok(program: P) {
        Terminate the program with a return value (variant + output fields).
        No further instructions may be appended.
      }
      -> notfound() { Program does not exist. }
    }

    action compose(first: P, second: P, bindAs: String) {
      -> ok(program: P) {
        Monadic bind: run first, bind its result to bindAs, then run second.
        The composed program's readSet/writeSet is the union of both.
      }
      -> notfound() { One or both programs do not exist. }
    }

    action analyze(program: P) {
      -> ok(readSet: String, writeSet: String, purity: String, branchCount: Int) {
        Statically analyze the program's effects without executing it.
        Returns the read/write sets, purity classification, and
        number of conditional branches.
      }
      -> notfound() { Program does not exist. }
    }
  }

  invariant {
    after create(program: p) -> ok()
    and get(program: p, relation: "users", key: "u1", bindAs: "user") -> ok(program: p)
    and put(program: p, relation: "users", key: "u1", value: "updated") -> ok(program: p)
    and analyze(program: p) -> ok(readSet: rs, writeSet: ws, purity: purity, branchCount: bc)
    then purity = "read-write"
  }

  invariant {
    after create(program: p) -> ok()
    and get(program: p, relation: "users", key: "u1", bindAs: "user") -> ok(program: p)
    and pure(program: p, variant: "ok", output: "done") -> ok(program: p)
    and analyze(program: p) -> ok(readSet: rs, writeSet: ws, purity: purity, branchCount: bc)
    then purity = "read-only"
  }
}
```

---

### 2. `ProgramInterpreter [I]` — The Runner

**Purpose:** Execute a StorageProgram against a real ConceptStorage backend, producing an ActionCompletion. This is the bridge between the functional world and the effectful world.

**Independent motivation:** Interpretation is its own concern — you might interpret the same program against different backends (test storage, production storage, dry-run), or with different transaction semantics (optimistic, pessimistic, serializable).

```
concept ProgramInterpreter [I] {
  purpose {
    Execute a StorageProgram against a ConceptStorage backend,
    managing transaction boundaries, producing completions, and
    recording execution traces. The interpreter is the only component
    that performs real side effects.
  }

  state {
    interpreters: set I
    backend: I -> String              // storage backend identifier
    mode: I -> Mode                   // live | dry-run | replay
    executions: I -> list Execution
  }

  actions {
    action register(interpreter: I, backend: String, mode: String) {
      -> ok() { Interpreter registered with the given backend and mode. }
      -> exists() { Interpreter already registered. }
    }

    action execute(interpreter: I, program: String, snapshot: String) {
      -> ok(variant: String, output: String, trace: String) {
        Run the program instruction-by-instruction against the backend.
        In live mode, mutations are applied to storage.
        In dry-run mode, mutations are applied to an in-memory snapshot only.
        Returns the terminal variant, output fields, and an execution trace.
      }
      -> error(message: String, failedAt: Int) {
        Execution failed at instruction index failedAt.
      }
      -> notfound() { Interpreter does not exist. }
    }

    action dryRun(interpreter: I, program: String, snapshot: String) {
      -> ok(variant: String, output: String, mutations: String) {
        Execute against a snapshot without side effects.
        Returns what *would* happen: the variant, output, and
        the list of mutations that would be applied.
      }
      -> error(message: String) { Dry run failed. }
      -> notfound() { Interpreter does not exist. }
    }

    action rollback(interpreter: I, executionId: String) {
      -> ok() {
        Reverse the mutations from a previous execution using
        compensating operations. Only available if the execution
        trace was recorded.
      }
      -> error(message: String) { Rollback failed. }
      -> notfound() { Interpreter or execution does not exist. }
    }
  }

  invariant {
    after register(interpreter: i, backend: "memory", mode: "dry-run") -> ok()
    and execute(interpreter: i, program: p, snapshot: s) -> ok(variant: v, output: o, trace: t)
    then the storage backend is not modified
  }
}
```

---

### 3. `ProgramAnalyzer [A]` — Static Analysis

**Purpose:** Inspect StoragePrograms *before* execution to extract properties useful for optimization, verification, and FlowTrace acceleration.

**Independent motivation:** Analysis is valuable even without the interpreter — it supports linting, dead-branch detection, conflict prediction, and feeds into the formal verification pipeline.

```
concept ProgramAnalyzer [A] {
  purpose {
    Statically analyze StoragePrograms to extract read/write sets,
    detect conflicts between concurrent programs, identify dead
    branches, compute complexity metrics, and determine whether
    two programs commute (can safely run in parallel).
  }

  state {
    analyses: set A
    result: A -> AnalysisResult
  }

  actions {
    action detectConflicts(programA: String, programB: String) {
      -> ok(conflicts: String, disjoint: Bool) {
        Compare write sets of two programs. If disjoint, they commute
        and can execute in parallel. Otherwise, return the conflicting
        relations and keys.
      }
      -> error(message: String) { Analysis failed. }
    }

    action findDeadBranches(program: String) {
      -> ok(deadBranches: String, reachableBranches: Int, totalBranches: Int) {
        Given type information and state constraints, identify branches
        in the program that can never be taken. Useful for pruning
        FlowTrace exploration.
      }
      -> error(message: String) { Analysis failed. }
    }

    action computeComplexity(program: String) {
      -> ok(instructionCount: Int, branchDepth: Int, readCount: Int, writeCount: Int) {
        Compute static complexity metrics for the program.
      }
      -> error(message: String) { Analysis failed. }
    }

    action checkCommutes(programA: String, programB: String) {
      -> ok(commutes: Bool, reason: String) {
        Determine if two programs produce the same result regardless
        of execution order. Stronger than disjoint write sets —
        considers read-write dependencies too.
      }
      -> error(message: String) { Analysis failed. }
    }

    action extractInvariants(program: String, conceptSpec: String) {
      -> ok(invariants: String) {
        Given a program and its concept spec, extract verifiable
        properties: "if state S before execution, then state S'
        after execution satisfies invariant I."
      }
      -> error(message: String) { Analysis failed. }
    }
  }

  invariant {
    after detectConflicts(
      programA: "put(users, u1, data)",
      programB: "get(users, u2, bindAs: x)"
    ) -> ok(conflicts: c, disjoint: d)
    then d = true
  }
}
```

---

### 4. `ProgramCache [C]` — Memoization

**Purpose:** Cache the results of pure or read-only StorageProgram executions, keyed by program structure + storage state hash. Enables FlowTrace to skip re-executing unchanged subtrees.

**Independent motivation:** Caching program results is useful for any repeated evaluation — not just FlowTrace. Handler idempotency checks, speculative execution, and test replay all benefit.

```
concept ProgramCache [C] {
  purpose {
    Memoize StorageProgram execution results keyed by program
    fingerprint and storage state hash. Enables incremental
    re-evaluation where only changed programs or changed state
    invalidates cached results.
  }

  state {
    entries: set C
    programHash: C -> String
    stateHash: C -> String
    result: C -> String
    hits: C -> Int
    staleSince: C -> String
  }

  actions {
    action lookup(programHash: String, stateHash: String) {
      -> hit(entry: C, result: String) {
        Cache hit — return the memoized result.
      }
      -> miss() { No cached result for this program + state combination. }
    }

    action store(programHash: String, stateHash: String, result: String) {
      -> ok(entry: C) { Result cached. }
      -> exists() { Entry already cached (idempotent). }
    }

    action invalidateByState(stateHash: String) {
      -> ok(evicted: Int) {
        Invalidate all entries whose stateHash matches.
        Called when storage state changes.
      }
    }

    action invalidateByProgram(programHash: String) {
      -> ok(evicted: Int) {
        Invalidate all entries for a given program.
        Called when a handler's program changes (code deploy).
      }
    }

    action stats() {
      -> ok(totalEntries: Int, hitRate: String, memoryBytes: Int) {
        Return cache statistics.
      }
    }
  }

  invariant {
    after store(programHash: "abc", stateHash: "def", result: "ok") -> ok(entry: c)
    then lookup(programHash: "abc", stateHash: "def") -> hit(entry: c, result: "ok")
  }

  invariant {
    after store(programHash: "abc", stateHash: "def", result: "ok") -> ok(entry: c)
    and invalidateByState(stateHash: "def") -> ok(evicted: n)
    then lookup(programHash: "abc", stateHash: "def") -> miss()
  }
}
```

---

### 5. `FunctionalHandler [H]` — The Handler Contract

**Purpose:** Register concept handlers that return StoragePrograms instead of executing effects directly. This is the migration point — the concept that bridges existing imperative handlers with the new functional model.

**Independent motivation:** The registry of which concepts have functional handlers is itself useful for governance, deployment decisions, and capability tracking — independent of whether programs are analyzed or cached.

```
concept FunctionalHandler [H] {
  purpose {
    Register concept handlers that produce StoragePrograms instead
    of directly executing storage effects. A FunctionalHandler is
    the contract between a concept's action logic and the monadic
    execution infrastructure.
  }

  state {
    handlers: set H
    concept: H -> String
    action: H -> String
    programFactory: H -> String       // reference to the function that builds the StorageProgram
    purity: H -> String               // declared purity: pure | read-only | read-write
    verified: H -> Bool               // whether formal verification has passed
  }

  actions {
    action register(handler: H, concept: String, action: String, purity: String) {
      -> ok() { Functional handler registered. }
      -> exists() { Handler for this concept/action already registered. }
    }

    action build(handler: H, input: String) {
      -> ok(program: String) {
        Invoke the handler's factory function with the given input.
        Returns a StorageProgram (as data) rather than executing effects.
      }
      -> notfound() { Handler does not exist. }
      -> error(message: String) { Factory function threw during program construction. }
    }

    action markVerified(handler: H, evidence: String) {
      -> ok() { Handler marked as formally verified with evidence reference. }
      -> notfound() { Handler does not exist. }
    }

    action list(concept: String) {
      -> ok(handlers: String) {
        List all registered functional handlers for a concept.
      }
    }

    action checkPurity(handler: H) {
      -> ok(declared: String, actual: String, consistent: Bool) {
        Compare declared purity against static analysis of the
        handler's built program. Flags mismatches.
      }
      -> notfound() { Handler does not exist. }
    }
  }

  invariant {
    after register(handler: h, concept: "User", action: "create", purity: "read-write") -> ok()
    and build(handler: h, input: "{ name: 'Alice' }") -> ok(program: p)
    then p is a valid StorageProgram
  }
}
```

---

## Syncs

### Core Execution Flow

```
sync BuildAndExecute [eager]
when {
  FunctionalHandler/build: [ handler: ?h; input: ?input ]
    => [ program: ?program ]
}
then {
  ProgramInterpreter/execute: [ interpreter: ?defaultInterpreter; program: ?program; snapshot: "current" ]
}
```

```
sync AnalyzeOnBuild [eager]
when {
  FunctionalHandler/build: [ handler: ?h; input: ?input ]
    => [ program: ?program ]
}
then {
  ProgramAnalyzer/computeComplexity: [ program: ?program ]
}
```

```
sync CacheLookupBeforeExecute [eager]
when {
  FunctionalHandler/build: [ handler: ?h ]
    => [ program: ?program ]
  StorageProgram/analyze: [ program: ?program ]
    => [ purity: "read-only" ]
}
where {
  bind(hash(?program) as ?programHash)
  bind(stateHash() as ?stateHash)
}
then {
  ProgramCache/lookup: [ programHash: ?programHash; stateHash: ?stateHash ]
}
```

```
sync CacheStoreAfterExecute [eager]
when {
  ProgramInterpreter/execute: [ program: ?program ]
    => [ variant: ?variant; output: ?output ]
  StorageProgram/analyze: [ program: ?program ]
    => [ purity: ?purity ]
}
where {
  filter(?purity != "read-write")
  bind(hash(?program) as ?programHash)
  bind(stateHash() as ?stateHash)
}
then {
  ProgramCache/store: [
    programHash: ?programHash;
    stateHash: ?stateHash;
    result: ?output
  ]
}
```

### Invalidation

```
sync InvalidateCacheOnWrite [eager]
when {
  ProgramInterpreter/execute: [ program: ?program ]
    => [ variant: ?variant ]
  StorageProgram/analyze: [ program: ?program ]
    => [ writeSet: ?writeSet; purity: "read-write" ]
}
where {
  bind(stateHash() as ?stateHash)
}
then {
  ProgramCache/invalidateByState: [ stateHash: ?stateHash ]
}
```

### Formal Verification Bridge

```
sync ExtractPropertiesForVerification [eager]
when {
  FunctionalHandler/register: [ handler: ?h; concept: ?concept; action: ?action ]
    => []
}
then {
  ProgramAnalyzer/extractInvariants: [ program: ?h; conceptSpec: ?concept ]
}
```

```
sync VerificationResultToHandler [eager]
when {
  FormalProperty/prove: [ target_symbol: ?symbol ]
    => [ status: "proved"; evidence_ref: ?evidence ]
}
where {
  FunctionalHandler: { ?h concept: ?concept }
  filter(?symbol = concat(?concept, "/", ?action))
}
then {
  FunctionalHandler/markVerified: [ handler: ?h; evidence: ?evidence ]
}
```

### Conflict Detection for Concurrent Flows

```
sync DetectConflictsBeforeParallelExecution [eager]
when {
  FunctionalHandler/build: [ handler: ?hA ]
    => [ program: ?programA ]
  FunctionalHandler/build: [ handler: ?hB ]
    => [ program: ?programB ]
}
where {
  filter(?hA != ?hB)
}
then {
  ProgramAnalyzer/detectConflicts: [ programA: ?programA; programB: ?programB ]
}
```

### FlowTrace Integration

```
sync FlowTraceUsesAnalysis [eager]
when {
  FlowTrace/build: [ flowId: ?flowId ]
    => []
  FunctionalHandler/build: [ handler: ?h ]
    => [ program: ?program ]
}
then {
  ProgramAnalyzer/checkCommutes: [ programA: ?program; programB: ?program ]
}
```

---

## Derived Concept

```
derived MonadicConceptHandlers [T] {

  purpose {
    Compose the monadic handler infrastructure into a unified
    execution model where concept handlers return inspectable
    StoragePrograms that are analyzed, cached, and interpreted —
    enabling formal verification, FlowTrace optimization, and
    safe concurrent execution.
  }

  composes {
    StorageProgram [T]
    ProgramInterpreter [T]
    ProgramAnalyzer [T]
    ProgramCache [T]
    FunctionalHandler [T]
  }

  syncs {
    required: [
      build-and-execute,
      analyze-on-build,
      invalidate-cache-on-write
    ]
    recommended: [
      cache-lookup-before-execute,
      cache-store-after-execute,
      extract-properties-for-verification,
      verification-result-to-handler,
      detect-conflicts-before-parallel-execution,
      flow-trace-uses-analysis
    ]
  }

  surface {
    action invoke(concept: String, action: String, input: String) {
      entry: FunctionalHandler/build matches on concept: ?concept, action: ?action
      triggers: [
        StorageProgram/analyze(program: ?program),
        ProgramInterpreter/execute(interpreter: "default", program: ?program, snapshot: "current")
      ]
    }

    action invokeWithDryRun(concept: String, action: String, input: String) {
      entry: FunctionalHandler/build matches on concept: ?concept, action: ?action
      triggers: [
        StorageProgram/analyze(program: ?program),
        ProgramInterpreter/dryRun(interpreter: "default", program: ?program, snapshot: "current")
      ]
    }

    query readWriteSets(concept: String, action: String) {
      reads: StorageProgram/analyze(program: ?latestProgram)
    }

    query commutativity(conceptA: String, actionA: String, conceptB: String, actionB: String) {
      reads: ProgramAnalyzer/checkCommutes(programA: ?pA, programB: ?pB)
    }

    query cacheStats() {
      reads: ProgramCache/stats()
    }

    query purityReport(concept: String) {
      reads: FunctionalHandler/checkPurity(handler: ?h)
    }
  }

  principle {
    after invoke(concept: c, action: a, input: i)
    then the handler builds a StorageProgram (no side effects)
    and  the program is statically analyzed for read/write sets
    and  the interpreter executes the program atomically
    and  if the program is read-only, the result is cached
    and  on re-invocation with same input and state, cache is hit
  }
}
```

---

## FlowTrace Performance Gains (Concrete)

With MonadicConceptHandlers wired in, FlowTrace gains these specific optimizations:

### 1. Parallel Branch Tracing
FlowTrace currently traces sync-triggered children **sequentially** because it can't know if they conflict. With `ProgramAnalyzer/checkCommutes`, it can determine disjoint write sets and trace branches **in parallel**.

**Where it happens:** `FlowTrace/build` consults `ProgramAnalyzer/detectConflicts` for sibling sync-triggered actions. If `disjoint: true`, children are traced concurrently.

### 2. Cached Subtree Reuse
When re-tracing a flow (common during debugging), FlowTrace checks `ProgramCache/lookup` for each node. If the handler's program hash and storage state hash match a cached entry, the entire subtree is reused without re-execution.

**Where it happens:** New sync `FlowTraceSubtreeCache` matches on `FlowTrace/build → ok` and `ProgramCache/lookup → hit` to short-circuit subtree reconstruction.

### 3. Dead Branch Pruning
FlowTrace currently evaluates every candidate sync to check if it fires. With `ProgramAnalyzer/findDeadBranches`, it can determine that certain variant branches are unreachable given current state, skipping entire sync subtrees.

**Where it happens:** Before walking child syncs, FlowTrace calls `findDeadBranches` on the handler's program. Syncs that only trigger on dead-branch variants are marked `fired: false, reason: "unreachable variant"` without evaluation.

### 4. Speculative "What-If" Traces
Since handlers are now data, FlowTrace can build traces for **hypothetical** inputs — "what if User/create returned `exists` instead of `ok`?" — without executing anything. It just walks the program's branch structure.

**Where it happens:** New action `FlowTrace/speculate(flowId, overrides)` that substitutes variant overrides into the program tree and follows the sync chain symbolically.

---

## Suite Manifest

```yaml
suite:
  name: monadic-handlers
  version: "1.0.0"
  description: >
    Monadic concept handler infrastructure — StoragePrograms as inspectable
    data, interpreted execution, static analysis, memoization, and formal
    verification integration.

concepts:
  StorageProgram:
    spec: specs/monadic/storage-program.concept
    params:
      P: { as: ProgramId, description: "Unique program identifier" }
  ProgramInterpreter:
    spec: specs/monadic/program-interpreter.concept
    params:
      I: { as: InterpreterId, description: "Interpreter instance identifier" }
  ProgramAnalyzer:
    spec: specs/monadic/program-analyzer.concept
    params:
      A: { as: AnalysisId, description: "Analysis result identifier" }
  ProgramCache:
    spec: specs/monadic/program-cache.concept
    params:
      C: { as: CacheEntryId, description: "Cache entry identifier" }
  FunctionalHandler:
    spec: specs/monadic/functional-handler.concept
    params:
      H: { as: HandlerId, description: "Handler registration identifier" }

syncs:
  required:
    - path: syncs/monadic/build-and-execute.sync
      description: "Execute a handler's StorageProgram after build"
    - path: syncs/monadic/analyze-on-build.sync
      description: "Statically analyze every built program"
    - path: syncs/monadic/invalidate-cache-on-write.sync
      description: "Invalidate memoized results when storage mutates"
  recommended:
    - path: syncs/monadic/cache-lookup-before-execute.sync
      name: CacheLookupBeforeExecute
      description: "Check cache before executing read-only programs"
    - path: syncs/monadic/cache-store-after-execute.sync
      name: CacheStoreAfterExecute
      description: "Memoize results of pure/read-only executions"
    - path: syncs/monadic/extract-properties-for-verification.sync
      name: ExtractPropertiesForVerification
      description: "Feed handler programs into formal verification pipeline"
    - path: syncs/monadic/detect-conflicts.sync
      name: DetectConflictsBeforeParallelExecution
      description: "Check concurrent programs for storage conflicts"
    - path: syncs/monadic/flow-trace-uses-analysis.sync
      name: FlowTraceUsesAnalysis
      description: "Provide FlowTrace with commutativity data for parallel tracing"

uses:
  - suite: formal-verification
    optional: true
    concepts:
      - name: FormalProperty
        params: { P: { as: PropertyId } }
    syncs:
      - path: syncs/monadic/verification-result-to-handler.sync
        description: "Mark handlers verified when formal proofs complete"
  - suite: infrastructure
    optional: true
    concepts:
      - name: Cache
        params: { C: { as: CacheId } }

dependencies:
  - name: clef-kernel
    version: ">=1.0.0"
```

---

## Migration Path

### Phase approach (by logical scope, not ordering):

**Scope A — Foundation:** Create StorageProgram and ProgramInterpreter concepts, handlers, and the `build-and-execute` sync. This gives the basic "handlers as data → interpreted execution" loop. Existing imperative handlers continue working unchanged.

**Scope B — Analysis:** Add ProgramAnalyzer and wire it via `analyze-on-build`. This enables read/write set extraction and commutativity checks but doesn't change execution behavior.

**Scope C — Caching:** Add ProgramCache and the cache syncs. Pure/read-only programs start getting memoized. FlowTrace begins benefiting from cached subtrees.

**Scope D — Verification Bridge:** Wire to formal-verification suite. Handler programs get automatically converted to FormalProperties. Verification results flow back as `markVerified`.

**Scope E — FlowTrace Integration:** Add the FlowTrace-specific syncs and the `speculate` action. This is where the full performance gains materialize — parallel tracing, dead branch pruning, speculative what-if.

Each scope is independently deployable and independently valuable. The recommended syncs in the suite manifest reflect this — `build-and-execute` is required, everything else is recommended and additive.

---

## ConceptStorage Changes

**None to the interface itself.** ConceptStorage remains the low-level backend that ProgramInterpreter targets. What changes:

1. **New `StorageProgram` DSL** — a builder API that handlers use instead of calling `storage.put()` directly
2. **New `ConceptHandler` variant** — `FunctionalConceptHandler` whose actions return `StorageProgram` instead of `Promise<{variant, ...}>`
3. **Interpreter glue** — `interpret(program: StorageProgram, storage: ConceptStorage): Promise<{variant, ...}>` that runs the program

The existing `ConceptHandler` interface in `runtime/types.ts` stays exactly as-is. A new parallel type is added:

```typescript
export interface FunctionalConceptHandler {
  [actionName: string]: (
    input: Record<string, unknown>,
  ) => StorageProgram<{ variant: string; [key: string]: unknown }>;
}
```

Note: no `storage` parameter. The handler never sees storage — it only builds a program.

---

## File Layout

```
specs/monadic/
  storage-program.concept
  program-interpreter.concept
  program-analyzer.concept
  program-cache.concept
  functional-handler.concept

syncs/monadic/
  build-and-execute.sync
  analyze-on-build.sync
  cache-lookup-before-execute.sync
  cache-store-after-execute.sync
  invalidate-cache-on-write.sync
  extract-properties-for-verification.sync
  verification-result-to-handler.sync
  detect-conflicts.sync
  flow-trace-uses-analysis.sync

derived/monadic-concept-handlers.derived

handlers/ts/monadic/
  storage-program.handler.ts
  program-interpreter.handler.ts
  program-analyzer.handler.ts
  program-cache.handler.ts
  functional-handler.handler.ts

runtime/
  storage-program.ts          # StorageProgram<A> type + builder DSL
  interpreter.ts              # interpret() function
  functional-handler.ts       # FunctionalConceptHandler type
```
