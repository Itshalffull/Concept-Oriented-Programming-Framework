# PRD: Action Triggers and Controls for Clef Base

## Status: Final
## Authors: Research audit, 2026-04-11
## Depends on: Usability audit (clef-base/docs/usability-audit.md)

---

## 1. Problem Statement

Every no-code platform faces the same fundamental challenge: connecting a user's click to a meaningful action. The eight platforms analyzed in the companion research (Coda, Notion, Airtable, Glide, AppSheet, Retool, Bubble, Softr) each solve this differently, and each reveals a distinct set of tradeoffs.

The consistent finding across all eight: **feedback, error handling, and confirmation are afterthoughts**. Coda has no confirmation dialogs. Bubble's loading indicator is a nearly invisible blue bar. Retool's confirmation can't be conditional. AppSheet's approach is the most principled but still requires manual per-action configuration.

Clef Base's usability audit confirms the same pattern internally: silent failures on ControlBlock Invoke, dead-end "Leave Space" button, missing retry on fetch failures, inconsistent error states across the app.

Clef's concept-oriented architecture — explicit return variants, sync-driven coordination, declarative concept specs — creates a rare opportunity: **derive interaction states automatically from concept specifications** rather than requiring builders to configure them manually. This PRD specifies how.

---

## 2. Competitive Landscape Summary

The companion research document (`controls-and-buttons-research.md`) provides detailed platform-by-platform analysis. The cross-cutting findings that drive this PRD:

### 2.1 Seven design axes

| Axis | Spectrum | Best-in-class | Gap Clef fills |
|------|----------|---------------|----------------|
| **Ontology** | Field/column → block → component → standalone action | AppSheet (standalone named actions) | Clef supports all placement contexts through a single ActionBinding concept and the Interactor → Affordance → WidgetResolver pipeline |
| **Specification** | Formula → visual builder → code | Coda (formula toggle) | Layered authoring: visual builder → expression language → ProcessSpec → concept handler code |
| **Scope** | Row → page → app-global | Coda (`thisRow`), Retool (`{{ component.selectedRow }}`) | ActionBinding parameter maps resolve context automatically from placement |
| **Composition** | Single action → chain → workflow engine | Bubble Custom Events, AppSheet grouped actions | Single action (ActionBinding) → multi-step (ProcessSpec) → durable state machine (Workflow) |
| **Execution model** | Optimistic → pessimistic; sync → async | Retool (`isFetching` binding) | `executionPolicy: auto` derives strategy from variant set; automatic FlowTrace-driven loading states |
| **Feedback** | Loading, error, success, confirmation | Retool (loading), AppSheet (confirmation), Airtable Interface (success) | All four derived automatically from return variants — zero builder configuration |
| **Parameters** | Ad hoc → `[_INPUT]` prompts → form binding | AppSheet (`[_INPUT]`) | Auto-generated parameter collection UI from action signature |

### 2.2 Key competitive advantages Clef can deliver

1. **Automatic variant-driven UI.** Every concept action declares its return variants explicitly (`ok`, `error`, `notfound`, `invalid`, `unauthorized`). The UI layer auto-generates appropriate visual states for each. No competitor does this.

2. **Sync-driven cross-concept coordination.** Where Airtable requires checkbox-flip automation triggers and Bubble requires separate workflows, Clef syncs handle cross-concept effects declaratively at the framework level.

3. **Pre-flight validation.** No competitor uses pre-flight validation to prevent actions from executing when they'll fail. Clef's Validator concept, wired to ActionBinding via sync, enables this.

4. **Automatic undo from reversal declarations.** Concept specs already declare `reversal: <actionName>` for integration test cleanup. This PRD extends that infrastructure to runtime undo.

5. **Operational principles enable intelligent optimistic UI.** The system can predict action outcomes from the spec and update the UI immediately, verifying against the actual response.

---

## 3. Concept Architecture

This PRD introduces **four new concepts** and replaces one existing concept. Each follows Daniel Jackson's methodology: independently motivated, single purpose, single operational principle.

### 3.1 Replace Control with two focused concepts

The current Control concept (`repertoire/concepts/automation/control.concept`) is a thin, generic stub — 5 state fields, 5 basic actions — that serves as both a state holder (slider value) and an action trigger (`triggerAction`). It's too generic to support the capabilities this PRD requires. It is replaced by:

**ActionBinding** — what happens when you click. Connects a user interaction to a concept action invocation with parameter resolution, preconditions, execution policy, and confirmation behavior.

**ControlState** — what value a slider holds. Reactive UI state (sliders, dropdowns, toggles, date pickers) that other concepts can read. Not about action triggering; about interactive state that feeds into filters, parameter bindings, and display logic.

### 3.2 ActionBinding [B]

**Purpose:** Bind a user interaction to a concept action invocation. Resolves parameters from placement context, evaluates preconditions, manages confirmation, delegates to Binding for transport, and maps result variants to UI states.

**State:**
- `bindings: set B`
- `target: B -> String` — concept/action reference (e.g., `"Task/complete"`)
- `parameterMap: B -> String` — JSON: maps action param names to context expressions
- `precondition: B -> option String` — expression; when false, action is unavailable
- `confirmWhen: B -> option String` — expression; when true, show confirmation before executing
- `executionPolicy: B -> String` — `"optimistic"` | `"pessimistic"` | `"auto"`
- `retryPolicy: B -> option String` — JSON: `{maxAttempts, backoff, initialDelay, maxDelay}`

**Actions:**
- `bind(binding: B, target: String, parameterMap: String, precondition: option String, confirmWhen: option String, executionPolicy: String)`
  - `-> ok(binding: B)` — binding created
  - `-> invalid(message: String)` — target action doesn't exist or params don't match signature
- `invoke(binding: B, context: String)`
  - `-> ok(result: String, trace: String)` — action succeeded
  - `-> error(variant: String, message: String, trace: String)` — action returned error variant
  - `-> invalid(violations: String, trace: String)` — pre-flight validation failed
  - `-> unauthorized(reason: String)` — precondition evaluated false
  - `-> confirming(binding: B, message: String)` — awaiting user confirmation
- `confirm(binding: B)`
  - `-> ok(result: String, trace: String)` — confirmed and executed
  - `-> error(variant: String, message: String, trace: String)` — confirmed but action failed
  - `-> expired(message: String)` — confirmation window expired
- `cancel(binding: B)`
  - `-> ok()` — confirmation cancelled

