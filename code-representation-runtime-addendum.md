# COPF Code Representation — Runtime & Debug Addendum

## Addendum to: Code Representation & Semantic Query System v0.1.0

**Purpose:** Connect the runtime execution layer (ActionLog, FlowTrace, SyncEngine, Machine, Signal) to the static representation layers so that observed behavior is queryable against declared structure.

---

## 1. The Three-Layer Model (Complete)

The base design doc describes two layers — static file representation and static semantic structure. But COPF already has a third layer: runtime execution data. The complete picture is:

```
┌──────────────────────────────────────────────────────────────────┐
│  RUNTIME LAYER (what DID happen)                                 │
│  ActionLog, FlowTrace, Machine instances, Signal values,         │
│  SyncEngine firing history, Transport requests, error traces     │
├──────────────────────────────────────────────────────────────────┤
│  SEMANTIC LAYER (what COULD happen)                              │
│  ConceptEntity, ActionEntity, VariantEntity, SyncEntity,         │
│  StateField, WidgetEntity, ThemeEntity, FlowGraph                │
├──────────────────────────────────────────────────────────────────┤
│  SYMBOL LAYER (what things ARE CALLED)                           │
│  Symbol, SymbolOccurrence, ScopeGraph, SymbolRelationship        │
├──────────────────────────────────────────────────────────────────┤
│  PARSE LAYER (what things LOOK LIKE)                             │
│  SyntaxTree, LanguageGrammar, DefinitionUnit, FileArtifact       │
├──────────────────────────────────────────────────────────────────┤
│  EXISTING FOUNDATION                                             │
│  ContentNode, ContentStorage, Resource, Graph, Provenance, etc.  │
└──────────────────────────────────────────────────────────────────┘
```

The critical insight: **the runtime layer is already data** — ActionLog is an append-only log, FlowTrace builds provenance trees, the SyncEngine maintains an index. The gap is connecting that data to the static entities so you can navigate between them.

---

## 2. Existing Runtime Concepts

COPF already has these runtime/debug concepts:

| Concept | What it records |
|---------|----------------|
| **ActionLog** | Every invocation (concept, action, input, flow-id, sync-id, timestamp) and every completion (+ variant, output). Append-only. |
| **FlowTrace** | Debug trace trees built from ActionLog provenance — reconstructs the causal chain of a flow by following flow-ids through invocations and completions. |
| **SyncEngine** | Runtime sync matching — maintains an index from (concept, action) pairs to compiled syncs. On completion: find candidates, match when-patterns, evaluate where-clauses, emit invocations. |
| **Telemetry** | Observability data collection and export. |

COIF adds runtime state:

| Concept | What it records |
|---------|----------------|
| **Machine** | FSM instance state — current state, context, transition history (implicit in send/ok completions) |
| **Signal** | Reactive values — current value, version counter, dependency graph, subscriber graph |
| **Binding** | Connection status, sync timestamps, mode |
| **Transport** | Request/response logs, retry state, offline queue |
| **Host** | View lifecycle — mount/ready/unmount transitions, tracked resources |

The problem is that these runtime concepts record events in their own sovereign storage without cross-referencing the static semantic entities. An ActionLog entry says `concept: "Article", action: "create", variant: "ok"` as *strings*, not as references to `ActionEntity` or `VariantEntity` nodes.

**The widget tracking gap:** Beyond the cross-referencing problem, there's a coverage asymmetry between concepts and widgets. Concepts have ActionLog recording *every* invocation and completion — full lifecycle visibility. Widgets don't have an equivalent. Machine/send captures state transitions, but that misses the full widget lifecycle:

| Tracked by existing COIF concepts | NOT tracked |
|-----------------------------------|-------------|
| FSM state transitions (Machine/send) | Widget mount/unmount counts per widget type |
| Signal value changes (Signal/write) | Which signal write caused which widget re-render |
| Binding status (Binding/bind/sync) | Prop change deltas between Machine/connect calls |
| View lifecycle (Host/mount/unmount) | Per-widget-instance render counts and timing |
| Transport requests (Transport/fetch) | Slot fill/clear activity correlated to host widget |
| Selection resolution (WidgetResolver/resolve) | Unnecessary re-renders (connect output unchanged) |

The concept equivalent would be if ActionLog only recorded one action per concept. The solution is extending the correlation syncs to capture the full widget lifecycle — mount, prop changes, re-renders, slot activity, and unmount — and feeding it all into RuntimeCoverage alongside concept-level events.

---

## 3. The Connection Strategy

Rather than modifying existing runtime concepts (which would violate their independence), we connect the layers through **three mechanisms**:

### 3.1 Symbol-Keyed Correlation

Every runtime event already contains enough information to resolve to a static entity — it names the concept, action, variant, sync. The connection is a **join on symbol strings**:

```
ActionLog entry:
  { concept: "Article", action: "create", variant: "ok", flow: "f-123", sync: "article-crud" }

Resolves to:
  ActionEntity where symbol = "copf/action/Article/create"
  VariantEntity where symbol = "copf/variant/Article/create/ok"
  SyncEntity where symbol = "copf/sync/article-crud"
```

No schema change to ActionLog needed. The representation system provides the resolver.

### 3.2 Enriched Trace Entities (new)

While ActionLog stores raw events and FlowTrace builds trees, neither stores the *resolved* semantic context. New entities bridge this gap.

### 3.3 Graph Overlay for Runtime Data

Runtime execution creates another typed Graph overlay alongside the static ones (flow-graph, call-graph, etc.):

