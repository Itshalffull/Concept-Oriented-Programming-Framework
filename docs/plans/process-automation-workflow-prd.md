# Process Automation Workflow — Product Requirements Document

**Version:** 0.1.0 | **Date:** 2026-03-23
**Status:** Design specification — pre-implementation

---

## 1. Vision

A unified process execution system for Clef Base where processes are recursive, content-rich, multi-modal (human, AI agent, chat FSM), version-aware, and built entirely from existing Clef primitives. Users create processes whose steps carry arbitrary content (via Schema mixins), expand recursively into sub-processes, roll up verification checks across levels, and execute in four modes — manual human, autonomous AI agent, triggered AI, or conversational chat FSM — all governed by Role/Permission and composable with parallel realities via VersionSpace.

---

## 2. Design Principles

1. **Steps are ContentNodes.** Process steps are not opaque strings inside ProcessSpec — they are full Clef Base ContentNodes with Schema mixins for context, instructions, and checks. This means steps get the triple-zone treatment: structured fields, unstructured prose, and related content.

2. **Processes compose recursively.** Any step can expand to a sub-process. Sub-processes can expand further. Check results roll up through the hierarchy. This is the existing `ProcessRun.start_child` / `subprocess-step-dispatch` pattern, extended with check aggregation.

3. **Execution mode is a runtime decision.** The same ProcessSpec can be executed by a human clicking through, an AI agent autonomously, or a human chatting with an AI. The mode is resolved at dispatch time based on actor, permissions, and configuration — not baked into the spec.

4. **VersionSpace for experimentation.** "Try a different approach" at any level forks a VersionSpace. Process state is version-aware via the existing `version-aware-load` / `version-aware-save` syncs. Compare, cherry-pick, or merge results.

5. **Everything is content.** ProcessSpecs, steps, checks, check results, conversations — all are ContentNodes visible in the content browser, searchable, linkable, embeddable.

---

## 3. Concept Inventory

### 3.1 Existing concepts (no changes needed)

| Concept | Suite | Role in this system |
|---------|-------|---------------------|
| ProcessSpec | process-foundation | Versioned process templates with steps and routing edges |
| ProcessRun | process-foundation | Running process instance lifecycle |
| StepRun | process-foundation | Per-step execution state |
| FlowToken | process-foundation | Control-flow position tracking, parallel fork/join |
| ProcessVariable | process-foundation | Typed scoped data within runs |
| ProcessEvent | process-foundation | Append-only audit trail |
| WorkItem | process-human | Human task lifecycle (offer/claim/complete) |
| Approval | process-human | Multi-party authorization gates |
| Escalation | process-human | SLA violation escalation chains |
| LLMCall | process-llm | LLM prompt execution with validation/repair |
| ToolRegistry | process-llm | Tool availability for LLM tool use |
| ConnectorCall | process-automation | External system calls |
| Timer | process-automation | Delays, timeouts, scheduled triggers |
| WebhookInbox | process-automation | Webhook reception and routing |
| Checkpoint | process-reliability | State snapshots for recovery |
| Milestone | process-observability | Process goal achievement tracking |
| Role | governance-identity | Named capacities with permissions |
| Permission | governance-identity | Action authorization with conditions |
| AgenticDelegate | governance-identity | AI agent delegation authority |
| Conversation | llm-conversation | Branching message sequences |
| AgentLoop | llm-agent | Agent reasoning cycle coordination |
| AgentRole | llm-agent | Capability declaration for task matching |
| VersionSpace | multiverse | Copy-on-write parallel reality overlays |
| VersionContext | multiverse | Per-user active version space stack |
| ContentNode | foundation | Universal entity type |
| Schema | classification | Composable type mixins |
| Property | foundation | Typed field storage |
| DiagramNotation | diagramming | Swappable diagram vocabulary (node/edge types, connection rules) |
| BpmnNotationProvider | diagramming | BPMN notation — ~30 node types for standards-compliant process diagrams |
| FlowchartNotationProvider | diagramming | Simplified flowchart notation for lightweight process views |
| AnalysisOverlay | diagramming | Non-destructive visual overlays (heat maps, clusters, highlights) on diagrams |
| AnalysisReport | diagramming | Generates process analytics reports (bottlenecks, critical paths, completion times) |
| DiagramExport | diagramming | Exports to BPMN XML, Mermaid, DrawIO, SVG, PDF, etc. |

### 3.2 New concept: CheckVerification

**Purpose:** Track the evaluation status of individual checks attached to process steps, supporting automated evaluation, human/LLM judgment, configurable ordering, and hierarchical rollup.

**Suite:** process-verification (new suite, depends on process-foundation)

```
concept CheckVerification [CV]

  state
    verifications:  set CV
    step_ref:       one CV -> StepRef
    check_ref:      one CV -> ContentNodeRef    // the Check ContentNode
    status:         one CV -> Status
    mode:           one CV -> EvalMode
    result_score:   one CV -> Float?
    result_evidence: one CV -> Text?
    judge:          one CV -> ActorRef?
    evaluated_at:   one CV -> Timestamp?
    depends_on:     set CV -> set CV            // ordering dependencies
    rollup_source:  set CV -> set CV            // child verifications rolled into this one
    rollup_status:  one CV -> RollupStatus?

  actions
    evaluate [cv: CV]
      // Run automated check logic. Returns pass/fail/error.
      ok      -> [cv: CV; score: Float; evidence: Text]
      fail    -> [cv: CV; score: Float; evidence: Text; feedback: Text]
      error   -> [cv: CV; reason: Text]

    judge [cv: CV; verdict: Verdict; evidence: Text]
      // Human or LLM provides judgment on a check.
      ok      -> [cv: CV; score: Float]
      fail    -> [cv: CV; feedback: Text]

    waive [cv: CV; justification: Text]
      // Skip a check with recorded justification.
      ok      -> [cv: CV]

    rollup [cv: CV; child_verifications: set CV]
      // Aggregate child process checks into this parent check.
      // Creates a work item (or chat/LLM interaction) for review.
      ok         -> [cv: CV; merged_evidence: Text]
      needs_edit -> [cv: CV; suggestions: list Suggestion]

    reset [cv: CV]
      // Reset a check for re-evaluation.
      ok      -> [cv: CV]

  invariants
    // A check cannot be both waived and evaluated
    all cv: CV | status(cv) = waived => result_score(cv) = null
```

**Status enum:** `pending | evaluating | passing | failing | waived | error`

**EvalMode enum:** `automated | human | llm | rollup`

**RollupStatus enum:** `pending | approved | needs_edit | merged`

**Verdict enum (for judge action):** `pass | fail`

### 3.3 New concept: ProcessConversation

**Purpose:** Bridge a Conversation to a ProcessRun, so that chat messages drive step transitions and the conversation accumulates process context across steps.

**Suite:** process-conversation (new suite, depends on process-foundation + llm-conversation)

```
concept ProcessConversation [PC]

  state
    bindings:           set PC
    process_run:        one PC -> RunRef
    conversation:       one PC -> ConversationRef
    current_step:       one PC -> StepRef?
    mode:               one PC -> ConversationMode
    delegate:           one PC -> AgenticDelegateRef
    checkpoint_map:     set PC -> map StepRef -> CheckpointRef

  actions
    bind [run: RunRef; conversation: ConversationRef; mode: ConversationMode]
      // Create the bridge between a process run and a conversation.
      ok   -> [pc: PC]
      fail -> [reason: Text]

    advance [pc: PC; to_step: StepRef]
      // Conversation advances to a new step. Captures checkpoint,
      // injects step context/instructions into conversation.
      ok   -> [pc: PC; message_id: MessageRef]

    rewind [pc: PC; to_step: StepRef]
      // Go back to a previous step. Forks the conversation at the
      // checkpoint message, restores process state from checkpoint.
      ok   -> [pc: PC; branch_id: BranchRef]

    delegate_edit [pc: PC; action: ActionRef; params: JSON]
      // AI performs an edit action on behalf of the user within
      // the process context. Governed by ai_authority config.
      ok      -> [pc: PC; result: JSON]
      denied  -> [pc: PC; reason: Text]

    complete_step [pc: PC]
      // Signal that the current step is done (checks will run).
      ok   -> [pc: PC; step: StepRef]
      fail -> [pc: PC; check_failures: list CheckFailure]
```

**ConversationMode enum:** `guided | freeform`
- `guided`: AI proactively explains each step, runs checks, suggests next actions
- `freeform`: AI responds to user questions but doesn't drive the flow

**AgenticDelegateRef:** Reference to an `AgenticDelegate` record (governance-identity suite) that governs which permissions the user delegates to the AI for this process. The AI can only do what the user could do and has explicitly delegated via the AgenticDelegate.

### 3.4 New concept: ExecutionDispatch

**Purpose:** Resolve how a step actually executes based on actor type, permissions, process configuration, and user preference. Sits before the existing step-type dispatch syncs.

**Suite:** process-foundation (extension — adds to existing suite)

```
concept ExecutionDispatch [ED]

  state
    dispatches:        set ED
    step_ref:          one ED -> StepRef
    spec_mode:         one ED -> StepType        // from ProcessSpec
    actor_type:        one ED -> ActorType
    resolved_mode:     one ED -> ResolvedMode
    actor_ref:         one ED -> ActorRef

  actions
    resolve [step: StepRef; actor: ActorRef; preferences: JSON?]
      // Determine execution mode for this step given the actor.
      ok -> [ed: ED; resolved_mode: ResolvedMode]

    override [ed: ED; new_mode: ResolvedMode; justification: Text]
      // Manually override the resolved mode (requires permission).
      ok -> [ed: ED]
```