**Operational principle:** After `bind(b, target, params)`, calling `invoke(b, ctx)` resolves params against ctx, checks precondition, optionally requests confirmation, optionally runs Validator pre-flight, then delegates to `Binding/invoke` for transport. Every invocation produces a FlowTrace entry regardless of outcome.

**Confirmation derivation:** When `confirmWhen` is not explicitly set, the system derives confirmation behavior from the target action's spec:
- `reversal: none` → automatic confirmation (irreversible action)
- `reversal: <actionName>` → no automatic confirmation (reversible, undo available via UndoStack)
- No reversal declared → system infers from naming conventions (same 14-pair system used by integration test generator)

**Execution policy derivation:** When `executionPolicy` is `"auto"` (default):
- If the only variants are `ok` and `error` → optimistic (apply expected result immediately, roll back on error)
- If `invalid`, `notfound`, or `unauthorized` variants exist → pessimistic (show loading state, apply only after response)

### 3.3 ControlState [K]

**Purpose:** Hold reactive UI state (sliders, dropdowns, date pickers) that other concepts can read. Not about action triggering — about interactive state that feeds into filters, parameter bindings, and display logic.

**State:**
- `controls: set K`
- `value: K -> String`
- `defaultValue: K -> String`
- `controlType: K -> String` — text, select, slider, date, toggle, etc.
- `options: K -> option String` — JSON: for select/radio types
- `personal: K -> Bool` — per-user vs. shared state

**Actions:**
- `create(control: K, controlType: String, defaultValue: String, options: option String, personal: Bool)`
  - `-> ok(control: K)` — control created
  - `-> duplicate(message: String)` — control already exists
- `set(control: K, value: String)`
  - `-> ok(previous: String, current: String)` — value updated
  - `-> invalid(violations: String)` — value doesn't match controlType constraints
  - `-> notfound(message: String)` — control doesn't exist
- `reset(control: K)`
  - `-> ok(value: String)` — returned to defaultValue
  - `-> notfound(message: String)` — control doesn't exist
- `get(control: K)`
  - `-> ok(value: String)` — current value
  - `-> notfound(message: String)` — control doesn't exist

**Operational principle:** After `set(k, v)`, `get(k)` returns `v`. After `reset(k)`, `get(k)` returns `defaultValue`. If `personal` is true, each Session maintains independent state.

### 3.4 ActionType [T]

**Purpose:** Classify action interactions by semantic purpose, independent of any concrete widget. The action-domain counterpart to Interactor (which classifies data/field interactions). Both produce type strings that Affordance matches on.

**Motivation for separation from Interactor:** Interactor classifies based on field properties (data type, cardinality, mutability, option count). ActionType classifies based on action properties (variant set, reversibility, sync/async, requires input). These are independently motivated concerns with different domain knowledge. Interactor's `classify()` takes `fieldType` and `constraints` — parameters that don't map to action classification. A separate concept keeps each classifier focused and avoids overloading `classify()` with two unrelated schemas in an opaque JSON blob.

**State:**
- `types: set T`
- `name: T -> String`
- `properties: T -> String` — JSON: action-specific classification properties

**Actions:**
- `define(actionType: T, name: String, properties: String)`
  - `-> ok(actionType: T)` — type registered
  - `-> duplicate(message: String)` — name already defined
- `classify(target: String, variants: String, context: String)`
  - `-> ok(actionType: T, confidence: Float)` — classified
  - `-> ok(actionType: T, candidates: String)` — multiple types match equally

**Built-in types:**
- **`invoke`** — one-shot action execution. Maps to: button, menu item, toolbar action, swipe action, context menu item, slash command, keyboard shortcut.
- **`commit`** — finalize pending input (form submit, save). Distinguished from `invoke` by: action sits at the end of a form/input collection flow.
- **`trigger`** — fire-and-forget background process. Distinguished by: action is async/long-running, no immediate result expected.

**Relationship to Interactor:** Both ActionType and Interactor produce type strings consumed by Affordance. They don't share state or actions. Affordance already treats interactor type as an opaque string — it doesn't know or care where the string came from. The two concepts use different category namespaces (Interactor: `selection`, `edit`, `control`, `output`, `navigation`, `composition`, `entity`; ActionType: `action`) to prevent type name collisions.

### 3.5 UndoStack [U]

**Purpose:** Maintain an ordered history of reversible user-initiated actions, supporting Cmd+Z/Cmd+Shift+Z undo/redo.

**Key design decision — user actions only:** UndoStack listens to ActionBinding completions, not ActionLog records. When a user clicks a button and `Task/complete` fires, that goes on the stack. The sync consequences (ActivityLog/record, Notification/send) do not. When undo is invoked, only the root action is reversed — the reversal action's own syncs handle cascading consistency, just like any other action invocation.

**State:**
- `stacks: set U`
- `entries: U -> String` — JSON: ordered list of `{action, params, result, trace, reversalAction}`
- `position: U -> Int` — current position in stack (for redo)
- `maxSize: U -> Int` — max entries before oldest is dropped

**Actions:**
- `push(stack: U, action: String, params: String, result: String, trace: String, reversalAction: String)`
  - `-> ok(entry: String)` — entry added, position advanced
  - `-> full(dropped: String)` — oldest entry dropped to make room
- `undo(stack: U)`
  - `-> ok(reversalAction: String, params: String)` — returns what to invoke; caller executes
  - `-> empty(message: String)` — nothing to undo
- `redo(stack: U)`
  - `-> ok(action: String, params: String)` — returns what to re-invoke
  - `-> empty(message: String)` — nothing to redo
- `clear(stack: U)`
  - `-> ok()` — stack cleared

**Operational principle:** After performing actions A, B, C via ActionBinding, `undo()` returns C's reversal. Another `undo()` returns B's reversal. `redo()` returns B's original action. Push after undo truncates the redo branch (standard undo/redo semantics).

### 3.6 Undo [D]

**Purpose:** Offer ephemeral, time-limited undo opportunities for individual actions (the toast/snackbar pattern). Independent from UndoStack — UndoStack is Cmd+Z history, Undo is the "You just archived this. [Undo]" toast.

**Jackson analysis for separation:**
- **Independent motivation:** Gmail "Undo send" exists without Cmd+Z stack. Text editors have Cmd+Z without toasts.
- **Independent state:** UndoStack is an ordered stack with position pointer (LIFO). Undo is an unordered set of pending opportunities with TTLs (time-bounded).
- **Different operational principles:** UndoStack: LIFO ordering. Undo: time-bounded availability.
- **Different composition:** UndoStack composes with keyboard shortcuts. Undo composes with timer/scheduler and toast UI.