| Graph overlay | Node type | Edge type | Populated by |
|---------------|-----------|-----------|--------------|
| `execution-graph` | ActionLog entries | `triggered-by`, `completed-with`, `fired-sync` | RuntimeCorrelationSync |
| `signal-graph` | Signal instances | `depends-on`, `notifies` | Signal dependency tracking |
| `binding-graph` | Binding instances + concept fields | `bound-to`, `synced-from` | Binding/bind completions |
| `render-graph` | Machine instances + Signal instances | `render-caused-by`, `prop-changed-by` | WidgetRenderCorrelationSync, SignalToWidgetRenderTraceSync |

---

## 4. New Semantic Entities

### RuntimeFlow [F]

```
purpose: An enriched execution flow that correlates ActionLog events with static semantic entities — the resolved version of FlowTrace.

state:
  flows: set F
  flow_id: F -> String
  started_at: F -> DateTime
  completed_at: F -> option DateTime
  status: F -> String              // "running", "completed", "failed", "timeout"
  trigger: F -> {
    action: ActionEntity-ref,
    variant: option VariantEntity-ref,
    sync: option SyncEntity-ref
  }
  steps: F -> list {
    sequence: Int,
    action_log_id: String,         // reference into ActionLog
    concept_entity: ConceptEntity-ref,
    action_entity: ActionEntity-ref,
    variant_entity: option VariantEntity-ref,
    sync_entity: option SyncEntity-ref,
    timestamp: DateTime,
    duration_ms: option Int,
    input_summary: option String,
    output_summary: option String
  }
  // The static FlowGraph path this execution followed
  expected_path: F -> option list { action: ActionEntity-ref, sync: SyncEntity-ref }
  // Deviation from expected path (if any)
  deviations: F -> list { step: Int, expected: String, actual: String, reason: String }

actions:
  correlate(flow_id: String)
    -> ok(flow: F)
    -> partial(flow: F, unresolved: list String)  // some events couldn't resolve to entities
    -> notfound()                  // no ActionLog entries for this flow

  find_by_action(action: ActionEntity-ref, since: option DateTime)
    -> ok(flows: list F)

  find_by_sync(sync: SyncEntity-ref, since: option DateTime)
    -> ok(flows: list F)

  find_by_variant(variant: VariantEntity-ref, since: option DateTime)
    -> ok(flows: list F)

  find_failures(since: option DateTime)
    -> ok(flows: list F)

  compare_to_static(flow: F)
    -> matches(path_length: Int)
    -> deviates(deviations: list { step: Int, expected: String, actual: String })
    -> no_static_path()            // no FlowGraph path exists for this trigger

  source_locations(flow: F)
    -> ok(locations: list { step: Int, file: FileArtifact-ref, line: Int, col: Int, symbol: Symbol-ref })
```

The key action is `compare_to_static`: it takes the actual execution path (from ActionLog) and diffs it against the predicted static FlowGraph path. Deviations indicate either a missing sync (static says it should fire but didn't), an unexpected branch (a variant returned that the static graph didn't predict), or an error (execution stopped before the chain completed).

### RuntimeCoverage [C]

```
purpose: Tracks which static entities have been exercised at runtime — the bridge between declared structure and observed behavior.

state:
  entries: set C
  entity_symbol: C -> Symbol-ref
  entity_kind: C -> String         // "action", "variant", "sync", "state-field",
                                   // "widget-state", "transition",
                                   // "widget-mount", "widget-unmount", "widget-render",
                                   // "widget-prop-change", "slot-fill", "affordance-match"
  first_exercised: C -> option DateTime
  last_exercised: C -> option DateTime
  execution_count: C -> Int
  flow_ids: C -> list String       // sample flow IDs that exercised this entity

actions:
  record(symbol: Symbol-ref, kind: String, flow_id: String)
    -> ok(entry: C)
    -> created(entry: C)           // first time this entity was exercised

  coverage_report(kind: option String, since: option DateTime)
    -> ok(report: {
      total_entities: Int,
      exercised: Int,
      unexercised: list Symbol-ref,
      coverage_pct: Float
    })

  variant_coverage(concept: ConceptEntity-ref)
    -> ok(report: list {
      action: String,
      variant: String,
      exercised: Bool,
      count: Int,
      last_seen: option DateTime
    })

  sync_coverage(since: option DateTime)
    -> ok(report: list {
      sync: String,
      tier: String,
      exercised: Bool,
      count: Int,
      avg_duration_ms: option Float
    })

  widget_state_coverage(widget: WidgetEntity-ref)
    -> ok(report: list {
      state: String,
      entered: Bool,
      count: Int,
      transitions_exercised: list { event: String, from: String, to: String, count: Int },
      transitions_unexercised: list { event: String, from: String, to: String }
    })

  widget_lifecycle_report(widget: WidgetEntity-ref, since: option DateTime)
    -> ok(report: {
      mount_count: Int,
      unmount_count: Int,
      active_instances: Int,
      avg_lifetime_ms: Float,
      render_count: Int,
      renders_per_instance_avg: Float,
      unnecessary_renders: Int,          // renders where connect output was unchanged
      unnecessary_render_pct: Float,
      prop_change_count: Int,
      prop_change_sources: list {        // which signals triggered prop changes
        signal_symbol: Symbol-ref,
        field: String,
        change_count: Int
      },
      slot_fills: list {
        slot_name: String,
        fill_count: Int,
        clear_count: Int
      }
    })

  widget_render_trace(widget_instance: String)
    -> ok(renders: list {
      timestamp: DateTime,
      duration_ms: Float,
      trigger: { kind: String, signal: option Symbol-ref, field: option String },
      props_changed: list String,        // which props actually changed
      necessary: Bool                    // did connect output change?
    })
    -> notfound()

  widget_comparison(since: option DateTime, top_n: Int)
    -> ok(ranking: list {
      widget: Symbol-ref,
      mount_count: Int,
      total_renders: Int,
      unnecessary_render_pct: Float,
      avg_render_ms: Float,
      p90_render_ms: Float
    })

  dead_at_runtime(kind: option String)
    -> ok(never_exercised: list Symbol-ref)
```

