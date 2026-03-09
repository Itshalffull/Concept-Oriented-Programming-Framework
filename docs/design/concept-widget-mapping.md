# Concept-Level Widget Mapping

**Status:** Proposal
**Date:** 2026-03-03
**Surface Spec Version:** v0.4.0

## Problem

Surface's current widget selection pipeline operates at the **field level**:

```
concept field → Interactor/classify → Affordance/match → WidgetResolver/resolve → widget
```

This produces correct, functional UIs — every `String` field gets a text input, every `DateTime` gets a date picker, every enum gets a radio group. But the result is **generic**. An `Approval` concept renders identically to an `Article` concept: a flat form with auto-selected field widgets.

Domain-specific concepts deserve domain-specific rendering. When a user sees an Approval, they expect a status badge with action buttons, not three text inputs. When they see a Workflow, they expect a node graph, not a detail form. The information architecture of a concept — what it *means* in the domain — should influence how it renders, not just the types of its individual fields.

Today, achieving this requires Level 1+ customization: manually specifying `widget: "approval-card"` in interface overrides. There is no mechanism for a widget to declare "I know how to render Approval concepts" the way it can declare "I know how to render single-choice interactions."

## Design Principle

Follow the existing affordance pattern exactly. Field-level affordances say:

> "I can serve `single-choice` interactions when `maxOptions < 8`"

Concept-level affordances should say:

> "I can serve `Approval` concepts when `view: detail` and `platform: browser`"

Same matching algorithm. Same specificity scoring. Same override mechanism. The new layer sits **above** the field pipeline — it's checked first, and if a concept-level match is found, the entire field-level pipeline is bypassed for that concept instance.

## Proposal

### 1. New Interactor Category: `entity`

Extend the Interactor taxonomy with a new top-level category for whole-concept rendering:

```
Interactor
├─ selection       (single-choice, multi-choice, ...)
├─ edit            (text-short, date-point, ...)
├─ control         (action-primary, submit, ...)
├─ output          (display-text, display-badge, ...)
├─ composition     (group-fields, group-repeating, ...)
└─ entity          ← NEW
   ├─ entity-detail        # Full single-instance view
   ├─ entity-card          # Compact summary (for lists, dashboards)
   ├─ entity-row           # Table row representation
   ├─ entity-inline        # Inline mention / chip
   ├─ entity-editor        # Full editing surface
   └─ entity-graph         # Graph/canvas visualization
```

These are **view-shape** interactors — they describe *how much space and attention* an entity gets, not what domain it belongs to. The domain specificity comes from affordance conditions.

### 2. Concept Affordance Declarations in `.widget` Files

Extend the `.widget` affordance block with a `concept` condition:

```widget
# approval-card.widget

anatomy {
  root:         container  { Card wrapper }
  statusBadge:  container  { Visual status indicator }
  title:        text       { Approval title }
  requester:    text       { Who requested }
  approver:     text       { Assigned approver }
  reasoning:    text       { Approval reasoning }
  actions:      container  { Approve/reject buttons }
  timeline:     container  { Status change history }
}

# ... states, accessibility, props, connect ...

affordance {
  serves: entity-detail
  specificity: 20
  when {
    concept: "Approval"
  }
}

affordance {
  serves: entity-card
  specificity: 20
  when {
    concept: "Approval"
  }
}
```

The `concept` condition matches against the concept name from the bound concept spec. Multiple conditions compose with AND:

```widget
# workflow-editor.widget

affordance {
  serves: entity-editor
  specificity: 20
  when {
    concept: "Workflow"
    platform: "browser"           # Only on browser (needs canvas)
  }
}

affordance {
  serves: entity-detail           # Fallback for non-browser
  specificity: 15
  when {
    concept: "Workflow"
    platform: "mobile"
  }
}
```

### 3. Suite-Level Matching via Tags

Not every domain concept has a named widget. But suites can provide default rendering for their concepts via tag matching:

```widget
# governance-entity-card.widget
# Ships with the governance suite

affordance {
  serves: entity-card
  specificity: 12                   # Lower than concept-specific
  when {
    suite: "governance"             # Matches any concept in governance suite
  }
}
```

The matching hierarchy by specificity:

| Match Type | Typical Specificity | Example |
|------------|-------------------|---------|
| Exact concept name | 20 | `concept: "Approval"` |
| Suite tag | 12 | `suite: "governance"` |
| Generic entity interactor | 5 | `serves: entity-detail` (no concept condition) |
| Field-level fallback | 0 | Current pipeline (no entity match) |

### 4. Concept-Level Classification

Extend `UISchema/inspect` to emit an **entity-level element** alongside the field-level element tree:

```
UISchema/inspect(conceptSpec: Approval)
→ {
    entityElement: {
      kind: "entity",
      concept: "Approval",
      suite: "governance",
      tags: ["stateful", "approvable"],
      fields: [ ... ]               # Field elements (existing)
    },
    elements: [ ... ]               # Field-level elements (existing, unchanged)
  }
```

A new sync feeds the entity element into the resolution pipeline:

```sync
sync EntityElementClassified {
  when UISchema/inspect: => ok(entityElement)
  then Interactor/classify:
    fieldType: "entity"
    constraints: {
      concept: entityElement.concept
      suite: entityElement.suite
      tags: entityElement.tags
    }
}
```

Interactor classifies based on context:

| Context | Entity Interactor |
|---------|------------------|
| Host view = "detail" | `entity-detail` |
| Host view = "list" (each item) | `entity-card` |
| Host view = "list" (table mode) | `entity-row` |
| Inline reference from another concept | `entity-inline` |
| Host view = "edit" | `entity-editor` |
| Host view = "graph" | `entity-graph` |

### 5. Resolution Flow

The full pipeline with concept-level mapping:

```
.concept spec
  ↓ Binding/bind
  ↓ UISchema/inspect
  ↓
  ├─── Entity element ──→ Interactor/classify("entity") ──→ entity-detail
  │                        ↓
  │                   WidgetResolver/resolve(
  │                     interactor: "entity-detail",
  │                     context: { concept: "Approval", suite: "governance", platform: "browser" }
  │                   )
  │                        ↓
  │                   ┌─ Match found (specificity 20): "approval-card" widget
  │                   │   → Widget/get("approval-card")
  │                   │   → Machine/spawn
  │                   │   → FrameworkAdapter/render
  │                   │   → DONE (field pipeline skipped)
  │                   │
  │                   └─ No match: fall through to field pipeline ↓
  │
  └─── Field elements ──→ Interactor/classify(per field) ──→ WidgetResolver/resolve(per field)
                           → Widget/get(per field) → Machine/spawn(per field)
                           → Layout/arrange → FrameworkAdapter/render
```

The key insight: **concept-level resolution is tried first**. If a domain widget matches, the field pipeline is never run for that concept instance. If no domain widget matches, the existing field-level pipeline runs unchanged.

### 6. Widget Contracts: How Widgets Know the Shape

This is the hard part. When `approval-detail` matches `Approval`, how does the widget know what fields exist, what they're called, and how to wire its anatomy to them?

Field-level widgets don't have this problem — a `text-input` receives one value via one signal. But a domain widget like `workflow-editor` needs `nodes`, `edges`, `workflowName`, and an `execute` command — specific named props that must map to specific concept fields. Today's `workflow-editor.widget` declares `props { nodes: list WorkflowNode; edges: list WorkflowEdge }` but nothing connects `Workflow.steps` → `nodes`.

The solution is a **`requires` block** — a structural contract declaring the shape the widget needs, independent of any specific concept's field names:

```widget
# approval-detail.widget

requires {
  # Structural shape — NOT concept field names
  fields {
    status: enum                     # Must have an enum field for status
    actor: entity                    # Must have an entity reference (approver, reviewer, etc.)
    body: String                     # Must have a text field (reasoning, justification, etc.)
  }
  actions {
    approve: { }                     # Must have an approval action
    reject: { }                      # Must have a rejection action
  }
}
```

This is **structural typing** — the widget says what shape it needs, not which concept it expects. The `concept: "Approval"` in the affordance block handles *selection*; the `requires` block handles *binding*.

#### 6.1 Field Resolution: How Names Get Matched

When a widget is selected for a concept, a **field resolution** step maps concept state fields to widget contract slots. Three strategies, tried in order:

**1. Exact name match** — concept field name equals contract slot name:

```
Approval.status → requires.status     ✓ exact match
```

**2. Explicit mapping in the affordance** — when names differ:

```widget
affordance {
  serves: entity-detail
  specificity: 20
  when { concept: "Approval" }
  bind {
    actor: approver                  # concept field "approver" → contract slot "actor"
    body: reasoning                  # concept field "reasoning" → contract slot "body"
  }
}
```

The `bind` block in an affordance declaration says: "when I serve this concept, map these fields." This keeps the contract generic (any concept with an `actor`) while the affordance handles concept-specific naming.

**3. Type-based inference** — when there's exactly one concept field matching the contract slot's type:

```
Contract slot: actor (type: entity)
Concept fields: approver (type: User → entity), status (type: enum), reasoning (type: String)
→ Only one entity field → auto-bind approver → actor
```

Type inference is a fallback. If it's ambiguous (multiple entity fields), the system requires an explicit `bind` mapping and reports a diagnostic.

#### 6.2 The Full Resolution Algorithm

```
1. Widget selected via affordance match
2. Read widget's requires block → contract slots
3. Read concept's state fields → available fields
4. For each contract slot:
   a. Check affordance bind block for explicit mapping → use if found
   b. Check for exact name match in concept fields → use if found
   c. Check for unambiguous type match → use if found
   d. No match → resolution error (widget cannot render this concept)
5. For each contract action:
   a. Check affordance bind block → use if found
   b. Check for exact name match in concept actions → use if found
   c. No match → action unavailable (widget disables that control)
6. Generate signal map: contract slot names → concept field signals
```

The output is a **resolved binding map** that Binding uses to create signals:

```
Resolved binding for approval-detail + Approval:
  status  → approval.status    (Signal<enum>)
  actor   → approval.approver  (Signal<User>)   # via affordance bind
  body    → approval.reasoning (Signal<String>)  # via affordance bind
  approve → approval.approve   (Command)
  reject  → approval.reject    (Command)
```

#### 6.3 Connect Blocks Use Contract Names

The widget's `connect` block references **contract slot names**, not concept field names:

```widget
# approval-detail.widget

connect {
  statusBadge -> {
    data-status: $status;                                    # contract slot "status"
    aria-label: concat("Status: ", $status);
  }
  actorDisplay -> {
    text: $actor.name;                                       # contract slot "actor"
  }
  bodyText -> {
    text: $body;                                             # contract slot "body"
  }
  approveButton -> {
    onClick: command($approve);                              # contract action "approve"
    disabled: if $status != "pending" then true else false;
  }
  rejectButton -> {
    onClick: command($reject);                               # contract action "reject"
    disabled: if $status != "pending" then true else false;
  }
}
```

The `$slotName` syntax reads from the resolved binding map. The widget never knows the concept called it `approver` vs. `reviewer` — it only knows `actor`.

#### 6.4 Worked Example: workflow-editor + Workflow

The `workflow-editor.widget` already has `props { nodes: list WorkflowNode; edges: list WorkflowEdge }`. With contracts:

```widget
# workflow-editor.widget

requires {
  fields {
    nodes: list Object               # Step/node collection
    edges: list Object               # Connection/edge collection
    name: String                     # Workflow title
  }
  actions {
    execute: { }                     # Run the workflow
  }
}

affordance {
  serves: entity-editor
  specificity: 20
  when { concept: "Workflow" }
  bind {
    nodes: steps                     # Workflow.steps → contract.nodes
    edges: connections               # Workflow.connections → contract.edges
    name: workflowName               # Workflow.workflowName → contract.name
  }
}
```

The `connect` block uses `$nodes`, `$edges`, `$name` — the contract names. The `bind` block in the affordance translates between the Workflow concept's field names and the widget's expected slots.

### 7. Multi-Concept Widgets

Real domain views rarely show a single concept in isolation. An approval detail page shows the Approval, a Comments thread, and an ActionLog timeline. A project dashboard shows WorkItems, Milestones, and Members simultaneously.

This is your question about "what if they need info from multiple concepts?" — and it's the most architecturally significant part of the proposal.

#### 7.1 The Problem

Today's Binding creates signals for **one concept**. A domain widget that needs `Approval + Comment + ActionLog` would need three separate bindings, coordinated so they reference the same approval instance.

#### 7.2 The Solution: `requires` Declares Multiple Concept Roles

Extend the `requires` block to declare **named concept roles** — each role is a separate concept binding with its own contract:

```widget
# approval-detail.widget

requires {
  # Primary concept — this is what the widget was matched against
  primary {
    fields {
      status: enum
      actor: entity
      body: String
    }
    actions {
      approve: { }
      reject: { }
    }
  }

  # Additional concept roles — each gets its own binding
  comments {
    source: "Comment"                # Concept name (or structural contract)
    relation: "parentId = primary.id" # How to filter/join
    fields {
      entries: collection            # The comment list
    }
    actions {
      add: { body: String }          # Add a comment
    }
    optional: true                   # Widget works without this
  }

  history {
    source: "ActionLog"
    relation: "entityId = primary.id"
    fields {
      entries: collection
    }
    optional: true
  }
}
```

Each role beyond `primary` declares:
- **`source`** — which concept to bind (by name, or by structural contract)
- **`relation`** — how this concept relates to the primary (filter/join expression)
- **`optional`** — whether the widget degrades gracefully without it (show/hide that section)

#### 7.3 Multi-Binding Syncs

When a multi-concept widget is resolved, the system creates **one Binding per role**:

```sync
sync EntityWidgetCreatesSecondaryBindings [eager]
when {
  WidgetResolver/resolve: [ element: ?element ]
    => ok(widget: ?widgetName; score: ?_)
}
where {
  ?element.kind == "entity"
  Widget/get: [ widget: ?widgetName ] => ok(ast: ?ast)
  ?ast.requires has secondaryRoles
}
then {
  # For each secondary role in requires:
  Binding/bind: [
    binding: concat(?element.id, "/", role.name);
    concept: role.source;
    mode: "coupled";
    filter: role.relation
  ]
}
```

The connect block references secondary roles by name:

```widget
connect {
  # Primary concept fields
  statusBadge -> { data-status: $primary.status; }
  actorDisplay -> { text: $primary.actor.name; }

  # Comments (secondary role)
  commentThread -> {
    data-count: $comments.entries.length;
    hidden: if not $comments then true else false;   # Graceful degradation
  }

  # History timeline (secondary role)
  timeline -> {
    data-count: $history.entries.length;
    hidden: if not $history then true else false;
  }
}
```

#### 7.4 Compose for Secondary Roles

Domain widgets delegate secondary roles to sub-widgets via `compose`, using the same entity pipeline recursively:

```widget
# approval-detail.widget

compose {
  # Primary UI
  approveButton: widget("button", { variant: "filled", label: "Approve" });
  rejectButton:  widget("button", { variant: "danger", label: "Reject" });
  statusBadge:   widget("badge", { value: $primary.status });

  # Secondary: delegate to whatever widget serves Comment as entity-card
  commentThread: entity("Comment", {
    view: "entity-list",
    filter: $comments.relation
  });

  # Secondary: delegate to timeline widget via entity resolution
  timeline: entity("ActionLog", {
    view: "entity-card",
    filter: $history.relation
  });
}
```

The `entity()` function in `compose` invokes the entity pipeline recursively — it looks up what widget serves `Comment` as `entity-list` and renders it. This means:

- If the collaboration suite ships a `comment-thread.widget` with `affordance { serves: entity-list; when { concept: "Comment" } }`, it renders as a threaded discussion
- If no domain widget exists for Comment, it falls through to the field-level pipeline and renders as a generic list
- The approval-detail widget doesn't need to know — it delegates via `entity()` and the resolution pipeline handles it

#### 7.5 How Secondary Concepts Are Discovered

When the widget declares `source: "Comment"`, how does the system know which Comment instances to bind? Three mechanisms:

**1. Relation expression** — the `relation` field in the requires block:
```
relation: "parentId = primary.id"
```
This becomes a filter on the Binding. The system queries Comment instances where `parentId` matches the current Approval's id.

**2. Sync-declared relationships** — if the suite already has syncs wiring Approval to Comment, the system can discover the relationship from the sync graph:
```sync
# Already exists in collaboration suite
sync ApprovalCommented {
  when Comment/create: [comment: ?c, parentType: "Approval", parentId: ?id]
    => ok(comment: ?c)
  then Notification/send: [...]
}
```
The sync graph reveals that Comment has a `parentId` → `Approval` relationship.