**State:**
- `offers: set D`
- `entry: D -> String` — the UndoStack entry this offer refers to
- `ttl: D -> Int` — milliseconds before expiry
- `status: D -> String` — `"offered"` | `"executed"` | `"dismissed"` | `"expired"`

**Actions:**
- `offer(undo: D, entry: String, ttl: Int)`
  - `-> ok(undo: D)` — offer created, timer started
  - `-> irreversible(message: String)` — action has no reversal
- `execute(undo: D)`
  - `-> ok(undo: D)` — delegates to UndoStack/undo
  - `-> expired(message: String)` — TTL elapsed
- `dismiss(undo: D)`
  - `-> ok()` — user explicitly dismissed
- `expire(undo: D)`
  - `-> ok()` — TTL elapsed, offer removed

**Operational principle:** After `offer(d, entry, 5000)`, exactly one of `execute`, `dismiss`, or `expire` eventually fires. After `execute`, the reversal has been invoked via UndoStack.

---

## 4. Sync Wiring

The concepts above compose through syncs. Each sync is independently meaningful — the system works with any subset of these syncs present.

### 4.1 ActionBinding → ActionType classification

When an ActionBinding is created, classify it into an action type for the widget pipeline:

```
sync ClassifyActionBinding [eager]
when {
  ActionBinding/bind: [ target: ?target; parameterMap: ?pm ]
    => [ ok(binding: ?b) ]
}
where {
  query(?target, variants: ?vs)
}
then {
  ActionType/classify: [
    target: ?target;
    variants: ?vs;
    context: ?pm
  ]
}
```

### 4.2 ActionBinding → Validator pre-flight

When ActionBinding/invoke is called, run Validator before executing if the target action has registered constraints:

```
sync PreflightValidation [eager]
when {
  ActionBinding/invoke: [ binding: ?b; context: ?ctx ]
    => []
}
where {
  ActionBinding: { ?b target: ?target; parameterMap: ?pm }
  query(?target, hasValidator: true)
}
then {
  Validator/validate: [ validator: ?target; data: ?ctx ]
}

sync PreflightValidationFailed [eager]
when {
  ActionBinding/invoke: [ binding: ?b ]
    => []
  Validator/validate: [ validator: ?target ]
    => [ ok(valid: false; errors: ?e) ]
}
then {
  ActionBinding/complete: [ binding: ?b; variant: "invalid"; violations: ?e ]
}
```

### 4.3 ActionBinding → Binding transport

After preconditions and validation pass, delegate to Binding for actual execution:

```
sync InvokeViaBinding [eager]
when {
  ActionBinding/invoke: [ binding: ?b; context: ?ctx ]
    => [ ok() ]
}
where {
  ActionBinding: { ?b target: ?target; parameterMap: ?pm }
  not Validator/validate: [ validator: ?target ] => [ ok(valid: false) ]
}
then {
  Binding/invoke: [ binding: ?b; action: ?target; input: ?ctx ]
}
```

### 4.4 ActionBinding → FlowTrace

Every invocation produces a trace entry:

```
sync TraceActionInvocation [eager]
when {
  ActionBinding/invoke: [ binding: ?b; context: ?ctx ]
    => [ ok(result: ?r; trace: ?t) ]
}
then {
  ActionLog/record: [
    action: ?b;
    params: ?ctx;
    result: ?r;
    trace: ?t
  ]
}
```

### 4.5 ActionBinding → UndoStack (user-initiated reversible actions only)

```
sync PushUndoOnReversibleInvoke [eager]
when {
  ActionBinding/invoke: [ binding: ?b; context: ?ctx ]
    => [ ok(result: ?r; trace: ?t) ]
}
where {
  ActionBinding: { ?b target: ?target }
  query(?target, reversal: ?rev)
  guard(?rev != "none")
}
then {
  UndoStack/push: [
    action: ?target;
    params: ?ctx;
    result: ?r;
    trace: ?t;
    reversalAction: ?rev
  ]
}
```

### 4.6 UndoStack → Undo toast

```
sync ToastOnStackPush [eager]
when {
  UndoStack/push: [ action: ?a; params: ?p ]
    => [ ok(entry: ?entry) ]
}
then {
  Undo/offer: [ entry: ?entry; ttl: 5000 ]
}
```

### 4.7 Undo toast → UndoStack execution

```
sync UndoToastExecutesStack [eager]
when {
  Undo/execute: [ undo: ?d ]
    => [ ok(undo: ?d) ]
}
where {
  Undo: { ?d entry: ?entry }
}
then {
  UndoStack/undo: [ stack: ?entry ]
}
```

### 4.8 UndoStack → ActionBinding reversal

```
sync ExecuteReversal [eager]
when {
  UndoStack/undo: [ stack: ?s ]
    => [ ok(reversalAction: ?rev; params: ?p) ]
}
then {
  ActionBinding/invoke: [
    binding: ?rev;
    context: ?p
  ]
}
```

### 4.9 Syncs vs. ProcessSpec guidance

**Syncs** = system-level consequences. "Whenever Task/complete happens, regardless of what triggered it, record it in the activity log." Syncs are global, declarative, and invisible to the user who clicked the button. They fire whether the action was triggered by a button, an API call, or another sync.

**ProcessSpec** = user-configured multi-step sequences. "When the user clicks this button, do these steps in this order with these conditions." Configured by the builder for a specific UI interaction. ProcessSpec provides sequential composition, conditional routing, retry policies, and compensation plans — everything the research doc's ActionChain proposed, already built.

**ActionBinding Level 1** targets a single concept action. **ActionBinding Level 2** targets a ProcessSpec for multi-step flows. **ActionBinding Level 3** targets a Workflow for durable state machines.

### 4.10 Action layering: widget FSM, concept actions, and syncs

ActionBinding is not the only way actions happen. It is one layer in a stack. A single button click may involve multiple layers:

| Layer | Mechanism | Example | Who handles it |
|---|---|---|---|
| **Widget-local UI state** | Widget FSM `send(EVENT)` | Expand section, enter edit mode, show dropdown | Widget's `states` block and `connect` block |
| **Frontend concept action** | ActionBinding → frontend concept | Navigate to page, toggle sidebar, mount overlay | Navigator, Shell, Host concepts |
| **Backend concept action** | ActionBinding → Binding → kernel | Complete task, send invoice, create record | Any backend concept |
| **Cross-concept effects** | Sync on action completion | After Invoice/send → open sent-detail sidebar | Sync engine |
| **Multi-step sequence** | ActionBinding → ProcessSpec | Save draft, then validate, then publish | ProcessSpec + StepRun |

