# PRD: QueryProgram `invoke` Instruction

**Status:** Draft
**Author:** Claude
**Date:** 2026-04-06

---

## Problem Statement

QueryProgram currently describes pure read pipelines: scan, filter, sort,
group, project, limit, join, pure. Views that need to trigger writes —
inline editing, bulk operations, "mark all as read" — must leave the
QueryProgram world entirely and route through a separate Binding/invoke or
Connection/invoke path. This creates two disconnected execution models for
what users experience as a single view interaction.

InteractionSpec references concept actions by name in opaque JSON
(`{"concept":"ContentNode","action":"create",...}`) but has no way to
compose those actions with the query pipeline that produced the data
they operate on. The view knows *what* to show and *what the user can do*,
but these two descriptions live in different systems with no shared
execution trace.

## Proposed Solution

Add an `invoke` instruction to QueryProgram that declares a concept
action invocation as a pure data instruction. The instruction is not
executed directly — when the QueryExecution interpreter encounters it,
it dispatches through the sync engine, which routes to the appropriate
StorageProgram handler. The completion flows back into the QueryProgram's
binding environment for downstream instructions.

This follows the exact pattern established by StorageProgram's `perform`
instruction, which declares transport effects as data and delegates
execution to registered EffectHandlers.

## Design Principles

1. **QueryProgram stays pure data.** The `invoke` instruction is a
   description of intent, not a side effect. The program remains
   serializable, inspectable, and diffable.

2. **Writes route through syncs.** The interpreter dispatches invoke
   instructions through the sync engine, preserving full observability:
   flow trace, CompletionCoverage, authorization, and audit logging.

3. **Purity becomes a first-class tracked property.** Programs containing
   `invoke` instructions are classified `read-write`. Programs without
   remain `read-only` or `pure`. The caching layer uses this
   classification to decide what can be memoized.

4. **No new execution path.** The invoke instruction reuses Connection's
   existing `invoke` semantics (concept, action, input → variant, output).
   No new dispatch infrastructure is needed.

## Specification

### New Action: `invoke`

```
action invoke(program: Q, concept: String, action: String,
              input: String, bindAs: String)
  -> ok(program: Q) {
    Append an Invoke instruction that declares a concept action
    invocation. The concept and action identify the target; input
    is a JSON-serialized action input. The completion (variant tag
    and output fields) is bound to bindAs for use by subsequent
    instructions. The program's purity is promoted to read-write.
  }
  -> notfound() {
    No program exists with this identifier.
  }
  -> sealed() {
    The program has already been terminated with pure and cannot
    accept new instructions.
  }
```

### New Action: `branch` (conditional on invoke result)

```
action branch(program: Q, binding: String, variant: String,
              thenProgram: Q, elseProgram: Q, bindAs: String)
  -> ok(program: Q) {
    Append a Branch instruction that inspects the variant tag
    bound at binding. If the variant matches, continue with
    thenProgram; otherwise continue with elseProgram. Enables
    conditional logic after invoke: "if create succeeded, scan
    the updated set; otherwise return the error."
  }
  -> notfound() {
    No program exists with this identifier, or thenProgram/
    elseProgram do not exist.
  }
  -> sealed() {
    The program has already been terminated.
  }
```

### State Changes

```
state {
  programs: set Q
  instructions: Q -> list String
  bindings: Q -> list String
  terminated: Q -> Bool
  readFields: Q -> set String
  invokedActions: Q -> set String    # NEW: concept/action pairs
  purity: Q -> String                # NEW: "pure" | "read-only" | "read-write"
}
```

### Purity Classification

| Instructions present | Purity |
|---|---|
| No instructions (empty program) | `pure` |
| Only scan, filter, sort, group, project, limit, join | `read-only` |
| Any `invoke` instruction | `read-write` |

Purity is tracked incrementally as instructions are appended:
- `create` → `pure`
- First scan/filter/sort/group/project/limit/join → `read-only`
- First invoke → `read-write`
- Purity never decreases (read-write stays read-write)

### New Invariants

```
always "invoke instructions track their target": {
  forall q in programs:
  forall instr in q.instructions:
  instr.type = "invoke" implies
    (instr.concept + "/" + instr.action) in q.invokedActions
}

always "programs with invokes are read-write": {
  forall q in programs:
  q.invokedActions != {} implies q.purity = "read-write"
}

never "read-only program contains invoke": {
  exists q in programs:
  q.purity = "read-only" and q.invokedActions != {}
}

always "invoke bindings are available downstream": {
  forall q in programs:
  forall instr in q.instructions:
  instr.type = "invoke" implies instr.bindAs in q.bindings
}
```

