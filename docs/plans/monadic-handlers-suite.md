# Monadic Concept Handlers — Implementation Plan

## Design Philosophy

Following Jackson's concept methodology: each concept below is **independently meaningful** with its own purpose. The monadic handler system decomposes into independent concepts wired by syncs, composed into a derived concept, and integrated with the existing FlowTrace and FormalProperty infrastructure.

### Jackson Compliance

Every concept in this plan has been validated against Jackson's six criteria:

| Criterion | Rule |
|-----------|------|
| **Independence** | No concept references another in its state or actions |
| **Single Purpose** | Each concept has exactly one reason to exist |
| **Operational Principle** | Each has a clear "if you do X then Y" narrative |
| **State Completeness** | All state fields are used by actions; no orphaned state |
| **Action Richness** | Actions form a coherent lifecycle; no grab-bag methods |
| **Familiarity** | Each maps to a well-known pattern or analog |

---

## Concept Decomposition

### 1. `StorageProgram [P]` — The Free Monad

**Purpose:** Build sequences of storage instructions as inspectable, composable data — separating the *description* of effects from their *execution*.

**Independent motivation:** Even without interpretation or verification, a StorageProgram is useful as a portable, serializable representation of "what a handler intends to do." It can be logged, diffed, replayed, or sent across a wire.

**Familiarity:** SQL query builder, AST builder.

**Operational principle:** Create a program, append instructions (get/put/find/del), optionally branch or compose with another program, then terminate with `pure`. The resulting program is data — no side effects occur until an interpreter runs it.

```
concept StorageProgram [P] {
  purpose {
    Build sequences of storage instructions as inspectable, composable
    data. A StorageProgram describes what a handler intends to do
    without executing side effects. Programs can be logged, diffed,
    serialized, composed, and handed to an interpreter or analyzer.
  }

  state {
    programs: set P
    instructions: P -> list Instruction
    bindings: P -> list Binding
    terminated: P -> Bool
  }

  actions {
    action create(program: P) {
      -> ok() { Empty program created, ready to receive instructions. }
      -> exists() { Program with this ID already exists. }
    }

    action get(program: P, relation: String, key: String, bindAs: String) {
      -> ok(program: P) {
        Append a Get instruction. The result will be bound to bindAs
        when interpreted.
      }
      -> notfound() { Program does not exist. }
      -> sealed() { Program already terminated with pure. }
    }

    action find(program: P, relation: String, criteria: String, bindAs: String) {
      -> ok(program: P) {
        Append a Find instruction with criteria filter.
      }
      -> notfound() { Program does not exist. }
      -> sealed() { Program already terminated with pure. }
    }

    action put(program: P, relation: String, key: String, value: String) {
      -> ok(program: P) {
        Append a Put instruction.
      }
      -> notfound() { Program does not exist. }
      -> sealed() { Program already terminated with pure. }
    }

    action del(program: P, relation: String, key: String) {
      -> ok(program: P) {
        Append a Del instruction.
      }
      -> notfound() { Program does not exist. }
      -> sealed() { Program already terminated with pure. }
    }

    action branch(program: P, condition: String, thenBranch: P, elseBranch: P) {
      -> ok(program: P) {
        Append a conditional branch. Both branches are themselves
        StoragePrograms, enabling nested control flow.
      }
      -> notfound() { Program or branch programs do not exist. }
      -> sealed() { Program already terminated with pure. }
    }

    action pure(program: P, variant: String, output: String) {
      -> ok(program: P) {
        Terminate the program with a return value (variant + output fields).
        No further instructions may be appended after pure.
      }
      -> notfound() { Program does not exist. }
      -> sealed() { Program already terminated with pure. }
    }

    action compose(first: P, second: P, bindAs: String) {
      -> ok(program: P) {
        Monadic bind: run first, bind its result to bindAs, then run second.
        Creates a new composite program.
      }
      -> notfound() { One or both programs do not exist. }
    }
  }

  invariant {
    after create(program: p) -> ok()
    and get(program: p, relation: "users", key: "u1", bindAs: "user") -> ok(program: p)
    and put(program: p, relation: "users", key: "u1", value: "updated") -> ok(program: p)
    and pure(program: p, variant: "ok", output: "done") -> ok(program: p)
    then p.terminated = true
  }

  invariant {
    after create(program: p) -> ok()
    and pure(program: p, variant: "ok", output: "done") -> ok(program: p)
    then get(program: p, relation: "users", key: "u1", bindAs: "x") -> sealed()
  }
}
```