**ActorType enum:** `human | ai_autonomous | ai_triggered | ai_conversational`

**ResolvedMode enum:** `work_item | llm_call | agent_loop | chat | approval | subprocess | automation | webhook_wait`

**Resolution logic:**
1. If `actor_type = human` and `spec_mode = human` → `work_item`
2. If `actor_type = ai_conversational` → `chat` (routes to ProcessConversation)
3. If `actor_type = ai_autonomous` → `agent_loop` (routes to AgentLoop)
4. If `actor_type = ai_triggered` → `llm_call` (routes to LLMCall)
5. Otherwise, fall through to spec_mode default

---

## 4. Schema Design (Clef Base Integration)

All process entities are ContentNodes with Schema mixins. This section defines the `schema.yaml` mappings.

### 4.1 Process Step Schemas

```yaml
# clef-base/suites/process-workflow/schema.yaml

schemas:
  ProcessStep:
    concept: StepRun
    primary_set: steps
    manifest: content
    fields:
      step_key:    { from: step_key, type: String, required: true, mutability: readonly }
      step_type:   { from: step_type, type: Enum, required: true, mutability: editable }
      status:      { from: status, type: Enum, required: true, mutability: system }
      attempt:     { from: attempt, type: Int, mutability: system }
      started_at:  { from: started_at, type: DateTime, mutability: system }
      completed_at: { from: completed_at, type: DateTime, mutability: system }

  # --- Mixin schemas applied to ProcessStep ContentNodes ---

  StepContext:
    type: mixin
    fields:
      background:      { type: RichText, description: "Why this step exists, what problem it addresses" }
      prerequisites:   { type: Reference, cardinality: unlimited, description: "ContentNodes that should be read/understood first" }
      reference_materials: { type: Reference, cardinality: unlimited, description: "Supporting documents, links, examples" }
      estimated_effort: { type: Enum, allowed_values: [trivial, small, medium, large, epic] }
      role_guidance:    { type: JSON, description: "Per-role customized context, keyed by role name" }

  StepInstructions:
    type: mixin
    fields:
      how_to:          { type: RichText, description: "Step-by-step instructions for completing this step" }
      acceptance_criteria: { type: RichText, description: "What 'done' looks like" }
      tools_needed:    { type: Reference, cardinality: unlimited, description: "Tools/resources required" }
      tips:            { type: RichText, description: "Optional tips, gotchas, common mistakes" }
      example_output:  { type: Reference, description: "An example of completed output" }

  StepChecklist:
    type: mixin
    fields:
      checks:          { type: Reference, cardinality: unlimited, description: "Ordered list of Check ContentNodes" }
      check_strategy:  { type: Enum, allowed_values: [stop_on_first_failure, run_all_report_all], default: run_all_report_all }
      rollup_mapping:  { type: JSON, description: "Suggested child-check to parent-check mappings for rollup" }

  # --- Check schema (applied to Check ContentNodes) ---

  Check:
    fields:
      name:            { type: String, required: true }
      description:     { type: RichText }
      eval_mode:       { type: Enum, allowed_values: [automated, human, llm], required: true }
      automated_rule:  { type: JSON, description: "Rule config for automated evaluation (concept action, validator, formula)" }
      pass_threshold:  { type: Float, default: 1.0, description: "Score >= threshold = pass" }
      order:           { type: Int, default: 0, description: "Evaluation order (lower = first)" }
      depends_on:      { type: Reference, cardinality: unlimited, description: "Other Checks that must pass first" }
      feedback_template: { type: RichText, description: "Template for failure feedback message" }

  CheckResult:
    fields:
      check_ref:       { type: Reference, required: true }
      step_ref:        { type: Reference, required: true }
      status:          { type: Enum, allowed_values: [pending, passing, failing, waived, error], required: true }
      score:           { type: Float }
      evidence:        { type: RichText }
      feedback:        { type: RichText, description: "What needs to change to pass" }
      judge:           { type: String, description: "Who/what evaluated: user ID, 'system', or model name" }
      evaluated_at:    { type: DateTime, mutability: system }
      waive_justification: { type: RichText }

  # --- Process spec as content ---

  Process:
    concept: ProcessSpec
    primary_set: specs
    manifest: content
    fields:
      name:        { from: name, type: String, required: true }
      version:     { from: version, type: String, required: true }
      status:      { from: status, type: Enum, required: true }
      description: { type: RichText }
      owner:       { type: Reference }
      tags:        { type: Reference, cardinality: unlimited }

  ProcessInstance:
    concept: ProcessRun
    primary_set: runs
    manifest: content
    fields:
      spec_ref:    { from: spec_ref, type: Reference, required: true }
      status:      { from: status, type: Enum, required: true, mutability: system }
      started_at:  { from: started_at, type: DateTime, mutability: system }
      ended_at:    { from: ended_at, type: DateTime, mutability: system }
      parent_run:  { from: parent_run, type: Reference, mutability: system }
      actor:       { type: Reference, description: "Who/what is executing this run" }
      actor_type:  { type: Enum, allowed_values: [human, ai_autonomous, ai_triggered, ai_conversational] }

hooks:
  on_apply:
    ProcessStep: StepRun/initializeStep
  on_save:
    CheckResult: CheckVerification/onResultSaved
```

### 4.2 Composition Rules

```yaml
# clef-base/suites/process-workflow/process-step.composition.yaml

composition: process-step-defaults
source: process-workflow
target: ProcessStep
rules:
  - type: mixin
    schema: StepContext
    auto_apply: true
  - type: mixin
    schema: StepInstructions
    auto_apply: true
  - type: mixin
    schema: StepChecklist
    auto_apply: true
```

This ensures every ProcessStep ContentNode automatically gets Context, Instructions, and Checklist mixins. Users can add more mixins (e.g., `StepEstimate`, `StepTrainingMaterial`) without touching process concepts.

---

## 5. Sync Design

### 5.1 Check evaluation syncs

```
sync check-evaluation-on-step-complete
  when StepRun/complete: [step: ?s] => ok[step: ?s; output: ?out]
  where
    query StepChecklist: { checks: ?checks } for step ?s
  then
    CheckVerification/evaluate: [step_ref: ?s; checks: ?checks]
```

```
sync check-strategy-stop-on-first
  when CheckVerification/evaluate: [cv: ?cv] => fail[cv: ?cv; feedback: ?fb]
  where
    query StepChecklist: { check_strategy: "stop_on_first_failure" } for step of ?cv
  then
    StepRun/fail: [step: step_of(?cv); error: ?fb]
```

```
sync check-strategy-run-all
  when CheckVerification/evaluate: [cv: ?cv] => fail[cv: ?cv; feedback: ?fb]
  where
    query StepChecklist: { check_strategy: "run_all_report_all" } for step of ?cv
    query CheckVerification: { depends_on: ?next } where ?next.status = "pending"
  then
    CheckVerification/evaluate: [step_ref: step_of(?cv); checks: [?next]]
```

### 5.2 Check rollup syncs

```
sync child-run-triggers-rollup
  when ProcessRun/complete: [run: ?child] => ok[output: ?out]
  where
    query ProcessRun: { parent_run: ?parent } for ?child
    query StepRun: { run_ref: ?parent; step_key: ?parent_step } where step_type = "subprocess"
    query CheckVerification: all verifications for ?child run
  then
    CheckVerification/rollup: [
      cv: parent_check_for(?parent_step);
      child_verifications: child_checks(?child)
    ]
```

```
sync rollup-needs-edit-creates-work-item
  when CheckVerification/rollup: [cv: ?cv] => needs_edit[suggestions: ?sug]
  then
    WorkItem/create: [
      step_ref: step_of(?cv);
      form_schema: rollup_review_schema;
      form_data: { parent_check: ?cv, suggestions: ?sug, child_evidence: evidence_of(?cv) }
    ]
```

### 5.3 Execution dispatch syncs

```
sync execution-mode-resolver
  when StepRun/start: [step: ?s] => ok[step: ?s]
  where
    query ProcessInstance: { actor_type: ?at } for run of ?s
    query StepRun: { step_type: ?st } for ?s
  then
    ExecutionDispatch/resolve: [step: ?s; actor: actor_of(run_of(?s)); preferences: null]
```

```
sync dispatch-to-chat
  when ExecutionDispatch/resolve: [ed: ?ed] => ok[resolved_mode: "chat"]
  then
    ProcessConversation/advance: [pc: pc_for(run_of(?ed)); to_step: step_of(?ed)]
```

```
sync dispatch-to-agent
  when ExecutionDispatch/resolve: [ed: ?ed] => ok[resolved_mode: "agent_loop"]
  then
    AgentLoop/create: [
      goal: instructions_for(step_of(?ed));
      available_tools: tools_for(step_of(?ed))
    ]
```

### 5.4 Process-conversation syncs

```
sync process-start-creates-conversation
  when ProcessRun/start: [run: ?r] => ok[run: ?r]
  where
    query ProcessInstance: { actor_type: "ai_conversational" } for ?r
  then
    Conversation/create: [model: default_model; context_strategy: "hybrid"]
    ProcessConversation/bind: [run: ?r; conversation: ?conv; mode: "guided"]
```