### Execution Semantics

When the QueryExecution interpreter encounters an `invoke` instruction:

1. Extract `concept`, `action`, `input` from the instruction
2. Dispatch through the sync engine as a concept action invocation
   (same path as Connection/invoke)
3. Receive the completion: `{ variant: String, output: String }`
4. Bind the completion to `bindAs` in the program's binding environment
5. Continue to the next instruction

The interpreter MUST NOT execute invoke instructions speculatively,
out of order, or in parallel with other invoke instructions. Invokes
execute in program order, sequentially. Read instructions before and
after an invoke may still be parallelized with each other (but not
across the invoke boundary).

### Interaction with Existing View Concepts

**InteractionSpec** — Row actions and create forms currently reference
concept actions as opaque JSON configs. With `invoke`, InteractionSpec
can instead reference a QueryProgram that contains the invoke instruction.
This is an optional migration, not a breaking change:

```
# Before: opaque JSON reference
createForm: '{"concept":"ContentNode","action":"create","fields":[...]}'

# After: InteractionSpec references a QueryProgram ID
createProgram: "content-create-qprog"
```

The QueryProgram can include pre-invoke reads (fetch defaults), the
invoke itself, and post-invoke reads (refresh the view):

```
scan("defaults", "defaults") →
  invoke("ContentNode", "create", input, "result") →
  branch("result", "ok", refreshProg, errorProg, "final") →
  pure("ok", "final")
```

**ViewShell** — No changes required. ViewShell holds a reference to
the query program; the program's purity is an internal property that
the execution layer checks.

**CompileQuery sync** — Existing compile syncs produce read-only
QueryPrograms and are unaffected. New syncs can produce read-write
programs when InteractionSpec specifies invoke-bearing programs.

### Sync Wiring

Two new syncs connect invoke execution to the sync engine:

**ExecuteInvoke** — Routes invoke instructions to the kernel:

```
sync ExecuteInvoke [eager]
  purpose: "When QueryExecution encounters an invoke instruction,
    dispatch it through Connection/invoke to the kernel."
when {
  QueryExecution/execute: [ program: ?program ]
    => invoke_pending(concept: ?concept; action: ?action;
                      input: ?input)
}
then {
  Connection/invoke: [
    connection: ?activeConnection;
    concept: ?concept;
    action: ?action;
    input: ?input ]
}
```

**InvokeComplete** — Returns completion to the query pipeline:

```
sync InvokeComplete [eager]
  purpose: "When Connection/invoke completes, feed the result
    back to QueryExecution so the program can continue."
when {
  Connection/invoke: [ concept: ?concept; action: ?action ]
    => ok(variant: ?variant; output: ?output)
}
then {
  QueryExecution/resumeAfterInvoke: [
    concept: ?concept;
    action: ?action;
    variant: ?variant;
    output: ?output ]
}
```

This requires a new `resumeAfterInvoke` action on QueryExecution (or
a variant of `execute` that accepts partial results). See Open
Questions.

## Static Analysis Providers

### InvokeEffectProvider (new)

Mirrors TransportEffectProvider for StorageProgram. Walks the
instruction tree and extracts all `concept/action` pairs that the
QueryProgram may invoke.

```
action analyze(program: String)
  -> ok(result: T, invocations: String, invokeCount: Int) {
    Walk the instruction tree. For each invoke instruction, extract
    the concept/action pair. For branch instructions, recurse into
    both arms and union the sets. Return all reachable invocations
    as a JSON array.
  }
```

**Enables:**
- Static verification that every invoked concept/action exists in
  the kernel registry
- Authorization pre-check: "does the session identity have permission
  to invoke all actions this QueryProgram references?"
- Impact analysis: "if Article/archive is removed, which
  QueryPrograms break?"

### QueryPurityProvider (new)

Mirrors ReadWriteSetProvider for StorageProgram. Classifies a
QueryProgram's purity and extracts read fields + invoked actions.

```
action analyze(program: String)
  -> ok(result: R, readFields: String, invokedActions: String,
        purity: String) {
    Walk the instruction tree. Scan/filter/sort/group/project/join
    contribute to readFields. Invoke instructions contribute to
    invokedActions. Purity: no instructions = pure, only reads =
    read-only, any invoke = read-write.
  }
```

