# Clef Process Kit — Synthesized Design & Implementation Plan

**Kit version:** 0.1.0 | **Date:** 2026-03-01
**Clef framework dependency:** COPF v0.18.0, Concept Library v0.4.0
**Status:** Complete design specification — implementable without further research context

---

## Part 1 — Synthesis Rationale

### 1.1 Source reports

| Label | Title | Strength | Weakness |
|-------|-------|----------|----------|
| **A** | "Composable process modeling: a unified concept catalog" | Deepest academic grounding (27 concepts from Petri nets, BPMN, LLM frameworks, statecharts, process algebras). Precise state/action definitions. Cross-domain mapping table. | Not Clef-native. Many "concepts" are really sync patterns in Clef's model. Over-counts by treating control-flow primitives as independent concepts. |
| **B** | "Composable Process Architectures: Integrating Human, Automation, and LLM" | Best at showing human/automation/LLM interchangeability. Uses Concepts-Suites-Syncs vocabulary. Concrete sync DSL examples. | Under-counts. Mixes application-specific concepts (Information Retrieval, Data Transformation) with universal primitives. Loose spec format. |
| **C** | "Composable Process Primitives as Clef Concepts, Suites, and Syncs" | Most Clef-native. Explicit concept-vs-sync decision procedure. JSON/YAML composition examples. 5-suite layout with build order. ER diagram for process meta-model. | Some concepts (Token) marked "optional" when they are essential for parallel semantics. Missing LLM repair-loop detail. |
| **D** | "Clef Comprehensive Reference" | Definitive framework spec. Exact .concept and .sync file formats. Coordination+provider pattern. Existing kit inventory. Overlap prevention guidelines. | Not a process report — provides the rules everything must conform to. |

### 1.2 Decision procedure

Three tests applied to every candidate concept from all reports:

1. **The Concept Test** (D §16.14): Does it own (a) independent state, (b) meaningful actions with domain-specific variants, (c) operational principles that compose via syncs? If not → it is infrastructure, a sync pattern, or an action on another concept.

2. **The Overlap Test** (D §10.4): Does an existing Clef kit already provide this capability? If so → wire via integration sync, do not duplicate. Specifically checked against: `EventBus` (Infrastructure), `Validator` (Infrastructure), `PluginRegistry` (Infrastructure), `Connector` (Data Integration), `Workflow` (Automation), `Queue` (Automation), `AutomationRule` (Automation), `Schema` (Classification), `Notification` (Notification), `Token` (Computation — name collision).

3. **The Sync Test**: Is the "concept" really wiring logic — routing between completions and actions? If so → it is a sync pattern, not a concept. Specifically: sequence, gateway/router, join, loop, parallel fork, sentry/guard, delegation, barriers.

### 1.3 Concepts removed — with justification

#### Became sync patterns (no independent state beyond what other concepts track)

| Candidate | Reports | Why it is a sync, not a concept |
|-----------|---------|--------------------------------|
| Sequence | A #1 | `when StepRun/complete -> then StepRun/start`. The "state" (current position) already lives in FlowToken. |
| Gateway / Router | A #2, B | Sync `where` clauses + variant matching + `condition_expr` on edges. XOR = multiple edges from same step with different condition expressions evaluated against ProcessVariables. AND = ParallelFork sync. Inclusive = multiple matching conditions. Pre-existing `DataRoute` sync handles all cases. No independent state. |
| Join | A #3 | Sync join: multiple `when` patterns must all match. FlowToken tracks which branches arrived. |
| Loop | A #4 | Edge from step back to itself (or earlier step) with `condition_expr` that eventually evaluates to false. `DataRoute` sync evaluates the condition each iteration. Iteration counter is a ProcessVariable updated by `OutputToVariable` sync. |
| Parallel Execution | A #5 | FlowToken handles fork (emit multiple) and join (consume all). Parallelism is sync-level. |
| Execution Barrier | B | A `@gate` StepRun whose `complete` waits for external trigger. Same as any gate step. |
| Delegation / Sub-Suite Call | B | Sync: `when StepRun/complete -> then ProcessRun/start`. Parent-child is state on ProcessRun (`parent_run`). |
| Critique & Refinement Loop | B | Sync loop: `when EvaluationRun/fail -> then LLMCall/request`. |
| Sentry / Guard | A #26 | Clef syncs ARE sentries. `when` = onPart (event trigger), `where` = ifPart (data guard), `then` = activation. |
| Cancellation | A #24 | Actions on ProcessRun and StepRun: `cancel_run`, `cancel_step`. Propagation is the pre-existing `CancelRunPropagation` sync that cascades `ProcessRun/cancel` to all active `StepRun/cancel` calls. Step-level cancel is also triggered by timeout syncs. |
| Timeout | A #22 | Composition: user sets `timeout_ms` and `timeout_action` in step config. Pre-existing `StepTimeoutCreate` sync auto-creates a Timer on step start. `StepTimeoutCancel`/`StepTimeoutEscalate`/`StepTimeoutFail` syncs fire the configured action. `CancelStepTimers` cleans up if step completes before timeout. No independent state. |
| Subprocess | A #8 | `ProcessRun/start_child` with `parent_run` populated. Child lifecycle is ProcessRun state. User sets `step_type: "subprocess"` in ProcessSpec; pre-existing `SubprocessStepDispatch`, `ChildRunCompletes`, and `ChildRunFails` syncs handle the full lifecycle. |

#### Collapsed into existing Clef concepts

| Candidate | Reports | Absorbed by | Why |
|-----------|---------|-------------|-----|
| Signal / Broadcast | A #12, B | **EventBus** (Infrastructure Kit) | EventBus already does pub/sub with subscriber management, priority, dead-letter, history. Process signals are EventBus messages with process-scoped topics. Wire via integration sync. |
| Message Correlation | A #10 | **WebhookInbox** (new) | Correlation-key matching to the right ProcessRun is WebhookInbox's core purpose. |
| Variable / Data Container | A #13 | **ProcessVariable** (new, renamed) | Same concept. "ProcessVariable" is more specific for the process domain than "Variable" which is too generic. |
| Template / Process Definition | A #23 | **ProcessSpec** (new) | Same concept — versioned blueprint. ProcessSpec is the Clef-native name (parallels existing naming: "spec" for definitions, "run" for instances). |
| Data Transformation / Formatter | B | **StepRun** step-type metadata + existing **Transform** (Data Integration Kit) | Transformation is a step execution type. If needed, sync to Transform concept. Not a process-specific concept. |
| Information Retrieval / Search | B | **ConnectorCall** (new) | A search query is an outbound call to an external system. Connector type metadata distinguishes it. |
| State Store / Scratchpad | B | **ProcessVariable** + sovereign concept state | Clef's sovereign storage principle means each concept IS its own state store. Shared process-scoped data uses ProcessVariable. |
| Memory Append-Log / Ledger | B | **ProcessEvent** (new) | Same concept — append-only event ledger with query. |
| Notification Broadcast | B | **Notification** (Notification Kit) | Already exists. Wire via integration sync. |
| Resource Assignment / Work Allocation | A #17 | **WorkItem** (new) | Assignment, claiming, delegation are all actions within the WorkItem lifecycle. Splitting assignment into a separate concept creates artificial coupling — the work item IS the assignment. |
| Reducer / State Merge | A #16 | **ProcessVariable** merge semantics | ProcessVariable's `merge_var` action accepts a merge strategy parameter (`append`, `replace`, `sum`, `custom`). Not enough independent state for its own concept — the strategy and target key are properties of the variable, not a separate entity. |
| Decision / Rule Evaluation | A #14 | **AutomationRule** (Automation Kit) for simple rules; **LLMCall** for complex evaluation | DMN-style decision tables are a specialized evaluation engine. Simple data-based routing is a sync `where` clause. Complex rule evaluation is either an AutomationRule or an LLM call. Defer dedicated DMN concept to v2 if enterprise BPMN compatibility is needed. |
| AccessPolicy | C | **Authorization** + **AccessControl** (Identity Kit) | Process-specific authorization delegates to existing Identity Kit concepts via integration sync. No new concept needed unless process-specific SoD constraints emerge. |

#### Deferred to v2 (valid concepts, not needed for initial capability)

| Candidate | Reports | Reason to defer |
|-----------|---------|-----------------|
| Discretionary Item / Runtime Planning | A #27 | Niche CMMN concept for knowledge-worker ad-hoc task injection. Can be modeled as WorkItem with `optional: true` + a `plan`/`unplan` action pair added later. LLM agent tool selection partially covers this via ToolRegistry. |
| Reducer as first-class concept | A #16 | If ProcessVariable merge semantics prove insufficient for complex CRDT-style merging across parallel branches, promote to its own concept. Current ConflictResolution concept (Collaboration Kit, in-progress) may cover this. |

### 1.4 Name collision resolution

The Computation Kit already contains a concept named **Token** for expression tokenization. Our process control-flow token concept is renamed to **FlowToken** per the overlap prevention guideline (D §10.4): "If a name is taken, use a qualifier that reflects the concept's specific domain."

### 1.5 Relationship to existing Connector concept

The Data Integration Kit contains a **Connector** concept for bidirectional sync with external systems. The new **ConnectorCall** concept is specifically about tracking a single outbound invocation within a process step — with idempotency keys, attempt tracking, and status lifecycle. ConnectorCall delegates actual I/O to providers (HTTP, gRPC, etc.), while the existing Connector manages connection configuration and bidirectional sync pairs. The two compose: a ConnectorCall provider may use a Connector's configuration to make its call. They are connected via an integration sync, not merged.

### 1.6 Supersession plan

The new process-foundation suite supersedes the existing **Workflow** concept in the Automation Kit.

| Superseded | Replaced by | Migration |
|------------|-------------|-----------|
| `Workflow` (Automation Kit) | `ProcessSpec` + `ProcessRun` + `StepRun` | Compatibility sync translates Workflow actions → ProcessSpec/ProcessRun equivalents. Deprecate Workflow after migration period. Remove in next major version. |

This follows the precedent of `Version → TemporalVersion` and `SyncedContent → Replica + ConflictResolution` (D §6.5).

---

## Part 2 — Final Concept Inventory: 20 Concepts, 6 Suites

### 2.1 Suite layout

```
kits/process-foundation/     6 concepts   ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable, ProcessEvent
kits/process-human/          3 concepts   WorkItem, Approval, Escalation
kits/process-automation/     3 concepts   ConnectorCall, WebhookInbox, Timer
kits/process-reliability/    3 concepts   RetryPolicy, CompensationPlan, Checkpoint
kits/process-llm/            3 concepts   LLMCall, ToolRegistry, EvaluationRun
kits/process-observability/  2 concepts   Milestone, ProcessMetric
```

### 2.2 Coordination + provider concepts

Four concepts use the coordination+provider pattern routed via PluginRegistry (Infrastructure Kit):

| Coordination Concept | Providers (v1 initial set) | Provider selection basis |
|---------------------|---------------------------|------------------------|
| **ConnectorCall** | HTTPProvider, DatabaseProvider | `connector_type` field |
| **LLMCall** | OpenAIProvider, AnthropicProvider | `model` prefix string |
| **Checkpoint** | FileCheckpoint, DatabaseCheckpoint | Deployment environment |
| **EvaluationRun** | SchemaEvaluator, LLMJudgeEvaluator | `evaluator_type` field |

---

## Part 3 — Complete .concept Specs

### 3.1 process-foundation concepts

#### ProcessSpec