This is the concept that answers the hardest debugging question: "I declared all these syncs and variants — which ones have actually fired in production?" Combined with the static dead-variant analysis from SyncEntity/find_orphan_variants, you get a complete picture: statically dead (no sync could ever trigger it) vs. dynamically dead (sync exists but has never fired).

### PerformanceProfile [P]

```
purpose: Aggregate performance data per static entity — connecting slow operations to their declared structure for optimization.

state:
  profiles: set P
  entity_symbol: P -> Symbol-ref
  entity_kind: P -> String
  sample_window: P -> { start: DateTime, end: DateTime }
  invocation_count: P -> Int
  timing: P -> {
    p50_ms: Float,
    p90_ms: Float,
    p99_ms: Float,
    max_ms: Float,
    total_ms: Float
  }
  error_rate: P -> Float
  // For syncs: breakdown of where time is spent
  sync_breakdown: P -> option {
    when_match_ms: Float,
    where_eval_ms: Float,
    then_invoke_ms: Float,
    downstream_wait_ms: Float
  }
  // For COIF: selection pipeline timing
  selection_breakdown: P -> option {
    classify_ms: Float,
    resolve_ms: Float,
    spawn_ms: Float,
    connect_ms: Float,
    render_ms: Float
  }
  // For COIF widgets: render performance
  render_breakdown: P -> option {
    render_count: Int,
    avg_render_ms: Float,
    p90_render_ms: Float,
    unnecessary_render_count: Int,     // renders where connect output unchanged
    unnecessary_render_pct: Float,
    avg_props_changed_per_render: Float,
    mount_count: Int,
    avg_mount_ms: Float,
    avg_unmount_ms: Float
  }

actions:
  aggregate(symbol: Symbol-ref, window: { start: DateTime, end: DateTime })
    -> ok(profile: P)
    -> insufficient_data(count: Int)

  hotspots(kind: option String, metric: String, top_n: Int)
    -> ok(hotspots: list { symbol: Symbol-ref, value: Float })

  slow_chains(threshold_ms: Float)
    -> ok(chains: list {
      flow_graph_path: list Symbol-ref,
      p90_total_ms: Float,
      bottleneck: { symbol: Symbol-ref, p90_ms: Float }
    })

  compare_windows(symbol: Symbol-ref, window_a: { start: DateTime, end: DateTime }, window_b: { start: DateTime, end: DateTime })
    -> ok(comparison: {
      a_p50: Float, b_p50: Float,
      a_p99: Float, b_p99: Float,
      regression: Bool,
      pct_change: Float
    })
    -> insufficient_data(window: String, count: Int)
```

### ErrorCorrelation [E]

```
purpose: Links runtime errors to their static context — which concept, action, variant, sync, file, and line produced the error, and what was the state of the flow at failure time.

state:
  errors: set E
  flow_id: E -> String
  timestamp: E -> DateTime
  error_kind: E -> String          // "action-error", "sync-mismatch", "where-clause-failure", "transport-error", "machine-invalid-event", "signal-cycle"
  error_message: E -> String
  // Resolved static context
  concept_entity: E -> option ConceptEntity-ref
  action_entity: E -> option ActionEntity-ref
  variant_entity: E -> option VariantEntity-ref
  sync_entity: E -> option SyncEntity-ref
  widget_entity: E -> option WidgetEntity-ref
  // Source location of the failing entity's declaration
  source_location: E -> option { file: FileArtifact-ref, line: Int, col: Int }
  // Flow state at failure time
  flow_context: E -> {
    steps_completed: Int,
    last_successful_step: option String,
    pending_invocations: list String,
    variable_bindings: option String
  }

actions:
  record(flow_id: String, error_kind: String, message: String, raw_event: String)
    -> ok(error: E)                // auto-resolves static context from flow data

  find_by_entity(symbol: Symbol-ref, since: option DateTime)
    -> ok(errors: list E)

  find_by_kind(error_kind: String, since: option DateTime)
    -> ok(errors: list E)

  error_hotspots(since: option DateTime, top_n: Int)
    -> ok(hotspots: list { symbol: Symbol-ref, count: Int, last_seen: DateTime, sample_message: String })

  root_cause(error: E)
    -> ok(
      chain: list { step: Int, entity: Symbol-ref, status: String },
      likely_cause: { entity: Symbol-ref, reason: String },
      source: { file: FileArtifact-ref, line: Int, col: Int }
    )
    -> inconclusive(partial_chain: list String)
```

The `root_cause` action is the most valuable: given a runtime error, it walks backward through the flow's execution steps, correlating each with its static entity, to find the earliest point where behavior deviated from the expected FlowGraph path.

---

## 5. Connecting Runtime to Static: The Resolution Syncs

### 5.1 ActionLog → Semantic Entity Correlation

```
sync ActionLogCorrelationSync [eventual]
when {
  ActionLog/append: [ entry: ?entry ]
    => [ entry: ?entry ]
}
where {
  // Resolve concept string to ConceptEntity
  ConceptEntity: { ?concept_entity name: ?entry_concept }
  // Resolve action string to ActionEntity
  ActionEntity: { ?action_entity concept: ?concept_entity; name: ?entry_action }
}
then {
  RuntimeCoverage/record: [ symbol: ?action_symbol; kind: "action"; flow_id: ?flow_id ]
}
```

This fires on every ActionLog append and records that the corresponding ActionEntity was exercised. For completions with variants:

```
sync VariantCoverageSync [eventual]
when {
  ActionLog/append: [ entry: ?entry ]
    => [ entry: ?entry ]  // completion entries have variant field
}
where {
  filter(?entry has variant)
  VariantEntity: { ?variant action: ?action; tag: ?entry_variant }
}
then {
  RuntimeCoverage/record: [ symbol: ?variant_symbol; kind: "variant"; flow_id: ?flow_id ]
}
```

