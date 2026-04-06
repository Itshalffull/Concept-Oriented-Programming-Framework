# PRD: QueryProgram `invoke` Instruction

**Status:** Draft (Open Questions Resolved)
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

### New Action: `match` (multi-way conditional on binding variant)

Replaces binary `branch`. Supports multi-way pattern matching on
completion variants — directly paralleling how syncs match on `when`
clauses. Named `match` (not `branch`) to distinguish from
StorageProgram's binary branch and signal multi-way semantics.

```
action match(program: Q, binding: String, cases: String,
             bindAs: String)
  -> ok(program: Q) {
    Append a Match instruction that inspects the variant tag bound
    at binding. cases is a JSON object mapping variant tags to
    sub-program IDs: {"ok": "prog-a", "error": "prog-b", "*": "prog-c"}.
    The "*" key is a wildcard default. The matched sub-program's
    terminal output is bound to bindAs. All referenced sub-programs
    must exist and be sealed (terminated with pure).
  }
  -> notfound() {
    No program exists with this identifier, or one or more
    sub-programs referenced in cases do not exist.
  }
  -> sealed() {
    The program has already been terminated.
  }
  -> invalid_cases() {
    The cases string is not valid JSON, is empty, or references
    sub-programs that are not sealed.
  }
```

### New Action: `traverseInvoke` (batch invocation over a bound set)

Iterates over a bound record set, stamping out one invoke per item
using a JSON input template with `$<itemBinding>.field` substitutions.
The interpreter dispatches each invocation sequentially through the
sync engine. Results are collected into a list bound to `bindAs`.

This covers 90% of real batch use cases (bulk status update, batch
archive, mark-all-as-read) with a flat, statically-analyzable
instruction. InvokeEffectProvider can extract the concept/action pair
directly without evaluating a sub-program body.

```
action traverseInvoke(program: Q, sourceBinding: String,
                      itemBinding: String, concept: String,
                      action: String, inputTemplate: String,
                      bindAs: String)
  -> ok(program: Q) {
    Append a TraverseInvoke instruction that iterates over the
    record set bound at sourceBinding. For each record, binds
    the record to itemBinding, interpolates inputTemplate
    (replacing $<itemBinding>.field with actual values), and
    invokes concept/action with the interpolated input. Each
    invocation dispatches through the sync engine sequentially.
    The list of completions (variant + output per item) is bound
    to bindAs. The program's purity is promoted to read-write.
  }
  -> notfound() {
    No program exists with this identifier.
  }
  -> sealed() {
    The program has already been terminated.
  }
```

### New Action: `traverse` (general sub-program iteration)

The full-power iteration primitive, mirroring StorageProgram's
`traverse`. Iterates over a bound record set, executing a complete
sub-QueryProgram per item. The sub-program can contain any
instruction including `invoke`, `match`, or nested `traverse`.

Supports declared effects for static analysis when the sub-program
body accesses item properties (same pattern as StorageProgram's
`TraverseDeclaredEffects`).

```
action traverse(program: Q, sourceBinding: String,
                itemBinding: String, bodyProgram: Q,
                bindAs: String, declaredEffects: String)
  -> ok(program: Q) {
    Append a Traverse instruction that iterates over the record
    set bound at sourceBinding. For each record, binds the record
    to itemBinding, then executes bodyProgram in a nested scope.
    The bodyProgram must be sealed. Results are collected into a
    list bound to bindAs. declaredEffects is a JSON object with
    optional keys: readFields, invokedActions, completionVariants.
    If provided, static analysis uses declared effects instead of
    analyzing the body (necessary when the body accesses item
    properties that don't exist on sentinel data).
  }
  -> notfound() {
    No program or bodyProgram exists with this identifier.
  }
  -> sealed() {
    The program has already been terminated.
  }
  -> not_sealed() {
    The bodyProgram has not been terminated with pure. Sub-programs
    used as traverse bodies must be sealed before attachment.
  }
```

**Relationship between `traverseInvoke` and `traverse`:**
`traverseInvoke` is syntactic sugar. Any `traverseInvoke` can be
desugared into a `traverse` whose body is a single-invoke program:

```
# traverseInvoke:
traverseInvoke(prog, "overdue", "_task",
  "Task", "escalate", '{"taskId":"$_task.id"}', "results")

# Equivalent traverse:
create(bodyProg)
invoke(bodyProg, "Task", "escalate", '{"taskId":"$_task.id"}', "r")
pure(bodyProg, "ok", "r")
traverse(prog, "overdue", "_task", bodyProg, "results", '{}')
```