**Mixed frontend+backend example:** A button that sends an invoice and opens a detail panel.

The button's ActionBinding targets `Invoice/send`. A sync handles the frontend effect:

```
sync ShowSentInvoicePanel [eager]
when {
  Invoice/send: [ invoiceId: ?id ]
    => [ ok(invoice: ?inv) ]
}
then {
  Host/mount: [ concept: "Invoice"; view: "sent-detail"; zone: "sidebar"; params: ?inv ]
}
```

The button doesn't know about the sidebar. The sync handles it — same pattern as any cross-concept coordination.

**Widget FSM + concept action example:** A button that opens a dropdown and fetches options from the backend.

The widget's `connect` block handles the local state transition:
```
onClick: send(OPEN_DROPDOWN);
```

The FSM's `entry` action on the `open` state triggers a concept invocation:
```
open {
  entry [fetchOptions];
  on CLOSE -> closed;
  on SELECT -> closed;
}
```

The Machine concept bridges FSM entry/exit actions to concept invocations. The widget spec declares the behavior; the runtime wires it.

**Key principle:** ActionBinding handles concept invocation (backend or frontend concepts). Widget FSMs handle local UI state. Syncs handle cross-concept coordination. These three mechanisms compose freely — a single button click can involve all three without any of them knowing about the others.

### 4.11 QueryProgram invoke: mutations inside the query pipeline

QueryProgram already has `invoke`, `branch`, `traverseInvoke`, and `traverse` instructions (merged from `claude/add-query-view-testing-O4HbA`; see PRD: `docs/prd/query-program-invoke.md`). These allow mutations inside the query pipeline — bulk edits, optimistic creates, inline updates — without leaving the QueryProgram world.

**How it works:** An `invoke` instruction declares a concept action invocation as pure data. The QueryExecution interpreter dispatches it through the sync engine using a coroutine model (execute → yield invoke → resume with completion → continue). The completion flows back into the program's binding environment for downstream instructions (e.g., re-scan to get refreshed data).

**Purity tracking:** Programs are classified `pure` (empty), `read-only` (only scan/filter/sort/etc.), or `read-write` (contains invoke). The caching layer uses this: read-only programs are cached; read-write programs execute fresh every time.

**Example — bulk status update:**
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

**How this connects to ActionBinding:** ActionBinding can target a QueryProgram with invoke instructions instead of a bare concept action. The CompileActionQuery sync (already implemented) builds invoke-bearing QueryPrograms from InteractionSpec configs. This means:

- **Inline edit in a table** → ActionBinding builds a QueryProgram: invoke the update, re-scan the row, return refreshed data
- **Bulk action on selected rows** → ActionBinding builds a QueryProgram: traverseInvoke over selected rows, re-scan, return updated set
- **Optimistic create** → ActionBinding builds a QueryProgram: invoke create, branch on ok/error, re-scan on success, return error on failure

The view receives the QueryProgram result (which includes both the mutation effect and the refreshed data) and re-renders. No separate ResultSet/cache concept needed — the QueryProgram's binding environment IS the local result.

**Static analysis providers** (also already implemented):
- **InvokeEffectProvider** — extracts which concept actions a program invokes (enables authorization pre-check)
- **QueryPurityProvider** — classifies purity for caching decisions
- **QueryCompletionCoverage** — verifies all invoke variants are handled by branch instructions

**Compilation sync — ActionBinding to invoke-bearing QueryProgram:**

```
sync CompileActionBindingQuery [eager]
when {
  ActionBinding/bind: [ binding: ?b; target: ?target; parameterMap: ?pm ]
    => [ ok(binding: ?b) ]
}
where {
  query(?target, concept: ?concept; action: ?action)
}
then {
  QueryProgram/create: [ program: ?b ]
  QueryProgram/invoke: [
    program: ?b;
    concept: ?concept;
    action: ?action;
    input: ?pm;
    bindAs: "result"
  ]
  QueryProgram/pure: [ program: ?b; variant: "ok"; output: "result" ]
}
```

For bulk actions with `traverseInvoke`, the sync builds a more complex program:

```
sync CompileBulkActionQuery [eager]
when {
  ActionBinding/bind: [ binding: ?b; target: ?target; parameterMap: ?pm ]
    => [ ok(binding: ?b) ]
}
where {
  ActionBinding: { ?b executionPolicy: "bulk" }
  query(?target, concept: ?concept; action: ?action)
}
then {
  QueryProgram/create: [ program: ?b ]
  QueryProgram/scan: [ program: ?b; source: ?pm.sourceBinding; bindAs: "items" ]
  QueryProgram/traverseInvoke: [
    program: ?b;
    sourceBinding: "items";
    itemBinding: "_item";
    concept: ?concept;
    action: ?action;
    inputTemplate: ?pm;
    bindAs: "results"
  ]
  QueryProgram/pure: [ program: ?b; variant: "ok"; output: "results" ]
}
```

### 4.12 View integration architecture

The full architecture connecting ActionBinding to the view system:

**InteractionSpec migration:** InteractionSpec currently stores action configs as inline JSON blobs (`rowActions: '[{"concept":"Theme","action":"activate",...}]'`). These are proto-ActionBindings. The migration:

- InteractionSpec's `rowActions`, `createForm`, and (new) `bulkActions` fields store ActionBinding references instead of inline JSON
- A CompileActionQuery sync builds invoke-bearing QueryPrograms from these ActionBindings
- Existing seed data continues to work via a compat sync that creates ActionBindings from the legacy JSON format

**ComponentMapping extension:** ComponentMapping currently binds data (slots + props) but cannot bind actions. Widget `requires` blocks already declare needed actions:

```
requires @1 {
  fields { blockId: String; schemaName: String; ... }
  actions { updateField: {}; removeBlock: {}; }
}
```

A new `bindAction` action on ComponentMapping fills this gap:

```
action bindAction(mapping: M, actionPart: String, binding: String)
  -> ok() { Action part bound to ActionBinding. }
  -> notfound(message: String) { Mapping or action part doesn't exist. }
```

This makes ComponentMapping the full override path: `Schema + DisplayMode → widget + slot bindings + prop bindings + action bindings`.

**The ownership model:**