### 5.2 SyncEngine Firing → SyncEntity Correlation

```
sync SyncFiringCorrelationSync [eventual]
when {
  SyncEngine/evaluate: [ ] => [ sync_name: ?sync; matched: true; flow: ?flow_id ]
}
where {
  SyncEntity: { ?sync_entity name: ?sync }
}
then {
  RuntimeCoverage/record: [ symbol: ?sync_symbol; kind: "sync"; flow_id: ?flow_id ]
}
```

### 5.3 Flow Completion → RuntimeFlow Construction

```
sync FlowCorrelationSync [eventual]
when {
  FlowTrace/record: [ trace: ?trace ]
    => [ trace: ?trace; flow_id: ?flow_id ]
}
then {
  RuntimeFlow/correlate: [ flow_id: ?flow_id ]
}
```

After correlation, compare against static expectations:

```
sync FlowDeviationCheckSync [eventual]
when {
  RuntimeFlow/correlate: [ ] => [ flow: ?flow ]
}
then {
  RuntimeFlow/compare_to_static: [ flow: ?flow ]
}
```

### 5.4 Error Recording with Auto-Resolution

```
sync ErrorCorrelationSync [eager]
when {
  ActionLog/append: [ entry: ?entry ]
    => [ entry: ?entry ]
}
where {
  filter(?entry_variant matches "error" or "invalid" or "notfound" or "timeout")
}
then {
  ErrorCorrelation/record: [ flow_id: ?flow_id; error_kind: "action-error"; message: ?entry_output; raw_event: ?entry ]
}
```

```
sync SyncMismatchErrorSync [eager]
when {
  SyncEngine/evaluate: [ ] => [ sync_name: ?sync; matched: false; reason: ?reason ]
}
then {
  ErrorCorrelation/record: [ flow_id: ?flow_id; error_kind: "sync-mismatch"; message: ?reason; raw_event: ?sync ]
}
```

### 5.5 COIF Runtime → Static Correlation

```
sync MachineStateCorrelationSync [eventual]
when {
  Machine/send: [ machine: ?m; event: ?event ]
    => [ machine: ?m; state: ?new_state ]
}
where {
  // Resolve machine's widget to WidgetEntity
  Machine: { ?m component: ?widget_name }
  WidgetEntity: { ?widget_entity name: ?widget_name }
  WidgetStateEntity: { ?state_entity widget: ?widget_entity; name: ?new_state }
}
then {
  RuntimeCoverage/record: [ symbol: ?state_symbol; kind: "widget-state"; flow_id: ?m ]
  // Also record the transition
  RuntimeCoverage/record: [ symbol: ?transition_symbol; kind: "transition"; flow_id: ?m ]
}
```

```
sync MachineInvalidEventSync [eager]
when {
  Machine/send: [ machine: ?m; event: ?event ]
    => invalid(message: ?msg)
}
where {
  Machine: { ?m component: ?widget_name }
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  ErrorCorrelation/record: [
    flow_id: ?m;
    error_kind: "machine-invalid-event";
    message: ?msg;
    raw_event: ?event
  ]
}
```

```
sync SelectionPipelineProfilingSync [eventual]
when {
  WidgetResolver/resolve: [ element: ?element; context: ?context ]
    => [ widget: ?widget; score: ?score; reason: ?reason ]
}
then {
  // Record which interactor → widget resolution actually happened at runtime
  // This validates the static affordance analysis
  RuntimeCoverage/record: [ symbol: ?widget_symbol; kind: "affordance-match"; flow_id: ?element ]
}
```

### 5.6 Widget Lifecycle Tracking

These syncs give widgets the same runtime visibility that concepts get from ActionLog. Every mount, unmount, render, prop change, and slot fill is correlated to its static WidgetEntity.

```
sync WidgetMountCorrelationSync [eventual]
when {
  Machine/spawn: [ machine: ?m; widget: ?widget_name ]
    => [ machine: ?m ]
}
where {
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  RuntimeCoverage/record: [ symbol: ?widget_symbol; kind: "widget-mount"; flow_id: ?m ]
}
```

```
sync WidgetUnmountCorrelationSync [eventual]
when {
  Machine/destroy: [ machine: ?m ]
    => [ machine: ?m ]
}
where {
  Machine: { ?m component: ?widget_name }
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  RuntimeCoverage/record: [ symbol: ?widget_symbol; kind: "widget-unmount"; flow_id: ?m ]
}
```

```
sync WidgetRenderCorrelationSync [eventual]
  purpose: "Track every render, correlated to the widget entity and the triggering signal"
when {
  FrameworkAdapter/render: [ adapter: ?adapter; props: ?props ]
    => [ adapter: ?adapter ]
}
where {
  // Resolve which machine instance this render is for
  Machine: { ?machine status: "running"; component: ?widget_name }
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  RuntimeCoverage/record: [ symbol: ?widget_symbol; kind: "widget-render"; flow_id: ?machine ]
}
```

```
sync WidgetPropChangeCorrelationSync [eventual]
  purpose: "When Machine/connect produces new props, record what changed and why"
when {
  Machine/connect: [ machine: ?machine ]
    => [ machine: ?machine; props: ?new_props ]
}
where {
  Machine: { ?machine component: ?widget_name }
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  RuntimeCoverage/record: [ symbol: ?widget_symbol; kind: "widget-prop-change"; flow_id: ?machine ]
}
```