```
sync conversation-step-advance
  when ProcessConversation/advance: [pc: ?pc; to_step: ?s] => ok[message_id: ?m]
  where
    query StepContext: { background: ?bg } for ?s
    query StepInstructions: { how_to: ?instr } for ?s
  then
    Conversation/append: [
      conversation: conv_of(?pc);
      role: "assistant";
      content: format_step_intro(?bg, ?instr)
    ]
    Checkpoint/capture: [run_ref: run_of(?pc)]
```

```
sync conversation-rewind-forks
  when ProcessConversation/rewind: [pc: ?pc; to_step: ?s] => ok[branch_id: ?b]
  then
    Conversation/fork: [
      conversation: conv_of(?pc);
      from_message: checkpoint_message(?pc, ?s)
    ]
    Checkpoint/restore: [
      run_ref: run_of(?pc);
      label: checkpoint_for(?s)
    ]
```

```
sync chat-step-checks-on-complete
  when ProcessConversation/complete_step: [pc: ?pc] => ok[step: ?s]
  then
    CheckVerification/evaluate: [step_ref: ?s; checks: checks_for(?s)]
```

```
sync chat-check-failure-appends-feedback
  when CheckVerification/evaluate: [cv: ?cv] => fail[feedback: ?fb]
  where
    query ProcessConversation: { current_step: step_of(?cv) } exists
  then
    Conversation/append: [
      conversation: conv_for_step(?cv);
      role: "assistant";
      content: format_check_feedback(?fb)
    ]
```

### 5.5 Version space integration syncs

```
sync process-fork-creates-version-space
  when VersionSpace/fork: [name: ?name; parent: ?parent; scope: ?scope]
       => ok[space: ?vs]
  where
    query ProcessRun: { status: "running" } for scope entity of ?scope
  then
    ProcessVariable/set: [
      run_ref: run_in_scope(?scope);
      name: "version_space";
      value: ?vs
    ]
```

No new sync needed for version-aware reads/writes — the existing `version-aware-load.sync` and `version-aware-save.sync` already intercept ContentStorage operations. Since ProcessStep, Check, and CheckResult are all ContentNodes, they automatically participate in VersionSpace overlays.

### 5.6 Agent process discovery syncs

```
sync agent-discovers-available-processes
  when AgentLoop/step: [agent: ?a] => ok[observation: "discover_processes"]
  where
    query AgentRole: { capabilities: ?caps } for ?a
    query ProcessSpec: { status: "active" } matching ?caps
    query Permission: check(?a, "ProcessRun/start", ?spec)
  then
    AgentLoop/observe: [
      agent: ?a;
      observation: available_processes(?specs)
    ]
```

---

## 6. Frontend Design

All frontend elements are defined using Clef Base primitives: Views, DisplayModes, Layouts, ComponentMappings, FieldPlacements, and Controls.

### 6.1 Navigation — New Destinations

```typescript
// New destinations added to clef-base/lib/destinations.ts

{ name: 'Processes',        href: '/processes',        group: 'Automation', targetConcept: 'ProcessSpec',   targetView: 'process-catalog' }
{ name: 'Process Runs',     href: '/runs',             group: 'Automation', targetConcept: 'ProcessRun',    targetView: 'run-dashboard' }
{ name: 'My Tasks',         href: '/tasks',            group: 'Automation', targetConcept: 'WorkItem',      targetView: 'my-work-items' }
{ name: 'Check Results',    href: '/checks',           group: 'Automation', targetConcept: 'CheckVerification', targetView: 'check-overview' }
{ name: 'Process Analytics', href: '/analytics',       group: 'Automation', targetConcept: 'ProcessMetric',      targetView: 'process-health' }
```

### 6.2 Views

#### 6.2.1 Process Catalog View (`process-catalog`)

**Purpose:** Browse and manage ProcessSpec definitions.

```yaml
view: process-catalog
title: "Processes"
dataSource:
  concept: ProcessSpec
  action: list
layout: card-grid
defaultDisplayMode: process-card
filters:
  - field: status
    type: toggle-group
    options: [draft, active, deprecated]
  - field: tags
    type: toggle-group
sorts:
  - field: name
    direction: asc
controls:
  - type: create
    label: "New Process"
    action: ProcessSpec/create
  - type: row-click
    action: navigate
    destination: "/processes/{{id}}"
```

#### 6.2.2 Run Dashboard View (`run-dashboard`)

**Purpose:** Monitor all running, completed, and failed process instances.

```yaml
view: run-dashboard
title: "Process Runs"
dataSource:
  concept: ProcessRun
  action: list
layout: table
filters:
  - field: status
    type: toggle-group
    options: [pending, running, suspended, completed, failed, cancelled]
  - field: actor_type
    type: toggle-group
    options: [human, ai_autonomous, ai_triggered, ai_conversational]
visibleFields:
  - field: spec_ref
    formatter: entity-reference
  - field: status
    formatter: badge
    formatter_options:
      colors:
        running: green
        failed: red
        completed: blue
        suspended: amber
        pending: gray
        cancelled: gray
  - field: actor_type
    formatter: badge
  - field: started_at
    formatter: date-relative
  - field: ended_at
    formatter: date-relative
sorts:
  - field: started_at
    direction: desc
controls:
  - type: create
    label: "Start Process"
    action: ProcessRun/start
  - type: row-click
    action: navigate
    destination: "/runs/{{id}}"
```

#### 6.2.3 My Work Items View (`my-work-items`)

**Purpose:** A personal task queue for the current user.

```yaml
view: my-work-items
title: "My Tasks"
dataSource:
  concept: WorkItem
  action: list
  params:
    assignee: "{{context.user}}"
layout: board
groups:
  field: status
  order: [offered, claimed, active, completed]
defaultDisplayMode: work-item-card
filters:
  - field: priority
    type: toggle-group
    options: [critical, high, medium, low]
sorts:
  - field: due_at
    direction: asc
controls:
  - type: row-action
    label: "Claim"
    action: WorkItem/claim
    visible_when: "status = offered"
  - type: row-action
    label: "Start"
    action: WorkItem/start
    visible_when: "status = claimed"
```

#### 6.2.4 Step Checks View (`step-checks`)

**Purpose:** Embedded view showing checks for a specific step. Used inside the step detail page.

```yaml
view: step-checks
title: "Checks"
dataSource:
  concept: CheckVerification
  action: list
  params:
    step_ref: "{{context.entity}}"
layout: table
visibleFields:
  - field: check_ref
    formatter: entity-reference
    label_override: "Check"
  - field: status
    formatter: badge
    formatter_options:
      colors:
        passing: green
        failing: red
        pending: gray
        waived: amber
        error: red
  - field: result_score
    formatter: plain-text
  - field: judge
    formatter: plain-text
  - field: evaluated_at
    formatter: date-relative
controls:
  - type: row-action
    label: "Re-evaluate"
    action: CheckVerification/reset
  - type: row-action
    label: "Waive"
    action: CheckVerification/waive
    visible_when: "status = failing"
```

#### 6.2.5 Process Conversation View (`process-chat`)

**Purpose:** The chat FSM interface — embedded within a process run page when execution mode is conversational.

```yaml
view: process-chat
title: "Process Chat"
dataSource:
  concept: Conversation
  action: getLineage
  params:
    conversation: "{{context.conversation}}"
layout: detail
defaultDisplayMode: chat-thread
controls:
  - type: action
    label: "Send"
    action: Conversation/append
  - type: action
    label: "Try Different Approach"
    action: ProcessConversation/rewind
  - type: action
    label: "Mark Step Complete"
    action: ProcessConversation/complete_step
```

### 6.3 DisplayModes

#### 6.3.1 Process Card (`process-card`)

**Schema:** Process
**Mode ID:** card
**Strategy:** Flat field list

```yaml
displayMode: process-card
schema: Process
mode_id: card
placements:
  - source_field: name
    formatter: heading
  - source_field: description
    formatter: truncate
    formatter_options: { length: 120 }
  - source_field: status
    formatter: badge
    formatter_options:
      colors: { active: green, draft: gray, deprecated: red }
  - source_field: version
    formatter: badge
    formatter_options: { variant: outline }
  - source_field: tags
    formatter: tag-list
```

#### 6.3.2 Process Step — Full (`step-full`)

**Schema:** ProcessStep
**Mode ID:** full
**Strategy:** Layout

The full step view is the primary execution interface for human/manual mode.

```yaml
displayMode: step-full
schema: ProcessStep
mode_id: full
layout: step-full-layout
```

**Layout: `step-full-layout`**

```yaml
layout: step-full-layout
kind: stack
direction: vertical
gap: spacing.lg
children:
  # --- Header: step identity + status ---
  - kind: stack
    direction: horizontal
    gap: spacing.md
    children:
      - view: null  # FieldPlacement inline
        placements:
          - source_field: step_key
            formatter: heading
          - source_field: status
            formatter: badge
          - source_field: step_type
            formatter: badge
            formatter_options: { variant: outline }

  # --- Main content: two-column on desktop, stacked on mobile ---
  - kind: split
    responsive:
      sm: { stacked: true }
    children:
      # Left: context + instructions (the "Do" panel)
      - kind: stack
        direction: vertical
        gap: spacing.md
        children:
          # Context section
          - area: structured
            placements:
              - source_field: background
                formatter: rich-text
                label_display: above
                label_override: "Context"
              - source_field: prerequisites
                formatter: entity-reference
                label_display: above
                label_override: "Prerequisites"
              - source_field: reference_materials
                formatter: entity-reference
                label_display: above
                label_override: "Reference Materials"
          # Instructions section
          - area: structured
            placements:
              - source_field: how_to
                formatter: rich-text
                label_display: above
                label_override: "Instructions"
              - source_field: acceptance_criteria
                formatter: rich-text
                label_display: above
                label_override: "Acceptance Criteria"
              - source_field: tips
                formatter: rich-text
                label_display: above
                label_override: "Tips"
          # Unstructured zone: the step's content body
          - area: unstructured

      # Right: checks sidebar
      - kind: stack
        direction: vertical
        gap: spacing.sm
        children:
          - view: step-checks
            context:
              entity: "{{current_entity}}"
```