```
@version(1)
concept ProcessSpec [P] {

  purpose {
    Store versioned, publishable process template definitions
    consisting of step definitions and routing edges.
  }

  state {
    specs: set P
    name: P -> String
    version: P -> Int
    status: P -> String                    // draft | active | deprecated
    description: P -> option String
    steps: P -> list {
      key: String,
      step_type: String,                   // human | automation | llm | approval | manual | subprocess | webhook_wait
      config: Bytes                        // step-type-specific configuration, opaque to this concept
    }
    edges: P -> list {
      from_step: String,
      to_step: String,
      on_variant: String,                  // variant tag that triggers this edge (ok, error, etc.)
      condition_expr: option String,       // expression evaluated against ProcessVariables for data-based routing
      priority: option Int                 // when multiple edges match, highest priority wins (default 0)
    }
    metadata: P -> option Bytes            // arbitrary extension metadata (milestones, retry configs, etc.)
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(name: String, steps: Bytes, edges: Bytes) {
      -> ok(spec: P) {
        Creates a new process spec in draft status with version 1.
        Validates that steps have unique keys, edges reference valid step keys,
        and at least one step exists.
      }
      -> invalid(message: String) {
        Steps or edges contain structural errors.
      }
    }

    action publish(spec: P) {
      -> ok(spec: P, version: Int) {
        Transitions spec from draft to active. Increments version if
        spec was previously deprecated and re-published.
      }
      -> not_found(spec: P) {
        No spec with this identifier exists.
      }
      -> already_active(spec: P) {
        Spec is already in active status.
      }
    }

    action deprecate(spec: P) {
      -> ok(spec: P) {
        Transitions spec from active to deprecated. Running instances
        continue but no new instances may be created.
      }
      -> not_found(spec: P) {
        No spec with this identifier exists.
      }
    }

    action update(spec: P, steps: Bytes, edges: Bytes) {
      -> ok(spec: P, version: Int) {
        Updates the step and edge definitions. Only allowed when status is draft.
        Increments version.
      }
      -> not_draft(spec: P) {
        Spec is not in draft status. Deprecate first, then update.
      }
      -> invalid(message: String) {
        New steps or edges contain structural errors.
      }
    }

    action get(spec: P) {
      -> ok(spec: P, name: String, version: Int, status: String, steps: Bytes, edges: Bytes) {
        Returns the full spec definition.
      }
      -> not_found(spec: P) {
        No spec with this identifier exists.
      }
    }
  }

  invariant {
    after create(name: "onboard", steps: s, edges: e) -> ok(spec: x)
    then get(spec: x) -> ok(spec: x, name: "onboard", version: 1, status: "draft", steps: s, edges: e)
  }
}
```

#### ProcessRun

```
@version(1)
@gate
concept ProcessRun [R] {

  purpose {
    Track the lifecycle of a running process instance from start to completion,
    failure, or cancellation, including parent-child relationships for subprocess nesting.
  }

  state {
    runs: set R
    spec_ref: R -> String
    spec_version: R -> Int
    status: R -> String                   // pending | running | suspended | completed | failed | cancelled
    parent_run: R -> option String
    started_at: R -> option DateTime
    ended_at: R -> option DateTime
    input: R -> option Bytes
    output: R -> option Bytes
    error: R -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action start(spec_ref: String, spec_version: Int, input: Bytes) {
      -> ok(run: R, spec_ref: String) {
        Creates a new run in running status. Generates a unique run identifier.
        Records start timestamp. If parent_run is needed, the sync provides it.
      }
      -> invalid_spec(spec_ref: String) {
        Referenced spec does not exist or is not active.
      }
    }

    action start_child(spec_ref: String, spec_version: Int, parent_run: String, input: Bytes) {
      -> ok(run: R, parent_run: String) {
        Creates a child run linked to a parent. Same as start but with parent_run populated.
      }
      -> invalid_spec(spec_ref: String) {
        Referenced spec does not exist or is not active.
      }
    }

    action complete(run: R, output: Bytes) {
      -> ok(run: R) {
        Transitions run from running to completed. Records end timestamp and output.
      }
      -> not_running(run: R) {
        Run is not in running status.
      }
    }

    action fail(run: R, error: String) {
      -> ok(run: R, error: String) {
        Transitions run from running to failed. Records end timestamp and error.
      }
      -> not_running(run: R) {
        Run is not in running status.
      }
    }

    action cancel(run: R) {
      -> ok(run: R) {
        Transitions run from running or suspended to cancelled. Records end timestamp.
      }
      -> not_cancellable(run: R) {
        Run is already in a terminal status.
      }
    }

    action suspend(run: R) {
      -> ok(run: R) {
        Transitions run from running to suspended.
      }
      -> not_running(run: R) {
        Run is not in running status.
      }
    }

    action resume(run: R) {
      -> ok(run: R) {
        Transitions run from suspended to running.
      }
      -> not_suspended(run: R) {
        Run is not in suspended status.
      }
    }

    action get_status(run: R) {
      -> ok(run: R, status: String, spec_ref: String) {
        Returns current run status and spec reference.
      }
      -> not_found(run: R) {
        No run with this identifier exists.
      }
    }
  }

  invariant {
    after start(spec_ref: "onboard", spec_version: 1, input: d) -> ok(run: r, spec_ref: "onboard")
    then get_status(run: r) -> ok(run: r, status: "running", spec_ref: "onboard")
    and  complete(run: r, output: o) -> ok(run: r)
    and  get_status(run: r) -> ok(run: r, status: "completed", spec_ref: "onboard")
  }
}
```

#### StepRun

```
@version(1)
@gate
concept StepRun [S] {

  purpose {
    Track per-step execution state within a process run, including
    step type dispatch, attempt counting, and input/output capture.
  }

  state {
    steps: set S
    run_ref: S -> String
    step_key: S -> String
    step_type: S -> String                // human | automation | llm | approval | manual | subprocess | webhook_wait
    status: S -> String                   // pending | ready | active | completed | failed | cancelled | skipped
    attempt: S -> Int
    input: S -> option Bytes
    output: S -> option Bytes
    error: S -> option String
    started_at: S -> option DateTime
    ended_at: S -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action start(run_ref: String, step_key: String, step_type: String, input: Bytes) {
      -> ok(step: S, run_ref: String, step_key: String, step_type: String) {
        Creates a step run in active status. Records start timestamp.
        Increments attempt counter if a step with same run_ref+step_key already
        exists in failed status (retry scenario).
      }
      -> already_active(step: S) {
        A step run for this run_ref+step_key is already active.
      }
    }

    action complete(step: S, output: Bytes) {
      -> ok(step: S, run_ref: String, step_key: String, output: Bytes) {
        Transitions step from active to completed. Records end timestamp and output.
      }
      -> not_active(step: S) {
        Step is not in active status.
      }
    }

    action fail(step: S, error: String) {
      -> error(step: S, run_ref: String, step_key: String, message: String) {
        Transitions step from active to failed. Records end timestamp and error.
      }
      -> not_active(step: S) {
        Step is not in active status.
      }
    }

    action cancel(step: S) {
      -> ok(step: S) {
        Transitions step from active or pending to cancelled.
      }
      -> not_cancellable(step: S) {
        Step is in a terminal status.
      }
    }

    action skip(step: S) {
      -> ok(step: S) {
        Transitions step from pending to skipped. Used when conditional
        routing determines this step should not execute.
      }
      -> not_pending(step: S) {
        Step is not in pending status.
      }
    }

    action get(step: S) {
      -> ok(step: S, run_ref: String, step_key: String, status: String, attempt: Int) {
        Returns step state.
      }
      -> not_found(step: S) {
        No step run with this identifier exists.
      }
    }
  }

  invariant {
    after start(run_ref: "r1", step_key: "kyc", step_type: "automation", input: d) -> ok(step: s, run_ref: "r1", step_key: "kyc", step_type: "automation")
    then complete(step: s, output: o) -> ok(step: s, run_ref: "r1", step_key: "kyc", output: o)
  }
}
```

#### FlowToken

```
@version(1)
concept FlowToken [K] {

  purpose {
    Track active control-flow positions within a process run to enable
    parallel branching (fork), synchronization (join), and dead-path elimination.
  }

  state {
    tokens: set K
    run_ref: K -> String
    position: K -> String                 // step_key the token is at
    status: K -> String                   // active | consumed | dead
    branch_id: K -> option String         // identifies which parallel branch
    created_at: K -> DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action emit(run_ref: String, position: String, branch_id: String) {
      -> ok(token: K, run_ref: String, position: String) {
        Creates an active token at the specified position.
        Multiple tokens at different positions in the same run represent parallelism.
      }
    }

    action consume(token: K) {
      -> ok(token: K, run_ref: String, position: String) {
        Transitions token from active to consumed. A consumed token has been
        processed by the step at its position.
      }
      -> not_active(token: K) {
        Token is not in active status.
      }
    }

    action kill(token: K) {
      -> ok(token: K) {
        Transitions token from active to dead. Used for dead-path elimination
        when a cancellation region or discriminator pattern fires.
      }
      -> not_active(token: K) {
        Token is not in active status.
      }
    }

    action count_active(run_ref: String, position: String) {
      -> ok(count: Int) {
        Returns the number of active tokens at the given position for the given run.
        Used by join syncs to determine if all parallel branches have arrived.
      }
    }

    action list_active(run_ref: String) {
      -> ok(tokens: Bytes) {
        Returns all active tokens for a run. Used for snapshot/checkpoint.
      }
    }
  }

  invariant {
    after emit(run_ref: "r1", position: "step_a", branch_id: "b1") -> ok(token: t1, run_ref: "r1", position: "step_a")
    then consume(token: t1) -> ok(token: t1, run_ref: "r1", position: "step_a")
    and  count_active(run_ref: "r1", position: "step_a") -> ok(count: 0)
  }
}
```

#### ProcessVariable

```
@version(1)
concept ProcessVariable [V] {

  purpose {
    Store typed, scoped data within process runs that steps can read and write.
    Supports explicit merge strategies for parallel branch convergence.
  }

  state {
    variables: set V
    run_ref: V -> String
    name: V -> String
    value: V -> Bytes
    value_type: V -> String               // string | int | float | bool | json | bytes
    scope: V -> String                    // step | run | global
    merge_strategy: V -> option String    // replace | append | sum | max | min | custom
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action set(run_ref: String, name: String, value: Bytes, value_type: String, scope: String) {
      -> ok(var: V) {
        Creates or overwrites a variable. If merge_strategy is set and a value
        already exists, applies the strategy instead of overwriting.
      }
    }

    action get(run_ref: String, name: String) {
      -> ok(var: V, value: Bytes, value_type: String) {
        Returns the current value.
      }
      -> not_found(run_ref: String, name: String) {
        No variable with this name exists in this run scope.
      }
    }

    action merge(run_ref: String, name: String, update: Bytes, strategy: String) {
      -> ok(var: V, merged_value: Bytes) {
        Merges an update into an existing variable using the specified strategy.
        For append: adds to list. For sum: adds numerically. For replace: overwrites.
      }
      -> not_found(run_ref: String, name: String) {
        No variable with this name exists.
      }
      -> merge_error(message: String) {
        Merge strategy failed (e.g., sum on non-numeric data).
      }
    }

    action delete(run_ref: String, name: String) {
      -> ok(run_ref: String, name: String) {
        Removes the variable.
      }
      -> not_found(run_ref: String, name: String) {
        No variable with this name exists.
      }
    }

    action list(run_ref: String) {
      -> ok(variables: Bytes) {
        Returns all variables for a run.
      }
    }

    action snapshot(run_ref: String) {
      -> ok(snapshot: Bytes) {
        Returns a serialized snapshot of all variables for checkpoint/restore.
      }
    }
  }

  invariant {
    after set(run_ref: "r1", name: "total", value: v, value_type: "int", scope: "run") -> ok(var: x)
    then get(run_ref: "r1", name: "total") -> ok(var: x, value: v, value_type: "int")
  }
}
```