**Jackson check:**
- Independence: No references to other concepts.
- Single purpose: Build instruction sequences. Analysis removed (belongs to providers).
- Operational principle: Create → append instructions → terminate with pure.
- State completeness: `programs`, `instructions`, `bindings`, `terminated` — all used by actions.
- Action richness: 8 actions forming a coherent builder lifecycle.
- Familiarity: Query builder / AST builder.

---

### 2. `ProgramInterpreter [I]` — The Runner

**Purpose:** Execute a StorageProgram against a ConceptStorage backend, managing transaction boundaries and recording execution traces.

**Independent motivation:** Interpretation is its own concern — the same program can be interpreted against different backends (test storage, production storage, dry-run) or with different transaction semantics.

**Familiarity:** Database transaction manager, virtual machine.

**Operational principle:** Register an interpreter with a backend and mode, then execute programs against it. Live mode mutates storage; dry-run mode returns what *would* happen. Each execution produces a trace and an executionId that can be used for rollback.

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
    backend: I -> String
    mode: I -> String
    executions: set String
    executionTrace: String -> String
  }

  actions {
    action register(interpreter: I, backend: String, mode: String) {
      -> ok() { Interpreter registered with the given backend and mode. }
      -> exists() { Interpreter already registered. }
      -> invalidMode() { Mode must be one of: live, dry-run, replay. }
    }

    action execute(interpreter: I, program: String, snapshot: String) {
      -> ok(executionId: String, variant: String, output: String, trace: String) {
        Run the program instruction-by-instruction against the backend.
        In live mode, mutations are applied to storage.
        In dry-run mode, mutations are applied to an in-memory snapshot only.
        Returns an executionId for rollback, the terminal variant,
        output fields, and an execution trace.
      }
      -> error(message: String, failedAt: Int) {
        Execution failed at instruction index failedAt.
      }
      -> notfound() { Interpreter does not exist. }
    }

    action dryRun(interpreter: I, program: String, snapshot: String) {
      -> ok(variant: String, output: String, mutations: String) {
        Execute against a snapshot without side effects.
        Returns what would happen: the variant, output, and
        the list of mutations that would be applied.
      }
      -> error(message: String) { Dry run failed. }
      -> notfound() { Interpreter does not exist. }
    }

    action rollback(interpreter: I, executionId: String) {
      -> ok() {
        Reverse the mutations from a previous execution using
        compensating operations derived from the execution trace.
      }
      -> error(message: String) { Rollback failed. }
      -> notfound() { Interpreter or execution does not exist. }
    }
  }

  invariant {
    after register(interpreter: i, backend: "memory", mode: "live") -> ok()
    and execute(interpreter: i, program: p, snapshot: s) -> ok(executionId: eid, variant: v, output: o, trace: t)
    then rollback(interpreter: i, executionId: eid) -> ok()
  }

  invariant {
    after register(interpreter: i, backend: "memory", mode: "dry-run") -> ok()
    and execute(interpreter: i, program: p, snapshot: s) -> ok(executionId: eid, variant: v, output: o, trace: t)
    then the storage backend is not modified
  }
}
```

**Jackson check:**
- Independence: No references to other concepts.
- Single purpose: Execute programs against backends.
- Operational principle: Register → execute → optionally rollback.
- State completeness: `interpreters`, `backend`, `mode`, `executions`, `executionTrace` — all used.
- Action richness: 4 actions covering full execution lifecycle.
- Familiarity: Transaction manager / VM.

---

### 3. `ProgramAnalysis [A]` — Analysis Dispatcher (Provider Pattern)

**Purpose:** Dispatch named analysis queries to registered providers and return structured results. This is the hub concept; specific analysis algorithms are providers.

**Independent motivation:** The dispatch registry is useful independent of any specific analysis — it provides a uniform interface for querying program properties regardless of the underlying algorithm.

**Familiarity:** Plugin registry, analysis rule engine (mirrors `AnalysisRule` in `code-analysis/`).

**Operational principle:** Register an analysis provider by name and kind, then run it against a program. The concept dispatches to the provider and returns the result. `runAll` dispatches to every registered provider.

```
concept ProgramAnalysis [A] {
  purpose {
    Dispatch named analysis queries against StoragePrograms to
    registered providers and return structured results. Each provider
    implements a specific analysis strategy; this concept provides
    the uniform dispatch interface.
  }

  state {
    providers: set String
    providerKind: String -> String
    results: set A
    program: A -> String
    provider: A -> String
    result: A -> String
  }

  actions {
    action registerProvider(name: String, kind: String) {
      -> ok() { Analysis provider registered. }
      -> exists() { Provider with this name already registered. }
    }

    action run(program: String, provider: String) {
      -> ok(analysis: A, result: String) { Analysis completed by the named provider. }
      -> providerNotFound() { No provider registered with this name. }
      -> error(message: String) { Analysis failed. }
    }

    action runAll(program: String) {
      -> ok(results: String) { All registered providers ran against the program. }
      -> error(message: String) { One or more providers failed. }
    }

    action listProviders() {
      -> ok(providers: String) { Return all registered provider names and kinds. }
    }
  }

  invariant {
    after registerProvider(name: "read-write-sets", kind: "structural") -> ok()
    and run(program: p, provider: "read-write-sets") -> ok(analysis: a, result: r)
    then a.provider = "read-write-sets"
  }

  invariant {
    after run(program: p, provider: "nonexistent") -> providerNotFound()
    then no analysis result is stored
  }
}
```

**Jackson check:**
- Independence: No references to other concepts.
- Single purpose: Dispatch analysis to providers.
- Operational principle: Register providers → run analyses → get results.
- State completeness: All state fields referenced by actions.
- Action richness: 4 actions — register, run, runAll, list.
- Familiarity: Plugin registry / analysis engine.

---

### 3a. `ReadWriteSetProvider [R]` — Structural Effect Extraction

**Purpose:** Extract which storage relations a StorageProgram reads and writes, and classify its purity (pure, read-only, read-write).

**Independent motivation:** Read/write sets are the foundation for all other analyses (conflict detection, commutativity, caching eligibility). This is the "base layer" provider.

**Familiarity:** Def-use analysis in compilers, taint tracking source identification.

```
concept ReadWriteSetProvider [R] {
  purpose {
    Extract the set of storage relations a program reads and writes
    by walking its instruction sequence. Classify the program's purity
    as pure (no storage access), read-only, or read-write.
  }

  state {
    results: set R
    readSet: R -> set String
    writeSet: R -> set String
    purity: R -> String
  }

  actions {
    action analyze(program: String) {
      -> ok(result: R, readSet: String, writeSet: String, purity: String) {
        Walk the instruction tree. Get/Find contribute to readSet.
        Put/Del contribute to writeSet. Branches union both sub-branches.
        Purity: no ops = pure, only reads = read-only, any write = read-write.
      }
      -> error(message: String) { Program could not be parsed. }
    }
  }

  invariant {
    after analyze(program: "get(users, u1); put(users, u1, data)") -> ok(result: r, readSet: rs, writeSet: ws, purity: p)
    then p = "read-write"
  }

  invariant {
    after analyze(program: "get(users, u1)") -> ok(result: r, readSet: rs, writeSet: ws, purity: p)
    then p = "read-only"
  }
}
```

---

### 3b. `CommutativityProvider [C]` — Parallel Safety

**Purpose:** Determine whether two StoragePrograms can safely execute in parallel — i.e., they produce the same result regardless of execution order.

**Independent motivation:** Enables safe concurrent execution and FlowTrace parallel branch tracing. Useful anywhere two handlers might run simultaneously.

**Familiarity:** Serializability analysis in databases, happens-before analysis in concurrent systems.

```
concept CommutativityProvider [C] {
  purpose {
    Determine whether two StoragePrograms commute — whether they
    produce the same result regardless of execution order. Uses
    read/write set analysis and optionally deeper semantic reasoning.
  }

  state {
    results: set C
    programA: C -> String
    programB: C -> String
    commutes: C -> Bool
    reason: C -> String
  }

  actions {
    action check(programA: String, programB: String, readWriteSetsA: String, readWriteSetsB: String) {
      -> ok(result: C, commutes: Bool, reason: String) {
        If write sets are disjoint and neither program's write set
        overlaps the other's read set, the programs commute.
        Returns the reasoning for the determination.
      }
      -> error(message: String) { Analysis failed. }
    }
  }

  invariant {
    after check(
      programA: "put(users, u1, data)", programB: "put(orders, o1, data)",
      readWriteSetsA: "{w: [users]}", readWriteSetsB: "{w: [orders]}"
    ) -> ok(result: c, commutes: true, reason: r)
    then r contains "disjoint write sets"
  }
}
```

---

### 3c. `DeadBranchProvider [D]` — Unreachable Branch Detection

**Purpose:** Identify branches in a StorageProgram that can never be taken, given type constraints and state invariants.

**Independent motivation:** Enables FlowTrace dead branch pruning and handler optimization. Useful for linting ("this error path is unreachable").

**Familiarity:** Dead code elimination in compilers, unreachable state detection in model checkers.

```
concept DeadBranchProvider [D] {
  purpose {
    Identify conditional branches in a StorageProgram that can
    never be taken, given type constraints and concept state invariants.
    Reports which branches are unreachable and why.
  }

  state {
    results: set D
    deadBranches: D -> list String
    reachableCount: D -> Int
    totalCount: D -> Int
  }

  actions {
    action analyze(program: String, constraints: String) {
      -> ok(result: D, deadBranches: String, reachableCount: Int, totalCount: Int) {
        Walk the program's branch tree. For each condition, check
        whether the constraint set makes the branch unsatisfiable.
        Return the list of dead branches with explanations.
      }
      -> error(message: String) { Analysis failed. }
    }
  }

  invariant {
    after analyze(program: "branch(true, thenP, elseP)", constraints: "{}") -> ok(result: d, deadBranches: db, reachableCount: rc, totalCount: tc)
    then rc = 1
    and tc = 2
  }
}
```

---

### 3d. `InvariantExtractionProvider [I]` — Formal Property Extraction

**Purpose:** Extract verifiable formal properties from a StorageProgram and its concept spec, producing FormalProperty candidates for the verification pipeline.

**Independent motivation:** Bridges the gap between handler code and formal specifications. Useful for auto-generating proof obligations without manual specification effort.

**Familiarity:** Weakest precondition calculus, design-by-contract extraction.

```
concept InvariantExtractionProvider [I] {
  purpose {
    Extract verifiable formal properties from a StorageProgram
    given its concept specification. Produces property candidates
    of the form "if state S before execution, then state S' after
    execution satisfies invariant I."
  }

  state {
    results: set I
    properties: I -> list String
    conceptRef: I -> String
  }

  actions {
    action extract(program: String, conceptSpec: String) {
      -> ok(result: I, properties: String) {
        Analyze the program's instruction sequence against the concept's
        declared invariants. For each invariant, derive a verifiable
        property relating pre-state to post-state.
      }
      -> error(message: String) { Extraction failed. }
    }
  }

  invariant {
    after extract(program: p, conceptSpec: "User { invariant: email is unique }") -> ok(result: i, properties: props)
    then props contains "post.users.email is unique"
  }
}
```

---

### 4. `ProgramCache [C]` — Memoization

**Purpose:** Cache the results of pure or read-only StorageProgram executions, keyed by program structure + storage state hash. Enables FlowTrace to skip re-executing unchanged subtrees.

**Independent motivation:** Caching program results is useful for any repeated evaluation — handler idempotency checks, speculative execution, and test replay all benefit.

**Familiarity:** Content-addressable cache, HTTP cache, build cache, memo table.

**Operational principle:** Store a result keyed by program hash + state hash, then lookup returns it. Invalidate by state or by program, then lookup misses.

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

**Jackson check:**
- Independence: No concept references.
- Single purpose: Memoize program results.
- Operational principle: store → lookup hits; invalidate → lookup misses.
- State completeness: All fields used.
- Action richness: 5 focused cache lifecycle actions.
- Familiarity: Content-addressable cache.

---

### 5. `FunctionalHandler [H]` — The Handler Registry

**Purpose:** Register concept handlers that return StoragePrograms instead of executing effects directly. The migration point between imperative and functional handler models.

**Independent motivation:** The registry of which concepts have functional handlers is useful for governance, deployment decisions, and capability tracking — independent of whether programs are analyzed, cached, or verified.

**Familiarity:** Service registry, dependency injection container.

**Operational principle:** Register a handler for a concept/action pair declaring its purity, then build a program from input. The handler produces data, not effects.

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
    programFactory: H -> String
    purity: H -> String
  }

  actions {
    action register(handler: H, concept: String, action: String, purity: String) {
      -> ok() { Functional handler registered for this concept/action. }
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

    action list(concept: String) {
      -> ok(handlers: String) {
        List all registered functional handlers for a concept.
      }
    }
  }

  invariant {
    after register(handler: h, concept: "User", action: "create", purity: "read-write") -> ok()
    and build(handler: h, input: "{ name: 'Alice' }") -> ok(program: p)
    then p is a valid StorageProgram
  }
}
```