```
ActionBinding (canonical action config — what, how, policies)
     ↑ referenced by
     ├── InteractionSpec (row actions, create form, bulk actions on views)
     ├── ComponentMapping (action part bindings on widgets)
     ├── Page/Layout config (shell-level actions, FAB, toolbar)
     └── Block editor config (slash commands, block actions)
```

ActionBinding is independent — knows nothing about placement. The referencing concepts handle placement context.

**View resolution flow:**

```
ViewShell/resolve
  ├── compile QueryProgram from filter+sort+group+projection+dataSource
  │     └── read-only path: QueryExecution → rows
  │
  └── resolve InteractionSpec
        ├── createForm → ActionBinding ref → "Create" button
        ├── rowActions → [ActionBinding ref, ...] → per-row buttons
        ├── bulkActions → [ActionBinding ref, ...] → bulk toolbar
        └── each ActionBinding → CompileActionQuery sync
              → invoke-bearing QueryProgram (read-write)
              → on user click: QueryExecution coroutine
              → mutation + refreshed data in one pass
```

**Param validation sync:** ActionBinding parameter maps reference row fields (`{ theme: "row.id" }`). These fields must exist in the QueryProgram's projection. A sync validates this:

```
sync ValidateActionParams [eager]
when {
  InteractionSpec/addRowAction: [ spec: ?s; binding: ?b ]
    => [ ok() ]
}
where {
  ViewShell: { ?v interaction: ?s; projection: ?p }
  ActionBinding: { ?b parameterMap: ?pm }
  ProjectionSpec: { ?p fields: ?fields }
  guard(allParamFieldsIn(?pm, ?fields))
}
then {
  // validation passed — or return error if guard fails
}
```

No current platform statically validates that action parameters are satisfiable by the view's projected fields.

---

## 5. Widget Pipeline Integration

### 5.1 ActionType → Affordance → WidgetResolver

The existing Interactor → Affordance → WidgetResolver pipeline handles action widgets the same way it handles field widgets. ActionType produces type strings that Affordance matches on:

```
ActionBinding/bind  →  ActionType/classify  →  Affordance/match  →  WidgetResolver/resolve
                                                      ↑
field context       →  Interactor/classify  ──────────┘
```

Two independent classification concepts feeding into the same resolution pipeline. Each concept has one job. The shared interface is a type string that Affordance understands.

### 5.2 Affordance declarations for action widgets

Widget specs declare affordances for action types:

```
// In a button widget's affordance block
affordance {
  serves: invoke;
  specificity: 10;
  when {
    context: "table-row";
  }
}
```

Context-dependent resolution:
- `invoke` in a table row → compact icon button
- `invoke` on a detail page → prominent labeled button
- `invoke` with `reversal: none` → red-styled button (irreversible)
- `invoke` in a toolbar → icon button or dropdown menu item
- `invoke` on mobile → floating action button
- `commit` after a form → full-width submit button
- `trigger` anywhere → button with progress indicator

### 5.3 Automatic variant-driven UI states

When ActionBinding/invoke is in flight, the widget enters a `pending` state. When a result arrives, the widget transitions to the appropriate state based on the variant:

```
idle → [user clicks] → confirming? → [user confirms] → validating → executing →
  → ok: success (auto-dismiss after 2s, undo toast if reversible)
  → error: error (with message + retry button if retryPolicy set)
  → invalid: validation (with field-level errors from Validator)
  → notfound: not-found (with explanation + back button)
  → unauthorized: forbidden (with explanation)
```

This state machine is derived from the concept spec's variant declarations — no builder configuration required. The widget pipeline renders the appropriate UI for each state through Affordance declarations.

### 5.4 Placement contexts in Clef Base

ActionBinding widgets can appear across all Clef Base surfaces. The ActionBinding configuration lives at the **placement level** — when a builder puts a widget in a view/page and wires it to a specific concept action. The same button widget can be bound to different concept actions in different contexts.

| Placement context | Example | How ActionBinding is configured |
|---|---|---|
| **View row actions** | "Complete" button on each task row | InteractionSpec `rowActions` — ActionBinding per action |
| **View-level actions** | "Create Task" button above a table | InteractionSpec `createForm` — ActionBinding for create action |
| **Bulk action toolbar** | "Archive selected" when rows selected | InteractionSpec bulk actions — ActionBinding with selected row context |
| **App shell** | "Leave Space" in sidebar, "Logout" in header | Shell zone configuration — ActionBinding per global action |
| **Block editor** | Slash command actions, block delete/reorder | Block anatomy action parts — ActionBinding per block action |
| **Span toolbar** | Highlight, comment, cite (floating on selection) | Floating toolbar — ActionBinding per span action |
| **Forms** | Submit, cancel, field-level save | Form anatomy — ActionBinding for commit |
| **Pane chrome** | Minimize, maximize, pin, close | Pane header — ActionBinding per window action |
| **Detail display** | Inline edit triggers, property save | Detail anatomy — ActionBinding per field action |
| **Content embeds** | "View in context", remove embed | Embed anatomy — ActionBinding per embed action |
| **Display mode picker** | Toggle between table/cards/board | Picker — ActionBinding per display mode switch |
| **Context menus** | Right-click actions on rows, blocks, nodes | Menu items — ActionBinding per menu action |
| **Keyboard shortcuts** | Cmd+Z, Cmd+S, Cmd+N | Shortcut → ActionBinding invocation |
| **Quick Capture FAB** | Floating action button (bottom-right) | FAB — ActionBinding for quick create action |
| **Calendar/timeline** | Event click, view navigation | Calendar — ActionBinding for event actions |

The builder never touches ActionType, Affordance, or WidgetResolver directly. They work with ActionBinding (pick action, map params, set policies). The pipeline runs under the hood.

---

## 6. Authoring Model

### 6.1 Progressive disclosure: one UI that grows

The three levels of complexity are not three separate tools — they are **one progressive UI** that reveals more capability as the builder needs it. The builder never has to choose "which level am I at." They start simple and add complexity incrementally.

**Single action** (starting state). The builder sees:

```
┌─────────────────────────────────────────┐
│ Concept: [Task ▾]                       │
│ Action:  [complete ▾]                   │
│ Params:  taskId = [row.id ▾]            │
│                                         │
│              [+ Add another step]       │
└─────────────────────────────────────────┘
```

This covers ~70% of use cases: mark complete, delete, navigate, toggle status. Under the hood, this is a single ActionBinding.

**Multi-step** (click "+ Add another step"). The UI expands to a vertical step editor:

```
┌─────────────────────────────────────────┐
│ Step 1: Task/complete                   │
│   params: taskId = row.id               │
│                                         │
│ Step 2: [pick action...]                │
│   ↳ [+ Add condition]                  │
│   ↳ [+ On error...]                    │
│                                         │
│              [+ Add another step]       │
│              [Convert to Workflow →]    │
└─────────────────────────────────────────┘
```

This covers ~25% of use cases: multi-step flows with conditions and error handling. Under the hood, the moment a second step is added, the system silently creates a ProcessSpec. The ProcessSpec provides sequential composition, conditional routing edges (`on_variant`, `condition_expr`), retry policies (RetryPolicy), and saga-style rollback (CompensationPlan). The ActionBinding now targets the ProcessSpec.

**Full workflow** (click "Convert to Workflow"). For durable state machines and event-driven behavior. The ProcessSpec is scaffolded into a Workflow. This is the escape hatch for logic that exceeds what ProcessSpec can express (~5% of use cases).

**This same progressive UI appears everywhere:**
- In the **view editor** when configuring row actions or create forms (writing to InteractionSpec)
- In the **component mapping admin** when binding action parts (writing to ComponentMapping)
- In the **page editor** when adding buttons to layout zones
- In the **block editor** when configuring slash command actions

### 6.2 Parameter context

The context object available for parameter binding provides:
- `row` — current row data if in a table/card/board
- `page` — current page state
- `user` — current Session/user
- `controls` — all ControlState values on the page
- `selection` — selected rows for bulk actions
- `block` — current block context if in the block editor

### 6.3 Visual builder for end users

1. **Quick bind**: Right-click a concept action in the sidebar → "Add button for this action" → button appears with auto-mapped parameters based on context. The system infers parameter bindings from type matching (if the action needs `taskId: TaskId` and the current row is a Task, it auto-binds `row.id`).

2. **Action picker panel**: Three-column layout: (1) Concept list → (2) Action list → (3) Parameter binding form. Each parameter shows its type, a dropdown of compatible context values, and a formula editor toggle for computed values.

3. **Preview panel**: Shows the button in its target context with variant simulation (click "Simulate error" to see error state, "Simulate invalid" to see validation errors, etc.).

### 6.4 Concept author configuration

For concept authors configuring ActionBindings in view/page definitions, the configuration is declarative and lives at the view or InteractionSpec level — not in `.widget` files. Widget specs declare capabilities (anatomy parts, FSM states, `requires` blocks). ActionBinding configuration happens when a widget is placed in context:

```
// In a view's InteractionSpec or page configuration
// (exact format TBD — this is view-level config, not widget spec)
rowActions: [
  {
    label: "Send Invoice",
    target: "Invoice/send",
    params: { invoiceId: "row.id", recipient: "row.customer.email" },
    precondition: "row.status == 'draft'",
    executionPolicy: "pessimistic",
    icon: "send",
    variant: "primary"
  },
  {
    label: "Void Invoice",
    target: "Invoice/void",
    params: { invoiceId: "row.id" },
    executionPolicy: "pessimistic",
    icon: "x-circle",
    variant: "destructive"
  }
]
```

Note: `confirmWhen` is omitted for "Void Invoice" because the system derives it automatically — `Invoice/void` declares `reversal: none`, so confirmation is automatic.

---

## 7. Usability Audit Fixes

Each fix maps directly to the concept architecture. All are incremental — each can ship independently.

### 7.1 Silent failure on ControlBlock Invoke (P0)

**Current state:** ControlBlock has an "Invoke" button with no loading or error feedback.

**Fix:** Replace the raw `onClick` handler with `ActionBinding/invoke(context)`. The widget pipeline's `invoke` ActionType → Affordance → Widget resolution automatically provides:
1. `pending` state with spinner while action executes
2. FlowTrace tracks the invocation
3. On `ok`: brief success indicator (green check, auto-dismiss), undo toast if reversible
4. On `error`: inline error message with retry button
5. On `invalid`: field-level violation highlights

**Scope:** Single component change in `clef-base/app/components/widgets/BlockEditor.tsx`.

### 7.2 Dead-end "Leave Space" button (P0)

**Current state:** "Leave Space" button is a placeholder onClick that doesn't invoke `VersionSpace/leave`.

**Fix:** Create ActionBinding with:
- `target: "VersionSpace/leave"`
- `params: { space: currentSpace.id }`
- Confirmation is automatic — `VersionSpace/leave` declares `reversal: none` (leaving a space is irreversible), so the system shows: "You'll lose access to [Space Name]. This cannot be undone."
- `ok` variant navigates to space list
- `error` variant (e.g., "you're the last admin") shows inline explanation

**Scope:** Single component change in `clef-base/app/components/AppShell.tsx`.

### 7.3 Missing retry on fetch failures (P1)

**Current state:** Data fetches that fail show no retry affordance.

**Fix:** ActionBinding with `retryPolicy`:
```
retryPolicy: {
  maxAttempts: 3,
  backoff: "exponential",
  initialDelay: 1000,
  maxDelay: 10000
}
```
FlowTrace tracks retry attempts. UI shows: "Failed to load. Retrying in 3s... (attempt 2/3)" with manual retry button. After max retries, error state persists with clear message.

**Scope:** Affects all data-fetching ActionBindings. Configure as default retryPolicy for read actions.

### 7.4 Inconsistent error states across the app (P1)