#### 6.3.3 Work Item Card (`work-item-card`)

**Schema:** WorkItem (would need a corresponding WorkItem schema mapping)
**Mode ID:** card

```yaml
displayMode: work-item-card
schema: WorkItem
mode_id: card
placements:
  - source_field: step_ref
    formatter: entity-reference
    label_override: "Step"
  - source_field: status
    formatter: badge
    formatter_options:
      colors: { offered: blue, claimed: amber, active: green, completed: gray }
  - source_field: priority
    formatter: badge
    formatter_options:
      colors: { critical: red, high: orange, medium: blue, low: gray }
  - source_field: due_at
    formatter: date-relative
  - source_field: assignee
    formatter: entity-reference
```

#### 6.3.4 Check Result Inline (`check-result-inline`)

**Schema:** CheckResult
**Mode ID:** inline

```yaml
displayMode: check-result-inline
schema: CheckResult
mode_id: inline
placements:
  - source_field: check_ref
    formatter: entity-reference
  - source_field: status
    formatter: boolean-badge
    formatter_options:
      true_value: passing
      true_label: "Pass"
      true_color: green
      false_label: "Fail"
      false_color: red
  - source_field: score
    formatter: plain-text
  - source_field: feedback
    formatter: rich-text
    visible: "status = failing"
```

#### 6.3.5 Chat Thread (`chat-thread`)

**Schema:** Conversation (would need schema mapping)
**Mode ID:** chat-thread
**Strategy:** ComponentMapping (full widget takeover)

```yaml
displayMode: chat-thread
schema: Conversation
mode_id: chat-thread
component_mapping: chat-thread-mapping
```

```yaml
componentMapping: chat-thread-mapping
widget_id: chat-thread
slot_bindings:
  - slot_name: messages
    sources: ["entity_field:messages"]
  - slot_name: active_branch
    sources: ["entity_field:active_branch"]
  - slot_name: branches
    sources: ["entity_field:branches"]
prop_bindings:
  - prop_name: onSend
    source: "action:Conversation/append"
  - prop_name: onFork
    source: "action:Conversation/fork"
  - prop_name: onSwitchBranch
    source: "action:Conversation/switchBranch"
```

### 6.4 Page Layouts

#### 6.4.1 Process Run Page — The Three-Mode Layout

This is the core UI. A process run page that adapts based on execution mode, with three tabs/modes sharing the same screen.

**Layout: `process-run-page`**

```yaml
layout: process-run-page
kind: stack
direction: vertical
gap: spacing.none
children:
  # --- Top bar: process identity + progress ---
  - kind: stack
    direction: horizontal
    gap: spacing.md
    children:
      - area: structured
        placements:
          - source_field: spec_ref
            formatter: entity-reference
            label_override: "Process"
          - source_field: status
            formatter: badge
          - source_field: actor_type
            formatter: badge
            formatter_options: { variant: outline }

      # Step progress indicator
      - component_mapping: process-step-indicator

  # --- Mode tabs ---
  - component_mapping: execution-mode-tabs

  # --- Content area (switched by active tab) ---
  - kind: stack
    direction: vertical
    children:
      # Tab 1: Map view — process graph
      - area: structured
        visible_when: "active_tab = map"
        component_mapping: process-map-graph

      # Tab 2: Do view — current step full view
      - area: structured
        visible_when: "active_tab = do"
        display_mode: step-full
        context:
          entity: "{{current_step}}"

      # Tab 3: Chat view — conversational interface
      - area: structured
        visible_when: "active_tab = chat"
        component_mapping: chat-execution-panel
```

#### 6.4.2 ComponentMappings for Process Run Page

**Process Step Indicator:**

```yaml
componentMapping: process-step-indicator
widget_id: step-indicator
scope_schema: ProcessInstance
prop_bindings:
  - prop_name: steps
    source: "formula:steps_as_labels(spec_ref)"  # [{label, description?}]
  - prop_name: currentStep
    source: "formula:current_step_index(run_id)"
  - prop_name: orientation
    source: "static_value:horizontal"
  - prop_name: clickable
    source: "static_value:true"  # navigate to completed steps
  - prop_name: size
    source: "static_value:md"
```

**Execution Mode Tabs:**

```yaml
componentMapping: execution-mode-tabs
widget_id: tab-bar
slot_bindings:
  - slot_name: tabs
    sources:
      - "static_value:[{id:'map',label:'Map',icon:'network'},{id:'do',label:'Do',icon:'clipboard'},{id:'chat',label:'Chat',icon:'message-circle'}]"
prop_bindings:
  - prop_name: activeTab
    source: "entity_field:active_tab"
  - prop_name: onTabChange
    source: "action:Shell/setZone"
```

**Process Map Graph (authoring + execution):**

Uses the existing `workflow-editor` widget (which already has an affordance binding for `ProcessSpec`) for authoring, and layers the existing `execution-overlay` widget on top for runtime status visualization. No new graph widget needed.

```yaml
componentMapping: process-map-graph
widget_id: workflow-editor
scope_schema: ProcessInstance
slot_bindings:
  - slot_name: canvas
    sources: ["entity_field:spec_ref"]  # ProcessSpec provides nodes + edges
prop_bindings:
  - prop_name: nodes
    source: "formula:steps_as_nodes(spec_ref)"
  - prop_name: edges
    source: "formula:edges_as_links(spec_ref)"
  - prop_name: readOnly
    source: "static_value:true"  # read-only during execution
  - prop_name: executionState
    source: "formula:if(status='running','running',if(status='completed','success',if(status='failed','error','idle')))"
  - prop_name: selectedNodeId
    source: "entity_field:current_step_key"
  - prop_name: paletteOpen
    source: "static_value:false"  # no palette during execution
```

```yaml
# Execution overlay layered on top of the workflow editor
componentMapping: process-execution-overlay
widget_id: execution-overlay
scope_schema: ProcessInstance
prop_bindings:
  - prop_name: mode
    source: "static_value:live"
  - prop_name: showControls
    source: "static_value:true"
  - prop_name: animateFlow
    source: "static_value:true"
```

For authoring (on the `process-spec-page`), the same `workflow-editor` is used with `readOnly: false` and the palette/config panel enabled:

```yaml
componentMapping: process-spec-editor-graph
widget_id: workflow-editor
scope_schema: Process
prop_bindings:
  - prop_name: nodes
    source: "formula:steps_as_nodes(id)"
  - prop_name: edges
    source: "formula:edges_as_links(id)"
  - prop_name: readOnly
    source: "static_value:false"
  - prop_name: paletteOpen
    source: "static_value:true"
  - prop_name: workflowName
    source: "entity_field:name"
```

**Chat Execution Panel:**

```yaml
componentMapping: chat-execution-panel
widget_id: chat-panel
scope_schema: ProcessInstance
slot_bindings:
  - slot_name: messages
    sources: ["view_embed:process-chat"]
  - slot_name: step_indicator
    sources: ["formula:concat(current_step_key, ': ', current_step_name)"]
  - slot_name: check_status
    sources: ["view_embed:step-checks-compact"]
prop_bindings:
  - prop_name: onSend
    source: "action:Conversation/append"
  - prop_name: onCompleteStep
    source: "action:ProcessConversation/complete_step"
  - prop_name: onRewind
    source: "action:ProcessConversation/rewind"
  - prop_name: branchNav
    source: "widget_embed:message-branch-nav"
```

#### 6.4.3 Process Spec Editor Page

The authoring interface for designing processes. Uses the triple-zone entity page pattern.

**Layout: `process-spec-page`**

```yaml
layout: process-spec-page
kind: stack
direction: vertical
gap: spacing.md
children:
  # Structured zone: process metadata
  - area: structured
    display_mode: process-full
    placements:
      - source_field: name
        formatter: heading
        mutability: editable
      - source_field: version
        formatter: badge
      - source_field: status
        formatter: badge
      - source_field: description
        formatter: rich-text
        mutability: editable
      - source_field: owner
        formatter: entity-reference
        mutability: editable

  # Step graph editor (visual step/edge editor)
  - component_mapping: process-spec-editor-graph

  # Steps list (table view of all steps with inline editing)
  - view: process-steps-editor
    context:
      entity: "{{current_entity}}"

  # Unstructured zone: process documentation, notes
  - area: unstructured

  # Related zone: related processes, suites, syncs
  - area: related
    responsive:
      sm: { stacked: true }
      md: { visible: true }
```

**Process Steps Editor View:**