**Jackson check:**
- Independence: No concept references.
- Single purpose: Register and invoke functional handlers.
- Operational principle: Register → build → get program data.
- State completeness: `handlers`, `concept`, `action`, `programFactory`, `purity` — all used.
- Action richness: 3 crisp actions — register, build, list. No verification or analysis concerns.
- Familiarity: Service registry.

---

## Syncs

### Provider Registration

Each analysis provider registers itself with ProgramAnalysis via a sync.

```
sync RegisterReadWriteSetProvider [eager]
when {
  ReadWriteSetProvider/analyze: []
    => []
}
then {
  ProgramAnalysis/registerProvider: [ name: "read-write-sets"; kind: "structural" ]
}
```

```
sync RegisterCommutativityProvider [eager]
when {
  CommutativityProvider/check: []
    => []
}
then {
  ProgramAnalysis/registerProvider: [ name: "commutativity"; kind: "relational" ]
}
```

```
sync RegisterDeadBranchProvider [eager]
when {
  DeadBranchProvider/analyze: []
    => []
}
then {
  ProgramAnalysis/registerProvider: [ name: "dead-branches"; kind: "constraint" ]
}
```

```
sync RegisterInvariantExtractionProvider [eager]
when {
  InvariantExtractionProvider/extract: []
    => []
}
then {
  ProgramAnalysis/registerProvider: [ name: "invariant-extraction"; kind: "formal" ]
}
```

