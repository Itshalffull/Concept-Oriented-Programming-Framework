# Concept-Level Widget Mapping

**Status:** Accepted
**Date:** 2026-03-03
**Surface Spec Version:** 0.4.0
**Companion to:** Clef v0.18.0

## 1. Problem

Surface's widget selection pipeline operates at the **field level**:

```
concept field → Interactor/classify → Affordance/match → WidgetResolver/resolve → widget
```

This produces correct, functional UIs — every `String` field gets a text input, every `DateTime` gets a date picker, every enum gets a radio group. But the result is **generic**. An `Approval` concept renders identically to an `Article` concept: a flat form with auto-selected field widgets.

Domain-specific concepts deserve domain-specific rendering. When a user sees an Approval, they expect a status badge with action buttons, not three text inputs. When they see a Workflow, they expect a node graph, not a detail form. The information architecture of a concept — what it *means* in the domain — should influence how it renders, not just the types of its individual fields.

Achieving this today requires Level 1+ customization: manually specifying `widget: "approval-card"` in interface overrides. There is no mechanism for a widget to declare "I know how to render Approval concepts" the way it can declare "I know how to render single-choice interactions."

## 2. Design Principle

Follow the existing affordance pattern exactly. Field-level affordances say:

> "I can serve `single-choice` interactions when `maxOptions < 8`"

Concept-level affordances say:

> "I can serve `Approval` concepts when `view: detail` and `platform: browser`"

Same matching algorithm. Same specificity scoring. Same override mechanism. The new layer sits **above** the field pipeline — it's checked first, and if a concept-level match is found, the entire field-level pipeline is bypassed for that concept instance. If no match is found, the field-level pipeline runs unchanged.

## 3. Entity Interactor Category

Extend the Interactor taxonomy with a new top-level category for whole-concept rendering:

```
Interactor
├─ selection       (single-choice, multi-choice, ...)
├─ edit            (text-short, date-point, ...)
├─ control         (action-primary, submit, ...)
├─ output          (display-text, display-badge, ...)
├─ composition     (group-fields, group-repeating, ...)
└─ entity
   ├─ entity-detail        # Full single-instance view
   ├─ entity-card          # Compact summary (for lists, dashboards)
   ├─ entity-row           # Table row representation
   ├─ entity-inline        # Inline mention / chip
   ├─ entity-editor        # Full editing surface
   └─ entity-graph         # Graph/canvas visualization
```

These are **view-shape** interactors — they describe how much space and attention an entity gets, not what domain it belongs to. The domain specificity comes from affordance conditions.

**On the category name.** The existing interactor categories (selection, edit, control, output, composition) describe what the user does. The `entity` category describes what's being rendered — a presentation scope concern rather than an interaction semantic. This is a deliberate departure. The field-level categories map one field to one widget; the entity category maps one concept to one widget. The conceptual grain is different, and the name reflects that. Renaming to something like `view-shape` was considered but rejected: `entity` is the standard term in Clef for a concept instance, and `entity-detail` / `entity-card` read naturally in affordance declarations. The category difference from `selection` et al. is a feature, not a bug — it signals to authors that these interactors work at a different level.

## 4. Concept Affordance Declarations

Extend the `.widget` affordance block with `concept` and `suite` conditions:

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

### 4.1 Suite-Level Matching

Suites provide default rendering for their concepts via the `suite` condition:

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

### 4.2 Specificity Hierarchy

| Match Type | Typical Specificity | Example |
|------------|-------------------|---------|
| Exact concept name | 20 | `concept: "Approval"` |
| Suite tag | 12 | `suite: "governance"` |
| Generic entity interactor | 5 | `serves: entity-detail` (no concept condition) |
| Field-level fallback | 0 | Current pipeline (no entity match) |

## 5. Concept-Level Classification

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

Interactor classifies the entity element based on host context:

| Context | Entity Interactor |
|---------|------------------|
| Host view = "detail" | `entity-detail` |
| Host view = "list" (each item) | `entity-card` |
| Host view = "list" (table mode) | `entity-row` |
| Inline reference from another concept | `entity-inline` |
| Host view = "edit" | `entity-editor` |
| Host view = "graph" | `entity-graph` |

## 6. Resolution Flow

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
  │                   ┌─ Match found (specificity 20): "approval-detail" widget
  │                   │   → Widget/get("approval-detail")
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

Concept-level resolution is tried first. If a domain widget matches, the field pipeline is never run for that concept instance. If no domain widget matches, the existing field-level pipeline runs unchanged.

## 7. Widget Contracts

When `approval-detail` matches `Approval`, how does the widget know what fields exist, what they're called, and how to wire its anatomy to them?

Field-level widgets don't have this problem — a `text-input` receives one value via one signal. But a domain widget like `workflow-editor` needs `nodes`, `edges`, `workflowName`, and an `execute` command — specific named props that must map to specific concept fields.

The solution is a **`requires` block** — a structural contract declaring the shape the widget needs, independent of any specific concept's field names:

```widget
# approval-detail.widget

requires {
  fields {
    status: enum                     # Must have an enum field for status
    actor: entity                    # Must have an entity reference
    body: String                     # Must have a text field
  }
  actions {
    approve: { }                     # Must have an approval action
    reject: { }                      # Must have a rejection action
  }
}
```

This is **structural typing** — the widget says what shape it needs, not which concept it expects. The `concept: "Approval"` in the affordance block handles *selection*; the `requires` block handles *binding*.

### 7.1 Field Resolution Algorithm

When a widget is selected for a concept, a field resolution step maps concept state fields to widget contract slots. Two strategies, tried in order:

**1. Explicit mapping in the affordance** — when names differ or when disambiguation is needed:

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

**2. Exact name match** — concept field name equals contract slot name:

```
Approval.status → requires.status     ✓ exact match
```

Type-based inference is **not supported**. If a contract slot cannot be resolved by explicit `bind` or exact name match, it is an unresolved slot and handled by the error system (§10). This avoids the fragility and surprising behavior of heuristic matching — when a concept has two `String` fields and the contract expects `body: String`, the system reports the ambiguity rather than guessing.

### 7.2 Full Resolution Algorithm

```
1. Widget selected via affordance match
2. Read widget's requires block → contract slots
3. Read concept's state fields → available fields
4. For each contract slot:
   a. Check affordance bind block for explicit mapping → use if found
   b. Check for exact name match in concept fields → use if found
   c. No match → unresolved slot (see §10 Error Handling)
5. For each contract action:
   a. Check affordance bind block → use if found
   b. Check for exact name match in concept actions → use if found
   c. No match → unavailable action (widget disables that control)
6. Type-check: resolved slot type must be compatible with contract slot type
7. Generate signal map: contract slot names → concept field signals
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

### 7.3 Connect Blocks Use Contract Names

The widget's `connect` block references **contract slot names**, not concept field names:

```widget
# approval-detail.widget

connect {
  statusBadge -> {
    data-status: $status;
    aria-label: concat("Status: ", $status);
  }
  actorDisplay -> {
    text: $actor.name;
  }
  bodyText -> {
    text: $body;
  }
  approveButton -> {
    onClick: command($approve);
    disabled: if $status != "pending" then true else false;
  }
  rejectButton -> {
    onClick: command($reject);
    disabled: if $status != "pending" then true else false;
  }
}
```

The `$slotName` syntax reads from the resolved binding map. The widget never knows the concept called it `approver` vs. `reviewer` — it only knows `actor`.

### 7.4 Worked Example: workflow-editor + Workflow

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

## 8. Multi-Concept Widgets

Real domain views rarely show a single concept in isolation. An approval detail page shows the Approval, a Comments thread, and an ActionLog timeline. Two mechanisms serve this need, with clear guidance on when to use each.

### 8.1 Secondary Roles in `requires`

Extend the `requires` block to declare **named concept roles**:

```widget
# approval-detail.widget