```yaml
view: process-steps-editor
title: "Steps"
dataSource:
  concept: StepRun
  action: list
  params:
    spec_ref: "{{context.entity}}"
layout: table
visibleFields:
  - field: step_key
    formatter: plain-text
    mutability: editable
  - field: step_type
    formatter: badge
    mutability: editable
  - field: order
    formatter: plain-text
    mutability: editable
  - field: checks
    formatter: json-count
    label_override: "Checks"
controls:
  - type: create
    label: "Add Step"
    action: StepRun/create
  - type: row-click
    action: navigate
    destination: "/steps/{{id}}"
  - type: row-action
    label: "Expand to Sub-Process"
    action: ProcessSpec/create  # creates child spec linked to this step
    visible_when: "step_type != subprocess"
  - type: row-action
    label: "Edit Sub-Process"
    action: navigate
    destination: "/processes/{{subprocess_ref}}"
    visible_when: "step_type = subprocess"
```

### 6.5 Widgets

#### 6.5.1 Existing Widgets (reused, no changes needed)

**Workflow Widgets:**

| Widget | Location | Role in Process System |
|--------|----------|----------------------|
| `workflow-editor` | `repertoire/widgets/domain/workflow-editor.widget` | Process graph authoring — drag nodes from palette, connect ports, configure steps. Already has `ProcessSpec` affordance binding. |
| `workflow-node` | `repertoire/widgets/domain/workflow-node.widget` | Individual step node with typed ports, status badge (pending/running/success/error), execution state FSM. |
| `execution-overlay` | `repertoire/concepts/process-foundation/widgets/execution-overlay.widget` | Runtime overlay — status-colored node highlights, active step pulse, animated flow edges, suspend/resume/cancel controls. Already has `ProcessRun` affordance. |
| `canvas` | `repertoire/widgets/domain/canvas.widget` | Available as alternative spatial layout if needed for freeform process design. |
| `minimap` | `repertoire/widgets/domain/minimap.widget` | Scaled overview of full process graph (composed by `workflow-editor`). |
| `state-machine-diagram` | `repertoire/widgets/domain/state-machine-diagram.widget` | State/transition editor for step FSM definitions. |
| `graph-view` | `repertoire/widgets/domain/graph-view.widget` | Force-directed graph for relationship exploration (process dependencies). |
| `message-branch-nav` | `repertoire/concepts/llm-conversation/widgets/message-branch-nav.widget` | Conversation branch navigation (N of M, left/right, edit-to-fork). |
| `context-breadcrumb` | (context widgets) | VersionSpace context indicator in shell chrome. |

**Diagramming Suite Concepts (for process visualization and export):**

| Concept | Location | Role in Process System |
|---------|----------|----------------------|
| `DiagramNotation` | `repertoire/concepts/diagramming/diagram-notation.concept` | Defines swappable diagram vocabularies (node types, edge types, connection rules). Use the **BPMN notation provider** for standards-compliant process diagrams, or **flowchart notation** for simpler views. Custom process-specific notations can be registered. |
| `BpmnNotationProvider` | `repertoire/concepts/diagramming/providers/bpmn-notation.concept` | ~30 BPMN node types (events, tasks, gateways, subprocesses, pools, lanes, data objects) + 3 edge types (sequence, message, association). The natural notation for process workflows. |
| `FlowchartNotationProvider` | `repertoire/concepts/diagramming/providers/flowchart-notation.concept` | Simpler alternative: process, decision, terminal, data, predefined-process nodes with sequence flow edges. Good for lightweight process views. |
| `AnalysisOverlay` | `repertoire/concepts/diagramming/analysis-overlay.concept` | Maps analysis results to visual attributes (node colors/sizes, edge highlights, cluster boundaries, heat maps). Non-destructive layers that toggle, stack, and remove. Use for: execution status heat maps, check pass/fail rate overlays, bottleneck visualization, step duration heat maps. |
| `AnalysisReport` | `repertoire/concepts/diagramming/analysis-report.concept` | Generates reports from graph analysis (ranked tables, partition summaries, path listings). Use for: process analytics, critical path analysis, step completion time reports, check failure rate tables. |
| `DiagramExport` | `repertoire/concepts/diagramming/diagram-export.concept` | Exports process diagrams to Mermaid, BPMN XML, DrawIO XML, SVG, PNG, PDF, D2, Dot, JSON. Supports round-trip metadata for re-import. |
| Layout providers | `repertoire/concepts/diagramming/providers/` | 7 auto-layout algorithms: hierarchical (default for processes), force-directed, tree, circular, grid, radial, constraint-based. |
| Route providers | `repertoire/concepts/diagramming/providers/` | 3 edge routing styles: orthogonal (right-angle BPMN-style), bezier (smooth curves), polyline (segmented). |

**Integration pattern:** The `workflow-editor` widget renders nodes and edges on a `canvas`. The `DiagramNotation` concept (with BPMN or flowchart provider) defines which node types appear in the palette and which connections are valid. The `AnalysisOverlay` concept layers runtime execution data (from `ProcessRun`/`StepRun` status) on top as a non-destructive overlay — equivalent to what `execution-overlay` does, but with richer analysis capabilities (heat maps, clustering, path highlighting). Process specs can be exported via `DiagramExport` to BPMN XML for interop with other BPM tools, or to Mermaid/SVG for documentation.

**Process Progress Widgets (existing):**

| Widget | Location | Role in Process System |
|--------|----------|----------------------|
| `step-indicator` | `repertoire/widgets/domain/step-indicator.widget` | Multi-step stepper with labeled steps, upcoming/current/completed states, check icons, connectors. Horizontal/vertical orientation, clickable navigation to completed steps. **Primary process progress widget.** |
| `progress-bar` | `repertoire/widgets/form-controls/progress-bar.widget` | Simple horizontal fill bar (determinate/indeterminate). For overall completion percentage. |
| `segmented-progress-bar` | `repertoire/widgets/domain/segmented-progress-bar.widget` | Color-coded segments by status (passing/failing/pending) with hover tooltips and legend. Ideal for check status summary display. |

#### 6.5.2 New Widgets (to be created via `/create-widget`)

##### `chat-panel` Widget

**Purpose:** Chat interface for conversational process execution. Shows messages, step context injections, check results inline, and branch navigation.

```
Anatomy: root, message-list, message, message-role-indicator, message-content, tool-call, tool-result, step-divider, check-inline, input-area, send-button, step-indicator, branch-nav
States: idle, composing, sending, waiting-for-ai, step-transitioning
Accessibility: role=log (aria-live=polite), input has role=textbox
Props: messages, stepIndicator, checkStatus, onSend, onCompleteStep, onRewind, branchNav
Slots: header (step indicator area), footer (input area), message-actions
```

##### `check-list` Widget

**Purpose:** Ordered checklist showing pass/fail status with expandable evidence/feedback.

```
Anatomy: root, check-item, check-icon, check-label, check-status, check-evidence, check-feedback, actions
States: idle, evaluating, expanded
Accessibility: role=list, check-items have role=listitem with aria-checked
Props: checks, checkStrategy, onEvaluate, onWaive, onReset, expandable
Slots: check-detail (expanded content area)
```

##### `rollup-review` Widget

**Purpose:** Side-by-side view of child checks mapped to parent checks during rollup. Allows editing, approving, or remapping.

```
Anatomy: root, parent-check-column, child-check-column, mapping-line, suggestion, approve-button, edit-area
States: idle, editing, reviewing
Props: parentChecks, childVerifications, suggestedMappings, onApprove, onEdit, onRemap
```

### 6.6 Version Space Integration in UI

When a user wants to try alternative approaches:

1. A **"Fork Reality"** control appears on the process run page (any tab).
2. Clicking it calls `VersionSpace/fork` scoped to the current ProcessRun.
3. The UI shows a **version space indicator** in the top bar (using the existing `context-breadcrumb` widget which serves the `context-stack` interactor).
4. The **workflow-editor** (with execution-overlay) shows forked branches as diverging paths with a visual indicator of which space is active.
5. A **"Compare Realities"** control opens a split view using the existing `diff-view` interactor, showing the `VersionSpace/diff` results.
6. **"Merge" / "Cherry Pick" / "Promote"** controls call the corresponding VersionSpace actions.

No new DisplayModes needed — the existing `context-breadcrumb`, `context-badge`, and `context-bar` widgets handle version context display. The `MultiverseView` already handles space management. We just need:

```yaml
# Additional controls on process-run-page
controls:
  - type: action
    label: "Fork Reality"
    action: VersionSpace/fork
    params:
      scope: "{{run_id}}"
      name: "{{prompt:Space name}}"
    icon: git-branch
  - type: action
    label: "Compare Realities"
    action: VersionSpace/diff
    icon: columns
    visible_when: "version_space != null"
  - type: action
    label: "Merge Reality"
    action: VersionSpace/merge
    icon: git-merge
    visible_when: "version_space != null"
```

### 6.7 Role-Based Visibility

Display modes and views respect `role_visibility` on FieldPlacements and Views. The process system uses this for:

1. **Level skipping:** A senior role sees rolled-up checks at a high level. The sub-process steps are hidden (or collapsed) for their role. They see the parent step with its rollup result, not the 15 child steps.

2. **Authoring vs. execution:** Users with `process.author` permission see the process-spec-editor-graph and step-editor controls. Users with only `process.execute` permission see the read-only step-full display mode.

3. **AI delegation configuration:** The `delegate` field (AgenticDelegate reference) on ProcessConversation is only visible/editable by users with `process.delegate` permission.