#### ProcessEvent

```
@version(1)
concept ProcessEvent [E] {

  purpose {
    Append-only event stream recording everything that happens in a process run.
    Serves as the source of truth for audit trails, process mining, replay, and observability.
  }

  state {
    events: set E
    run_ref: E -> String
    event_type: E -> String               // run.started | step.started | step.completed | step.failed | ...
    step_ref: E -> option String
    actor_ref: E -> option String          // who/what caused this event (user id, system id, model id)
    payload: E -> Bytes
    timestamp: E -> DateTime
    sequence_num: E -> Int                 // monotonic per run for ordering
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action append(run_ref: String, event_type: String, payload: Bytes) {
      -> ok(event: E, sequence_num: Int) {
        Appends an event. Automatically sets timestamp and assigns next
        sequence number for this run. step_ref and actor_ref are
        optional fields set from payload metadata.
      }
    }

    action query(run_ref: String, after_seq: Int, limit: Int) {
      -> ok(events: Bytes, count: Int) {
        Returns events for a run after the given sequence number, up to limit.
        Ordered by sequence_num ascending.
      }
    }

    action query_by_type(run_ref: String, event_type: String, limit: Int) {
      -> ok(events: Bytes, count: Int) {
        Returns events of a specific type for a run.
      }
    }

    action get_cursor(run_ref: String) {
      -> ok(last_seq: Int) {
        Returns the latest sequence number for a run. Used by checkpoint.
      }
    }
  }

  invariant {
    after append(run_ref: "r1", event_type: "step.completed", payload: p) -> ok(event: e1, sequence_num: 1)
    then append(run_ref: "r1", event_type: "step.started", payload: p2) -> ok(event: e2, sequence_num: 2)
    and  query(run_ref: "r1", after_seq: 0, limit: 10) -> ok(events: _, count: 2)
  }
}
```

### 3.2 process-human concepts

#### WorkItem

```
@version(1)
@gate
concept WorkItem [W] {

  purpose {
    Manage the lifecycle of human tasks: offering to candidate pools,
    claiming by individuals, completing with form data, delegating, and releasing.
  }

  state {
    items: set W
    step_ref: W -> String
    status: W -> String                   // offered | claimed | active | completed | rejected | delegated | released
    assignee: W -> option String
    candidate_pool: W -> list String      // role names or user identifiers
    form_schema: W -> option String       // reference to expected form structure
    form_data: W -> option Bytes          // completed form data
    priority: W -> Int
    due_at: W -> option DateTime
    claimed_at: W -> option DateTime
    completed_at: W -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(step_ref: String, candidate_pool: Bytes, form_schema: String, priority: Int) {
      -> ok(item: W, step_ref: String) {
        Creates a work item in offered status, visible to all candidates in the pool.
      }
    }

    action claim(item: W, assignee: String) {
      -> ok(item: W, assignee: String) {
        Assignee claims the item. Transitions from offered to claimed.
        No other candidate can claim it.
      }
      -> not_offered(item: W) {
        Item is not in offered status (already claimed or completed).
      }
      -> not_authorized(assignee: String) {
        Assignee is not in the candidate pool.
      }
    }

    action start(item: W) {
      -> ok(item: W) {
        Transitions from claimed to active. Assignee begins work.
      }
      -> not_claimed(item: W) {
        Item is not in claimed status.
      }
    }

    action complete(item: W, form_data: Bytes) {
      -> ok(item: W, step_ref: String, form_data: Bytes) {
        Transitions to completed. Records form data and completion timestamp.
      }
      -> not_active(item: W) {
        Item is not in active status.
      }
      -> validation_failed(message: String) {
        Form data does not match expected schema.
      }
    }

    action reject(item: W, reason: String) {
      -> ok(item: W, step_ref: String, reason: String) {
        Assignee rejects the work item (cannot or should not complete it).
      }
      -> not_active(item: W) {
        Item is not in active or claimed status.
      }
    }

    action delegate(item: W, new_assignee: String) {
      -> ok(item: W, new_assignee: String) {
        Transfers the item to a different assignee.
      }
      -> not_claimed(item: W) {
        Item must be in claimed or active status to delegate.
      }
    }

    action release(item: W) {
      -> ok(item: W) {
        Returns item to offered status. Clears assignee.
      }
      -> not_claimed(item: W) {
        Item must be in claimed status to release.
      }
    }
  }

  invariant {
    after create(step_ref: "review", candidate_pool: p, form_schema: "ReviewForm", priority: 1) -> ok(item: w, step_ref: "review")
    then claim(item: w, assignee: "alice") -> ok(item: w, assignee: "alice")
    and  start(item: w) -> ok(item: w)
    and  complete(item: w, form_data: d) -> ok(item: w, step_ref: "review", form_data: d)
  }
}
```

#### Approval

```
@version(1)
@gate
concept Approval [A] {

  purpose {
    Gate process progression on explicit multi-party authorization decisions
    with configurable approval policies (one-of, all-of, n-of-m).
  }

  state {
    approvals: set A
    step_ref: A -> String
    status: A -> String                   // pending | approved | denied | timed_out | changes_requested
    policy {
      kind: A -> String                   // one_of | all_of | n_of_m
      required_count: A -> Int
      roles: A -> list String
    }
    decisions: A -> list {
      actor: String,
      decision: String,                   // approve | deny | request_changes
      comment: option String,
      decided_at: DateTime
    }
    requested_at: A -> DateTime
    resolved_at: A -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action request(step_ref: String, policy_kind: String, required_count: Int, roles: Bytes) {
      -> ok(approval: A, step_ref: String) {
        Creates a pending approval request with the specified policy.
      }
    }

    action approve(approval: A, actor: String, comment: String) {
      -> ok(approval: A, step_ref: String) {
        Records an approve decision. If policy threshold is met, transitions to approved.
      }
      -> already_resolved(approval: A) {
        Approval is no longer pending.
      }
      -> not_authorized(actor: String) {
        Actor does not have an authorized role.
      }
      -> pending(approval: A, decisions_so_far: Int, required: Int) {
        Decision recorded but threshold not yet met. Approval remains pending.
      }
    }

    action deny(approval: A, actor: String, reason: String) {
      -> ok(approval: A, step_ref: String, reason: String) {
        Records a deny decision. Transitions to denied.
      }
      -> already_resolved(approval: A) {
        Approval is no longer pending.
      }
      -> not_authorized(actor: String) {
        Actor does not have an authorized role.
      }
    }

    action request_changes(approval: A, actor: String, feedback: String) {
      -> ok(approval: A, step_ref: String, feedback: String) {
        Records a changes-requested decision. Transitions to changes_requested.
      }
      -> already_resolved(approval: A) {
        Approval is no longer pending.
      }
    }

    action timeout(approval: A) {
      -> ok(approval: A, step_ref: String) {
        Transitions to timed_out. Triggered by Timer sync.
      }
      -> already_resolved(approval: A) {
        Approval is no longer pending.
      }
    }

    action get_status(approval: A) {
      -> ok(approval: A, status: String, decisions: Bytes) {
        Returns current approval state including all decisions recorded so far.
      }
      -> not_found(approval: A) {
        No approval with this identifier exists.
      }
    }
  }

  invariant {
    after request(step_ref: "mgr_approve", policy_kind: "one_of", required_count: 1, roles: r) -> ok(approval: a, step_ref: "mgr_approve")
    then approve(approval: a, actor: "boss", comment: "looks good") -> ok(approval: a, step_ref: "mgr_approve")
  }
}
```

#### Escalation

```
@version(1)
concept Escalation [L] {

  purpose {
    Redirect work or raise attention when normal handling is insufficient,
    tracking escalation chains with levels and resolution.
  }

  state {
    escalations: set L
    source_ref: L -> String               // step or work-item that triggered escalation
    run_ref: L -> String
    status: L -> String                   // pending | escalated | accepted | resolved
    trigger_type: L -> String             // timeout | condition | manual | retry_exhausted
    target: L -> option String            // person or role to escalate to
    level: L -> Int                       // escalation severity level
    reason: L -> String
    created_at: L -> DateTime
    resolved_at: L -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action escalate(source_ref: String, run_ref: String, trigger_type: String, reason: String, level: Int) {
      -> ok(escalation: L, source_ref: String) {
        Creates an escalation in escalated status.
      }
    }

    action accept(escalation: L, acceptor: String) {
      -> ok(escalation: L) {
        An actor accepts responsibility for resolving the escalation.
      }
      -> not_escalated(escalation: L) {
        Escalation is not in escalated status.
      }
    }

    action resolve(escalation: L, resolution: String) {
      -> ok(escalation: L, source_ref: String, resolution: String) {
        Marks the escalation resolved. Records resolution and timestamp.
      }
      -> not_accepted(escalation: L) {
        Escalation must be accepted before it can be resolved.
      }
    }

    action re_escalate(escalation: L, new_level: Int, reason: String) {
      -> ok(escalation: L) {
        Raises the escalation to a higher level.
      }
    }
  }
}
```

### 3.3 process-automation concepts

#### ConnectorCall

```
@version(1)
@gate
concept ConnectorCall [C] {

  purpose {
    Track a single outbound call to an external system within a process step,
    with idempotency keys and status lifecycle. Actual I/O is delegated to providers.
  }

  state {
    calls: set C
    step_ref: C -> String
    connector_type: C -> String           // http | grpc | database | mq | fs
    operation: C -> String                // e.g., "POST /api/kyc/check" or "query:users"
    input: C -> Bytes
    output: C -> option Bytes
    status: C -> String                   // pending | invoking | succeeded | failed
    idempotency_key: C -> String
    error: C -> option String
    invoked_at: C -> option DateTime
    completed_at: C -> option DateTime
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action invoke(step_ref: String, connector_type: String, operation: String, input: Bytes, idempotency_key: String) {
      -> ok(call: C, step_ref: String) {
        Creates a call record in invoking status. Provider dispatch happens via sync.
      }
      -> duplicate(idempotency_key: String) {
        A call with this idempotency key already exists. Returns existing result.
      }
    }

    action mark_success(call: C, output: Bytes) {
      -> ok(call: C, step_ref: String, output: Bytes) {
        Provider completed successfully. Records output.
      }
      -> not_invoking(call: C) {
        Call is not in invoking status.
      }
    }

    action mark_failure(call: C, error: String) {
      -> error(call: C, step_ref: String, message: String) {
        Provider failed. Records error.
      }
      -> not_invoking(call: C) {
        Call is not in invoking status.
      }
    }

    action get_result(call: C) {
      -> ok(call: C, status: String, output: Bytes) {
        Returns call status and output if available.
      }
      -> not_found(call: C) {
        No call with this identifier exists.
      }
    }
  }
}
```

#### WebhookInbox