```
sync SignalToWidgetRenderTraceSync [eventual]
  purpose: "Trace which signal write caused which widget(s) to re-render — the causal chain from data change to pixels"
when {
  Signal/write: [ signal: ?signal; value: ?value ]
    => [ signal: ?signal; version: ?version ]
}
where {
  // Find bindings that include this signal in their signalMap
  Binding: { ?binding signalMap: ?map }
  filter(contains(?map, ?signal))
  // Find machines connected to this binding
  Host: { ?host binding: ?binding }
  Machine: { ?machine status: "running" }
}
then {
  // Record the causal link: this signal write will trigger these widget re-renders
  // This is what powers "why did this widget re-render?" traces
  RuntimeCoverage/record: [ symbol: ?widget_symbol; kind: "widget-render"; flow_id: ?signal ]
}
```

Note: `SignalToWidgetRenderTraceSync` is the most complex join — it traverses Signal → Binding (via signalMap) → Host (via tracked binding) → Machine (via host's tracked resources) → WidgetEntity (via machine's component name). This is the causal chain from a backend data change to a frontend pixel update. The join works because each concept along the chain stores enough foreign-key-like data (Binding stores signalMap, Host stores binding ref, Machine stores component name) to follow the chain without any concept referencing another's state directly.

```
sync SlotActivityCorrelationSync [eventual]
when {
  Slot/fill: [ slot: ?slot; content: ?content ]
    => [ slot: ?slot ]
}
where {
  Slot: { ?slot host: ?widget_name }
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  RuntimeCoverage/record: [ symbol: ?slot_symbol; kind: "slot-fill"; flow_id: ?slot ]
}
```

```
sync SlotClearCorrelationSync [eventual]
when {
  Slot/clear: [ slot: ?slot ]
    => [ slot: ?slot ]
}
where {
  Slot: { ?slot host: ?widget_name }
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  RuntimeCoverage/record: [ symbol: ?slot_symbol; kind: "slot-clear"; flow_id: ?slot ]
}
```

```
sync UnnecessaryRenderDetectionSync [eventual]
  purpose: "Detect renders where Machine/connect output didn't change — performance waste"
when {
  Machine/connect: [ machine: ?machine ]
    => [ machine: ?machine; props: ?new_props ]
}
where {
  // Compare against previous connect output
  Machine: { ?machine component: ?widget_name }
  filter(?new_props == ?previous_props)  // props unchanged
  WidgetEntity: { ?widget_entity name: ?widget_name }
}
then {
  RuntimeCoverage/record: [ symbol: ?widget_symbol; kind: "widget-unnecessary-render"; flow_id: ?machine ]
}
```

### 5.7 Performance Aggregation

```
sync PerformanceAggregationSync [eventual]
  // Runs periodically or on-demand, not per-event
when {
  Telemetry/flush: [ ] => [ window: ?window ]
}
then {
  PerformanceProfile/aggregate: [ symbol: ?entity_symbol; window: ?window ]
}
```

---

## 6. What This Enables: Debug Queries

### 6.1 "Why did this request fail?"

```
copf debug error <flow-id>
```

Executes: `ErrorCorrelation/root_cause` → walks the flow's steps backward → finds the first deviation from FlowGraph → returns the source location of the failing entity.

Output:
```
Flow f-123 failed at step 3 of 5

Step 1: ✓ User/register → ok          (user.concept:14)
Step 2: ✓ Password/set → ok           (password.concept:22)
Step 3: ✗ JWT/generate → error         (jwt.concept:31)
         "Token signing key not configured"

Root cause: JWT/generate requires capability 'crypto'
            which is not available in current deployment.

Static expectation (flow-graph):
  User/register → Password/set → JWT/generate → Profile/create → Web/respond
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ got this far

Source: specs/framework/jwt.concept, line 31
Sync:   syncs/auth/registration-flow.sync, line 12
```

### 6.2 "Which variants have never fired?"

```
copf debug coverage --kind variant
```

Executes: `RuntimeCoverage/coverage_report(kind: "variant")` → cross-references with `SyncEntity/find_orphan_variants` (static analysis).

Output:
```
Variant Coverage Report (last 30 days)
═══════════════════════════════════════

Total variants: 47
Exercised: 38 (80.9%)
Statically dead: 3 (no sync matches)
Dynamically dead: 6 (sync exists but never fired)

Statically dead (no sync can ever trigger these):
  Article/create → duplicate     (article.concept:18)
  Comment/add → ratelimited      (comment.concept:24)
  Tag/remove → cascade           (tag.concept:15)

Dynamically dead (syncs exist but haven't fired):
  User/register → suspended      last sync: user-moderation.sync
  Article/update → conflict      last sync: article-optimistic-lock.sync
  JWT/verify → expired           last sync: auth-refresh.sync
  Password/check → locked        last sync: auth-lockout.sync
  Follow/follow → blocked        last sync: user-blocking.sync
  Favorite/favorite → limit      last sync: rate-limiting.sync
```

### 6.3 "What's the slowest sync chain?"

```
copf debug hotspots --kind sync --metric p90
```

Executes: `PerformanceProfile/slow_chains` → traces through FlowGraph to find the bottleneck entity.

Output:
```
Slow Sync Chains (p90 > 100ms)
══════════════════════════════

Chain: User/register → Password/set → JWT/generate → Profile/create
  Total p90: 342ms
  Bottleneck: Password/set (p90: 210ms)
              ^^^ bcrypt hashing — expected

Chain: Article/create → Tag/add → SearchIndex/update
  Total p90: 189ms
  Bottleneck: SearchIndex/update (p90: 145ms)
              ^^^ consider making [eventual]
```

### 6.4 "Show me the runtime path vs. static expectation"

```
copf debug flow <flow-id> --compare-static
```

Executes: `RuntimeFlow/compare_to_static` → diffs actual execution against FlowGraph prediction.