```yaml
# Example role_visibility on a FieldPlacement
- source_field: rollup_mapping
  formatter: json
  role_visibility: [process.author, admin]
  # Only visible to process authors and admins

# Example role_visibility on a View
view: process-steps-editor
role_visibility: [process.author, admin]
# Only process authors see the editor; others see read-only step list
```

### 6.8 Real-Time Collaboration

Multiple users can work on different steps of the same process simultaneously. The system supports this via:

1. **WorkItem assignment:** Each step's WorkItem is assigned to a specific user. The `my-work-items` board view shows only your assigned tasks.

2. **Live status updates:** ProcessEvent append-only stream drives real-time UI updates. The `run-dashboard` view subscribes to events for visible runs.

3. **Visibility rules:** ProcessVariable `visibility` scope controls who can see step outputs. A user can see another user's step progress if the process spec allows it, but not their in-progress work unless explicitly shared.

4. **Version space isolation:** Users working in different VersionSpaces see different realities. Changes in one space don't affect another until merged.

---

## 7. Process Lifecycle — End to End

### 7.1 Authoring a Process

1. Navigate to **Processes** → click **"New Process"**
2. Process Spec ContentNode created with `Process` schema → opens in `process-spec-page` layout
3. Add steps via the **Steps** table view — each step is a ContentNode with `ProcessStep` + `StepContext` + `StepInstructions` + `StepChecklist` mixins
4. For each step: fill in context (background, prerequisites), instructions (how-to, acceptance criteria), and checks (create Check ContentNodes, link them)
5. Define routing edges in the **workflow-editor** component (visual node-graph editor with drag-from-palette, port connections)
6. For steps that should expand to sub-processes: click **"Expand to Sub-Process"** → creates a child ProcessSpec linked to this step, setting `step_type: subprocess`
7. **Publish** the process (`ProcessSpec/publish` → status: active)

### 7.2 Starting a Process Run

1. From the process catalog, click a process → **"Start"**
2. Choose execution mode: Manual (human), Autonomous AI, Conversational (chat), or Triggered (per-step automation)
3. `ProcessRun/start` fires → `ExecutionDispatch/resolve` determines how each step routes
4. If conversational: `Conversation/create` + `ProcessConversation/bind` set up the chat bridge
5. Process run page opens in the appropriate default tab (Do for manual, Chat for conversational, Map for monitoring autonomous)

### 7.3 Executing a Step (Manual)

1. **Do** tab shows the `step-full` display mode
2. User reads context → follows instructions → does the work
3. Clicks **"Mark Complete"** → `StepRun/complete`
4. Checks evaluate (in configured order):
   - Automated checks run immediately
   - Human/LLM checks create WorkItems or LLMCalls
5. If all pass → `FlowToken` advances → next step activates
6. If any fail → feedback shown → user continues working → re-triggers checks

### 7.4 Executing a Step (Chat FSM)

1. **Chat** tab is active
2. AI appends a message explaining the step (context + instructions pulled from schemas)
3. User types a response / asks questions / gives instructions
4. AI performs edits (via `ProcessConversation/delegate_edit`, governed by `ai_authority`)
5. AI or user triggers **"Mark Step Complete"**
6. Checks run; failures appear as AI messages with feedback
7. On all pass, AI advances to next step — continues in the same conversation thread
8. User can say "let's try a different approach" → `ProcessConversation/rewind` → conversation forks, checkpoint restores

### 7.5 Executing a Step (Autonomous AI Agent)

1. **Map** tab shows the process graph with the agent's current position
2. `AgentLoop/create` with the step's instructions as the goal
3. Agent uses available tools (from `ToolRegistry`) to complete the step
4. Agent triggers `StepRun/complete` → checks run
5. If checks fail → agent receives feedback → retries (up to max attempts)
6. If checks pass → token advances → agent moves to next step
7. Human can intervene at any point via the **Map** or **Do** tab

### 7.6 Roaming Agent

1. Agent queries available processes via `AgentRole/match`
2. Filters by permission via `Permission/check`
3. Selects a process and calls `ProcessRun/start`
4. Executes steps as in 7.5
5. When process completes, discovers next available process

### 7.7 Recursive Sub-Process Expansion

1. Step has `step_type: subprocess` → `subprocess-step-dispatch` sync fires
2. Child `ProcessRun/start_child` creates a new run with `parent_run` set
3. Child process executes in the same mode as parent (or overridden per-step)
4. When all child steps complete → child `ProcessRun/complete`
5. `child-run-triggers-rollup` sync fires → `CheckVerification/rollup`
6. Rollup creates a WorkItem (or LLM/chat interaction) to review and merge child checks into parent checks
7. On rollup approval → parent `StepRun/complete` → parent process continues

### 7.8 Parallel Realities

1. User clicks **"Fork Reality"** on a running process
2. `VersionSpace/fork` creates a copy-on-write overlay
3. User (or AI) executes the process in the forked space
4. All reads/writes go through the overlay (via `version-aware-load`/`version-aware-save`)
5. User can fork again (recursive), switch between spaces, or cherry-pick results
6. **"Compare Realities"** shows `VersionSpace/diff` results in a split view
7. **"Merge Reality"** applies the winning approach to the parent space (or base)

---

## 8. New Suite Manifest

```yaml
# repertoire/concepts/process-verification/suite.yaml

suite: process-verification
version: 0.1.0
description: Check verification, rollup, and evaluation for process steps

concepts:
  required:
    - CheckVerification

uses:
  required:
    - process-foundation
  optional:
    - process-human      # for rollup work items
    - process-llm        # for LLM-judged checks

syncs:
  required:
    - check-evaluation-on-step-complete
    - check-strategy-stop-on-first
    - check-strategy-run-all
    - child-run-triggers-rollup
  recommended:
    - rollup-needs-edit-creates-work-item
  integration:
    - chat-check-failure-appends-feedback
```

```yaml
# repertoire/concepts/process-conversation/suite.yaml

suite: process-conversation
version: 0.1.0
description: Conversational process execution bridging Conversation to ProcessRun

concepts:
  required:
    - ProcessConversation
    - ExecutionDispatch

uses:
  required:
    - process-foundation
    - llm-conversation
  optional:
    - process-verification  # for check feedback in chat
    - process-human         # for work item fallback
    - process-reliability   # for checkpoints on rewind
    - multiverse            # for version space integration

syncs:
  required:
    - process-start-creates-conversation
    - conversation-step-advance
    - execution-mode-resolver
    - dispatch-to-chat
  recommended:
    - conversation-rewind-forks
    - chat-step-checks-on-complete
    - chat-check-failure-appends-feedback
    - dispatch-to-agent
  integration:
    - process-fork-creates-version-space
    - agent-discovers-available-processes
```

---

## 9. Schema YAML for Clef Base Integration

```yaml
# clef-base/suites/process-workflow/schema.yaml
# (Full version of Section 4.1 — ready for ConceptBrowser import)

schemas:
  Process:
    concept: ProcessSpec
    primary_set: specs
    manifest: content
    fields:
      name:        { from: name, type: String, required: true }
      version:     { from: version, type: String, required: true }
      status:      { from: status, type: Enum, allowed_values: [draft, active, deprecated], required: true }
      description: { type: RichText }
      owner:       { type: Reference }

  ProcessInstance:
    concept: ProcessRun
    primary_set: runs
    manifest: content
    fields:
      spec_ref:    { from: spec_ref, type: Reference, required: true }
      status:      { from: status, type: Enum, required: true, mutability: system }
      started_at:  { from: started_at, type: DateTime, mutability: system }
      ended_at:    { from: ended_at, type: DateTime, mutability: system }
      parent_run:  { from: parent_run, type: Reference, mutability: system }
      actor:       { type: Reference }
      actor_type:  { type: Enum, allowed_values: [human, ai_autonomous, ai_triggered, ai_conversational] }

  ProcessStep:
    concept: StepRun
    primary_set: steps
    manifest: content
    fields:
      step_key:    { from: step_key, type: String, required: true, mutability: readonly }
      step_type:   { from: step_type, type: Enum, required: true }
      status:      { from: status, type: Enum, required: true, mutability: system }
      attempt:     { from: attempt, type: Int, mutability: system }
      started_at:  { from: started_at, type: DateTime, mutability: system }
      completed_at: { from: completed_at, type: DateTime, mutability: system }

  StepContext:
    type: mixin
    fields:
      background:        { type: RichText }
      prerequisites:     { type: Reference, cardinality: unlimited }
      reference_materials: { type: Reference, cardinality: unlimited }
      estimated_effort:  { type: Enum, allowed_values: [trivial, small, medium, large, epic] }
      role_guidance:     { type: JSON }

  StepInstructions:
    type: mixin
    fields:
      how_to:            { type: RichText }
      acceptance_criteria: { type: RichText }
      tools_needed:      { type: Reference, cardinality: unlimited }
      tips:              { type: RichText }
      example_output:    { type: Reference }

  StepChecklist:
    type: mixin
    fields:
      checks:            { type: Reference, cardinality: unlimited }
      check_strategy:    { type: Enum, allowed_values: [stop_on_first_failure, run_all_report_all], default: run_all_report_all }
      rollup_mapping:    { type: JSON }
      composite_rule:    { type: JSON, default: '{ "provider": "all-pass" }', description: "Composite scoring provider + config for step pass/fail" }

  Check:
    fields:
      name:              { type: String, required: true }
      description:       { type: RichText }
      eval_mode:         { type: Enum, allowed_values: [automated, human, llm], required: true }
      automated_rule:    { type: JSON }
      pass_threshold:    { type: Float, default: 1.0 }
      order:             { type: Int, default: 0 }
      depends_on:        { type: Reference, cardinality: unlimited }
      feedback_template: { type: RichText }

  CheckResult:
    concept: CheckVerification
    primary_set: verifications
    manifest: content
    fields:
      check_ref:         { from: check_ref, type: Reference, required: true }
      step_ref:          { from: step_ref, type: Reference, required: true }
      status:            { from: status, type: Enum, required: true, mutability: system }
      score:             { from: result_score, type: Float, mutability: system }
      evidence:          { from: result_evidence, type: RichText, mutability: system }
      feedback:          { type: RichText, mutability: system }
      judge:             { from: judge, type: String, mutability: system }
      evaluated_at:      { from: evaluated_at, type: DateTime, mutability: system }
      waive_justification: { type: RichText }

  ProcessChat:
    concept: ProcessConversation
    primary_set: bindings
    manifest: config
    fields:
      process_run:   { from: process_run, type: Reference, required: true }
      conversation:  { from: conversation, type: Reference, required: true }
      current_step:  { from: current_step, type: Reference, mutability: system }
      mode:          { from: mode, type: Enum, allowed_values: [guided, freeform] }
      delegate:      { type: Reference, description: "AgenticDelegate record governing AI edit permissions" }

hooks:
  on_apply:
    ProcessStep: StepRun/initializeStep
  on_save:
    CheckResult: CheckVerification/onResultSaved
```