`traverseInvoke` exists for ergonomics and because InvokeEffectProvider
can extract the concept/action pair from the flat instruction without
analyzing a sub-program tree. Both are shipped together — no phasing.

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
  matchCases: Q -> list String       # NEW: sub-program refs from match instructions
  traverseBodies: Q -> list Q        # NEW: sub-program refs from traverse instructions
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

always "traverseInvoke instructions track their target": {
  forall q in programs:
  forall instr in q.instructions:
  instr.type = "traverseInvoke" implies
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
  (instr.type = "invoke" or instr.type = "traverseInvoke"
   or instr.type = "traverse")
  implies instr.bindAs in q.bindings
}

always "match case sub-programs are sealed": {
  forall q in programs:
  forall instr in q.instructions:
  instr.type = "match" implies
    forall ref in instr.cases.values:
    ref in programs and ref.terminated = true
}

always "traverse body sub-programs are sealed": {
  forall q in programs:
  forall instr in q.instructions:
  instr.type = "traverse" implies
    instr.bodyProgram in programs and
    instr.bodyProgram.terminated = true
}

always "traverse inherits body purity": {
  forall q in programs:
  forall instr in q.instructions:
  instr.type = "traverse" and instr.bodyProgram.purity = "read-write"
  implies q.purity = "read-write"
}
```

### Execution Semantics

**`invoke`** — When the interpreter encounters an invoke instruction:

1. Extract `concept`, `action`, `input` from the instruction
2. Dispatch through the sync engine as a concept action invocation
   (same path as Connection/invoke)
3. Receive the completion: `{ variant: String, output: String }`
4. Bind the completion to `bindAs` in the program's binding environment
5. Continue to the next instruction

**`match`** — When the interpreter encounters a match instruction:

1. Read the variant tag from the binding referenced by `binding`
2. Look up the variant in `cases`; fall back to `"*"` wildcard if
   no exact match
3. Execute the matched sub-program (which is already sealed)
4. Bind the sub-program's terminal output to `bindAs`
5. Continue to the next instruction

**`traverseInvoke`** — When the interpreter encounters a
traverseInvoke instruction:

1. Read the record set from `sourceBinding`
2. For each record, bind it to `itemBinding`
3. Interpolate `inputTemplate` (replace `$<itemBinding>.field` refs)
4. Dispatch `concept/action` with interpolated input through the
   sync engine
5. Collect the completion (variant + output) into a results list
6. After all records are processed, bind the results list to `bindAs`
7. Continue to the next instruction

Each invocation within a traverseInvoke dispatches sequentially. The
interpreter yields `invoke_pending` per item in the coroutine model
(N items = N yield/resume cycles).

**`traverse`** — When the interpreter encounters a traverse instruction:

1. Read the record set from `sourceBinding`
2. For each record, bind it to `itemBinding`
3. Execute `bodyProgram` in a nested scope with the item binding
4. Collect each body execution's terminal output into a results list
5. After all records are processed, bind the results list to `bindAs`
6. Continue to the next instruction

If the body program contains invoke instructions, each triggers the
coroutine yield/resume cycle. A traverse over N items where the body
has M invokes produces N×M yield/resume cycles.

**Ordering guarantee:** The interpreter MUST NOT execute invoke or
traverseInvoke instructions speculatively, out of order, or in parallel
with other invoke instructions. Invokes execute in program order,
sequentially. Read instructions before and after an invoke boundary
may still be parallelized with each other (but not across the boundary).

**Error propagation:** Invoke completions are always bound to `bindAs`,
including error variants. Application errors (unauthorized, notfound,
handler errors) are bindable — downstream `match` instructions can
handle them. Infrastructure errors (network failure, sync engine down)
abort the entire program with `QueryExecution/execute → error`.

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
  match("result", {"ok":"refresh-prog","*":"error-prog"}, "final") →
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

This requires the `resumeAfterInvoke` action on QueryExecution
specified in the Coroutine-style execution section above.

## Static Analysis Providers

### InvokeEffectProvider (new)

Mirrors TransportEffectProvider for StorageProgram. Walks the
instruction tree and extracts all `concept/action` pairs that the
QueryProgram may invoke.

```
action analyze(program: String)
  -> ok(result: T, invocations: String, invokeCount: Int) {
    Walk the instruction tree. For each invoke or traverseInvoke
    instruction, extract the concept/action pair. For match
    instructions, recurse into all case sub-programs and union
    the sets. For traverse instructions, use declaredEffects if
    available; otherwise analyze the body sub-program. Return all
    reachable invocations as a JSON array.
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
    contribute to readFields. Invoke and traverseInvoke instructions
    contribute to invokedActions. Traverse instructions inherit
    purity from their body sub-program (or declaredEffects).
    Purity: no instructions = pure, only reads = read-only,
    any invoke/traverseInvoke/read-write-traverse = read-write.
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
    For each invoke and traverseInvoke instruction, determine the
    set of possible completion variants from the target concept
    spec. Check that the program handles each variant (via a
    downstream match instruction on the invoke's bindAs) or
    explicitly ignores it. For traverse bodies, check coverage
    within the body sub-program. Report uncovered variants.
  }
```

**Enables:**
- "This QueryProgram invokes Article/create but never handles the
  `duplicate` variant — it will silently drop duplicates"
- Completeness verification at build time, not runtime

## QueryExecution Changes

QueryExecution needs to support pausing execution at an invoke
instruction, dispatching the action, and resuming with the result.

### Coroutine-style execution

`execute` returns a new variant when it hits an invoke:

```
action execute(program: String, kind: String)
  -> ok(rows: String, metadata: String)          # terminal
  -> invoke_pending(concept: String,              # NEW
       action: String, input: String,
       continuation: String)
  -> error(message: String)
```

The `continuation` is a **structured program suffix**: the remaining
instruction list plus the current binding environment, serialized as
JSON. This preserves inspectability — continuations can be diffed,
logged, and included in flow traces. No opaque tokens, no server-side
state.

```json
{
  "remainingInstructions": [ ... ],
  "bindings": { "overdue": [...], "result": { "variant": "ok", ... } },
  "programId": "bulk-escalate",
  "instructionIndex": 4
}
```

`resumeAfterInvoke` accepts the continuation and the invoke result:

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

For `traverseInvoke` and `traverse` with invoke bodies, the
continuation additionally tracks the iteration position (current index
into the source set and accumulated results so far). A traverseInvoke
over N items produces N yield/resume cycles, each with a structured
continuation showing progress:

```json
{
  "remainingInstructions": [ ... ],
  "bindings": { ... },
  "traverseState": {
    "sourceBinding": "overdue",
    "currentIndex": 3,
    "totalItems": 12,
    "accumulatedResults": [ ... ]
  }
}
```

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

### Bulk status update (traverseInvoke)

"Find all overdue tasks, mark each one escalated, return updated list."

```
create(program: "bulk-escalate")
scan(program: "bulk-escalate", source: "tasks", bindAs: "all")
filter(program: "bulk-escalate",
  node: '{"type":"lt","field":"dueDate","value":"2026-04-06"}',
  bindAs: "overdue")
traverseInvoke(program: "bulk-escalate",
  sourceBinding: "overdue", itemBinding: "_task",
  concept: "Task", action: "escalate",
  inputTemplate: '{"taskId":"$_task.id"}',
  bindAs: "results")
scan(program: "bulk-escalate", source: "tasks", bindAs: "refreshed")
filter(program: "bulk-escalate",
  node: '{"type":"eq","field":"status","value":"escalated"}',
  bindAs: "updated")
pure(program: "bulk-escalate", variant: "ok", output: "updated")
```

Purity: `read-write`. InvokeEffectProvider reports: `["Task/escalate"]`.

### Conditional bulk with error handling (traverse + match)

"Archive each completed task; if any archive fails due to a lock,
skip it and continue. Return summary of archived vs skipped."

```
# Body sub-program: archive one task, handle lock error
create(program: "archive-body")
invoke(program: "archive-body",
  concept: "Task", action: "archive",
  input: '{"taskId":"$_task.id"}', bindAs: "archiveResult")
match(program: "archive-body",
  binding: "archiveResult",
  cases: '{"ok":"archived-path","locked":"skipped-path","*":"error-path"}',
  bindAs: "outcome")
pure(program: "archive-body", variant: "ok", output: "outcome")

# Main program
create(program: "bulk-archive")
scan(program: "bulk-archive", source: "tasks", bindAs: "all")
filter(program: "bulk-archive",
  node: '{"type":"eq","field":"status","value":"completed"}',
  bindAs: "completed")
traverse(program: "bulk-archive",
  sourceBinding: "completed", itemBinding: "_task",
  bodyProgram: "archive-body", bindAs: "outcomes",
  declaredEffects: '{"invokedActions":["Task/archive"],"completionVariants":["ok","locked","error"]}')
pure(program: "bulk-archive", variant: "ok", output: "outcomes")
```

Purity: `read-write`. InvokeEffectProvider reports:
`["Task/archive"]` (extracted from declared effects without
analyzing the body).

### Optimistic create with refresh (match)

"Create a content node. On success, refresh the list. On duplicate,
return the existing record. On error, return the error."

```
# Sub-programs (each sealed independently)
create(program: "refresh-prog")
scan(program: "refresh-prog", source: "contentNodes", bindAs: "all")
pure(program: "refresh-prog", variant: "ok", output: "all")

create(program: "dup-prog")
pure(program: "dup-prog", variant: "duplicate", output: "createResult")

create(program: "error-prog")
pure(program: "error-prog", variant: "error", output: "createResult")

# Main program
create(program: "create-and-refresh")
invoke(program: "create-and-refresh",
  concept: "ContentNode", action: "create",
  input: '{"node":"new-article","kind":"concept"}',
  bindAs: "createResult")
match(program: "create-and-refresh",
  binding: "createResult",
  cases: '{"ok":"refresh-prog","duplicate":"dup-prog","*":"error-prog"}',
  bindAs: "final")
pure(program: "create-and-refresh", variant: "ok", output: "final")
```

### Single invoke (simple case)

"Mark a notification as read and return confirmation."

```
create(program: "mark-read")
invoke(program: "mark-read",
  concept: "Notification", action: "markRead",
  input: '{"id":"notif-42"}', bindAs: "result")
pure(program: "mark-read", variant: "ok", output: "result")
```

### Read-only query (unchanged)

Existing read-only pipelines are completely unaffected:

```
create → scan → filter → sort → project → pure
```

Purity: `read-only`. No invoke instructions. Cached normally.

## Migration & Backwards Compatibility

- **No breaking changes.** `invoke`, `match`, `traverseInvoke`, and
  `traverse` are new optional actions. Existing QueryPrograms remain
  valid and read-only.
- **Purity field defaults to `read-only`** for existing programs that
  have instructions, `pure` for empty programs. No migration needed.
- **InteractionSpec** continues to work with opaque JSON action
  references. The `createProgram` reference pattern is additive.
- **Existing syncs** (CompileQuery, ExecuteQuery, etc.) are unaffected.
  They produce read-only programs and never emit invoke instructions.
- **QueryExecution** gains `invoke_pending` and `resumeAfterInvoke`
  as new variants/actions. Existing `execute → ok` path is unchanged.

## Implementation Plan

### Phase 1: Core instructions & purity tracking

1. ~~Add `invoke`, `match`, `traverseInvoke`, and `traverse` actions
   to `query-program.concept`~~ (done: 406f382e)
2. ~~Add `invokedActions`, `purity`, `matchCases`, `traverseBodies`
   state fields~~ (done: 406f382e)
3. ~~Add invariants (invoke tracking, purity classification, match
   sub-program sealing, traverse body sealing, purity inheritance)~~
   (done: 406f382e)
4. ~~Add fixtures and conformance tests for all four new actions~~
   (done: 406f382e)
5. ~~Update QueryProgram handler to implement the new actions~~
   (done: 8aad6aea)
6. ~~Update runtime DSL (if QueryProgram has one) with builder
   functions for all four instructions~~ (N/A — no QueryProgram
   runtime DSL exists; instructions are built via handler actions)

### Phase 2: Execution support

1. ~~Add `invoke_pending` variant to `QueryExecution/execute`~~
   (done: 7973b2eb)
2. ~~Add `resumeAfterInvoke` action to QueryExecution~~
   (done: 7973b2eb)
3. ~~Write ExecuteInvoke and InvokeComplete syncs~~
   (done: 7973b2eb)
4. ~~Update QueryExecution handler to implement coroutine-style
   pause/resume~~ (done: 7ac9f581)
5. Integration test: invoke dispatches through sync engine and
   returns completion

### Phase 3: Static analysis providers

1. ~~Create InvokeEffectProvider concept and handler~~
   (concept: 7973b2eb, handler: 7ac9f581)
2. ~~Create QueryPurityProvider concept and handler~~
   (concept: 7ac9f581, handler: f0baf406)
3. ~~Create QueryCompletionCoverage concept~~ (done: f0baf406)
   and handler
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

## Resolved Design Decisions

### 1. Batch/traverse: both `traverseInvoke` and `traverse`

Both are shipped together, not phased. `traverseInvoke` is a flat,
ergonomic instruction for the common "invoke once per record" case.
`traverse` is the full-power primitive for arbitrary sub-program
iteration. `traverseInvoke` is syntactic sugar that desugars to a
`traverse` with a single-invoke body.

**Rationale:** Pushing batch semantics into concept handlers violates
concept independence — batching is an orchestration concern.
`traverseInvoke` covers 90% of cases with a flat, statically-analyzable
instruction. `traverse` handles the remaining 10% (conditional logic
per item, multi-step sub-programs). Shipping both avoids forcing users
into the complex form for simple cases.

### 2. Continuation serialization: structured program suffix

Continuations are serialized as JSON containing the remaining
instruction list, current binding environment, program ID, and
instruction index. For traverse instructions, the continuation also
includes iteration position (current index, total items, accumulated
results).

**Rationale:** Opaque tokens defeat QueryProgram's inspectability
guarantee. Structured continuations can be diffed, logged, included
in flow traces, and resumed by any stateless executor. The payload
overhead is minimal — each instruction is a few hundred bytes of JSON.

### 3. Authorization: layered (static pre-check + per-invoke runtime)

Before executing a read-write QueryProgram, InvokeEffectProvider
extracts all concept/action pairs (including from traverseInvoke and
traverse declared effects). The executor checks session authorization
for every pair upfront. If any fails, the entire program is rejected
before a single instruction runs.

Per-invoke runtime authorization (Connection/invoke) remains as defense
in depth — catches permission changes between static check and
execution, and handles conservative static analysis (e.g., match
branches mean only one of N invokes runs, but the static set includes
all N).

**Rationale:** Static pre-check prevents the ugly partial-batch failure
(47 of 100 items succeed, item 48 fails auth). Runtime check is the
authority. Same pattern as typed languages: compiler catches errors
statically, runtime still has bounds checks.

### 4. Error propagation: bind the error, let the program decide

Invoke completions (including error variants) are always bound to
`bindAs`. Downstream `match` instructions can branch on the variant.
If the program doesn't handle an error variant, it's silently bound
and the program continues. QueryCompletionCoverage warns about
unhandled variants at build time.

The exception: infrastructure errors (network failure, sync engine
down) abort the entire program with `QueryExecution/execute → error`.
These are not bindable — they indicate the execution environment is
broken, not that a concept action returned an error.

**Rationale:** Matches StorageProgram's branch semantics. Keeps error
handling composable and explicit. QueryCompletionCoverage provides the
safety net for unhandled variants.

### 5. Conditional: separate `match` action (multi-way, not binary)

`match` is a separate action from `invoke`, supporting multi-way
pattern matching via a JSON cases object mapping variant tags to
sub-program IDs. A `"*"` wildcard handles unmatched variants.

Named `match` (not `branch`) to distinguish from StorageProgram's
binary branch and signal multi-way semantics — directly paralleling
how syncs match on `when` clauses.

**Rationale:** Separate is more composable — `match` works on any
binding, not just invoke results (could match on a scan result count
or a join match flag). Multi-way avoids nested binary chains for
actions with 3+ variants (which is common — `ok`, `notfound`,
`unauthorized`, `error`). The combined "invoke with handlers" form
can be provided as a builder-level convenience without changing the
instruction set.

## Success Criteria

- [ ] QueryProgram with invoke, match, traverseInvoke, and traverse
      instructions can be created, sealed, serialized, and deserialized
- [ ] Purity is correctly classified for all program shapes (pure,
      read-only, read-write) including traverse purity inheritance
- [ ] match sub-programs and traverse body programs must be sealed
- [ ] InvokeEffectProvider extracts all reachable concept/action pairs
      from invoke, traverseInvoke, and traverse declared effects
- [ ] QueryCompletionCoverage reports unhandled invoke variants
      (variants not matched by downstream match instructions)
- [ ] QueryExecution dispatches invoke through the sync engine and
      resumes with structured continuation
- [ ] traverseInvoke over N items produces N coroutine yield/resume
      cycles with continuation tracking iteration progress
- [ ] traverse with invoke body produces correct nested yield/resume
- [ ] Static authorization pre-check rejects programs with
      unauthorized concept/action pairs before execution starts
- [ ] Flow trace shows the full causal chain: QueryProgram → invoke →
      sync → StorageProgram → completion → resume
- [ ] Read-only programs are unaffected (no performance regression,
      no behavioral change)
- [ ] Existing view syncs (CompileQuery, ExecuteQuery) continue to
      work unchanged
- [ ] traverseInvoke desugars correctly to equivalent traverse form