Output:
```
Flow f-456: Article/publish flow
══════════════════════════════════

Expected (static FlowGraph):
  1. Article/publish → ok
  2. → [sync: publish-notify] → Notification/send
  3. → [sync: publish-index] → SearchIndex/update

Actual (runtime):
  1. ✓ Article/publish → ok               12ms
  2. ✓ → [sync: publish-notify] → Notification/send → ok    34ms
  3. ✓ → [sync: publish-index] → SearchIndex/update → ok    89ms
  4. ✗ → [sync: publish-cache] → Cache/invalidate → error   3ms
         "Cache connection refused"
         ^^^ DEVIATION: sync exists in static graph but errored
             This sync is [eventual] so the flow still completed.

Static path matched: 3/3 expected steps
Extra steps: 1 (publish-cache — eventual, errored)
```

### 6.5 "How does this widget actually behave at runtime?"

```
copf debug widget dialog --coverage
```

Executes: `RuntimeCoverage/widget_state_coverage(widget: dialog)` → compares against WidgetStateEntity definitions.

Output:
```
Widget: dialog — State Machine Coverage
═══════════════════════════════════════

States:
  closed  ✓ 847 entries    (initial)
  open    ✓ 847 entries

Transitions:
  closed → open   (OPEN)    ✓ 847 times
  open → closed   (CLOSE)   ✓ 834 times
  open → closed   (ESCAPE)  ✓ 13 times    ← keyboard close
  
  Unexercised transitions: none

Accessibility events:
  trapFocus:    ✓ 847 invocations
  releaseFocus: ✓ 847 invocations
  preventScroll: ✓ 847 invocations
```

### 6.5b "Full widget lifecycle report"

```
copf debug widget checkbox-group --lifecycle
```

Executes: `RuntimeCoverage/widget_lifecycle_report(widget: checkbox-group)` → full mount/render/unmount lifecycle.

Output:
```
Widget: checkbox-group — Lifecycle Report (last 30 days)
════════════════════════════════════════════════════════

Instances:
  Total mounts:    4,891
  Total unmounts:  4,889
  Active now:      2
  Avg lifetime:    42.3s

Rendering:
  Total renders:          18,247
  Renders/instance avg:   3.7
  Unnecessary renders:    1,204 (6.6%)    ← connect output unchanged
  Avg render time:        1.2ms
  P90 render time:        2.8ms

  ⚠ 6.6% unnecessary renders — consider memoizing connect output
    or checking prop equality before triggering FrameworkAdapter/render

Prop changes that triggered re-renders:
  Signal: article.tags     8,412 changes  (46.1%)
  Signal: article.published  4,102 changes  (22.5%)   ← not even a checkbox-group prop!
  Signal: viewport.width   3,891 changes  (21.3%)   ← responsive re-evaluation
  Signal: theme.tokens     1,842 changes  (10.1%)   ← theme switch

  ⚠ article.published changes trigger re-renders on checkbox-group
    but checkbox-group doesn't read this prop. The parent component
    is re-rendering checkbox-group unnecessarily.
    Source: Binding b-article, signalMap includes published
    Fix: narrow signalMap or use shouldComponentUpdate

Slots:
  (none defined for checkbox-group)

Concept field bindings:
  Renders Article.tags:  4,891 instances
    Avg option count: 3.2
    Max option count: 12
    Affordance: checkbox-group (specificity 10, maxOptions: 8)
    23 instances exceeded maxOptions → fell through to combobox
```

### 6.5c "Why did this widget re-render?"

```
copf debug widget-instance <machine-id> --render-trace
```

Executes: `RuntimeCoverage/widget_render_trace(widget_instance: machine-id)` → shows every render with causal chain.

Output:
```
Render trace for checkbox-group instance m-7842
═══════════════════════════════════════════════

Render 1: 2026-02-25T14:03:22.100Z  (1.1ms)  MOUNT
  Trigger: Machine/spawn
  Props: { options: ["rust", "wasm"], selected: ["rust"] }

Render 2: 2026-02-25T14:03:24.350Z  (0.8ms)  NECESSARY
  Trigger: Signal/write → article.tags
  Chain: Tag/add(tag: "copf") → tag-update-sync → Article/update → ok
         → Binding/sync → Signal/write(article.tags)
  Props changed: options (added "copf"), selected (unchanged)

Render 3: 2026-02-25T14:03:24.351Z  (0.9ms)  UNNECESSARY ⚠
  Trigger: Signal/write → article.published
  Chain: Article/update → ok → Binding/sync → Signal/write(article.published)
  Props changed: (none — checkbox-group doesn't read published)
  Suggestion: Signal batching would collapse renders 2+3 into one

Render 4: 2026-02-25T14:03:30.200Z  (1.4ms)  NECESSARY
  Trigger: Signal/write → article.tags
  Chain: User removed "wasm" tag in UI → Binding/invoke → Tag/remove → ok
  Props changed: options (removed "wasm"), selected (removed "wasm")
```

### 6.5d "Compare widget performance across the project"

```
copf debug widget --comparison --top 10
```

Executes: `RuntimeCoverage/widget_comparison` → ranks widgets by render load.

Output:
```
Widget Performance Comparison (last 7 days)
═══════════════════════════════════════════

Widget              Mounts   Renders   Unnecessary%   Avg ms   P90 ms
─────────────────────────────────────────────────────────────────────
text-input          12,847   38,541    2.1%          0.4ms    0.8ms
checkbox-group       4,891   18,247    6.6%          1.2ms    2.8ms   ⚠
article-card         3,204   14,892    12.3%         3.1ms    8.2ms   ⚠⚠
select               2,891    8,673    1.8%          0.6ms    1.2ms
button-filled        8,412    8,412    0.0%          0.2ms    0.4ms
tag-list             3,204   12,816    0.0%          0.8ms    1.5ms
avatar               6,408    6,408    0.0%          0.3ms    0.5ms
dialog                 847    1,694    0.0%          1.8ms    3.2ms
toggle               4,201    8,402    0.0%          0.1ms    0.3ms
textarea             1,842    5,526    3.2%          0.5ms    1.1ms

⚠ article-card: 12.3% unnecessary renders (584 of 4,737)
  Root cause: parent list re-renders all cards when any article updates
  Suggestion: key-based reconciliation or per-card binding isolation
```