**Enables:**
- Cache invalidation: read-write programs are never memoized
- Query optimization: read-only programs can be safely re-executed,
  deduplicated, or served from cache
- Audit: which views can modify data?

### QueryCompletionCoverage (new)

Verifies that every invoke instruction's possible completion variants
have matching downstream handling (via `branch` or direct binding).

```
action check(program: String)
  -> ok(covered: String, uncovered: String) {
    For each invoke instruction, determine the set of possible
    completion variants from the target concept spec. Check that
    the program handles each variant (via branch) or explicitly
    ignores it. Report uncovered variants.
  }
```

**Enables:**
- "This QueryProgram invokes Article/create but never handles the
  `duplicate` variant — it will silently drop duplicates"
- Completeness verification at build time, not runtime

## QueryExecution Changes

QueryExecution needs to support pausing execution at an invoke
instruction, dispatching the action, and resuming with the result.

### Option A: Coroutine-style (recommended)

`execute` returns a new variant when it hits an invoke:

```
action execute(program: String, kind: String)
  -> ok(rows: String, metadata: String)          # terminal
  -> invoke_pending(concept: String,              # NEW
       action: String, input: String,
       continuation: String)
  -> error(message: String)
```

The `continuation` is a serialized program state that
`resumeAfterInvoke` uses to continue execution:

```
action resumeAfterInvoke(continuation: String, variant: String,
                         output: String)
  -> ok(rows: String, metadata: String)           # terminal
  -> invoke_pending(concept: String, action: String,
       input: String, continuation: String)       # another invoke
  -> error(message: String)
```

This is a coroutine: execute → yield invoke → resume → yield invoke →
... → return rows. Each step is a sync trigger, so every invoke is
visible in the flow trace.

### Option B: Batch pre-resolution

All invoke instructions are extracted statically
(InvokeEffectProvider), executed upfront via the sync engine, and
their results injected into the binding environment before the
QueryProgram runs. Simpler, but doesn't support data-dependent
invokes (where the invoke input depends on a scan result).

**Recommendation:** Option A. It handles both static and
data-dependent invokes, and the coroutine pattern is well-precedented
by StorageProgram's `perform` execution model.

## Caching & Memoization Impact

| Purity | Cache behavior |
|---|---|
| `pure` | Always cached, never invalidated |
| `read-only` | Cached, invalidated on relevant storage writes |
| `read-write` | **Never cached.** Each execution is unique. |

The QueryExecution provider checks `purity` before consulting the
cache. ProgramCache (if extended to QueryPrograms) skips read-write
programs entirely.

For read-write programs that contain a read-only prefix (scan →
filter → sort → invoke → re-scan), the optimizer MAY cache the
prefix up to the first invoke instruction. This is an optimization,
not a requirement for v1.

## Examples

### Bulk status update

"Find all overdue tasks, mark them escalated, return the updated list."

```
create(program: "bulk-escalate")
scan(program: "bulk-escalate", source: "tasks", bindAs: "all")
filter(program: "bulk-escalate",
  node: '{"type":"lt","field":"dueDate","value":"2026-04-06"}',
  bindAs: "overdue")
invoke(program: "bulk-escalate",
  concept: "Task", action: "escalate",
  input: '{"ids":"$overdue"}', bindAs: "escalation")
scan(program: "bulk-escalate", source: "tasks", bindAs: "refreshed")
filter(program: "bulk-escalate",
  node: '{"type":"eq","field":"status","value":"escalated"}',
  bindAs: "updated")
pure(program: "bulk-escalate", variant: "ok", output: "updated")
```

Purity: `read-write`. InvokeEffectProvider reports: `["Task/escalate"]`.

### Optimistic create with refresh

"Create a content node, then return the updated content list."

```
create(program: "create-and-refresh")
invoke(program: "create-and-refresh",
  concept: "ContentNode", action: "create",
  input: '{"node":"new-article","kind":"concept"}',
  bindAs: "createResult")
branch(program: "create-and-refresh",
  binding: "createResult", variant: "ok",
  thenProgram: "refresh-prog", elseProgram: "error-prog",
  bindAs: "final")
pure(program: "create-and-refresh", variant: "ok", output: "final")
```