**3. Explicit wiring in derived concepts** — if the app defines a derived concept that composes Approval + Comment + ActionLog, the derivation's sync declarations provide the binding map. This is the cleanest approach for complex compositions:
```concept
derived ApprovalWorkspace {
  uses Approval, Comment, ActionLog

  sync CommentsBelongToApproval {
    when Comment/create: [parentId: ?aid] => ok
    where Approval: { ?a id: ?aid }
    then ActionLog/record: [entity: ?aid, action: "commented"]
  }
}
```
The derived concept is itself a valid concept URI — the widget can bind to `ApprovalWorkspace` and get all three concepts' state through a single entity resolution.

#### 7.6 Multi-Concept Binding Summary

| Mechanism | Use Case | Widget Knows |
|-----------|----------|-------------|
| `requires.primary` | The matched concept | Contract shape only |
| `requires.{role}` with `source` | Named secondary concept | Concept name + relation |
| `compose` with `entity()` | Delegated sub-rendering | Concept name + view shape |
| Derived concept | Pre-composed multi-concept | Single composed entity |

The derived concept approach is the most "Clef-native" — it composes concepts at the concept layer, not the widget layer, and the widget just binds to the composed result. But `requires` with secondary roles is pragmatic for common patterns (comments, timeline, attachments) that almost every domain entity needs.

### 7. Concept Spec Side: Optional `surface` Annotation

Concepts can optionally declare rendering preferences without depending on Surface:

```concept
@version(1)
concept Approval [A, U] {
  purpose "Track and resolve approval requests"

  annotations {
    surface {
      preferredView: "entity-detail"       # Hint, not a hard requirement
      tags: ["stateful", "approvable"]     # Used in suite-level matching
    }
  }

  state { ... }
  actions { ... }
}
```

This is a **hint** stored in the concept manifest's `annotations` field. Surface reads it during `UISchema/inspect` but is not required to honor it. Concepts remain independent — they never reference widgets by name.

### 8. Syncs

Three new syncs integrate concept-level mapping into the existing pipeline:

```sync
sync EntityClassification {
  purpose "Classify entity element from UISchema inspection"

  when UISchema/inspect: schema => ok
  where UISchema/getEntityElement: schema => ok(entityElement)
  then Interactor/classify:
    fieldType: "entity"
    constraints: entityElement.constraints
    intent: entityElement.annotations.surface
}
```

```sync
sync EntityResolution {
  purpose "Resolve entity interactor to domain widget before field pipeline"

  when Interactor/classify: element => ok(interactorType, confidence)
  where interactorType starts-with "entity-"
  where Viewport/current: => ok(breakpoint)
  where Host/current: => ok(host)
  then WidgetResolver/resolve:
    element: element
    context: {
      interactorType: interactorType
      concept: element.concept
      suite: element.suite
      tags: element.tags
      platform: host.platform
      viewport: breakpoint
    }
}
```

```sync
sync EntityResolutionBypassesFieldPipeline {
  purpose "When entity widget resolved, skip per-field resolution"

  when WidgetResolver/resolve: element => ok(widget, score)
  where element.kind == "entity"
  then Host/trackResource: host, "entity-widget", widget
  then UISchema/markResolved: schema
  -- UISchema/markResolved prevents UISchema/getElements from firing,
  -- which prevents the field-level classification cascade
}
```

### 9. Worked Example: Governance Suite

The governance suite ships with concepts (`Approval`, `Polity`, `Constitution`, `Escalation`, etc.) and can ship matching domain widgets:

```
repertoire/suites/governance/
├── suite.yaml
├── concepts/
│   ├── approval.concept
│   ├── polity.concept
│   ├── constitution.concept
│   └── escalation.concept
├── syncs/
│   └── ...
└── widgets/                          ← NEW: suite-bundled widgets
    ├── approval-card.widget
    ├── approval-detail.widget
    ├── polity-dashboard.widget
    ├── constitution-viewer.widget
    └── governance-entity-card.widget  # Suite-level fallback
```

The `suite.yaml` registers widget affordances:

```yaml
name: governance
version: 0.1.0
description: Voting, approval, and organizational governance

concepts:
  - approval
  - polity
  - constitution
  - escalation
  # ...

widgets:                               # ← NEW section
  - approval-card
  - approval-detail
  - polity-dashboard
  - constitution-viewer
  - governance-entity-card

surface:                               # ← NEW section
  entityAffordances:
    - concept: Approval
      detail: approval-detail
      card: approval-card
    - concept: Polity
      detail: polity-dashboard
    - fallback: governance-entity-card  # Any governance concept without specific widget
```