### 6.6 "What concept field changes caused this UI re-render?"

```
copf debug binding <binding-id> --signal-trace
```

Traces: Signal/write → Binding/sync → which concept field changed → which ActionLog entry caused it → which sync fired.

Output:
```
Signal trace for binding b-article-42
═════════════════════════════════════

Signal write: article.tags = ["rust", "wasm", "copf"]
  ← Binding/sync (b-article-42)
  ← Transport/fetch response
  ← ActionLog: Article/update → ok (flow: f-789)
  ← SyncEngine fired: tag-update-sync
  ← ActionLog: Tag/add (tag: "copf", article: 42)
  ← User action in UI

Re-render triggered:
  checkbox-group (renders article.tags)
    ← interactor: multi-choice (3 options)
    ← affordance: checkbox-group (specificity 10, maxOptions: 8)
    ← source: Article.concept:8 (state { tags: A -> set String })
```

### 6.7 "If I change this concept's schema, what breaks in production?"

```
copf debug impact Article/tags --include-runtime
```

Combines static impact analysis with runtime coverage:

Output:
```
Impact Analysis: Article/tags (set String)
══════════════════════════════════════════

STATIC IMPACT:
  Syncs affected: 3
    tag-update-sync          [required]   ← reads tags in where-clause
    article-search-sync      [recommended] ← indexes tags
    tag-cloud-sync           [eventual]    ← aggregates all tags

  Generated files: 4
    generated/ts/article.handler.ts     line 42
    generated/graphql/article.graphql   line 18
    generated/ts/article.types.ts       line 7
    generated/react/ArticleForm.tsx     line 34

  Widget selection: checkbox-group (via multi-choice interactor)
    Anatomy: option parts × 3 average
    If type changes from set → list: re-classifies as group-repeating
      → widget changes to repeating-list (BREAKING UI CHANGE)

RUNTIME IMPACT (last 30 days):
  This field was written 1,247 times
  Read by 3 syncs (all actively firing)
  Rendered in 4,891 UI views
  Average option count: 3.2 (checkbox-group is appropriate)
  Max option count: 12 (would trigger combobox at > 8 — happened 23 times)

  ⚠ WARNING: 23 renders used combobox instead of checkbox-group
    due to option count > 8. Consider:
    1. Raise checkbox-group maxOptions affordance to 12
    2. Accept combobox for high-count cases
```

---

## 7. Relationship to Existing Concepts

### 7.1 Concepts Reused (no changes)

| Concept | Role in runtime layer |
|---------|----------------------|
| ActionLog | Primary data source — all invocations/completions flow from here |
| FlowTrace | Builds trace trees — RuntimeFlow enriches these with static entity references |
| SyncEngine | Firing events feed coverage and performance tracking |
| Telemetry | Timing data feeds PerformanceProfile aggregation |
| Machine | FSM events feed widget state coverage; spawn/destroy feed mount/unmount tracking; connect output feeds prop change and unnecessary render detection |
| Signal | Write events feed binding trace, re-render tracking, and render causal chains (signal → binding → machine → widget) |
| Slot | Fill/clear events feed slot activity tracking correlated to host widget |
| FrameworkAdapter | Render events feed per-widget render counting and timing |
| Transport | Request/response events feed error correlation |
| DataQuality | InvariantValidationSync already uses this — RuntimeCoverage extends the coverage picture |

### 7.2 Concepts Extended (additive)

| Concept | Extension |
|---------|-----------|
| Graph | New `execution-graph`, `signal-graph`, `binding-graph`, `render-graph` overlay types |
| Tag | New runtime tags: `coverage:exercised`, `coverage:dead-static`, `coverage:dead-runtime`, `performance:hot`, `performance:bottleneck` |
| SearchIndex | Runtime entities (flows, errors, profiles) become searchable |

### 7.3 Not Superseded

RuntimeCoverage does *not* supersede DataQuality for invariant checking. DataQuality validates that observed behavior matches declared invariants (a pass/fail check). RuntimeCoverage tracks *which* entities have been observed at all (a quantitative measure). They're complementary:

- DataQuality: "When JWT/verify → expired happens, does the auth-refresh sync fire correctly?"
- RuntimeCoverage: "Has JWT/verify → expired ever happened at all?"

---

## 8. New Concepts Summary

| Concept | Kit | Purpose |
|---------|-----|---------|
| RuntimeFlow | Semantic | Enriched execution flow — ActionLog events resolved to static entities |
| RuntimeCoverage | Semantic | Which static entities have been exercised at runtime |
| PerformanceProfile | Semantic | Aggregate timing per static entity |
| ErrorCorrelation | Semantic | Runtime errors linked to static context with root cause analysis |

All four go in the Semantic Kit since they bridge runtime data to semantic entities. They don't need the provider pattern — they're uniform across all languages and contexts.

### Provider pattern: not needed

Unlike parse/symbol/analysis layers which are language-specific, runtime correlation is uniform. ActionLog entries from TypeScript handlers and Rust handlers have the same structure. Machine events from React and SwiftUI have the same structure. The correlation logic is always the same: resolve string identifiers to Symbol-ref → Symbol-ref to semantic entity.

---

## 9. CLI Additions