requires {
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

  comments {
    source: "Comment"
    relation: "parentId = primary.id"
    fields {
      entries: collection
    }
    actions {
      add: { body: String }
    }
    optional: true
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

- **`source`** — which concept to bind, by name.
- **`relation`** — how this concept relates to the primary (filter expression evaluated against the Binding).
- **`optional`** — whether the widget degrades gracefully without it.

Secondary role relations are always **explicit**. The system does not infer relationships from the sync graph. Sync-graph inference was considered and rejected: syncs declare coordination chains, not data relationships, and the overlap between "Comment/create fires a Notification sync" and "Comments belong to Approvals" is coincidental. Requiring explicit `relation` expressions keeps the binding predictable and debuggable.

### 8.2 Compose with `entity()` Delegation

Domain widgets delegate secondary roles to sub-widgets via `compose`, re-entering the entity pipeline recursively:

```widget
compose {
  approveButton: widget("button", { variant: "filled", label: "Approve" });
  rejectButton:  widget("button", { variant: "danger", label: "Reject" });
  statusBadge:   widget("badge", { value: $primary.status });

  commentThread: entity("Comment", {
    view: "entity-list",
    filter: $comments.relation
  });

  timeline: entity("ActionLog", {
    view: "entity-card",
    filter: $history.relation
  });
}
```

The `entity()` function invokes the entity resolution pipeline recursively — it looks up what widget serves `Comment` as `entity-list` and renders it. If the collaboration suite ships a `comment-thread.widget`, it renders as a threaded discussion. If no domain widget exists, the field pipeline produces a generic list. The approval-detail widget doesn't know or care which path is taken.

### 8.3 Derived Concepts as an Alternative

When the composition is app-specific and tightly coupled, a **derived concept** is the Clef-native alternative:

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

The derived concept is itself a valid concept URI. A widget can declare `concept: "ApprovalWorkspace"` in its affordance and bind to the composed entity through a single resolution.

### 8.4 When to Use Which

| Mechanism | Use When | Example |
|-----------|----------|---------|
| Secondary roles | The secondary concept is a **universal pattern** that many domain widgets need. The suite ships the widget and the secondary binding together. | Comments, timeline, attachments, audit log |
| Derived concept | The composition is **app-specific** — particular concepts joined in a way that only this application needs. | `ApprovalWorkspace` combining Approval + Comment + ActionLog with custom sync wiring |
| `compose` with `entity()` | The widget needs to **delegate rendering** of a secondary concept to whatever widget serves it, without knowing which widget that is. | Approval detail delegating its comment section to the collaboration suite's comment-thread widget |

Secondary roles and `entity()` delegation are complementary and typically used together: the role declares the data binding, and `entity()` delegates the rendering.

## 9. Collection Rendering

When displaying a *list* of concept instances (e.g., a list of Approvals), the entity pipeline operates at two levels:

**Item level.** Each item within a collection widget uses `entity-card` (or `entity-row` for table mode). The collection widget (data-table, card-grid) is a composition-level widget that iterates over items and delegates each item's rendering to the entity pipeline.

**Collection level.** A domain widget may declare affinity for a **collection of a specific concept** via the existing `group-repeating` interactor with a `concept` condition:

```widget
# approval-board.widget

affordance {
  serves: group-repeating
  specificity: 18
  when {
    concept: "Approval"
    viewType: "board"
  }
}
```

This allows a suite to ship a kanban board for Approvals alongside the card and detail widgets. The specificity hierarchy applies: a concept-specific collection widget (specificity 18) beats a generic data-table (specificity 5), which beats the field-level fallback.

Collection-level affordances follow the same resolution flow as entity-level affordances. The `concept` condition on `group-repeating` is a condition key on the existing Affordance concept — no new interactor subtypes are needed.

## 10. Error Handling

Contract resolution can fail in several ways. The error system must be precise, actionable, and never silent.

### 10.1 Error Categories

| Error | When | Severity | Behavior |
|-------|------|----------|----------|
| **Unresolved slot** | Contract slot has no exact-name match and no explicit `bind` mapping | Error | Widget is disqualified as a candidate. WidgetResolver falls to the next affordance match or the field-level pipeline. |
| **Type mismatch** | Resolved slot type is incompatible with contract slot type (e.g., concept field is `String`, contract expects `enum`) | Error | Same as unresolved slot. Widget is disqualified. |
| **Missing required action** | Contract declares a required action that the concept doesn't have and `bind` doesn't map | Warning | Widget remains a candidate. The action slot is bound to a no-op command. The widget should handle this via its state machine (disable the button, hide the section). |
| **Missing optional role** | Secondary role with `optional: true` has no matching concept available | Info | Widget renders without that section. `$roleName` evaluates to `null` in connect blocks. |
| **Missing required role** | Secondary role without `optional: true` has no matching concept available | Error | Widget is disqualified. |
| **Relation evaluation failure** | A secondary role's `relation` expression references a field that doesn't exist on the primary concept | Error | Widget is disqualified. |

### 10.2 Disqualification Behavior

When a widget is disqualified during contract validation, WidgetResolver does **not** throw an error. Instead:

1. The widget is removed from the candidate list for this resolution.
2. A diagnostic record is created with the widget name, the concept, and the specific slot or role that failed.
3. WidgetResolver continues scoring remaining candidates.
4. If no candidates remain, the resolution falls through to the field-level pipeline.
5. Diagnostics are available via `WidgetResolver/explain` for the element.

This means contract validation failures are **silent at runtime** but **visible in tooling**. The user always sees a rendered UI (either a lower-specificity domain widget or the field-level fallback), and the developer can inspect why a specific widget was skipped.

### 10.3 Diagnostic Output

`WidgetResolver/explain` returns a structured trace for any element:

```
WidgetResolver/explain(element: "entity:Approval:detail")
→ {
    candidates: [
      {
        widget: "approval-detail",
        affordance: { serves: "entity-detail", concept: "Approval", specificity: 20 },
        contractResult: "ok",
        resolvedSlots: {
          status: { source: "exact-name", field: "status", type: "enum" },
          actor: { source: "bind", field: "approver", type: "User" },
          body: { source: "bind", field: "reasoning", type: "String" }
        },
        score: 20,
        selected: true
      },
      {
        widget: "governance-entity-card",
        affordance: { serves: "entity-detail", suite: "governance", specificity: 12 },
        contractResult: "ok",
        score: 12,
        selected: false,
        reason: "lower specificity"
      }
    ],
    resolvedWidget: "approval-detail",
    fallbackUsed: false
  }
```

When a widget is disqualified:

```
{
  widget: "review-detail",
  affordance: { serves: "entity-detail", concept: "Approval", specificity: 20 },
  contractResult: "error",
  errors: [
    { slot: "reviewer", reason: "unresolved: no exact-name match, no bind mapping" },
    { slot: "comments", reason: "required role: concept 'Review' not found" }
  ],
  score: 0,
  selected: false
}
```

### 10.4 Build-Time Validation

In addition to runtime disqualification, the `clef surface check` command performs **static contract validation** at build time:

1. For every affordance with a `concept` condition, load the named concept spec.
2. Run the field resolution algorithm against the contract.
3. Report unresolved slots, type mismatches, and missing roles as build warnings.
4. Report missing `bind` mappings for slots that require them.

This catches errors before deployment. Build-time validation is advisory (warnings, not errors) because a concept spec may be provided by a different suite that isn't available at build time.

### 10.5 Runtime Error Signals

When a domain widget is resolved and its contract is satisfied but a secondary role's data fetch fails at runtime (e.g., the Comment service is down), the system delivers an error through the binding:

```
$comments.error → { code: "fetch-failed", message: "Comment service unavailable" }
$comments.entries → null
```

The widget's `connect` block handles this via the existing `if not $comments then ...` pattern for optional roles. For required roles, `Host/setError` is invoked and the host transitions to its error state.

## 11. Contract Versioning

When a widget updates its `requires` contract — adding a required field, changing a type, removing a slot — existing affordance `bind` mappings for concepts that lack the new field break. This section specifies how contract changes are managed.

### 11.1 Contract Version Declaration

Every `requires` block declares a version:

```widget
requires @2 {
  fields {
    status: enum
    actor: entity
    body: String
    priority: enum              # Added in @2
  }
  actions {
    approve: { }
    reject: { }
  }
}
```

The `@N` annotation is a monotonically increasing integer. It is **not** semver — it's a simple sequence number local to this widget.

### 11.2 Change Classification

| Change | Classification | Version Bump Required |
|--------|---------------|----------------------|
| Add optional field (with default) | Non-breaking | No |
| Add required field | Breaking | Yes |
| Remove field | Breaking | Yes |
| Change field type | Breaking | Yes |
| Add optional action | Non-breaking | No |
| Remove action | Breaking | Yes |
| Add optional secondary role | Non-breaking | No |
| Add required secondary role | Breaking | Yes |
| Change relation expression | Breaking | Yes |

### 11.3 Affordance Contract Pinning

Affordances may pin to a specific contract version:

```widget
affordance {
  serves: entity-detail
  specificity: 20
  when { concept: "Approval" }
  contract: @1                      # Pin to contract version 1
  bind {
    actor: approver
    body: reasoning
  }
}
```

When an affordance pins `contract: @1`, the widget must retain the `@1` contract shape as a **supported version**. The widget declares which versions it supports:

```widget
requires @2 {
  supports: [@1, @2]
  # ...
}
```

At binding time, the system checks which contract version the affordance references, and uses that version's field set for resolution. Fields added in later versions are bound to defaults or left unresolved (the widget must handle missing slots from older contract versions).

### 11.4 Unpinned Affordances

Affordances without a `contract:` pin always resolve against the **latest** contract version. This is the default and recommended approach for affordances that ship with the widget (they're updated together). Pinning is for **external affordances** — when a third-party suite writes an affordance for someone else's widget and needs stability guarantees.

### 11.5 Deprecation Flow

When a widget drops support for an old contract version:

1. The widget removes the version from `supports`.
2. Any affordance pinned to the removed version fails contract validation at build time (via `clef surface check`).
3. At runtime, the affordance is disqualified — the widget is removed from candidates for concepts using that affordance.
4. The `WidgetResolver/explain` diagnostic reports: `"contract version @1 no longer supported by widget approval-detail@2"`.

This is a soft failure — the resolution falls through to lower-specificity candidates or the field-level pipeline. No runtime crash.

## 12. Concept-Side Annotations

Concepts can optionally declare rendering preferences without depending on Surface:

```concept
@version(1)
concept Approval [A, U] {
  purpose "Track and resolve approval requests"

  annotations {
    surface {
      preferredView: "entity-detail"
      tags: ["stateful", "approvable"]
    }
  }

  state { ... }
  actions { ... }
}
```

This is a **hint** stored in the concept manifest's `annotations` field. Surface reads it during `UISchema/inspect` but is not required to honor it. Concepts remain independent — they never reference widgets by name. The `tags` array feeds into suite-level matching (a widget can match `tag: "stateful"` in addition to `suite: "governance"`).

## 13. Suite Integration

Suites that ship domain widgets bundle them alongside concepts:

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
└── widgets/
    ├── approval-card.widget
    ├── approval-detail.widget
    ├── polity-dashboard.widget
    ├── constitution-viewer.widget
    └── governance-entity-card.widget
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

widgets:
  - approval-card
  - approval-detail
  - polity-dashboard
  - constitution-viewer
  - governance-entity-card

surface:
  entityAffordances:
    - concept: Approval
      detail: approval-detail
      card: approval-card
    - concept: Polity
      detail: polity-dashboard
    - fallback: governance-entity-card
```

When an app includes the governance suite, all concept-level affordances are registered automatically. An `Approval` concept renders as `approval-detail` in detail view without any app-level configuration.

## 14. Syncs

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

An additional sync handles secondary role binding:

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
  Binding/bind: [
    binding: concat(?element.id, "/", role.name);
    concept: role.source;
    mode: "coupled";
    filter: role.relation
  ]
}
```

## 15. Progressive Override

The customization levels extend naturally:

| Level | Concept-Level Behavior |
|-------|----------------------|
| **0** | If suite provides domain widget → use it. Otherwise → field pipeline. |
| **1** | App overrides domain widget: `WidgetResolver/override(element: "entity:Approval", widget: "custom-approval")` |
| **2** | App customizes domain widget layout via Slot system |
| **3** | App fills slots in domain widget with custom content |
| **4** | App uses Machine/spawn directly, ignores domain widget entirely |

Level 0 is the key improvement: **suites that ship widgets give you domain-appropriate rendering for free.**

## 16. Contract Diagnostics

Widget discoverability and contract validation are backed by two concepts whose actions are exposed through Bind as CLI commands, REST endpoints, MCP tools, and SDKs.

### 16.1 ContractChecker Concept

```
@version(1)
concept ContractChecker [C] {

  purpose {
    Validate widget contracts against concept specs. Runs the
    field resolution algorithm statically — without a live
    binding — and reports resolved slots, unresolved slots,
    type mismatches, and missing roles. Used by build tooling
    and developer-facing diagnostics.
  }

  state {
    results: set C
    widget: C -> String
    concept: C -> String
    contractVersion: C -> Int
    status: C -> String
    resolvedSlots: C -> list String
    unresolvedSlots: C -> list String
    typeMismatches: C -> list String
    missingRoles: C -> list String
    suggestions: C -> list String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action check(checker: C, widget: String, concept: String,
                 contractVersion: option Int) {
      -> ok(checker: C, resolved: String, unresolved: String,
           mismatches: String) {
        Run field resolution algorithm for the widget's
        requires block against the concept's state and actions.
        Use explicit contract version if provided, otherwise
        latest. Return structured result with per-slot status.
      }
      -> incompatible(checker: C, errors: String) {
        Widget and concept are fundamentally incompatible
        (no affordance declares this concept for this widget).
      }
      -> notfound(message: String) { Widget or concept not registered. }
    }

    action checkAll(checker: C, concept: String) {
      -> ok(checker: C, results: String) {
        Run contract check for every widget with an affordance
        matching the named concept. Returns ranked results
        with contract status per widget.
      }
      -> notfound(message: String) { Concept not registered. }
    }

    action checkSuite(checker: C, suite: String) {
      -> ok(checker: C, results: String) {
        Run contract check for every concept-widget pair in a
        suite. Validates that all suite-bundled affordances
        resolve cleanly against their target concepts.
      }
      -> notfound(message: String) { Suite not registered. }
    }

    action suggest(checker: C, widget: String, concept: String) {
      -> ok(checker: C, suggestions: String) {
        For each unresolved slot, suggest candidate concept
        fields by type compatibility. Output is advisory —
        the developer writes the bind mapping.
      }
      -> resolved(message: String) { All slots already resolved, no suggestions needed. }
      -> notfound(message: String) { Widget or concept not registered. }
    }
  }

  invariant {
    after check(checker: c, widget: "approval-detail",
      concept: "Approval", contractVersion: _)
      -> ok(checker: c, resolved: _, unresolved: _, mismatches: _)
  }
}
```

### 16.2 WidgetRegistry Concept

```
@version(1)
concept WidgetRegistry [W] {

  purpose {
    Queryable index of all registered entity-level affordances.
    Answers questions about which widgets serve which concepts,
    at what specificity, with what contract requirements.
    Populated automatically from parsed .widget files.
  }

  state {
    entries: set W
    widget: W -> String
    interactor: W -> String
    concept: W -> option String
    suite: W -> option String
    tags: W -> list String
    specificity: W -> Int
    contractVersion: W -> Int
    contractSlots: W -> list String
    contractActions: W -> list String
    secondaryRoles: W -> list String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(entry: W, widget: String, interactor: String,
                    concept: option String, suite: option String,
                    tags: list String, specificity: Int,
                    contractVersion: Int, contractSlots: String,
                    contractActions: String, secondaryRoles: String) {
      -> ok(entry: W) {
        Register an entity-level affordance entry. Called by
        WidgetParser when processing .widget files with entity
        affordance declarations.
      }
      -> duplicate(message: String) { Exact entry already registered. }
    }

    action query(concept: option String, suite: option String,
                 interactor: option String) {
      -> ok(entries: String) {
        Find all entity affordances matching the given filters.
        Any filter left empty is a wildcard. Results ranked
        by specificity descending.
      }
      -> none(message: String) { No matching entries. }
    }

    action remove(entry: W) {
      -> ok(entry: W) { Remove entry. }
      -> notfound(message: String) { Entry not registered. }
    }
  }

  invariant {
    after register(entry: w, widget: "approval-detail",
      interactor: "entity-detail", concept: "Approval",
      suite: "governance", tags: _, specificity: 20,
      contractVersion: 1, contractSlots: _, contractActions: _,
      secondaryRoles: _) -> ok(entry: w)
    then query(concept: "Approval", suite: _, interactor: _)
      -> ok(entries: _)
  }
}
```

### 16.3 Syncs

```sync
sync ParsedEntityAffordanceRegistered [eager]
purpose "Register entity affordances in WidgetRegistry when parsed"

when {
  WidgetParser/parse: [ parser: ?p ] => ok(ast: ?ast)
}
where {
  ?ast.affordances has entityAffordances
}
then {
  WidgetRegistry/register: [
    entry: concat(?ast.name, "/", affordance.serves);
    widget: ?ast.name;
    interactor: affordance.serves;
    concept: affordance.when.concept;
    suite: affordance.when.suite;
    tags: affordance.when.tags;
    specificity: affordance.specificity;
    contractVersion: ?ast.requires.version;
    contractSlots: ?ast.requires.fields;
    contractActions: ?ast.requires.actions;
    secondaryRoles: ?ast.requires.secondaryRoles
  ]
}
```

```sync
sync SuiteCheckValidatesContracts [eager]
purpose "Run contract checks when a suite is loaded"

when {
  Suite/load: [ suite: ?s ] => ok(name: ?name)
}
where {
  WidgetRegistry/query: [ concept: _; suite: ?name; interactor: _ ]
    => ok(entries: ?entries)
}
then {
  ContractChecker/checkSuite: [ checker: ?name; suite: ?name ]
}
```

### 16.4 Bind-Generated Interfaces

Because `ContractChecker` and `WidgetRegistry` are standard Clef concepts, Bind generates all programmatic interfaces automatically:

**CLI** (via `clef bind cli`):

```
$ clef surface widgets --concept Approval

  Entity widgets for Approval (governance suite):

  ┌────────────────────┬──────────────────┬─────────────┬──────────────────────────┐
  │ Widget             │ Serves           │ Specificity │ Contract Status           │
  ├────────────────────┼──────────────────┼─────────────┼──────────────────────────┤
  │ approval-detail    │ entity-detail    │ 20          │ ✓ all slots resolved     │
  │ approval-card      │ entity-card      │ 20          │ ✓ all slots resolved     │
  │ governance-entity  │ entity-card      │ 12          │ ✓ all slots resolved     │
  │ governance-entity  │ entity-detail    │ 12          │ ✓ all slots resolved     │
  └────────────────────┴──────────────────┴─────────────┴──────────────────────────┘

  Contract: approval-detail @1
    status (enum)     ← Approval.status       (exact name)
    actor (entity)    ← Approval.approver     (bind mapping)
    body (String)     ← Approval.reasoning    (bind mapping)
    approve (action)  ← Approval.approve      (exact name)
    reject (action)   ← Approval.reject       (exact name)
```

```
$ clef surface check --concept Workflow --gaps

  pipeline-viewer @1 gaps:
    ✗ duration (Int) — no match in Workflow.
    Suggestion: bind { duration: estimatedTime }
```

The CLI commands are thin wrappers over concept actions:

| CLI Command | Concept Action |
|-------------|---------------|
| `clef surface widgets --concept X` | `WidgetRegistry/query(concept: X)` + `ContractChecker/checkAll(concept: X)` |
| `clef surface widgets --suite X` | `WidgetRegistry/query(suite: X)` |
| `clef surface check --concept X` | `ContractChecker/checkAll(concept: X)` |
| `clef surface check --concept X --gaps` | `ContractChecker/checkAll(concept: X)` + `ContractChecker/suggest(...)` per unresolved widget |
| `clef surface check --suite X` | `ContractChecker/checkSuite(suite: X)` |

**REST** (via `clef bind rest`): `GET /widget-registry?concept=Approval`, `POST /contract-checker/check`, etc.

**MCP** (via `clef bind mcp`): LLMs can query which widgets are available for a concept, check contract compatibility, and get binding suggestions — enabling AI-assisted widget selection and affordance authoring.

**SDK** (via `clef bind sdk`): `contractChecker.checkAll({ concept: "Approval" })`, `widgetRegistry.query({ suite: "governance" })`, etc.

## 17. What This Does Not Change

- **Field-level pipeline** — untouched. Still works exactly as before for concepts without domain widgets.
- **Affordance concept** — no schema changes. The `concept` and `suite` conditions are new condition keys in the existing conditions map.
- **WidgetResolver algorithm** — no changes. It already scores by specificity and condition fit. Concept conditions are more conditions to match.
- **Binding concept** — the `$entity` signal is additive. Field signals remain unchanged.
- **Concept independence** — concepts never reference widgets. The `annotations.surface` block is optional metadata, not a dependency.

## 18. What This Adds

| Addition | Type | Purpose |
|----------|------|---------|
| `entity` interactor category | Interactor taxonomy extension | Classify whole-concept rendering |
| `concept` / `suite` / `tag` affordance conditions | Affordance condition keys | Match widgets to specific concepts |
| `$entity` signal | Binding signal map extension | Give domain widgets whole-concept state |
| `requires` block with `@N` versioning | Widget spec grammar extension | Structural contracts for widget-concept binding |
| `bind` block in affordance | Affordance grammar extension | Map concept fields to contract slots |
| `contract:` pin in affordance | Affordance grammar extension | Version stability for external affordances |
| `annotations.surface` | Concept manifest field | Optional rendering hints |
| `widgets/` in suite directory | Suite structure extension | Suites bundle domain widgets |
| `surface` section in `suite.yaml` | Suite manifest extension | Register concept-level affordances |
| 4 new syncs (entity pipeline) | Sync orchestration | Entity classification, resolution, field-pipeline bypass, secondary binding |
| 2 new syncs (diagnostics) | Sync orchestration | Affordance registration, suite validation |
| `UISchema/getEntityElement` | UISchema action extension | Emit entity-level element |
| `UISchema/markResolved` | UISchema action extension | Prevent field pipeline for resolved entities |
| `WidgetResolver/explain` enhancements | Diagnostic extension | Contract resolution tracing |
| ContractChecker concept | New concept | Static contract validation, slot suggestions |
| WidgetRegistry concept | New concept | Queryable index of entity-level affordances |