When an app includes the governance suite, all concept-level affordances are registered automatically. An `Approval` concept renders as `approval-detail` in detail view without any app-level configuration.

### 10. Progressive Override

The customization levels extend naturally:

| Level | Concept-Level Behavior |
|-------|----------------------|
| **0** | If suite provides domain widget → use it. Otherwise → field pipeline. |
| **1** | App overrides domain widget: `WidgetResolver/override(element: "entity:Approval", widget: "custom-approval")` |
| **2** | App customizes domain widget layout via Slot system |
| **3** | App fills slots in domain widget with custom content |
| **4** | App uses Machine/spawn directly, ignores domain widget entirely |

Level 0 is the key improvement: **suites that ship widgets give you domain-appropriate rendering for free.**

## What This Does Not Change

- **Field-level pipeline** — untouched. Still works exactly as before for concepts without domain widgets.
- **Affordance concept** — no schema changes. The `concept` and `suite` conditions are just new condition keys in the existing conditions map.
- **WidgetResolver algorithm** — no changes. It already scores by specificity and condition fit. Concept conditions are just more conditions to match.
- **Binding concept** — the `$entity` signal is additive. Field signals remain unchanged.
- **Concept independence** — concepts never reference widgets. The `annotations.surface` block is optional metadata, not a dependency.

## What This Adds

| Addition | Type | Purpose |
|----------|------|---------|
| `entity` interactor category | Interactor taxonomy extension | Classify whole-concept rendering |
| `concept` / `suite` affordance conditions | Affordance condition keys | Match widgets to specific concepts |
| `$entity` signal | Binding signal map extension | Give domain widgets whole-concept state |
| `annotations.surface` | Concept manifest field | Optional rendering hints |
| `widgets/` in suite directory | Suite structure extension | Suites bundle domain widgets |
| `surface` section in `suite.yaml` | Suite manifest extension | Register concept-level affordances |
| 3 new syncs | Sync orchestration | Entity classification, resolution, field-pipeline bypass |
| `UISchema/getEntityElement` | UISchema action extension | Emit entity-level element |
| `UISchema/markResolved` | UISchema action extension | Prevent field pipeline for resolved entities |

## Open Questions

1. **Collection rendering.** When displaying a *list* of Approvals, should each item use `entity-card`, or should the collection itself match a domain widget (e.g., `approval-board`)? Proposal: `entity-card` for items within a generic collection widget (data-table, card-grid), but allow a collection-level affordance:

   ```widget
   affordance {
     serves: group-repeating
     specificity: 18
     when { concept: "Approval"; viewType: "board" }
   }
   ```

2. **Contract validation timing.** Should the `requires` contract be validated at widget registration time (when WidgetParser processes the `.widget` file), at affordance match time (when WidgetResolver scores candidates), or at binding time (when Binding creates the signal map)? Early validation catches errors faster; late validation allows more flexibility. Proposal: validate at affordance match time — the widget is only a valid candidate if the concept satisfies its contract.

3. **Ambiguous type inference.** When a concept has two `String` fields and the contract expects `body: String`, exact-name matching fails and type inference is ambiguous. Should the system require explicit `bind` mappings for all non-trivially-matched fields, or should it use heuristics (field ordering, semantic similarity of names)? Proposal: require explicit `bind` — heuristics are fragile and surprising.

4. **Derived concept vs. secondary roles.** The proposal offers two ways to compose multiple concepts into a widget: derived concepts (concept-layer composition) and `requires` secondary roles (widget-layer composition). Should the system prefer one over the other, or are they complementary? Proposal: complementary — derived concepts for app-specific compositions, secondary roles for universal patterns (comments, history, attachments) that suites provide.

5. **Contract evolution.** When a widget updates its `requires` contract (adds a required field), all affordance `bind` mappings for concepts that lack that field break. How should versioning work? Proposal: widgets version their contracts, and affordances reference a contract version. Breaking changes require a new major version.

6. **Widget discoverability.** How do developers find available domain widgets for a concept? Proposal: `clef surface widgets --concept Approval` CLI command that queries the affordance registry and shows contract requirements, matched fields, and binding gaps.