---

## 10. Seed Data

The following seed data would be created on suite installation:

### DisplayModes
- `process-card` (Schema: Process, mode: card)
- `process-full` (Schema: Process, mode: full)
- `step-full` (Schema: ProcessStep, mode: full)
- `step-compact` (Schema: ProcessStep, mode: compact)
- `work-item-card` (Schema: WorkItem, mode: card)
- `check-result-inline` (Schema: CheckResult, mode: inline)
- `chat-thread` (Schema: Conversation, mode: chat-thread)

### Views
- `process-catalog` (Process list, card-grid)
- `run-dashboard` (ProcessRun list, table)
- `my-work-items` (WorkItem board)
- `step-checks` (CheckVerification table, contextual)
- `process-chat` (Conversation detail, contextual)
- `process-steps-editor` (StepRun table, contextual)
- `check-overview` (CheckVerification table, global)

### Layouts
- `step-full-layout` (split: instructions + checks sidebar)
- `process-run-page` (stack: header + tabs + content)
- `process-spec-page` (stack: metadata + graph + steps + notes)

### ComponentMappings
- `process-step-indicator`
- `execution-mode-tabs`
- `process-map-graph`
- `chat-execution-panel`
- `process-spec-editor-graph`
- `chat-thread-mapping`
- `rollup-review-mapping`

### Compositions
- `process-step-defaults` (auto-apply StepContext + StepInstructions + StepChecklist to ProcessStep)

---

## 11. Implementation Order

This is organized by logical dependency, not phases. All items have VK cards.

### Layer 1: Foundation Schemas [VK: Layer 1 parent]
- [x] Define `schema.yaml` for process-workflow suite [VK card]
- [x] Define composition rules [VK card]
- [x] Create Check and CheckResult schemas [VK card]
- [x] Define mixin schemas (StepContext, StepInstructions, StepChecklist) [VK card]
- [x] Define ProcessChat schema [VK card]
- [x] Create seed DisplayModes and Views [VK card]

### Layer 2: CheckVerification Concept [VK: Layer 2 parent, blocked by Layer 1]
- [x] Create `CheckVerification` concept spec [VK card]
- [x] Create handler (functional style) [VK card]
- [x] Create check-evaluation syncs (+ check-strategy syncs) [VK card]
- [x] Create step-checks View and check-result-inline DisplayMode [VK card]
- [x] Create check-list widget spec [VK card]

### Layer 3: Process Content Integration [VK: Layer 3 parent, blocked by Layer 1]
- [x] Wire ProcessSpec/StepRun to ContentNode pool [VK card]
- [x] Create step-full DisplayMode and Layout [VK card]
- [x] Create process-spec-page Layout [VK card]
- [x] Create process-catalog View and process-card DisplayMode [VK card]
- [x] Create process-steps-editor View [VK card]

### Layer 4: Process Run UI [VK: Layer 4 parent, blocked by Layer 2 + 3]
- [x] Create run-dashboard View [VK card]
- [x] Create process-run-page Layout with three-mode tabs [VK card]
- [x] Create process-step-indicator ComponentMapping [VK card]
- [x] Verify `workflow-editor` and `execution-overlay` affordance bindings work for process use case [VK card]
- [x] Create process-map-graph and process-execution-overlay ComponentMappings [VK card]
- [x] Wire step navigation (node click → Do tab for that step) [VK card]

### Layer 5: Check Rollup [VK: Layer 5 parent, blocked by Layer 2]
- [x] Create child-run-triggers-rollup sync [VK card]
- [x] Create rollup-needs-edit-creates-work-item sync [VK card]
- [x] Create rollup-review widget spec and ComponentMapping [VK card]

### Layer 6: Execution Dispatch [VK: Layer 6 parent, blocked by Layer 3]
- [x] Create ExecutionDispatch concept spec [VK card]
- [x] Create execution dispatch syncs (resolver, dispatch-to-chat, dispatch-to-agent) [VK card]
- [x] Create execution-mode-tabs ComponentMapping [VK card]

### Layer 7: Conversational Process [VK: Layer 7 parent, blocked by Layer 6]
- [x] Create ProcessConversation concept spec [VK card]
- [x] Create handler (functional style) [VK card]
- [x] Create process-conversation syncs (5 syncs) [VK card]
- [x] Create chat-panel widget spec [VK card]
- [x] Create chat-execution-panel ComponentMapping and chat-thread DisplayMode [VK card]
- [x] Create process-chat View [VK card]
- [x] Create chat-delegate-checks-authority sync [VK card]

### Layer 8: Agent Integration [VK: Layer 8 parent, blocked by Layer 2 + 6]
- [x] Create agent-discovers-available-processes sync [VK card]
- [x] Wire AgentLoop step completion to CheckVerification [VK card]
- [x] Create my-work-items View + work-item-card DisplayMode [VK card]

### Layer 9: Version Space Integration [VK: Layer 9 parent, blocked by Layer 4]
- [x] Create process-fork-creates-version-space sync [VK card]
- [x] Add Fork Reality / Compare / Merge controls to process-run-page [VK card]
- [x] Verify version-aware-load/save work with process ContentNodes [VK card]
- [x] Test recursive VersionSpace forking within sub-processes [VK card]

### Cross-cutting [VK: direct children of epic]
- [x] Create process-verification suite.yaml [VK card, blocked by Layer 2 + 5]
- [x] Create process-conversation suite.yaml [VK card, blocked by Layer 6 + 7]
- [x] Add Automation navigation destinations [VK card, blocked by Layer 1]
- [x] Create check-overview View [VK card, blocked by Layer 2]
- [x] Register check-evaluator PluginRegistry providers [VK card, blocked by Layer 2]
- [x] Register composite-scorer PluginRegistry providers [VK card, blocked by Layer 2]
- [x] Create process-health analytics View [VK card, blocked by Layer 4]
- [x] Create step-bottlenecks analytics View [VK card, blocked by Layer 4]
- [x] Create check-failures analytics View [VK card, blocked by Layer 4]
- [x] Role-based visibility configuration [VK card, blocked by Layer 4]
- [x] Wire real-time collaboration: ProcessEvent subscriptions + visibility rules [VK card, blocked by Layer 4]
- [x] Create process-completion-trend and process-step-breakdown analytics sub-views [VK card, blocked by process-health card]

---

## 12. Resolved Design Decisions

### 12.1 Check Evaluation: PluginRegistry Providers

Automated check evaluation uses the standard **coordination + provider pattern** via PluginRegistry. The Check schema's `automated_rule` field specifies a provider name + config. The `CheckVerification/evaluate` action dispatches to the named provider.

**Provider type:** `check-evaluator`

**Built-in providers:**

| Provider | Purpose | `automated_rule` config |
|----------|---------|------------------------|
| `FormulaCheckEvaluator` | Evaluates a Formula expression against step/process context. For simple checks: field validation, threshold comparisons, existence checks. | `{ provider: "formula", expression: "output.word_count >= 500" }` |
| `ValidatorCheckEvaluator` | Delegates to the existing Validator concept with schema rules. | `{ provider: "validator", schema: "ArticleQuality", rules: ["has_title", "has_body"] }` |
| `ApiCallCheckEvaluator` | Calls an external API and checks the response. | `{ provider: "api", url: "https://...", method: "POST", pass_condition: "response.status == 'ok'" }` |
| `TestRunnerCheckEvaluator` | Runs a test suite and checks results. | `{ provider: "test-runner", suite: "integration", pass_threshold: 1.0 }` |
| `LLMJudgeCheckEvaluator` | Sends check criteria + step output to an LLM for judgment. | `{ provider: "llm-judge", prompt: "Does this meet the criteria?", model: "default" }` |

**Dispatch sync:**

```
sync check-evaluator-dispatch
  when CheckVerification/evaluate: [cv: ?cv] => evaluating
  where
    query Check: { automated_rule: ?rule } for check_ref of ?cv
    query PluginRegistry: resolve("check-evaluator", ?rule.provider)
  then
    CheckEvaluatorProvider/evaluate: [cv: ?cv; config: ?rule]
```