### Analysis Dispatch

When ProgramAnalysis/run is called, dispatch to the appropriate provider.

```
sync DispatchReadWriteSets [eager]
when {
  ProgramAnalysis/run: [ program: ?program; provider: "read-write-sets" ]
    => []
}
then {
  ReadWriteSetProvider/analyze: [ program: ?program ]
}
```

```
sync DispatchCommutativity [eager]
when {
  ProgramAnalysis/run: [ program: ?programA; provider: "commutativity" ]
    => []
}
where {
  bind(?programA as ?readWriteSetsA)
  bind(?programA as ?readWriteSetsB)
}
then {
  CommutativityProvider/check: [
    programA: ?programA;
    programB: ?programA;
    readWriteSetsA: ?readWriteSetsA;
    readWriteSetsB: ?readWriteSetsB
  ]
}
```

```
sync DispatchDeadBranches [eager]
when {
  ProgramAnalysis/run: [ program: ?program; provider: "dead-branches" ]
    => []
}
then {
  DeadBranchProvider/analyze: [ program: ?program; constraints: "{}" ]
}
```

```
sync DispatchInvariantExtraction [eager]
when {
  ProgramAnalysis/run: [ program: ?program; provider: "invariant-extraction" ]
    => []
}
then {
  InvariantExtractionProvider/extract: [ program: ?program; conceptSpec: "" ]
}
```