```
@version(1)
@gate
concept WebhookInbox [H] {

  purpose {
    Receive and correlate inbound events from external systems to waiting
    process instances using correlation keys.
  }

  state {
    hooks: set H
    run_ref: H -> String
    step_ref: H -> String
    event_type: H -> String
    correlation_key: H -> String
    status: H -> String                   // waiting | received | expired | acknowledged
    payload: H -> option Bytes
    registered_at: H -> DateTime
    received_at: H -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(run_ref: String, step_ref: String, event_type: String, correlation_key: String) {
      -> ok(hook: H, run_ref: String) {
        Registers a webhook listener. Waits until receive or expire is called.
      }
    }

    action receive(correlation_key: String, event_type: String, payload: Bytes) {
      -> ok(hook: H, run_ref: String, step_ref: String, payload: Bytes) {
        Matches an inbound event to a waiting hook by correlation key + event type.
        Transitions to received.
      }
      -> no_match(correlation_key: String) {
        No waiting hook matches this correlation key and event type.
      }
    }

    action expire(hook: H) {
      -> ok(hook: H, run_ref: String, step_ref: String) {
        Hook timed out. Transitions to expired.
      }
      -> not_waiting(hook: H) {
        Hook is not in waiting status.
      }
    }

    action ack(hook: H) {
      -> ok(hook: H) {
        Acknowledge processing of received event. Transitions to acknowledged.
      }
      -> not_received(hook: H) {
        Hook is not in received status.
      }
    }
  }
}
```

#### Timer

```
@version(1)
@gate
concept Timer [T] {

  purpose {
    Introduce time-based triggers into process execution: absolute dates,
    relative durations, and recurring cycles.
  }

  state {
    timers: set T
    run_ref: T -> String
    purpose_tag: T -> String              // e.g., "retry", "escalation", "sla", "schedule"
    timer_type: T -> String               // date | duration | cycle
    specification: T -> String            // ISO 8601 duration/date/recurrence
    status: T -> String                   // set | active | fired | cancelled
    fire_count: T -> Int
    next_fire_at: T -> option DateTime
    context_ref: T -> option String       // opaque reference to what this timer is for
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action set_timer(run_ref: String, timer_type: String, specification: String, purpose_tag: String, context_ref: String) {
      -> ok(timer: T, run_ref: String, next_fire_at: DateTime) {
        Creates a timer. Computes next fire time from specification.
      }
      -> invalid_spec(specification: String) {
        Specification is not a valid time expression.
      }
    }

    action fire(timer: T) {
      -> ok(timer: T, run_ref: String, purpose_tag: String, context_ref: String) {
        Timer has reached its fire time. Increments fire_count.
        For cycle timers, computes next_fire_at and remains active.
        For date/duration timers, transitions to fired.
      }
      -> not_active(timer: T) {
        Timer is not in active status.
      }
    }

    action cancel(timer: T) {
      -> ok(timer: T) {
        Cancels an active timer. Transitions to cancelled.
      }
      -> not_active(timer: T) {
        Timer is not in active status.
      }
    }

    action reset(timer: T, specification: String) {
      -> ok(timer: T, next_fire_at: DateTime) {
        Resets a fired or active timer with a new specification.
      }
    }
  }
}
```

### 3.4 process-reliability concepts

#### RetryPolicy

```
@version(1)
concept RetryPolicy [Y] {

  purpose {
    Define retry/backoff rules for failed steps and track attempt state.
  }

  state {
    policies: set Y
    step_ref: Y -> String
    run_ref: Y -> String
    config {
      max_attempts: Y -> Int
      initial_interval_ms: Y -> Int
      backoff_coefficient: Y -> Float
      max_interval_ms: Y -> Int
      non_retryable_errors: Y -> list String
    }
    attempt_count: Y -> Int
    last_error: Y -> option String
    next_retry_at: Y -> option DateTime
    status: Y -> String                   // active | exhausted | succeeded
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(step_ref: String, run_ref: String, max_attempts: Int, initial_interval_ms: Int, backoff_coefficient: Float, max_interval_ms: Int) {
      -> ok(policy: Y) {
        Creates a retry policy for a step.
      }
    }

    action should_retry(policy: Y, error: String) {
      -> retry(policy: Y, delay_ms: Int, attempt: Int) {
        Error is retryable and attempts remain. Returns the backoff delay.
      }
      -> exhausted(policy: Y, step_ref: String, run_ref: String, last_error: String) {
        Max attempts reached or error is non-retryable. Transitions to exhausted.
      }
    }

    action record_attempt(policy: Y, error: String) {
      -> ok(policy: Y, attempt_count: Int) {
        Increments attempt counter. Records error.
      }
    }

    action mark_succeeded(policy: Y) {
      -> ok(policy: Y) {
        Step eventually succeeded. Transitions to succeeded.
      }
    }
  }
}
```

#### CompensationPlan

```
@version(1)
concept CompensationPlan [X] {

  purpose {
    Track compensating actions for saga-style rollback. As forward steps complete,
    their undo actions are registered. On failure, compensations execute in reverse order.
  }

  state {
    plans: set X
    run_ref: X -> String
    status: X -> String                   // dormant | triggered | executing | completed | failed
    compensations: X -> list {
      step_key: String,
      action_descriptor: String,          // enough info to invoke the compensating action
      registered_at: DateTime
    }
    current_index: X -> Int               // which compensation is currently executing (reverse order)
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(run_ref: String, step_key: String, action_descriptor: String) {
      -> ok(plan: X) {
        Appends a compensating action to the plan. Creates plan if none exists for this run.
      }
    }

    action trigger(run_ref: String) {
      -> ok(plan: X) {
        Begins compensation. Transitions from dormant to triggered.
        Sets current_index to the last registered compensation.
      }
      -> empty(run_ref: String) {
        No compensations registered for this run.
      }
      -> already_triggered(run_ref: String) {
        Compensation already in progress.
      }
    }

    action execute_next(plan: X) {
      -> ok(plan: X, step_key: String, action_descriptor: String) {
        Returns the next compensation to execute (reverse order).
        Decrements current_index.
      }
      -> all_done(plan: X) {
        All compensations executed. Transitions to completed.
      }
    }

    action mark_compensation_failed(plan: X, step_key: String, error: String) {
      -> ok(plan: X) {
        Records that a compensating action failed. Transitions plan to failed.
        Human intervention likely required.
      }
    }
  }
}
```

#### Checkpoint

```
@version(1)
concept Checkpoint [Z] {

  purpose {
    Capture and restore complete process state snapshots for recovery,
    time-travel debugging, and audit. Storage is delegated to providers.
  }

  state {
    checkpoints: set Z
    run_ref: Z -> String
    timestamp: Z -> DateTime
    run_state: Z -> Bytes                 // serialized ProcessRun state
    variables_snapshot: Z -> Bytes        // serialized ProcessVariable state
    token_snapshot: Z -> Bytes            // serialized FlowToken state
    event_cursor: Z -> Int                // ProcessEvent sequence_num at time of capture
    label: Z -> option String             // human-readable label (e.g., "before_payment")
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action capture(run_ref: String, run_state: Bytes, variables_snapshot: Bytes, token_snapshot: Bytes, event_cursor: Int) {
      -> ok(checkpoint: Z, timestamp: DateTime) {
        Creates a snapshot. Delegates actual storage to provider.
      }
    }

    action restore(checkpoint: Z) {
      -> ok(checkpoint: Z, run_state: Bytes, variables_snapshot: Bytes, token_snapshot: Bytes, event_cursor: Int) {
        Retrieves a checkpoint's full state for replay/recovery.
      }
      -> not_found(checkpoint: Z) {
        No checkpoint with this identifier exists.
      }
    }

    action find_latest(run_ref: String) {
      -> ok(checkpoint: Z) {
        Returns the most recent checkpoint for a run.
      }
      -> none(run_ref: String) {
        No checkpoints exist for this run.
      }
    }

    action prune(run_ref: String, keep_count: Int) {
      -> ok(pruned: Int) {
        Removes old checkpoints, keeping only the most recent keep_count.
      }
    }
  }
}
```

### 3.5 process-llm concepts

#### LLMCall

```
@version(1)
@gate
concept LLMCall [M] {

  purpose {
    Manage LLM prompt execution with structured output validation,
    tool calling, and repair loops. Actual model invocation is delegated to providers.
  }

  state {
    calls: set M
    step_ref: M -> String
    model: M -> String
    system_prompt: M -> option String
    user_prompt: M -> Bytes
    tools: M -> list String               // tool registry references
    output_schema: M -> option String     // JSON Schema reference for structured output
    status: M -> String                   // pending | requesting | validating | accepted | rejected | repairing
    raw_output: M -> option Bytes
    validated_output: M -> option Bytes
    validation_errors: M -> option String
    attempt_count: M -> Int
    max_attempts: M -> Int
    token_usage {
      input_tokens: M -> option Int
      output_tokens: M -> option Int
    }
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action request(step_ref: String, model: String, prompt: Bytes, output_schema: String, max_attempts: Int) {
      -> ok(call: M, step_ref: String, model: String) {
        Creates a call in requesting status. Provider dispatch via sync.
      }
    }

    action record_response(call: M, raw_output: Bytes, input_tokens: Int, output_tokens: Int) {
      -> ok(call: M) {
        Provider returned a response. Records raw output and token usage.
        Transitions to validating if output_schema is set, otherwise to accepted.
      }
      -> provider_error(call: M, message: String) {
        Provider returned an error.
      }
    }

    action validate(call: M) {
      -> valid(call: M, step_ref: String, validated_output: Bytes) {
        Output matches schema. Transitions to accepted.
      }
      -> invalid(call: M, errors: String, attempt_count: Int, max_attempts: Int) {
        Output does not match schema. Reports errors and attempt count.
      }
    }

    action repair(call: M, errors: String) {
      -> ok(call: M) {
        Increments attempt count. Transitions back to requesting.
        Sync chain feeds errors into next prompt for self-correction.
      }
      -> max_attempts_reached(call: M, step_ref: String) {
        Cannot repair further. Transitions to rejected.
      }
    }

    action accept(call: M) {
      -> ok(call: M, step_ref: String, output: Bytes) {
        Manually accepts output (bypassing schema validation).
      }
    }

    action reject(call: M, reason: String) {
      -> ok(call: M, step_ref: String, reason: String) {
        Permanently rejects the call output.
      }
    }
  }

  invariant {
    after request(step_ref: "draft", model: "claude-sonnet-4-5-20250929", prompt: p, output_schema: "Email:v1", max_attempts: 3) -> ok(call: m, step_ref: "draft", model: "claude-sonnet-4-5-20250929")
    then record_response(call: m, raw_output: o, input_tokens: 100, output_tokens: 200) -> ok(call: m)
    and  validate(call: m) -> valid(call: m, step_ref: "draft", validated_output: o)
  }
}
```

#### ToolRegistry

```
@version(1)
concept ToolRegistry [G] {

  purpose {
    Register, version, and authorize tool schemas for LLM function/tool calling.
  }

  state {
    tools: set G
    name: G -> String
    version: G -> Int
    description: G -> String
    schema: G -> Bytes                    // JSON Schema defining tool parameters
    status: G -> String                   // active | deprecated | disabled
    allowed_models: G -> list String      // which models may call this tool ("*" = all)
    allowed_processes: G -> list String   // which process specs may use this tool ("*" = all)
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(name: String, description: String, schema: Bytes) {
      -> ok(tool: G, version: Int) {
        Registers a new tool or increments version of existing tool.
      }
      -> invalid_schema(message: String) {
        Schema is not valid JSON Schema.
      }
    }

    action deprecate(tool: G) {
      -> ok(tool: G) {
        Transitions to deprecated. Existing calls continue but new calls are warned.
      }
    }

    action disable(tool: G) {
      -> ok(tool: G) {
        Transitions to disabled. No new calls allowed.
      }
    }

    action authorize(tool: G, model: String, process_ref: String) {
      -> ok(tool: G) {
        Grants a specific model/process pair access to this tool.
      }
    }

    action check_access(tool: G, model: String, process_ref: String) {
      -> allowed(tool: G, schema: Bytes) {
        Access is permitted. Returns schema for inclusion in LLM request.
      }
      -> denied(tool: G, reason: String) {
        Tool is disabled, deprecated, or the model/process is not authorized.
      }
    }

    action list_active(process_ref: String) {
      -> ok(tools: Bytes) {
        Returns all active tools authorized for a process.
      }
    }
  }
}
```