New providers are registered via PluginRegistry like any other provider — no concept changes needed.

### 12.2 Step Output Rendering: Standard display-as Pattern

When a step's output is a ContentNode (e.g., a process that creates another ProcessSpec), it renders via the **standard Clef Base embedding pattern** — not a process-specific UI.

The step's unstructured zone (content body) can embed any ContentNode via `((block-ref))` or Reference field. The `display-as` picker lets the user choose which Schema + DisplayMode to render the embedded content as. This works identically whether the output is a ProcessSpec, an Article, a Canvas, or any other ContentNode.

**No new DisplayMode needed.** The existing `workflow-editor` widget already has an affordance binding for `ProcessSpec`, so when a ProcessSpec ContentNode is embedded in a step's body and displayed as "Process", it renders as the interactive node-graph editor.

This is a general Clef Base capability, not process-specific.

### 12.3 AI Delegation: AgenticDelegate

The `ai_authority` field on ProcessConversation is replaced with a Reference to an **AgenticDelegate** record from the governance-identity suite.

AgenticDelegate already models:
- **Who delegates** (the user)
- **To whom** (the AI agent identity)
- **What permissions** are delegated (scoped action list)
- **Constraints** (time-bound, revocable, conditional)

The `ProcessConversation/delegate_edit` action checks the AgenticDelegate record:

```
sync chat-delegate-checks-authority
  when ProcessConversation/delegate_edit: [pc: ?pc; action: ?act; params: ?p]
  where
    query AgenticDelegate: { delegator: user_of(?pc), delegate: ai_of(?pc) } as ?ad
    query Permission: check(?ad, ?act) => granted
  then
    // proceed with the action
```

If no AgenticDelegate exists or the action is outside scope → `denied` variant returned, feedback appended to conversation.

**Schema update:** Replace `ai_authority: { type: JSON }` with `delegate: { type: Reference, description: "AgenticDelegate record governing AI edit permissions" }` on the ProcessChat schema.

### 12.4 Composite Scoring: PluginRegistry Providers

Composite step-level scoring (aggregating individual check results into a step pass/fail decision) uses the same **coordination + provider pattern**.

**Provider type:** `composite-scorer`

**Built-in providers:**

| Provider | Purpose | Config |
|----------|---------|--------|
| `FormulaCompositeScorer` | Evaluates a Formula expression over aggregated check results. Vars: `scores`, `pass_count`, `fail_count`, `total`, `avg_score`. | `{ provider: "formula", expression: "pass_count == total" }` |
| `WeightedAverageScorer` | Weighted average of check scores with per-check weights. | `{ provider: "weighted-avg", weights: { "check-1": 2.0, "check-2": 1.0 }, threshold: 0.8 }` |
| `MajorityVoteScorer` | Pass if N of M checks pass. | `{ provider: "majority", required: 3 }` |
| `AllPassScorer` | Simple: all checks must pass. The default. | `{ provider: "all-pass" }` |

**StepChecklist schema update:**

```yaml
composite_rule:
  type: JSON
  default: '{ "provider": "all-pass" }'
  description: "Composite scoring provider + config for aggregating check results into step pass/fail"
```

**Dispatch sync:**

```
sync composite-score-after-checks
  when CheckVerification/evaluate: all checks for step ?s complete
  where
    query StepChecklist: { composite_rule: ?rule } for ?s
    query PluginRegistry: resolve("composite-scorer", ?rule.provider)
  then
    CompositeScorerProvider/score: [step: ?s; results: all_check_results(?s); config: ?rule]
```

### 12.5 Process Analytics: View + DisplayMode Aggregator Pattern

Analytics views use the standard View + DisplayMode pattern — data-driven, not custom components. Each view queries ProcessMetric/ProcessEvent/CheckVerification data and renders through existing display types (table, card-grid, graph) with existing widgets (segmented-progress-bar, gauge, step-indicator).

#### 12.5.1 Process Health Dashboard View (`process-health`)

**Purpose:** Aggregated stats across all runs of a ProcessSpec.

```yaml
view: process-health
title: "Process Health"
dataSource:
  concept: ProcessMetric
  action: aggregate
  params:
    spec_ref: "{{context.entity}}"
    window: "30d"
layout: stack
children:
  # Row 1: KPI stat cards
  - view: process-health-stats
  # Row 2: Status distribution + completion trend
  - kind: split
    children:
      - view: process-status-distribution
      - view: process-completion-trend
  # Row 3: Step-level breakdown table
  - view: process-step-breakdown
```

```yaml
view: process-health-stats
title: "Overview"
dataSource:
  concept: ProcessMetric
  action: aggregate
  params:
    spec_ref: "{{context.entity}}"
    metrics: [completion_rate, avg_duration, failure_rate, active_runs]
layout: card-grid
defaultDisplayMode: stat-card
visibleFields:
  - field: metric_name
    formatter: heading
  - field: value
    formatter: plain-text
  - field: trend
    formatter: badge
    formatter_options:
      colors: { up: green, down: red, flat: gray }
```

```yaml
view: process-status-distribution
title: "Run Status Distribution"
dataSource:
  concept: ProcessRun
  action: list
  params:
    spec_ref: "{{context.entity}}"
layout: table
groups:
  field: status
defaultDisplayMode: status-segment
# Renders as segmented-progress-bar via ComponentMapping:
component_mapping: process-status-segments
```

```yaml
componentMapping: process-status-segments
widget_id: segmented-progress-bar
prop_bindings:
  - prop_name: showLegend
    source: "static_value:true"
  - prop_name: showTotal
    source: "static_value:true"
  - prop_name: size
    source: "static_value:lg"
```

#### 12.5.2 Step Bottleneck View (`step-bottlenecks`)

**Purpose:** Which steps take longest, fail most often, get rewound most.

```yaml
view: step-bottlenecks
title: "Step Bottlenecks"
dataSource:
  concept: ProcessMetric
  action: step_metrics
  params:
    spec_ref: "{{context.entity}}"
    window: "30d"
layout: table
sorts:
  - field: avg_duration
    direction: desc
visibleFields:
  - field: step_key
    formatter: plain-text
    label_override: "Step"
  - field: avg_duration
    formatter: plain-text
    label_override: "Avg Duration"
  - field: failure_rate
    formatter: badge
    formatter_options:
      colors: { high: red, medium: amber, low: green }
    label_override: "Failure Rate"
  - field: rewind_count
    formatter: plain-text
    label_override: "Rewinds"
  - field: check_failure_rate
    formatter: badge
    formatter_options:
      colors: { high: red, medium: amber, low: green }
    label_override: "Check Failures"
  - field: completion_count
    formatter: plain-text
    label_override: "Completions"
controls:
  - type: row-click
    action: navigate
    destination: "/steps/{{step_key}}"
```

For visual bottleneck analysis on the process graph, the **AnalysisOverlay** concept from the diagramming suite layers a heat map on the `workflow-editor`:

```yaml
componentMapping: bottleneck-heat-map
widget_id: execution-overlay
scope_schema: Process
prop_bindings:
  - prop_name: mode
    source: "static_value:static"  # not live, historical analysis
```

The AnalysisOverlay would be configured with:
- Node color → `avg_duration` (green=fast, red=slow)
- Node size → `failure_rate` (bigger=more failures)
- Edge thickness → `traversal_count` (thicker=more traveled)

#### 12.5.3 Check Failure Report View (`check-failures`)

**Purpose:** Which checks fail most, across which steps, with what feedback.

```yaml
view: check-failures
title: "Check Failure Analysis"
dataSource:
  concept: CheckVerification
  action: list
  params:
    status: "failing"
    window: "30d"
layout: table
sorts:
  - field: failure_count
    direction: desc
groups:
  field: check_ref
visibleFields:
  - field: check_ref
    formatter: entity-reference
    label_override: "Check"
  - field: step_ref
    formatter: entity-reference
    label_override: "Step"
  - field: failure_count
    formatter: plain-text
    label_override: "Failures"
  - field: avg_score
    formatter: plain-text
    label_override: "Avg Score"
  - field: most_common_feedback
    formatter: truncate
    formatter_options: { length: 80 }
    label_override: "Common Feedback"
  - field: last_failed_at
    formatter: date-relative
    label_override: "Last Failed"
filters:
  - field: step_ref
    type: toggle-group
  - field: eval_mode
    type: toggle-group
    options: [automated, human, llm]
controls:
  - type: row-click
    action: navigate
    destination: "/checks/{{id}}"
```

#### 12.5.4 Navigation — Analytics Destination

```typescript
{ name: 'Process Analytics', href: '/analytics', group: 'Automation', targetConcept: 'ProcessMetric', targetView: 'process-health' }
```

#### 12.5.5 Analytics Seed Data

**Views:**
- `process-health` (aggregated KPI dashboard)
- `process-health-stats` (stat cards)
- `process-status-distribution` (segmented-progress-bar)
- `process-completion-trend` (chart — uses existing `chart` widget)
- `process-step-breakdown` (table of per-step metrics)
- `step-bottlenecks` (table sorted by duration/failure)
- `check-failures` (table grouped by check)

**ComponentMappings:**
- `process-status-segments` (segmented-progress-bar for run status)
- `bottleneck-heat-map` (AnalysisOverlay on workflow-editor)

**DisplayModes:**
- `stat-card` (Schema: ProcessMetric, mode: card) — single KPI with trend indicator