### Core Execution Flow

```
sync BuildAndExecute [eager]
when {
  FunctionalHandler/build: [ handler: ?h; input: ?input ]
    => [ program: ?program ]
}
then {
  ProgramInterpreter/execute: [
    interpreter: ?defaultInterpreter;
    program: ?program;
    snapshot: "current"
  ]
}
```

```
sync AnalyzeOnBuild [eager]
when {
  FunctionalHandler/build: [ handler: ?h; input: ?input ]
    => [ program: ?program ]
}
then {
  ReadWriteSetProvider/analyze: [ program: ?program ]
}
```

### Cache Integration

```
sync CacheLookupBeforeExecute [eager]
when {
  FunctionalHandler/build: [ handler: ?h ]
    => [ program: ?program ]
  ReadWriteSetProvider/analyze: [ program: ?program ]
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
  ReadWriteSetProvider/analyze: [ program: ?program ]
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
  ReadWriteSetProvider/analyze: [ program: ?program ]
    => [ purity: "read-write" ]
}
where {
  bind(stateHash() as ?stateHash)
}
then {
  ProgramCache/invalidateByState: [ stateHash: ?stateHash ]
}
```

### Formal Verification Bridge

These syncs are optional — only active when the `formal-verification` suite is present.

```
sync ExtractPropertiesOnRegister [eager]
when {
  FunctionalHandler/register: [ handler: ?h; concept: ?concept; action: ?action ]
    => []
  FunctionalHandler/build: [ handler: ?h ]
    => [ program: ?program ]
}
then {
  InvariantExtractionProvider/extract: [ program: ?program; conceptSpec: ?concept ]
}
```