#### EvaluationRun

```
@version(1)
concept EvaluationRun [N] {

  purpose {
    Execute quality evaluations against step outputs and track metrics.
    Actual evaluation logic is delegated to evaluator providers.
  }

  state {
    runs: set N
    step_ref: N -> String
    evaluator_type: N -> String           // schema | rubric | llm_judge | regex | custom
    status: N -> String                   // pending | running | passed | failed
    input: N -> Bytes                     // the output being evaluated
    score: N -> option Float
    threshold: N -> option Float
    metrics: N -> list {
      name: String,
      value: Float
    }
    feedback: N -> option String
    evaluated_at: N -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action run_eval(step_ref: String, evaluator_type: String, input: Bytes, threshold: Float) {
      -> ok(eval: N, step_ref: String, evaluator_type: String) {
        Creates evaluation in running status. Provider dispatch via sync.
      }
    }

    action log_metric(eval: N, metric_name: String, metric_value: Float) {
      -> ok(eval: N) {
        Records a metric from the evaluation.
      }
    }

    action pass(eval: N, score: Float, feedback: String) {
      -> ok(eval: N, step_ref: String) {
        Evaluation passed threshold. Transitions to passed.
      }
    }

    action fail(eval: N, score: Float, feedback: String) {
      -> failed(eval: N, step_ref: String, feedback: String) {
        Evaluation did not meet threshold. Transitions to failed.
      }
    }

    action get_result(eval: N) {
      -> ok(eval: N, status: String, score: Float, feedback: String) {
        Returns evaluation results.
      }
      -> not_found(eval: N) {
        No evaluation with this identifier exists.
      }
    }
  }
}
```

### 3.6 process-observability concepts

#### Milestone

```
@version(1)
concept Milestone [I] {

  purpose {
    Track achievement of significant process goals declaratively,
    without prescribing which specific steps cause achievement.
  }

  state {
    milestones: set I
    run_ref: I -> String
    name: I -> String
    status: I -> String                   // pending | achieved | revoked
    condition_expr: I -> String           // expression evaluated against process variables
    achieved_at: I -> option DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action define(run_ref: String, name: String, condition_expr: String) {
      -> ok(milestone: I) {
        Creates a milestone definition for a run in pending status.
      }
    }

    action evaluate(milestone: I, context: Bytes) {
      -> achieved(milestone: I, name: String, run_ref: String) {
        Condition evaluates to true. Transitions to achieved.
      }
      -> not_yet(milestone: I) {
        Condition evaluates to false. Remains pending.
      }
      -> already_achieved(milestone: I) {
        Milestone was already achieved.
      }
    }

    action revoke(milestone: I) {
      -> ok(milestone: I) {
        Reverts milestone from achieved to pending. For conditions that
        can become untrue (e.g., inventory drops below threshold).
      }
    }
  }
}
```

#### ProcessMetric

```
@version(1)
concept ProcessMetric [Q] {

  purpose {
    Aggregate and expose process-level performance metrics
    for dashboards, SLA monitoring, and process mining.
  }

  state {
    metrics: set Q
    spec_ref: Q -> option String
    run_ref: Q -> option String
    metric_name: Q -> String              // step.duration_ms | run.duration_ms | step.retry_count | ...
    metric_value: Q -> Float
    dimensions: Q -> list {
      key: String,
      value: String
    }
    recorded_at: Q -> DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action record(metric_name: String, metric_value: Float, dimensions: Bytes) {
      -> ok(metric: Q) {
        Records a metric data point.
      }
    }

    action query(metric_name: String, from: DateTime, to: DateTime) {
      -> ok(metrics: Bytes, count: Int) {
        Returns metrics in the given time range.
      }
    }

    action aggregate(metric_name: String, aggregation: String, from: DateTime, to: DateTime) {
      -> ok(value: Float, sample_count: Int) {
        Computes aggregate (avg, sum, min, max, p50, p95, p99) over time range.
      }
    }
  }
}
```

---

## Part 4 — Complete Sync Inventory

### 4.1 process-foundation syncs

**Required** (8 syncs):

```
// 1. Log every run start
sync RunStartedEvent [eager]
when {
  ProcessRun/start: [ run: ?r; spec_ref: ?spec ]
    => [ variant: "ok" ]
}
then {
  ProcessEvent/append: [ run_ref: ?r; event_type: "run.started"; payload: ?spec ]
}
```

```
// 2. When a step completes, evaluate edges to find next step(s).
//    Matches on_variant first. If condition_expr is present, evaluates
//    it against ProcessVariables. Priority breaks ties.
//    This single sync handles: sequence, XOR gateway, data-based routing,
//    and loop-back edges (edge where to_step == from_step or earlier step).
sync DataRoute [eager]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r; step_key: ?sk; output: ?out ]
    => [ variant: ?v ]
}
where {
  ProcessSpec: { ?r edges: ?edges }
  bind(matchEdgesByVariant(?edges, ?sk, ?v) as ?candidateEdges)
  ProcessVariable/list: [ run_ref: ?r ] => [ variant: "ok"; variables: ?vars ]
  bind(evaluateConditions(?candidateEdges, ?vars) as ?matchedEdge)
  bind(field(?matchedEdge, "to_step") as ?nextKey)
}
then {
  FlowToken/emit: [ run_ref: ?r; position: ?nextKey; branch_id: ?v ]
}
```

Edge evaluation semantics (implemented in the `matchEdgesByVariant` + `evaluateConditions` helpers):
1. Filter edges where `from_step == completed step_key` AND `on_variant == completion variant`
2. Among matches, if `condition_expr` is null → edge matches unconditionally
3. If `condition_expr` is present → evaluate against current ProcessVariables
4. If multiple edges match → pick highest `priority` (default 0); ties are an authoring error
5. If zero edges match → step is terminal (checked by RunCompletion sync)