```
copf debug <subcommand>
  copf debug flow <flow-id> [--compare-static] [--source-locations]
    # Show enriched flow with static comparison

  copf debug error <flow-id-or-error-id> [--root-cause]
    # Error details with root cause chain

  copf debug coverage [--kind action|variant|sync|widget-state|transition|widget-render|widget-mount]
                      [--since <datetime>] [--concept <n>] [--widget <n>]
    # Coverage report — which declared entities have been exercised

  copf debug hotspots [--kind action|sync|chain|widget] [--metric p50|p90|p99|error-rate|unnecessary-render-pct]
                      [--top <n>] [--since <datetime>]
    # Performance hotspots

  copf debug binding <binding-id> [--signal-trace]
    # Trace signal writes back to concept field changes

  copf debug widget <widget-name> [--coverage] [--transitions] [--lifecycle] [--comparison]
    # --coverage: FSM state/transition coverage
    # --lifecycle: full mount/render/unmount lifecycle report
    # --transitions: which transitions have been exercised
    # --comparison: rank all widgets by render performance

  copf debug widget-instance <machine-id> [--render-trace] [--signal-chain]
    # --render-trace: every render with causal chain (signal → prop → render)
    # --signal-chain: which signals this instance depends on

  copf debug compare-static [--flow <flow-id>] [--all-recent]
    # Compare recent runtime behavior against static FlowGraph predictions

copf impact <file-or-symbol> [--include-runtime]
  # Extended: adds runtime frequency data to static impact analysis
```

### Updates to Existing Commands

```
copf check
  --pattern runtime-dead-variants    # variants with syncs but zero runtime exercises
  --pattern runtime-dead-syncs       # syncs that have never fired
  --pattern unexercised-transitions  # widget FSM transitions never taken
  --pattern performance-regression   # entities whose p90 increased > 50% in last window
  --pattern error-hotspots           # entities with > 5% error rate
  --pattern unnecessary-renders      # widgets with > 5% unnecessary render rate
  --pattern signal-cascade           # signal writes that trigger > 10 widget re-renders
  --pattern unbound-signal-leak      # signals in binding signalMap that no widget reads

copf trace
  --resolve                          # resolve trace entries to semantic entities
  --source                           # include source file locations
  --compare                          # diff against static FlowGraph

copf query flow <concept/action>
  --actual                           # show runtime flows instead of static FlowGraph
  --both                             # show static expectation alongside actual history
```

---

## 10. Interface Kit Additions

### MCP Tools

```
tools:
  - copf_debug_flow: Enriched flow trace with static comparison
  - copf_debug_error: Error with root cause chain and source locations
  - copf_debug_coverage: Runtime coverage for any entity kind
  - copf_debug_hotspots: Performance hotspots by entity
  - copf_debug_binding_trace: Signal write → concept field → action chain
  - copf_debug_compare_static: Runtime vs static flow comparison
  - copf_debug_widget_lifecycle: Full widget mount/render/unmount lifecycle report
  - copf_debug_widget_render_trace: Per-instance render trace with causal chains
  - copf_debug_widget_comparison: Cross-project widget performance ranking
```

### Claude Skills

```
skills:
  - copf-debugger:
      description: "Debug runtime issues with full static context"
      tools: [debug_flow, debug_error, debug_coverage, debug_compare_static, inspect_concept, inspect_sync]

  - copf-performance-analyst:
      description: "Identify performance bottlenecks with structural context"
      tools: [debug_hotspots, debug_flow, query_flow, analyze_slice, debug_widget_comparison]

  - copf-coverage-analyst:
      description: "Analyze runtime coverage against declared structure"
      tools: [debug_coverage, query_dead_variants, query_dead_syncs, check_runtime_dead_variants]

  - copf-widget-profiler:
      description: "Profile and optimize widget rendering performance"
      tools: [debug_widget_lifecycle, debug_widget_render_trace, debug_widget_comparison,
              debug_hotspots, debug_binding_trace, check_unnecessary_renders, check_signal_cascade]
```

---

## 11. Updated Totals

From base doc + COIF addendum: 26 coordination concepts + ~46 providers across 27 kits.

This addendum adds:
- 4 semantic entities (RuntimeFlow, RuntimeCoverage, PerformanceProfile, ErrorCorrelation)
- 0 providers (uniform across languages)
- 0 new kits (goes in Semantic Kit)
- ~18 new syncs (correlation, coverage, performance, error, widget lifecycle)
- 8 new AnalysisRule built-ins (runtime-dead-variants, runtime-dead-syncs, unexercised-transitions, performance-regression, error-hotspots, unnecessary-renders, signal-cascade, unbound-signal-leak)

**Final combined totals:**
- COPF concept library: 54 concepts, 15 kits
- Code Representation system: 30 coordination concepts + ~46 providers, 5 new kits
- COIF: 29 concepts, 7 kits
- Combined: **~113 coordination concepts + ~46 providers across 27 kits**

Concept library version: **v0.5.0**

---

## 12. Implementation Phase Updates

Runtime correlation integrates into the existing phases:

### Phase 3 (Semantic Entities) — add:
- RuntimeFlow, RuntimeCoverage as concepts (they depend on ActionEntity, SyncEntity)
- ActionLogCorrelationSync, VariantCoverageSync, SyncFiringCorrelationSync

### Phase 5 (Analysis Overlays) — add:
- ErrorCorrelation concept
- ErrorCorrelationSync, SyncMismatchErrorSync
- FlowDeviationCheckSync (compare runtime to static FlowGraph)
- Runtime-specific AnalysisRule built-ins

### Phase 7 (Interface Exposure & DevServer) — add:
- PerformanceProfile concept and PerformanceAggregationSync
- `copf debug` CLI commands
- MCP tools for debugging
- Claude Skills for debugging and performance analysis
- DevServer integration: live coverage overlay showing which syncs/variants have fired during the current dev session

### New Phase 8 candidate: Production Observability
- Continuous coverage tracking in production
- Performance regression detection as AnalysisRules
- Error hotspot alerting via Telemetry integration
- Dashboard generation from RuntimeCoverage + PerformanceProfile data