```
sync PublishExtractedProperties [eager]
when {
  InvariantExtractionProvider/extract: [ program: ?program; conceptSpec: ?concept ]
    => [ properties: ?properties ]
}
then {
  FormalProperty/define: [
    target_symbol: ?concept;
    kind: "postcondition";
    formula: ?properties;
    language: "clef-invariant"
  ]
}
```

### FlowTrace Integration

```
sync FlowTraceParallelBranches [eager]
when {
  FlowTrace/build: [ flowId: ?flowId ]
    => []
  FunctionalHandler/build: [ handler: ?hA ]
    => [ program: ?programA ]
  FunctionalHandler/build: [ handler: ?hB ]
    => [ program: ?programB ]
}
where {
  filter(?hA != ?hB)
}
then {
  CommutativityProvider/check: [
    programA: ?programA;
    programB: ?programB;
    readWriteSetsA: "";
    readWriteSetsB: ""
  ]
}
```

```
sync FlowTraceDeadBranchPruning [eager]
when {
  FlowTrace/build: [ flowId: ?flowId ]
    => []
  FunctionalHandler/build: [ handler: ?h ]
    => [ program: ?program ]
}
then {
  DeadBranchProvider/analyze: [ program: ?program; constraints: "{}" ]
}
```

---

## Derived Concept