**Current state:** Each component implements ad hoc error handling (or doesn't).

**Fix:** Systematic — every component that invokes an action goes through ActionBinding → FlowTrace → WidgetResolver. Error states for table row buttons, toolbar buttons, form submit buttons, and pane actions all use the same `invoke` ActionType → Affordance → Widget pipeline. Visual design of error states (red border, error icon, message text, retry button) defined once in Affordance declarations.

**Scope:** Incremental migration. Start with highest-traffic surfaces (view row actions, form submits), expand to remaining surfaces.

---

## 8. Frontend Infrastructure Requirements

The concept architecture and sync wiring define _what_ happens. The frontend infrastructure renders _how it looks_. The PRD's "zero-config feedback" promise requires frontend components that don't yet exist in Clef Base.

### 8.1 Current state

| Feature | Current state | Where |
|---|---|---|
| Modal/dialog | Inline `position: fixed` divs, per-component | CreateForm.tsx, QuickCapture.tsx |
| Toast/notification | Single ad hoc `useState` + `setTimeout(2500)` | BlockEditor.tsx (line ~2888) |
| Loading indicators | `disabled={submitting}` on buttons, no spinners | CreateForm.tsx, InlineEdit.tsx |
| Kernel invoke | `useKernelInvoke()` hook — fully implemented | clef-provider.tsx |
| Variant checking | `result.variant === 'ok'` — fully implemented | Every component that invokes |

The backend plumbing is solid. The frontend rendering for automatic states is ad hoc per component.

### 8.2 Required Surface widgets

Each of these should be a `.widget` spec going through the normal widget pipeline, not bespoke React components.

**Confirmation dialog widget.** Rendered when ActionBinding enters `confirming` state. Receives: action label, confirmation message (derived from concept spec or `confirmWhen` expression), confirm/cancel buttons. The confirmation message for irreversible actions (target has `reversal: none`) is auto-generated: "This cannot be undone. Are you sure?"

**Toast/snackbar widget.** Rendered when Undo/offer fires. Supports: message text, optional action button ("Undo"), auto-dismiss timer, queue for multiple simultaneous toasts. Also used for success feedback after `ok` variant.

**Inline error widget.** Rendered when ActionBinding returns `error` variant. Displays: error message from variant data, optional retry button (if retryPolicy is set or action is idempotent). Positioned inline relative to the triggering button, not as a global notification.

**Validation error widget.** Rendered when ActionBinding returns `invalid` variant. Displays: field-level violation messages mapped to form fields (red borders, error text below fields). Requires the Validator's violation data to include field names.

**Loading indicator widget.** Rendered when ActionBinding is in `pending` state. Two modes: button overlay (spinner replaces button icon, button disabled) and inline progress (for longer operations with RetryPolicy showing "Retrying in 3s...").

### 8.3 Infrastructure concepts

**A centralized overlay manager** is needed so that confirmation dialogs and toasts can render without each widget building its own fixed-position overlay. This maps to the existing Shell concept's overlay zone management — `Host/mount(zone: "overlay")` for modals, a toast-specific zone for snackbars.

The rendering flow for confirmation:
1. ActionBinding/invoke enters `confirming` state
2. Sync fires: `Host/mount(concept: "ActionBinding", view: "confirm-dialog", zone: "overlay")`
3. Shell renders the overlay zone with the confirmation dialog widget
4. User confirms → `ActionBinding/confirm` → dialog unmounts via `Host/unmount`
5. User cancels → `ActionBinding/cancel` → dialog unmounts

The rendering flow for undo toast:
1. Undo/offer fires with entry and TTL
2. Sync fires: toast widget renders in Shell's toast zone
3. Timer expires or user clicks Undo → toast dismisses
4. Multiple toasts queue vertically (newest on top)

This keeps the infrastructure within the existing concept architecture — Shell zones handle positioning, Host handles lifecycle, widgets handle rendering. No new mechanisms.

---

## 9. Implementation Plan

### Phase 1: Foundation (ActionBinding + ControlState + frontend infra)

**Create concepts:**
- `ActionBinding` concept spec + handler (functional style, StorageProgram)
- `ControlState` concept spec + handler
- Conformance tests for both

**Create Surface widgets:**
- Confirmation dialog widget (`.widget` spec + React adapter)
- Inline error widget
- Loading indicator widget (button overlay mode)

**Create syncs:**
- ActionBinding → ActionLog/record (trace every invocation)
- ActionBinding → Binding/invoke (transport delegation)
- ActionBinding `confirming` → Host/mount confirmation dialog

**Immediate fixes:**
- ControlBlock Invoke → ActionBinding (7.1)
- Leave Space → ActionBinding (7.2)

**Deprecate:** Control concept (mark as deprecated, keep for backward compatibility during migration)

### Phase 2: Widget Pipeline (ActionType + Affordance wiring)

**Create concepts:**
- `ActionType` concept spec + handler with built-in `invoke`, `commit`, `trigger` types

**Create syncs:**
- ActionBinding/bind → ActionType/classify
- ActionType result → Affordance/match → WidgetResolver/resolve

**Widget updates:**
- Add `invoke` affordance declarations to existing button widgets
- Add variant-driven state machine to button widgets (pending, success, error, invalid states)

### Phase 3: Pre-flight + Retry

**Create syncs:**
- ActionBinding/invoke → Validator/validate (pre-flight gate)
- Validator failure → ActionBinding/complete with `invalid` variant

**ActionBinding extensions:**
- `retryPolicy` support with exponential backoff
- FlowTrace integration for retry tracking
- Retry UI affordance

**Fix:** Missing retry on fetch failures (7.3)

### Phase 4: Undo

**Create concepts:**
- `UndoStack` concept spec + handler
- `Undo` concept spec + handler

**Create syncs:**
- ActionBinding/invoke ok + has reversal → UndoStack/push
- UndoStack/push → Undo/offer (toast)
- Undo/execute → UndoStack/undo
- UndoStack/undo → ActionBinding/invoke (reversal)

**UI:**
- Undo toast widget with auto-dismiss
- Cmd+Z / Cmd+Shift+Z keyboard shortcut wiring

### Phase 5: View integration + consistent error states (migration)

**View system wiring:**
- InteractionSpec: migrate `rowActions`/`createForm` from inline JSON to ActionBinding references; add `bulkActions` field
- ComponentMapping: add `bindAction(mapping, actionPart, binding)` action for widget action part bindings
- CompileActionBindingQuery sync: build invoke-bearing QueryPrograms from ActionBinding configs (extends existing CompileActionQuery sync)
- Param validation sync: verify ActionBinding param field references exist in ProjectionSpec
- Compat sync: create ActionBindings from legacy InteractionSpec JSON format (migration path)

**Progressive disclosure UI:**
- Single action editor: concept picker → action picker → parameter binder
- "+ Add another step" silently creates ProcessSpec; reveals vertical step editor with conditions/error handling
- "Convert to Workflow" escape hatch scaffolds Workflow from current ProcessSpec steps
- Same UI appears in view editor, component mapping admin, page editor, block editor

**Existing UI updates:**
- SlotSourceEditor (`clef-base/app/components/widgets/SlotSourceEditor.tsx`, 630 lines): add "Action Bindings" panel for `bindAction` — wire widget `requires.actions` parts to ActionBindings. Currently only has slot + prop binding; no action binding UI
- ViewEditor Controls panel (`clef-base/app/components/ViewEditor.tsx`, ControlsConfigurator ~100 lines): replace inline `ControlsConfig` (concept/action/fields) with ActionBinding picker. Add row actions editor and bulk actions editor. This is where the progressive disclosure action editor lives
- FormBuilder (`clef-base/app/components/widgets/FormBuilder.tsx`): submit actions use `useKernelInvoke()` directly — migrate to ActionBinding for confirmation/error/loading states
- FormRenderer (`clef-base/app/components/widgets/FormRenderer.tsx`): form submit and field save actions — migrate to ActionBinding
- SchemaFieldsEditor (`clef-base/app/components/widgets/SchemaFieldsEditor.tsx`): add/remove/reorder field actions — migrate to ActionBinding
- CreateForm (`clef-base/app/components/widgets/CreateForm.tsx`): modal submit — migrate to ActionBinding (has basic `submitting` state but no variant-driven feedback)
- FormMode (`clef-base/app/components/widgets/FormMode.tsx`): save/cancel — migrate to ActionBinding

**Systematic migration** of all action-triggering components to use ActionBinding:
- View row actions (TableDisplay, CardGridDisplay, BoardDisplay)
- Form submits (CreateForm, FormMode)
- Block editor actions (BlockEditor, SpanToolbar, ImageToolbar)
- Pane chrome (PaneHeader)
- App shell actions (sidebar nav, Quick Capture)
- Calendar/timeline actions
- Graph/canvas actions

**Outcome:** Consistent error states across all surfaces (7.4).

---

## 10. Concept Dependency Map

```
ActionBinding (canonical action config)
     │
     ├──[sync]──→ Binding/invoke (transport)
     ├──[sync]──→ Validator/validate (pre-flight)
     ├──[sync]──→ ActionLog/record (audit trail)
     ├──[sync]──→ FlowTrace/build (execution tracking)
     ├──[sync]──→ UndoStack/push (reversible actions only)
     │                 │
     │                 └──[sync]──→ Undo/offer (toast)
     │
     ├──[sync]──→ ActionType/classify
     │                 │
     │                 └──→ Affordance/match ──→ WidgetResolver/resolve
     │
     └──[sync]──→ CompileActionQuery ──→ QueryProgram (invoke-bearing)
                       │
                       └──→ QueryExecution (coroutine) ──→ refreshed result
     ↑ referenced by
     ├── InteractionSpec (row actions, create form, bulk actions)
     ├── ComponentMapping (widget action part bindings)
     ├── Page/Layout config (shell-level actions)
     └── Block editor config (slash commands, block actions)

ControlState (reactive UI state)
     │
     └── read by parameter expressions in ActionBinding context
```

All composition is through syncs. No concept depends on another's internal state. Each can be used independently.

---

## 11. Success Criteria

1. **Zero-config feedback:** A builder creates an ActionBinding targeting any concept action. Without any additional configuration, the button automatically shows loading state, appropriate error messages for each variant, and confirmation for irreversible actions.

2. **Consistent error UX:** Every action-triggering surface in Clef Base renders errors identically — same visual treatment, same retry behavior, same FlowTrace correlation.

3. **Undo within 5 seconds:** After any reversible action, an undo toast appears. Clicking it reverses the action. Cmd+Z works for the full session history.

4. **Pre-flight prevents failures:** Actions with Validator constraints show violations before execution. The user sees "Cannot send invoice: amount is zero" with field highlights, not a post-execution error.

5. **No new grammar:** All capabilities derive from existing concept spec features (return variants, `reversal:` declarations, operational principles). No extensions to the `.concept` grammar are required.

---

## Appendix A: Concepts Inventory

| Concept | Status | Location | Role |
|---------|--------|----------|------|
| ActionBinding | **New** | TBD | Core: user interaction → concept action |
| ControlState | **New** | TBD | Core: reactive UI state holding |
| ActionType | **New** | TBD | Pipeline: action interaction classification |
| UndoStack | **New** | TBD | Undo: ordered history of reversible actions |
| Undo | **New** | TBD | Undo: ephemeral time-limited undo offers |
| Control | **Deprecated** | `repertoire/concepts/automation/control.concept` | Replaced by ActionBinding + ControlState |
| Binding | Existing | `repertoire/concepts/ui-core/binding.concept` | Transport bridge to backend |
| Validator | Existing | `repertoire/concepts/infrastructure/validator.concept` | Pre-flight validation |
| ActionLog | Existing | `specs/framework/action-log.concept` | Audit trail |
| FlowTrace | Existing | `specs/framework/flow-trace.concept` | Execution tracking |
| Interactor | Existing | `repertoire/concepts/ui-component/interactor.concept` | Field interaction classification |
| Affordance | Existing | `repertoire/concepts/ui-component/affordance.concept` | Widget capability declarations |
| WidgetResolver | Existing | `repertoire/concepts/ui-component/widget-resolver.concept` | Context-aware widget selection |
| ProcessSpec | Existing | `repertoire/concepts/process-foundation/process-spec.concept` | Multi-step sequential execution |
| RetryPolicy | Existing | `repertoire/concepts/process-reliability/retry-policy.concept` | Retry with backoff |
| CompensationPlan | Existing | `repertoire/concepts/process-reliability/compensation-plan.concept` | Saga-style rollback |
| Workflow | Existing | `repertoire/concepts/automation/workflow.concept` | Durable state machines |
| AutomationRule | Existing | `repertoire/concepts/automation/automation-rule.concept` | Event-driven triggers |
| InteractionSpec | **Updated** | `specs/view/interaction-spec.concept` | Migrate rowActions/createForm to ActionBinding refs; add bulkActions |
| ComponentMapping | **Updated** | `clef-base/concepts/component-mapping.concept` | Add bindAction for widget action part bindings |
| QueryProgram | Existing | `specs/view/query-program.concept` | invoke/branch/traverseInvoke for mutations in query pipeline |
| QueryExecution | Existing | `specs/view/query-execution.concept` | Coroutine dispatch for invoke-bearing programs |

## Appendix B: Companion Documents

- **Competitive research:** `docs/research/controls-and-buttons/controls-and-buttons-research.md` — platform-by-platform deep dives and cross-cutting analysis
- **QueryProgram invoke PRD:** `docs/prd/query-program-invoke.md` — mutations inside the query pipeline (invoke, branch, traverseInvoke, purity tracking, coroutine execution)
- **Usability audit:** `clef-base/docs/usability-audit.md` — current Clef Base UX gaps
- **Concept grammar:** `.claude/skills/spec-parser/references/concept-grammar.md` — includes `reversal:` syntax
- **Integration test gen:** `handlers/ts/framework/integration-test-gen.handler.ts` — 5-tier reversal resolution system