### Read-only query (unchanged)

Existing read-only pipelines are completely unaffected:

```
create → scan → filter → sort → project → pure
```

Purity: `read-only`. No invoke instructions. Cached normally.

## Migration & Backwards Compatibility

- **No breaking changes.** `invoke` and `branch` are new optional
  actions. Existing QueryPrograms remain valid and read-only.
- **Purity field defaults to `read-only`** for existing programs that
  have instructions, `pure` for empty programs. No migration needed.
- **InteractionSpec** continues to work with opaque JSON action
  references. The `createProgram` reference pattern is additive.
- **Existing syncs** (CompileQuery, ExecuteQuery, etc.) are unaffected.
  They produce read-only programs and never emit invoke instructions.
- **QueryExecution** gains `invoke_pending` and `resumeAfterInvoke`
  as new variants/actions. Existing `execute → ok` path is unchanged.

## Implementation Plan

### Phase 1: Core instruction & purity tracking

1. Add `invoke` and `branch` actions to `query-program.concept`
2. Add `invokedActions` and `purity` state fields
3. Add invariants
4. Add fixtures and conformance tests
5. Update QueryProgram handler to implement the new actions
6. Update runtime DSL (if QueryProgram has one) with `invoke` and
   `branch` builder functions

### Phase 2: Execution support

1. Add `invoke_pending` variant to `QueryExecution/execute`
2. Add `resumeAfterInvoke` action to QueryExecution
3. Write ExecuteInvoke and InvokeComplete syncs
4. Update QueryExecution handler to implement coroutine-style
   pause/resume
5. Integration test: invoke dispatches through sync engine and
   returns completion

### Phase 3: Static analysis providers

1. Create InvokeEffectProvider concept and handler
2. Create QueryPurityProvider concept and handler
3. Create QueryCompletionCoverage concept and handler
4. Register providers in the view suite manifest
5. Wire analysis syncs (analyze on program seal)

### Phase 4: View integration

1. Add optional `createProgram` / `actionProgram` fields to
   InteractionSpec for invoke-bearing QueryPrograms
2. Write CompileActionQuery sync (builds invoke-bearing programs
   from InteractionSpec configs)
3. Update Pilot/submit to dispatch through invoke-bearing
   QueryPrograms when available
4. End-to-end test: view renders, user clicks action, invoke
   executes through sync engine, view refreshes

## Open Questions

1. **Should `invoke` support batch/traverse?** The bulk escalate
   example assumes a single invoke with `$overdue` as a set. Should
   there be a `traverseInvoke` that iterates over a bound set and
   invokes once per record? Or should that be handled by the concept
   handler accepting a batch input?

2. **Continuation serialization.** The coroutine model requires
   serializing the QueryProgram's execution state at an invoke
   boundary. Should this be an opaque token (simpler, but
   non-inspectable) or a structured program suffix (inspectable,
   but more complex)?

3. **Authorization scope.** Should InvokeEffectProvider's static
   analysis feed into an authorization pre-check before the program
   starts executing? Or should authorization be checked per-invoke
   at execution time (current Connection/invoke behavior)?

4. **Error propagation.** If an invoke fails mid-program (e.g.,
   unauthorized), should the entire QueryProgram fail, or should the
   error be bound and let downstream `branch` instructions handle it?
   Recommendation: bind the error and let the program decide — this
   matches StorageProgram's `branch` semantics.

5. **Should `branch` be a separate action or part of `invoke`?**
   StorageProgram has a dedicated `branch` action. QueryProgram could
   follow the same pattern (proposed above) or combine invoke + branch
   into a single "invoke with handlers" instruction. Separate is more
   composable; combined is more concise for the common case.

## Success Criteria

- [ ] QueryProgram with invoke instructions can be created, sealed,
      serialized, and deserialized
- [ ] Purity is correctly classified for all program shapes
- [ ] InvokeEffectProvider extracts all reachable concept/action pairs
- [ ] QueryCompletionCoverage reports unhandled invoke variants
- [ ] QueryExecution dispatches invoke through the sync engine and
      resumes with the completion
- [ ] Flow trace shows the full causal chain: QueryProgram → invoke →
      sync → StorageProgram → completion → resume
- [ ] Read-only programs are unaffected (no performance regression,
      no behavioral change)
- [ ] Existing view syncs (CompileQuery, ExecuteQuery) continue to
      work unchanged