This replaces the previous StepAdvance and ConditionalRoute syncs. Users express:
- **Sequence:** single edge with `on_variant: "ok"`, no condition
- **XOR gateway:** multiple edges from same step, same variant, different `condition_expr` values
- **Loop:** edge where `to_step` points back to same or earlier step, with a `condition_expr` that eventually becomes false
- **Error routing:** edge with `on_variant: "error"`
```

```
// 4. When a token arrives at a step position, start the step
sync TokenActivatesStep [eager]
when {
  FlowToken/emit: [ token: ?k; run_ref: ?r; position: ?pos ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r steps: ?steps }
  bind(lookupStep(?steps, ?pos) as ?stepDef)
  bind(stepType(?stepDef) as ?stype)
  bind(stepInput(?stepDef, ?r) as ?inp)
}
then {
  StepRun/start: [ run_ref: ?r; step_key: ?pos; step_type: ?stype; input: ?inp ]
}
```

```
// 5. Fork: when an edge has multiple parallel targets, emit multiple tokens
sync ParallelFork [eager]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r; step_key: ?sk ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r edges: ?edges }
  bind(parallelTargets(?edges, ?sk) as ?targets)
  filter(length(?targets) > 1)
}
then {
  FlowToken/emit: [ run_ref: ?r; position: ?targets; branch_id: ?sk ]
}
```

```
// 6. Join: when all tokens arrive at a join point, consume and advance
sync ParallelJoin [eager]
when {
  FlowToken/consume: [ token: ?k; run_ref: ?r; position: ?joinPos ]
    => [ variant: "ok" ]
}
where {
  FlowToken/count_active: [ run_ref: ?r; position: ?joinPos ]
    => [ variant: "ok"; count: ?c ]
  filter(?c == 0)
}
then {
  StepRun/start: [ run_ref: ?r; step_key: ?joinPos; step_type: "join"; input: "" ]
}
```

```
// 7. Log every step completion
sync StepCompletedEvent [eventual]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r; step_key: ?sk; output: ?out ]
    => [ variant: "ok" ]
}
then {
  ProcessEvent/append: [ run_ref: ?r; event_type: "step.completed"; payload: ?out ]
}
```

```
// 8. Detect terminal step to complete run
sync RunCompletion [eager]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r; step_key: ?sk ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r terminal_steps: ?terms }
  filter(contains(?terms, ?sk))
  FlowToken/count_active: [ run_ref: ?r; position: _ ]
    => [ variant: "ok"; count: 0 ]
}
then {
  ProcessRun/complete: [ run: ?r; output: "" ]
}
```

```
// 9. Dispatch subprocess-type steps to child ProcessRun
sync SubprocessStepDispatch [eager]
when {
  StepRun/start: [ step: ?s; run_ref: ?r; step_key: ?sk; step_type: "subprocess" ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk config: ?cfg }
  bind(extractField(?cfg, "child_spec_ref") as ?childSpec)
  bind(extractField(?cfg, "child_spec_version") as ?childVer)
  bind(extractField(?cfg, "child_input") as ?childInput)
}
then {
  ProcessRun/start_child: [ spec_ref: ?childSpec; spec_version: ?childVer; parent_run: ?r; input: ?childInput ]
}
```

```
// 10. Child run completion → parent step completion
sync ChildRunCompletes [eager]
when {
  ProcessRun/complete: [ run: ?child; output: ?out ]
    => [ variant: "ok" ]
}
where {
  ProcessRun: { ?child parent_run: ?parent }
  filter(?parent != null)
  StepRun: { ?parent status: "active" steps: ?s }
}
then {
  StepRun/complete: [ step: ?s; output: ?out ]
}
```

```
// 11. Child run failure → parent step failure
sync ChildRunFails [eager]
when {
  ProcessRun/fail: [ run: ?child; error: ?err ]
    => [ variant: "ok" ]
}
where {
  ProcessRun: { ?child parent_run: ?parent }
  filter(?parent != null)
  StepRun: { ?parent status: "active" steps: ?s }
}
then {
  StepRun/fail: [ step: ?s; error: ?err ]
}
```

**Recommended** (3 syncs):

```
// Checkpoint after every step completion
sync AutoCheckpoint [eventual]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r ]
    => [ variant: "ok" ]
}
where {
  ProcessRun: { ?r status: "running" }
  ProcessVariable/snapshot: [ run_ref: ?r ] => [ variant: "ok"; snapshot: ?vars ]
  FlowToken/list_active: [ run_ref: ?r ] => [ variant: "ok"; tokens: ?toks ]
  ProcessEvent/get_cursor: [ run_ref: ?r ] => [ variant: "ok"; last_seq: ?seq ]
}
then {
  Checkpoint/capture: [ run_ref: ?r; run_state: ?r; variables_snapshot: ?vars; token_snapshot: ?toks; event_cursor: ?seq ]
}
```

```
// Pass step output into process variables
sync OutputToVariable [eager]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r; step_key: ?sk; output: ?out ]
    => [ variant: "ok" ]
}
then {
  ProcessVariable/set: [ run_ref: ?r; name: ?sk; value: ?out; value_type: "bytes"; scope: "run" ]
}
```

```
// Evaluate milestones after step completions
sync MilestoneCheck [eventual]
when {
  StepRun/complete: [ run_ref: ?r ]
    => [ variant: "ok" ]
}
where {
  Milestone: { ?r status: "pending" milestones: ?mlist }
  ProcessVariable/snapshot: [ run_ref: ?r ] => [ variant: "ok"; snapshot: ?ctx ]
}
then {
  Milestone/evaluate: [ milestone: ?mlist; context: ?ctx ]
}
```

### 4.2 process-human syncs (5 required, 2 recommended)

```
// Dispatch human-type steps to WorkItem
sync HumanStepDispatch [eager]
when {
  StepRun/start: [ step: ?s; run_ref: ?r; step_key: ?sk; step_type: "human" ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk config: ?cfg }
}
then {
  WorkItem/create: [ step_ref: ?s; candidate_pool: ?cfg; form_schema: ?cfg; priority: 1 ]
}
```

```
// WorkItem completion → StepRun completion
sync WorkItemCompletes [eager]
when {
  WorkItem/complete: [ item: ?w; step_ref: ?s; form_data: ?data ]
    => [ variant: "ok" ]
}
then {
  StepRun/complete: [ step: ?s; output: ?data ]
}
```

```
// Dispatch approval-type steps
sync ApprovalStepDispatch [eager]
when {
  StepRun/start: [ step: ?s; run_ref: ?r; step_key: ?sk; step_type: "approval" ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk config: ?cfg }
}
then {
  Approval/request: [ step_ref: ?s; policy_kind: ?cfg; required_count: ?cfg; roles: ?cfg ]
}
```

```
// Approval granted → StepRun complete
sync ApprovalGranted [eager]
when {
  Approval/approve: [ approval: ?a; step_ref: ?s ]
    => [ variant: "ok" ]
}
then {
  StepRun/complete: [ step: ?s; output: "approved" ]
}
```

```
// Approval denied → StepRun complete with deny variant
sync ApprovalDenied [eager]
when {
  Approval/deny: [ approval: ?a; step_ref: ?s; reason: ?reason ]
    => [ variant: "ok" ]
}
then {
  StepRun/complete: [ step: ?s; output: ?reason ]
}
```

```
// Recommended: SLA escalation on unclaimed work items
sync SLAEscalation [eventual]
when {
  Timer/fire: [ timer: ?t; run_ref: ?r; purpose_tag: "escalation"; context_ref: ?s ]
    => [ variant: "ok" ]
}
where {
  WorkItem: { ?s status: "offered" }
}
then {
  Escalation/escalate: [ source_ref: ?s; run_ref: ?r; trigger_type: "timeout"; reason: "SLA exceeded"; level: 1 ]
}
```

```
// Recommended: Notify candidates when work item created
sync WorkItemNotify [eventual]
when {
  WorkItem/create: [ item: ?w; candidate_pool: ?pool ]
    => [ variant: "ok" ]
}
then {
  Notification/send: [ recipients: ?pool; channel: "default"; message: "New task available" ]
}
```

### 4.3 process-automation syncs (5 required)

```
sync AutomationStepDispatch [eager]
when {
  StepRun/start: [ step: ?s; run_ref: ?r; step_key: ?sk; step_type: "automation" ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk config: ?cfg }
  bind(uuid() as ?ikey)
}
then {
  ConnectorCall/invoke: [ step_ref: ?s; connector_type: ?cfg; operation: ?cfg; input: ?cfg; idempotency_key: ?ikey ]
}
```

```
sync ConnectorSuccess [eager]
when {
  ConnectorCall/mark_success: [ call: ?c; step_ref: ?s; output: ?out ]
    => [ variant: "ok" ]
}
then {
  StepRun/complete: [ step: ?s; output: ?out ]
}
```

```
sync ConnectorFailure [eager]
when {
  ConnectorCall/mark_failure: [ call: ?c; step_ref: ?s; message: ?msg ]
    => [ variant: "error" ]
}
then {
  StepRun/fail: [ step: ?s; error: ?msg ]
}
```

```
sync WebhookStepDispatch [eager]
when {
  StepRun/start: [ step: ?s; run_ref: ?r; step_key: ?sk; step_type: "webhook_wait" ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk config: ?cfg }
}
then {
  WebhookInbox/register: [ run_ref: ?r; step_ref: ?s; event_type: ?cfg; correlation_key: ?cfg ]
}
```

```
sync WebhookReceived [eager]
when {
  WebhookInbox/receive: [ hook: ?h; run_ref: ?r; step_ref: ?s; payload: ?p ]
    => [ variant: "ok" ]
}
then {
  StepRun/complete: [ step: ?s; output: ?p ]
}
```

```
// Create timeout timer when a step starts (if step config has timeout_ms)
sync StepTimeoutCreate [eager]
when {
  StepRun/start: [ step: ?s; run_ref: ?r; step_key: ?sk ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk config: ?cfg }
  bind(extractField(?cfg, "timeout_ms") as ?timeout)
  filter(?timeout != null)
}
then {
  Timer/set_timer: [ run_ref: ?r; timer_type: "duration"; specification: ?timeout; purpose_tag: "step_timeout"; context_ref: ?s ]
}
```

```
// When step timeout fires and step is still active, cancel the step
sync StepTimeoutCancel [eager]
when {
  Timer/fire: [ timer: ?t; run_ref: ?r; purpose_tag: "step_timeout"; context_ref: ?s ]
    => [ variant: "ok" ]
}
where {
  StepRun: { ?s status: "active" }
  ProcessSpec: { ?r step_config: ?s config: ?cfg }
  bind(extractField(?cfg, "timeout_action") as ?action)
  filter(?action == "cancel" || ?action == null)
}
then {
  StepRun/cancel: [ step: ?s ]
}
```

```
// When step timeout fires and action is "escalate", create escalation
sync StepTimeoutEscalate [eager]
when {
  Timer/fire: [ timer: ?t; run_ref: ?r; purpose_tag: "step_timeout"; context_ref: ?s ]
    => [ variant: "ok" ]
}
where {
  StepRun: { ?s status: "active" step_key: ?sk }
  ProcessSpec: { ?r step_config: ?s config: ?cfg }
  bind(extractField(?cfg, "timeout_action") as ?action)
  filter(?action == "escalate")
}
then {
  Escalation/escalate: [ source_ref: ?s; run_ref: ?r; trigger_type: "timeout"; reason: "Step exceeded time limit"; level: 1 ]
}
```

```
// When step timeout fires and action is "fail", fail the step
sync StepTimeoutFail [eager]
when {
  Timer/fire: [ timer: ?t; run_ref: ?r; purpose_tag: "step_timeout"; context_ref: ?s ]
    => [ variant: "ok" ]
}
where {
  StepRun: { ?s status: "active" }
  ProcessSpec: { ?r step_config: ?s config: ?cfg }
  bind(extractField(?cfg, "timeout_action") as ?action)
  filter(?action == "fail")
}
then {
  StepRun/fail: [ step: ?s; error: "Step timed out" ]
}
```

### 4.4 process-llm syncs (5 required, 3 integration)

```
sync LLMStepDispatch [eager]
when {
  StepRun/start: [ step: ?s; run_ref: ?r; step_key: ?sk; step_type: "llm" ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk config: ?cfg }
}
then {
  LLMCall/request: [ step_ref: ?s; model: ?cfg; prompt: ?cfg; output_schema: ?cfg; max_attempts: 3 ]
}
```

```
sync LLMResponseValidation [eager]
when {
  LLMCall/record_response: [ call: ?m ]
    => [ variant: "ok" ]
}
where {
  LLMCall: { ?m output_schema: ?schema }
  filter(?schema != null)
}
then {
  LLMCall/validate: [ call: ?m ]
}
```

```
sync LLMValid [eager]
when {
  LLMCall/validate: [ call: ?m; step_ref: ?s; validated_output: ?out ]
    => [ variant: "valid" ]
}
then {
  StepRun/complete: [ step: ?s; output: ?out ]
}
```

```
sync LLMRepair [eager]
when {
  LLMCall/validate: [ call: ?m; errors: ?errs; attempt_count: ?n; max_attempts: ?max ]
    => [ variant: "invalid" ]
}
where {
  filter(?n < ?max)
}
then {
  LLMCall/repair: [ call: ?m; errors: ?errs ]
}
```

```
sync LLMRepairExhausted [eager]
when {
  LLMCall/repair: [ call: ?m; step_ref: ?s ]
    => [ variant: "max_attempts_reached" ]
}
then {
  StepRun/fail: [ step: ?s; error: "LLM validation failed after max repair attempts" ]
}
```

```
// Integration: route to correct LLM provider
sync LLMProviderDispatch [eager]
when {
  LLMCall/request: [ call: ?m; model: ?model ]
    => [ variant: "ok" ]
}
where {
  PluginRegistry: { provider_for: ?model as ?provider }
}
then {
  ?provider/execute: [ call: ?m; model: ?model ]
}
```

```
// Integration: authorize tools before LLM call
sync ToolAuthorization [eager]
when {
  LLMCall/request: [ call: ?m; step_ref: ?s ]
    => [ variant: "ok" ]
}
where {
  LLMCall: { ?m tools: ?toolList }
  filter(length(?toolList) > 0)
  ProcessRun: { ?s spec_ref: ?spec }
}
then {
  ToolRegistry/check_access: [ tool: ?toolList; model: ?m; process_ref: ?spec ]
}
```

```
// Integration: dispatch to evaluator provider
sync EvalProviderDispatch [eager]
when {
  EvaluationRun/run_eval: [ eval: ?n; evaluator_type: ?etype ]
    => [ variant: "ok" ]
}
where {
  PluginRegistry: { provider_for: ?etype as ?provider }
}
then {
  ?provider/evaluate: [ eval: ?n ]
}
```

### 4.5 process-reliability syncs (5 required)

```
sync RetryOnFailure [eager]
when {
  StepRun/fail: [ step: ?s; run_ref: ?r; step_key: ?sk; message: ?msg ]
    => [ variant: "error" ]
}
where {
  RetryPolicy: { ?s policy: ?p }
}
then {
  RetryPolicy/should_retry: [ policy: ?p; error: ?msg ]
}
```

```
sync RetrySchedule [eager]
when {
  RetryPolicy/should_retry: [ policy: ?p; delay_ms: ?delay; attempt: ?n ]
    => [ variant: "retry" ]
}
where {
  RetryPolicy: { ?p step_ref: ?s; run_ref: ?r }
}
then {
  Timer/set_timer: [ run_ref: ?r; timer_type: "duration"; specification: ?delay; purpose_tag: "retry"; context_ref: ?s ]
}
```

```
sync RetryTimerFired [eager]
when {
  Timer/fire: [ timer: ?t; run_ref: ?r; purpose_tag: "retry"; context_ref: ?s ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?s step_type: ?stype }
}
then {
  StepRun/start: [ run_ref: ?r; step_key: ?s; step_type: ?stype; input: "" ]
}
```

```
sync CompensationRegistration [eager]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r; step_key: ?sk ]
    => [ variant: "ok" ]
}
where {
  ProcessSpec: { ?r step_config: ?sk compensation: ?comp }
  filter(?comp != null)
}
then {
  CompensationPlan/register: [ run_ref: ?r; step_key: ?sk; action_descriptor: ?comp ]
}
```

```
sync CompensationOnRunFailure [eager]
when {
  ProcessRun/fail: [ run: ?r ]
    => [ variant: "ok" ]
}
then {
  CompensationPlan/trigger: [ run_ref: ?r ]
}
```

### 4.6 Cross-kit integration syncs (3 syncs)

```
// Bridge process events to application-level EventBus
sync ProcessEventBridge [eventual]
when {
  ProcessEvent/append: [ event: ?e; event_type: ?type; payload: ?p ]
    => [ variant: "ok" ]
}
then {
  EventBus/publish: [ topic: ?type; payload: ?p ]
}
```

```
// Cancel active timers when step completes (prevents stale escalation/timeout fires)
sync CancelStepTimers [eager]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r ]
    => [ variant: "ok" ]
}
where {
  Timer: { ?r context_ref: ?s; status: "active" timers: ?tlist }
}
then {
  Timer/cancel: [ timer: ?tlist ]
}
```

```
// Cancel all active work when run is cancelled
sync CancelRunPropagation [eager]
when {
  ProcessRun/cancel: [ run: ?r ]
    => [ variant: "ok" ]
}
where {
  StepRun: { ?r status: "active" steps: ?activeSteps }
}
then {
  StepRun/cancel: [ step: ?activeSteps ]
}
```

### 4.7 Provider dispatch syncs (2 syncs)

```
// Route ConnectorCall to correct provider based on connector_type
sync ConnectorProviderDispatch [eager]
when {
  ConnectorCall/invoke: [ call: ?c; connector_type: ?ctype ]
    => [ variant: "ok" ]
}
where {
  PluginRegistry: { provider_for: ?ctype as ?provider }
}
then {
  ?provider/execute: [ call: ?c; connector_type: ?ctype ]
}
```

```
// Route Checkpoint to correct storage provider
sync CheckpointProviderDispatch [eager]
when {
  Checkpoint/capture: [ checkpoint: ?z; run_ref: ?r ]
    => [ variant: "ok" ]
}
where {
  PluginRegistry: { provider_for: "checkpoint" as ?provider }
}
then {
  ?provider/store: [ checkpoint: ?z ]
}
```

### 4.8 Observability metric syncs (2 syncs)

```
// Record step duration on completion
sync StepDurationMetric [eventual]
when {
  StepRun/complete: [ step: ?s; run_ref: ?r; step_key: ?sk ]
    => [ variant: "ok" ]
}
where {
  StepRun: { ?s started_at: ?start; ended_at: ?end }
  bind(durationMs(?start, ?end) as ?dur)
}
then {
  ProcessMetric/record: [ metric_name: "step.duration_ms"; metric_value: ?dur; dimensions: ?sk ]
}
```

```
// Record run duration on completion
sync RunDurationMetric [eventual]
when {
  ProcessRun/complete: [ run: ?r ]
    => [ variant: "ok" ]
}
where {
  ProcessRun: { ?r started_at: ?start; ended_at: ?end; spec_ref: ?spec }
  bind(durationMs(?start, ?end) as ?dur)
}
then {
  ProcessMetric/record: [ metric_name: "run.duration_ms"; metric_value: ?dur; dimensions: ?spec ]
}
```

---

## Part 5 — Suite Manifests

### process-foundation/suite.yaml

```yaml
kit:
  name: process-foundation
  version: 0.1.0
  description: "Process execution kernel: specs, runs, steps, flow tokens, variables, event log"