```
derived MonadicConceptHandlers [T] {

  purpose {
    Compose the monadic handler infrastructure into a unified
    execution model where concept handlers return inspectable
    StoragePrograms that are analyzed by pluggable providers,
    cached, and interpreted — enabling formal verification,
    FlowTrace optimization, and safe concurrent execution.
  }

  composes {
    StorageProgram [T]
    ProgramInterpreter [T]
    ProgramAnalysis [T]
    ReadWriteSetProvider [T]
    CommutativityProvider [T]
    DeadBranchProvider [T]
    ProgramCache [T]
    FunctionalHandler [T]
  }

  syncs {
    required: [
      build-and-execute,
      analyze-on-build,
      invalidate-cache-on-write,
      dispatch-read-write-sets,
      register-read-write-set-provider
    ]
    recommended: [
      cache-lookup-before-execute,
      cache-store-after-execute,
      register-commutativity-provider,
      dispatch-commutativity,
      register-dead-branch-provider,
      dispatch-dead-branches,
      flow-trace-parallel-branches,
      flow-trace-dead-branch-pruning
    ]
  }

  surface {
    action invoke(concept: String, action: String, input: String) {
      entry: FunctionalHandler/build matches on concept: ?concept, action: ?action
      triggers: [
        ReadWriteSetProvider/analyze(program: ?program),
        ProgramInterpreter/execute(interpreter: "default", program: ?program, snapshot: "current")
      ]
    }

    action invokeWithDryRun(concept: String, action: String, input: String) {
      entry: FunctionalHandler/build matches on concept: ?concept, action: ?action
      triggers: [
        ReadWriteSetProvider/analyze(program: ?program),
        ProgramInterpreter/dryRun(interpreter: "default", program: ?program, snapshot: "current")
      ]
    }

    query readWriteSets(concept: String, action: String) {
      reads: ReadWriteSetProvider/analyze(program: ?latestProgram)
    }

    query commutativity(conceptA: String, actionA: String, conceptB: String, actionB: String) {
      reads: CommutativityProvider/check(programA: ?pA, programB: ?pB, readWriteSetsA: ?rwA, readWriteSetsB: ?rwB)
    }

    query cacheStats() {
      reads: ProgramCache/stats()
    }

    query analysisProviders() {
      reads: ProgramAnalysis/listProviders()
    }
  }

  principle {
    after invoke(concept: c, action: a, input: i)
    then the handler builds a StorageProgram (no side effects)
    and  the ReadWriteSetProvider extracts read/write sets
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
FlowTrace currently traces sync-triggered children **sequentially** because it can't know if they conflict. With `CommutativityProvider/check`, it can determine disjoint write sets and trace branches **in parallel**.

**Where it happens:** `FlowTraceParallelBranches` sync feeds commutativity data to FlowTrace. If `commutes: true`, children are traced concurrently.

### 2. Cached Subtree Reuse
When re-tracing a flow (common during debugging), FlowTrace checks `ProgramCache/lookup` for each node. If the handler's program hash and storage state hash match a cached entry, the entire subtree is reused without re-execution.

**Where it happens:** `CacheLookupBeforeExecute` sync short-circuits execution for read-only programs with cached results.

### 3. Dead Branch Pruning
FlowTrace currently evaluates every candidate sync to check if it fires. With `DeadBranchProvider/analyze`, it can determine that certain variant branches are unreachable given current state, skipping entire sync subtrees.

**Where it happens:** `FlowTraceDeadBranchPruning` sync runs dead branch analysis for each handler in the flow. Syncs that only trigger on dead-branch variants are marked `fired: false, reason: "unreachable variant"` without evaluation.

### 4. Speculative "What-If" Traces
Since handlers are now data, FlowTrace can build traces for **hypothetical** inputs — "what if User/create returned `exists` instead of `ok`?" — without executing anything. It walks the program's branch structure.

**Where it happens:** New action `FlowTrace/speculate(flowId, overrides)` that substitutes variant overrides into the program tree and follows the sync chain symbolically.

---

## Suite Manifest

```yaml
suite:
  name: monadic-handlers
  version: "1.0.0"
  description: >
    Monadic concept handler infrastructure — StoragePrograms as inspectable
    data, interpreted execution, pluggable static analysis providers,
    memoization, and formal verification integration.

concepts:
  StorageProgram:
    spec: specs/monadic/storage-program.concept
    params:
      P: { as: ProgramId, description: "Unique program identifier" }
  ProgramInterpreter:
    spec: specs/monadic/program-interpreter.concept
    params:
      I: { as: InterpreterId, description: "Interpreter instance identifier" }
  ProgramAnalysis:
    spec: specs/monadic/program-analysis.concept
    params:
      A: { as: AnalysisId, description: "Analysis result identifier" }
  ReadWriteSetProvider:
    spec: specs/monadic/providers/read-write-set-provider.concept
    params:
      R: { as: ResultId, description: "Read/write set analysis result" }
  CommutativityProvider:
    spec: specs/monadic/providers/commutativity-provider.concept
    params:
      C: { as: ResultId, description: "Commutativity analysis result" }
  DeadBranchProvider:
    spec: specs/monadic/providers/dead-branch-provider.concept
    params:
      D: { as: ResultId, description: "Dead branch analysis result" }
  InvariantExtractionProvider:
    spec: specs/monadic/providers/invariant-extraction-provider.concept
    params:
      I: { as: ResultId, description: "Invariant extraction result" }
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
      description: "Run ReadWriteSetProvider on every built program"
    - path: syncs/monadic/invalidate-cache-on-write.sync
      description: "Invalidate memoized results when storage mutates"
    - path: syncs/monadic/dispatch-read-write-sets.sync
      description: "Dispatch read-write-set analysis to provider"
    - path: syncs/monadic/register-read-write-set-provider.sync
      description: "Register the ReadWriteSetProvider with ProgramAnalysis"
  recommended:
    - path: syncs/monadic/cache-lookup-before-execute.sync
      name: CacheLookupBeforeExecute
      description: "Check cache before executing read-only programs"
    - path: syncs/monadic/cache-store-after-execute.sync
      name: CacheStoreAfterExecute
      description: "Memoize results of pure/read-only executions"
    - path: syncs/monadic/register-commutativity-provider.sync
      name: RegisterCommutativityProvider
      description: "Register the CommutativityProvider with ProgramAnalysis"
    - path: syncs/monadic/dispatch-commutativity.sync
      name: DispatchCommutativity
      description: "Dispatch commutativity analysis to provider"
    - path: syncs/monadic/register-dead-branch-provider.sync
      name: RegisterDeadBranchProvider
      description: "Register the DeadBranchProvider with ProgramAnalysis"
    - path: syncs/monadic/dispatch-dead-branches.sync
      name: DispatchDeadBranches
      description: "Dispatch dead branch analysis to provider"
    - path: syncs/monadic/flow-trace-parallel-branches.sync
      name: FlowTraceParallelBranches
      description: "Feed commutativity data to FlowTrace for parallel tracing"
    - path: syncs/monadic/flow-trace-dead-branch-pruning.sync
      name: FlowTraceDeadBranchPruning
      description: "Feed dead branch data to FlowTrace for pruning"

uses:
  - suite: formal-verification
    optional: true
    concepts:
      - name: FormalProperty
        params: { P: { as: PropertyId } }
    syncs:
      - path: syncs/monadic/extract-properties-on-register.sync
        description: "Extract invariants from handler programs on registration"
      - path: syncs/monadic/publish-extracted-properties.sync
        description: "Publish extracted invariants as FormalProperties"
      - path: syncs/monadic/register-invariant-extraction-provider.sync
        description: "Register InvariantExtractionProvider with ProgramAnalysis"
      - path: syncs/monadic/dispatch-invariant-extraction.sync
        description: "Dispatch invariant extraction to provider"

dependencies:
  - name: clef-kernel
    version: ">=1.0.0"
```

---

## Migration Path

Each scope is independently deployable and independently valuable.

**Scope A — Foundation:** Create StorageProgram, FunctionalHandler, ProgramInterpreter, and the `build-and-execute` sync. This gives the basic "handlers as data → interpreted execution" loop. Existing imperative handlers continue working unchanged.

**Scope B — Base Analysis:** Add ProgramAnalysis, ReadWriteSetProvider, and the `analyze-on-build` sync. Every built program gets read/write set extraction. No behavior change — just information.

**Scope C — Caching:** Add ProgramCache and the cache syncs. Pure/read-only programs start getting memoized. FlowTrace begins benefiting from cached subtrees.

**Scope D — Advanced Analysis Providers:** Add CommutativityProvider and DeadBranchProvider. These are recommended syncs — they enhance FlowTrace with parallel tracing and dead branch pruning. Deployments that don't need these skip them.

**Scope E — Formal Verification Bridge:** Add InvariantExtractionProvider and wire to the `formal-verification` suite. Handler programs get automatically converted to FormalProperties. Only active when formal-verification suite is present (optional `uses` dependency).

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
  program-analysis.concept
  program-cache.concept
  functional-handler.concept
  providers/
    read-write-set-provider.concept
    commutativity-provider.concept
    dead-branch-provider.concept
    invariant-extraction-provider.concept

syncs/monadic/
  build-and-execute.sync
  analyze-on-build.sync
  cache-lookup-before-execute.sync
  cache-store-after-execute.sync
  invalidate-cache-on-write.sync
  dispatch-read-write-sets.sync
  dispatch-commutativity.sync
  dispatch-dead-branches.sync
  dispatch-invariant-extraction.sync
  register-read-write-set-provider.sync
  register-commutativity-provider.sync
  register-dead-branch-provider.sync
  register-invariant-extraction-provider.sync
  extract-properties-on-register.sync
  publish-extracted-properties.sync
  flow-trace-parallel-branches.sync
  flow-trace-dead-branch-pruning.sync

derived/monadic-concept-handlers.derived

handlers/ts/monadic/
  storage-program.handler.ts
  program-interpreter.handler.ts
  program-analysis.handler.ts
  program-cache.handler.ts
  functional-handler.handler.ts
  providers/
    read-write-set-provider.handler.ts
    commutativity-provider.handler.ts
    dead-branch-provider.handler.ts
    invariant-extraction-provider.handler.ts

runtime/
  storage-program.ts          # StorageProgram<A> type + builder DSL
  interpreter.ts              # interpret() function
  functional-handler.ts       # FunctionalConceptHandler type
```