concepts:
  ProcessSpec:
    spec: ./process-spec.concept
    params: { P: { as: process-spec-id } }
  ProcessRun:
    spec: ./process-run.concept
    params: { R: { as: process-run-id } }
  StepRun:
    spec: ./step-run.concept
    params: { S: { as: step-run-id } }
  FlowToken:
    spec: ./flow-token.concept
    params: { K: { as: flow-token-id } }
  ProcessVariable:
    spec: ./process-variable.concept
    params: { V: { as: variable-id } }
  ProcessEvent:
    spec: ./process-event.concept
    params: { E: { as: event-id } }

syncs:
  required:
    - ./syncs/run-started-event.sync
    - ./syncs/data-route.sync
    - ./syncs/token-activates-step.sync
    - ./syncs/parallel-fork.sync
    - ./syncs/parallel-join.sync
    - ./syncs/step-completed-event.sync
    - ./syncs/run-completion.sync
    - ./syncs/subprocess-step-dispatch.sync
    - ./syncs/child-run-completes.sync
    - ./syncs/child-run-fails.sync
  recommended:
    - ./syncs/auto-checkpoint.sync
    - ./syncs/output-to-variable.sync
    - ./syncs/milestone-check.sync

uses:
  - kit: process-reliability
    optional: true
    concepts: [Checkpoint]
  - kit: process-observability
    optional: true
    concepts: [Milestone]
```

### process-human/suite.yaml

```yaml
kit:
  name: process-human
  version: 0.1.0
  description: "Human task lifecycle: work items, multi-party approvals, escalation chains"

concepts:
  WorkItem:
    spec: ./work-item.concept
    params: { W: { as: work-item-id } }
  Approval:
    spec: ./approval.concept
    params: { A: { as: approval-id } }
  Escalation:
    spec: ./escalation.concept
    params: { L: { as: escalation-id } }

syncs:
  required:
    - ./syncs/human-step-dispatch.sync
    - ./syncs/work-item-completes.sync
    - ./syncs/approval-step-dispatch.sync
    - ./syncs/approval-granted.sync
    - ./syncs/approval-denied.sync
  recommended:
    - ./syncs/sla-escalation.sync
  integration:
    - ./syncs/work-item-notify.sync

uses:
  - kit: process-foundation
    concepts: [StepRun, ProcessSpec]
  - kit: process-automation
    optional: true
    concepts: [Timer]
  - kit: notification
    optional: true
    concepts: [Notification]
```

### process-automation/suite.yaml

```yaml
kit:
  name: process-automation
  version: 0.1.0
  description: "External system integration: connector calls, webhook inbox, timers"

concepts:
  ConnectorCall:
    spec: ./connector-call.concept
    params: { C: { as: connector-call-id } }
  WebhookInbox:
    spec: ./webhook-inbox.concept
    params: { H: { as: webhook-id } }
  Timer:
    spec: ./timer.concept
    params: { T: { as: timer-id } }
# Providers
  HTTPProvider:
    spec: ./providers/http-provider.concept
    optional: true
  DatabaseProvider:
    spec: ./providers/database-provider.concept
    optional: true

syncs:
  required:
    - ./syncs/automation-step-dispatch.sync
    - ./syncs/connector-success.sync
    - ./syncs/connector-failure.sync
    - ./syncs/webhook-step-dispatch.sync
    - ./syncs/webhook-received.sync
    - ./syncs/step-timeout-create.sync
    - ./syncs/step-timeout-cancel.sync
    - ./syncs/step-timeout-escalate.sync
    - ./syncs/step-timeout-fail.sync
  integration:
    - ./syncs/connector-provider-dispatch.sync

uses:
  - kit: process-foundation
    concepts: [StepRun, ProcessSpec, ProcessVariable]
  - kit: process-human
    optional: true
    concepts: [Escalation]
  - kit: infrastructure
    optional: true
    concepts: [PluginRegistry]
```

### process-reliability/suite.yaml

```yaml
kit:
  name: process-reliability
  version: 0.1.0
  description: "Fault tolerance: retry policies, saga compensation, state checkpointing"

concepts:
  RetryPolicy:
    spec: ./retry-policy.concept
    params: { Y: { as: retry-policy-id } }
  CompensationPlan:
    spec: ./compensation-plan.concept
    params: { X: { as: compensation-plan-id } }
  Checkpoint:
    spec: ./checkpoint.concept
    params: { Z: { as: checkpoint-id } }
# Providers
  FileCheckpoint:
    spec: ./providers/file-checkpoint.concept
    optional: true
  DatabaseCheckpoint:
    spec: ./providers/db-checkpoint.concept
    optional: true

syncs:
  required:
    - ./syncs/retry-on-failure.sync
    - ./syncs/retry-schedule.sync
    - ./syncs/retry-timer-fired.sync
    - ./syncs/compensation-registration.sync
    - ./syncs/compensation-on-run-failure.sync
  integration:
    - ./syncs/checkpoint-provider-dispatch.sync

uses:
  - kit: process-foundation
    concepts: [StepRun, ProcessRun, ProcessSpec, ProcessVariable, FlowToken, ProcessEvent]
  - kit: process-automation
    optional: true
    concepts: [Timer]
  - kit: infrastructure
    optional: true
    concepts: [PluginRegistry]
```

### process-llm/suite.yaml

```yaml
kit:
  name: process-llm
  version: 0.1.0
  description: "LLM task execution: prompt management, tool calling, validation, evaluation"

concepts:
  LLMCall:
    spec: ./llm-call.concept
    params: { M: { as: llm-call-id } }
  ToolRegistry:
    spec: ./tool-registry.concept
    params: { G: { as: tool-id } }
  EvaluationRun:
    spec: ./evaluation-run.concept
    params: { N: { as: eval-run-id } }
# LLM Providers
  OpenAIProvider:
    spec: ./providers/openai-provider.concept
    optional: true
  AnthropicProvider:
    spec: ./providers/anthropic-provider.concept
    optional: true
# Evaluator Providers
  SchemaEvaluator:
    spec: ./providers/schema-evaluator.concept
    optional: true
  LLMJudgeEvaluator:
    spec: ./providers/llm-judge-evaluator.concept
    optional: true

syncs:
  required:
    - ./syncs/llm-step-dispatch.sync
    - ./syncs/llm-response-validation.sync
    - ./syncs/llm-valid.sync
    - ./syncs/llm-repair.sync
    - ./syncs/llm-repair-exhausted.sync
  integration:
    - ./syncs/llm-provider-dispatch.sync
    - ./syncs/tool-authorization.sync
    - ./syncs/eval-provider-dispatch.sync

uses:
  - kit: process-foundation
    concepts: [StepRun, ProcessSpec, ProcessRun]
  - kit: infrastructure
    optional: true
    concepts: [PluginRegistry, Validator]
```

### process-observability/suite.yaml

```yaml
kit:
  name: process-observability
  version: 0.1.0
  description: "Process monitoring: goal milestones, performance metrics, SLA tracking"

concepts:
  Milestone:
    spec: ./milestone.concept
    params: { I: { as: milestone-id } }
  ProcessMetric:
    spec: ./process-metric.concept
    params: { Q: { as: metric-id } }

syncs:
  recommended:
    - ./syncs/step-duration-metric.sync
    - ./syncs/run-duration-metric.sync

uses:
  - kit: process-foundation
    concepts: [StepRun, ProcessRun]
```

---

## Part 6 — Implementation Plan & Build Order

### Phase 1: Process Kernel (process-foundation) — Weeks 1–3

**Build order (dependency-driven):**

1. **ProcessEvent** — simplest concept, append-only, no dependencies. Build this first because all other concepts emit events.
2. **ProcessVariable** — simple key-value store. Needed by step routing logic.
3. **FlowToken** — emit/consume/kill lifecycle. Needed for parallel semantics.
4. **ProcessSpec** — template storage. Defines the graph structure that syncs query.
5. **StepRun** — the workhorse step lifecycle. Depends on spec structure.
6. **ProcessRun** — orchestrator lifecycle. Depends on all above.

**Per concept, deliver in each language:**
- `.concept` spec file (provided above)
- Handler implementation (TypeScript, Rust, Swift, Solidity)
- Storage adapter (in-memory for tests + persistent for production)
- Conformance test suite (~5–8 tests per concept per language)

**Syncs to deliver:** 10 required + 3 recommended = 13 sync files.

**Milestone gate:** Can execute a simple linear process (3 sequential steps) end-to-end in TypeScript with in-memory storage. Can execute a process with XOR data-based routing (two conditional branches). Can execute a process that invokes a subprocess.

### Phase 2: Human Work (process-human) — Weeks 3–4

1. **WorkItem** — task assignment and claiming lifecycle
2. **Approval** — multi-party authorization gate
3. **Escalation** — timeout/condition redirect

5 required syncs + 2 recommended syncs.

**Milestone gate:** Can execute a process with a human approval step that blocks execution until approved via `Approval/approve`.

### Phase 3: Reliability (process-reliability) — Weeks 4–5

1. **RetryPolicy** — retry/backoff logic
2. **CompensationPlan** — saga registration and reverse execution
3. **Checkpoint** — state snapshot (coordination concept)
4. **FileCheckpoint** provider (v1 only needs local file storage)

5 required syncs + 1 integration sync.

**Milestone gate:** A process step that fails 2 times, retries with backoff, succeeds on 3rd attempt. A separate test: a 3-step saga where step 3 fails and steps 2→1 compensate in reverse.

### Phase 4: Automation (process-automation) — Weeks 5–6

1. **Timer** — prerequisite for retry, escalation, SLA patterns
2. **ConnectorCall** — outbound call tracking (coordination concept)
3. **WebhookInbox** — inbound event correlation
4. **HTTPProvider** for ConnectorCall (v1)

9 required syncs + 1 integration sync.

**Milestone gate:** A process that (a) calls an external HTTP API, (b) waits for a webhook callback, (c) has a timer-based timeout on a step that auto-cancels, and (d) a separate step with timeout that escalates.

### Phase 5: LLM Tasks (process-llm) — Weeks 6–8

1. **ToolRegistry** — tool schema management (no external dependencies)
2. **EvaluationRun** — quality evaluation (coordination concept)
3. **LLMCall** — the main concept (coordination concept)
4. **AnthropicProvider** and **OpenAIProvider** (v1)
5. **SchemaEvaluator** and **LLMJudgeEvaluator** (v1)

5 required syncs + 3 integration syncs.

**Milestone gate:** A process that (a) invokes Claude via AnthropicProvider, (b) validates structured output against JSON Schema, (c) automatically repairs once on validation failure, (d) falls back to StepRun/fail if repair exhausted.

### Phase 6: Observability (process-observability) — Week 8

1. **Milestone** — declarative goal tracking
2. **ProcessMetric** — metric aggregation

2 recommended syncs.

**Milestone gate:** Process runs produce duration metrics queryable via ProcessMetric/aggregate.

### Phase 7: Integration syncs & cross-kit wiring — Week 9

3 cross-kit integration syncs (EventBus bridge, cancel propagation, timer cleanup).

**Milestone gate:** Full end-to-end "Customer Onboarding" process executing across all 6 suites.

---

## Part 7 — Four-Language Implementation Details

### 7.1 TypeScript

**Location:** `implementations/typescript/kits/process-*/`

**Pattern per concept:**
```
kits/process-foundation/
  src/
    process-event.handler.ts      // ConceptHandler<ProcessEventState>
    process-event.storage.ts      // ConceptStorage adapter (in-memory + PostgreSQL)
    process-variable.handler.ts
    process-variable.storage.ts
    flow-token.handler.ts
    flow-token.storage.ts
    process-spec.handler.ts
    process-spec.storage.ts
    step-run.handler.ts
    step-run.storage.ts
    process-run.handler.ts
    process-run.storage.ts
  test/
    process-event.conformance.test.ts
    process-run.conformance.test.ts
    step-run.conformance.test.ts
    flow-token.conformance.test.ts
    happy-path.chain.test.ts
    parallel-fork-join.chain.test.ts
    saga-compensation.chain.test.ts
```

**Key implementation notes:**
- Use `@clef/framework` types: `ConceptHandler`, `ConceptStorage`, `ActionCompletion`, `ActionInvocation`
- Storage adapters: in-memory (Map-based) for tests; PostgreSQL via `pg` for production; SQLite via `better-sqlite3` for local dev
- Timer concept: `setTimeout` for in-process; durable timers via database-polled scheduler for production (similar to Temporal's timer queue pattern)
- LLM providers use `fetch()` for HTTP calls to model APIs
- All handlers are `async` functions returning `ActionCompletion` objects
- Conformance tests use the framework's `Conformance` concept (Test Kit)

### 7.2 Rust

**Location:** `implementations/rust/kits/process-*/`

**Pattern per concept:**
```
kits/process-foundation/
  src/
    lib.rs
    process_event.rs              // trait ProcessEventHandler + DefaultProcessEventHandler
    process_variable.rs
    flow_token.rs
    process_spec.rs
    step_run.rs
    process_run.rs
    storage/
      mod.rs
      memory.rs                   // HashMap-based in-memory adapter
      postgres.rs                 // sqlx-based PostgreSQL adapter
  tests/
    conformance.rs
    chain_tests.rs
```

**Key implementation notes:**
- Each concept defines an `#[async_trait]` trait with one method per action returning `ActionCompletion`
- Use `serde` + `serde_json` for all state serialization; `Bytes` fields map to `Vec<u8>`
- Storage: `sqlx` for PostgreSQL, `rusqlite` for SQLite
- Timer: `tokio::time::sleep` for in-process; background `tokio::spawn` poller for persistent timers
- LLM providers: `reqwest` for HTTP
- Error handling: no `panic!` or `unwrap()` in handlers; all errors are return variants
- Use `chrono::DateTime<Utc>` for all DateTime fields

### 7.3 Swift

**Location:** `implementations/swift/kits/process-*/`

**Pattern per concept:**
```
kits/process-foundation/
  Sources/
    ProcessEvent/
      ProcessEventHandler.swift      // protocol + default implementation
      ProcessEventStorage.swift
    ProcessVariable/
    FlowToken/
    ProcessSpec/
    StepRun/
    ProcessRun/
  Tests/
    ProcessFoundationTests/
      ConformanceTests.swift
      ChainTests.swift
```

**Key implementation notes:**
- Each concept defines a `protocol` with `async` methods using Swift concurrency
- `Codable` conformance for all state types
- `DateTime` maps to `Foundation.Date`
- `Bytes` maps to `Foundation.Data`
- Storage: `UserDefaults` for lightweight/mobile; `SwiftData` / Core Data for persistent; `GRDB` for SQLite
- Timer: `Task.sleep(for:)` for in-process; `BGTaskScheduler` for background timers on iOS
- LLM providers: `URLSession` for HTTP
- Server-side (Vapor): `Fluent` ORM for storage adapters

### 7.4 Solidity

**Location:** `implementations/solidity/kits/process-*/`

**Applicable concepts (subset — not all concepts make sense on-chain):**

| Concept | On-chain? | Rationale |
|---------|-----------|-----------|
| ProcessSpec | ✅ | Verifiable process definitions |
| ProcessRun | ✅ | Verifiable execution state |
| StepRun | ✅ | Verifiable step transitions |
| FlowToken | ✅ | On-chain token tracking |
| ProcessEvent | ✅ via events | Solidity events ARE the append-only log |
| ProcessVariable | ✅ | On-chain process data |
| Approval | ✅ | On-chain governance voting |
| CompensationPlan | ✅ | DeFi saga rollbacks |
| Milestone | ✅ | Incentive milestone tracking |
| WorkItem | ❌ | Human task UIs are off-chain |
| Escalation | ❌ | Off-chain operational concern |
| ConnectorCall | ❌ | External API calls are off-chain (oracle pattern) |
| WebhookInbox | ❌ | Inbound events use Chainlink-style oracles |
| Timer | ⚠️ partial | Block.timestamp only; no cron. Keeper/Automation pattern for timed triggers |
| LLMCall | ❌ | LLM invocation is off-chain |
| ToolRegistry | ❌ | Off-chain concern |
| EvaluationRun | ❌ | Off-chain concern |
| RetryPolicy | ❌ | Off-chain reliability concern |
| ProcessMetric | ❌ | Off-chain analytics |

**Pattern:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IProcessRun {
    enum Status { Pending, Running, Suspended, Completed, Failed, Cancelled }

    event RunStarted(bytes32 indexed runId, string specRef, uint256 specVersion);
    event RunCompleted(bytes32 indexed runId);
    event RunFailed(bytes32 indexed runId, string error);

    function startRun(bytes32 runId, string calldata specRef, uint256 specVersion, bytes calldata input)
        external returns (bytes memory);
    function completeRun(bytes32 runId, bytes calldata output) external returns (bytes memory);
    function failRun(bytes32 runId, string calldata error) external returns (bytes memory);
    function cancelRun(bytes32 runId) external returns (bytes memory);
    function getStatus(bytes32 runId) external view returns (Status);
}
```

**Key implementation notes:**
- All identifiers are `bytes32` (gas-efficient)
- State stored in `mapping(bytes32 => ...)` patterns
- Solidity `event` emissions double as ProcessEvent entries (indexed topics for efficient filtering)
- Timer uses `block.timestamp` comparison; external Chainlink Keepers trigger `fire()` when time arrives
- Approval implements on-chain multi-sig governance patterns
- Tests use Foundry (`forge test`) per existing SolidityGen patterns

---

## Part 8 — Summary

| Metric | Count |
|--------|-------|
| **New concepts** | 20 |
| **New suites** | 6 |
| **Required syncs** | 34 |
| **Recommended syncs** | 6 |
| **Integration syncs** | 6 |
| **Cross-kit syncs** | 3 |
| **Total sync files** | 49 |
| **Coordination concepts** | 4 (ConnectorCall, LLMCall, Checkpoint, EvaluationRun) |
| **Initial providers (v1)** | 8 (HTTP, DB, OpenAI, Anthropic, FileCheckpoint, DBCheckpoint, SchemaEval, LLMJudgeEval) |
| **Language implementations** | 4 (TypeScript, Rust, Swift, Solidity) |
| **Solidity-applicable concepts** | 9 of 20 |
| **Superseded existing concepts** | 1 (Workflow → ProcessSpec + ProcessRun + StepRun) |
| **Concepts eliminated from research** | 24 (12 → sync patterns, 9 → existing Clef concepts, 3 → deferred to v2) |
| **Name collisions resolved** | 1 (Token → FlowToken) |
| **Estimated build time** | 9 weeks (6 phases + integration) |

### Key design decision: pre-existing syncs guarantee user access

Every behavior from the 12 "became a sync" concepts is accessible to users **purely through ProcessSpec configuration** — users never write syncs. This is enforced by:

- **Data-based routing (Gateway/XOR/Loop):** Users add `condition_expr` and `priority` to edges. The pre-existing `DataRoute` sync evaluates conditions against ProcessVariables.
- **Subprocess nesting:** Users set `step_type: "subprocess"` with a `child_spec_ref` in config. Pre-existing `SubprocessStepDispatch` + `ChildRunCompletes` + `ChildRunFails` syncs handle the full parent↔child lifecycle.
- **Step timeouts:** Users set `timeout_ms` and `timeout_action` in step config. Pre-existing `StepTimeoutCreate` + three action-specific syncs handle creation, firing, and cleanup.
- **Sequence, parallel fork/join, error routing, cancellation propagation:** All handled by pre-existing syncs reacting to edge structure and step completions.
- **Loops:** A back-edge (where `to_step` references the same or earlier step) with a `condition_expr` — the DataRoute sync evaluates it each iteration.
