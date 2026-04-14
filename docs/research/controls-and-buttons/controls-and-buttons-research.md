# Buttons and controls across no-code platforms: a design blueprint for Clef Base

**Every no-code platform faces the same fundamental challenge: connecting a user's click to a meaningful action.** The eight platforms analyzed here — Coda, Notion, Airtable, Glide, AppSheet, Retool, Bubble, and Softr — each solve this problem differently, and each reveals a distinct set of tradeoffs. Clef Base, with its concept-oriented architecture, explicit return variants, and sync-driven coordination, has a rare opportunity to leapfrog all of them. The key insight: where existing platforms bolt on loading states, error handling, and confirmations as afterthoughts, **Clef can derive these behaviors automatically from its formal concept specifications** — turning the concept-oriented foundation into a genuine UX advantage, not just an architectural curiosity.

The ten most important findings:

1. **Buttons occupy three distinct ontological slots** across platforms: field/column (Coda, Airtable), block/component (Notion, Retool, Bubble), and standalone named action (AppSheet, Glide). Clef should support all three through its existing widget pipeline, not force a single model.
2. **No platform handles loading/error/confirmation well by default.** Coda has no confirmation dialogs. Bubble shows only a subtle blue bar. Retool's confirmation can't be conditional. This is the largest opportunity for Clef.
3. **The formula-vs-visual-builder-vs-code spectrum** is the most consequential authoring decision. Coda's formula approach is powerful but error-prone; Bubble's visual workflows are intuitive but hide parallelism bugs; Retool's code approach is flexible but hard to maintain.
4. **Sequential execution is surprisingly hard.** Bubble's workflow actions run in parallel despite appearing sequential. Retool event handlers run in parallel. Only Coda's `RunActions()` guarantees sequential execution with inter-step recalculation.
5. **Reusable, named actions are the clear winning pattern.** Glide's Workflow Editor, AppSheet's standalone actions, and Bubble's Custom Events all point toward first-class action objects that can be referenced from multiple UI surfaces.
6. **Input parameter collection before action execution** is handled ad hoc everywhere. AppSheet's `[_INPUT]` prompting system and Coda's "Open Row For Editing" toggle are the most principled approaches.
7. **Authorization for button actions is universally weak.** No platform has granular, per-action RBAC. Most rely on component visibility (which is not security) or inherit document-level permissions.
8. **Optimistic vs. pessimistic update strategy varies** but is rarely configurable by the builder. Glide does optimistic updates; Coda is pessimistic/synchronous. None let the builder choose per action.
9. **Cross-concept coordination** (a button action that affects multiple data sources) requires workarounds on every platform — checkbox-flip triggers in Airtable, separate automations in Notion, JavaScript orchestration in Retool.
10. **Every platform's error handling is reactive rather than preventive.** No platform uses pre-flight validation to prevent actions from executing when they'll fail — a capability Clef's Validator concept already enables.

---

## Platform-by-platform deep dives

### Coda: the formula-first action model

Coda treats buttons as **formula-bearing objects** — either canvas buttons (standalone named objects on a page) or button columns (a column type where each row materializes its own button instance). The underlying data model stores an action formula, a label formula, a disable-if formula, and visual settings. This tight integration with Coda's formula system is both its greatest strength and its primary limitation.

**The action vocabulary** centers on a small set of built-in action formulas: `ModifyRows()` for updating data, `AddRow()` and `DeleteRows()` for CRUD, `RunActions()` for sequential composition, and `OpenWindow()` for navigation. Pack actions extend this to external services (Gmail, Slack, Jira). Crucially, action formulas return an **Action type**, not a data value — a distinction that prevents capturing references to newly created rows, which is one of the platform's most painful limitations.

Sequential composition works through `RunActions(action1, action2, ...)`, which forces doc recalculation between steps. This is the only platform that guarantees inter-step consistency — Bubble and Retool both default to parallel execution. Conditional logic uses `If()` and `SwitchIf()` inside action formulas. `ForEach()` provides iteration over lists.

**Controls** (sliders, dropdowns, date pickers) are a separate concept: named, state-holding canvas objects. Each control stores a value that can be referenced in any formula by name. Controls can be personal (per-user state) or collaborative (shared). The `SetControlValue()` and `ResetControlValue()` actions let buttons manipulate control state programmatically. This control-as-named-state-holder pattern is directly relevant to Clef's design.

**The major gaps.** Coda has **no native confirmation dialogs** — the most frequently requested community feature. Error handling is toast-only with no try/catch or rollback mechanism. Built-in actions cannot return references to affected rows. Button columns contribute to document size bloat. The formula language has no arbitrary HTTP request capability without building a custom Pack.

*Relevance to Clef*: Coda's formula-driven button model validates the "declarative action specification" approach but shows the limits of embedding all logic in formulas. Clef's concept actions with explicit return variants are strictly more expressive. Coda's control objects map well to what Clef's Control concept should become.

### Notion: simplicity at the cost of power

Notion offers buttons as both **page-level blocks** (`/button`) and **database properties**. Both share the same action framework but differ in context — page blocks operate on the current page, database buttons operate on the current row. The action set is small but well-designed: insert blocks, add/edit pages, send notifications, send email, send webhooks, open pages/URLs, and — critically — **show confirmation dialogs** with customizable text.

Multi-step actions are supported through sequential step chaining ("Add another step"). Notion introduced **variables** (`Define variables`) and **formula support** in action fields, enabling dynamic parameter computation. However, **there is no conditional logic within buttons** — no if/else branching, no conditional step execution. This is the platform's most significant limitation versus Coda.

**What Notion gets right:** The "Show confirmation" action is a first-class citizen, not a workaround. The multi-step UI with clear visual stacking is intuitive. The fact that button actions can trigger database automations (via property changes) creates a clean separation between direct user actions and reactive system behavior.

**What Notion gets wrong:** No scripting, no conditional logic, limited external integrations (webhook POST only), and formulas that calculate values but cannot take actions. Users consistently describe Notion buttons as "too limited for real workflows."

### Airtable: the split-personality button

Airtable has the most confusing button model of any platform because **button fields (grid view) and button elements (Interface Designer) have entirely different capabilities.** Grid-view button fields can open URLs, run scripts (via the Scripting extension), and open extensions. Interface buttons can trigger automations directly. The fact that **grid-view button fields cannot trigger automations** is the platform's most complained-about limitation — users resort to checkbox-flip workarounds.

The scripting capability is powerful: full JavaScript execution with read/write access to the entire base, **120-second timeout** for button-triggered scripts, and interactive user input via `input.recordAsync()`. Automation scripts are more restricted (12-second timeout, no interactive input, background-only execution).

**Airtable's automation system** supports conditional groups (if/else-if branches), repeating groups (iteration), and up to 25 actions per automation. However, conditional groups cannot be nested, and conditional logic cannot be combined with repeating groups in the same automation — a significant structural limitation.

Interface buttons support **visual feedback**: configurable "Color before"/"Color after" states, label text changes on completion, and check icons next to updated records. Interface buttons also support **confirmation dialogs**. Neither feature is available for grid-view button fields.

**The permission gap** is notable: button field permissions cannot be set at all — there is no way to restrict who can click a button field. This is a security concern for destructive actions.

### Glide: the action-chain pioneer

Glide's contribution to the design space is its **Workflow Editor** — a dedicated visual canvas for building multi-step action sequences with if/else branching. Actions in Glide are dual-natured: they can be configured inline as component properties (a button's "on click") or created as standalone reusable workflows in the Workflow Editor.

The action vocabulary is rich: data CRUD, navigation, communication (email, phone, SMS), API calls (Business plan), barcode scanning, voice recording, and integration-specific actions (Slack, Salesforce, OpenAI). **Compound actions** execute top-to-bottom with conditional if/else branches — more structured than Coda's formula-based conditionals.

**Glide uses optimistic updates** — the UI updates immediately and syncs in the background. This is a deliberate UX choice that makes the app feel fast but introduces the possibility of silent rollbacks if the backend rejects a change.

**The gaps:** No native confirmation dialogs (highly requested), no looping constructs, stop-on-error with no recovery mechanism, and error messages to end users are essentially non-existent unless the builder manually adds `Show Notification` steps. Debugging compound actions is described by community experts as "impossible when the app grows."

**Security model** is noteworthy: Glide's **Row Owners** system enforces data access at the server level (not just UI visibility), which is the most principled approach to action authorization of any platform studied. However, visibility conditions on action buttons are purely cosmetic — a hidden button doesn't prevent data access.

### Retool: the developer-oriented event-handler model

Retool treats buttons as **stateful components** with event handlers configured in an Inspector panel. The paradigm is: `Component Event → Event Handler Action → Query Trigger → Success/Failure Handlers`. This creates a reactive chain where queries are the central unit of data mutation.

**The query layer** is Retool's distinguishing feature. Resource queries (SQL, REST, GraphQL) execute against connected data sources. JavaScript queries provide full async/await orchestration. Critically, queries expose `isFetching` (boolean loading state), `.data` (results), and `.error` (error details) — and components can bind to these properties automatically. A button's `Loading` property can be bound to `{{ queryName.isFetching }}`, showing a spinner overlay while the query runs. This is **the most systematic approach to loading states** of any platform.

**Confirmation modals** are built-in at the query level: a checkbox enables "Show a confirmation modal before running" with configurable message text supporting dynamic expressions. The limitation is that this cannot be conditional — it's always-on or always-off per query.

**Multiple event handlers on a single component run in parallel**, which is unintuitive and leads to race conditions. Sequential chaining requires the success-handler pattern (Query A → On Success → trigger Query B) or JavaScript async/await orchestration.

**Pain points** center on state management complexity. As one community member put it: "Your app's state is implicitly spread across all the components and queries." There is no dependency graph or visual flow showing which components trigger which queries. A global error handler has been requested but doesn't exist — each query needs individual failure handlers wired manually.

### Bubble: workflows as the universal primitive

Bubble's entire programming model is **workflow-centric**: Event → Conditions → Actions. Every behavior is a workflow. Frontend workflows respond to page-level events (clicks, input changes, page loads). Backend (API) workflows run server-side, can be scheduled, and can override privacy rules.

**The biggest "gotcha" in all of no-code**: Bubble's workflow actions **appear sequential** in the UI (listed as Step 1, Step 2, Step 3) **but actually execute in parallel**. This causes constant data consistency bugs for new developers. The fix is **Custom Events**, which enforce true sequential execution and accept parameters with return values — making them essentially reusable functions.

Bubble's **error handling** has evolved but remains primitive. Default errors show browser-native alert dialogs. Element-specific error events catch workflow failures. Backend workflow debugging requires creating custom "debug" data types to log errors. There are **no built-in button loading indicators** — just a subtle blue progress bar at the top of the page that users routinely miss.

**The Custom Event pattern** is the most sophisticated action reuse mechanism of any visual platform: Custom Events can accept typed parameters, return values, and be defined inside reusable elements for cross-page access. This is close to what Clef's ActionBinding concept should enable.

### AppSheet: the expression-driven action system

AppSheet defines **actions as standalone, named objects** per table — the most structured approach of any platform. Four categories (navigation, data-change, external, grouped) with configurable position (Primary, Prominent, Inline, Hidden), conditions ("Only if this condition is true"), and confirmation settings ("Needs confirmation?" with custom message text).

**The `[_INPUT]` system** is unique: data-change actions can define input fields that prompt users for values at runtime. This is the only platform with a built-in "collect parameters before executing" mechanism — every other platform requires workarounds like form screens or modal popups.

**Grouped actions** provide sequential composition, and **Reference Actions** provide cross-table iteration (execute an action on a filtered set of rows from another table). The confirmation toggle is a native, first-class feature — simpler and more reliable than any workaround-based approach.

**The sync-based architecture** means all data changes are applied locally first (optimistic) and then synced to the server. Validation rules are enforced at each step of grouped actions, providing a form of pre-flight checking.

### Softr: the thin wrapper

Softr has the most limited button model: buttons are **UI elements within blocks** (List, Table, Kanban), each performing a **single action** (Add Record, Edit Record, Delete Record, One-click Update, Call API, navigation). No multi-step actions, no conditional logic, no scripting. The Call API action (POST/PUT/PATCH/DELETE) is the bridge to external automation tools.

Softr wraps Airtable automations indirectly: CRUD operations write to Airtable, triggering "When record changes" automations. The Call API action can send webhooks to Airtable's "When webhook received" trigger. This indirect coupling is fragile and introduces latency.

The platform does get one thing right: **conditional visibility** based on record attributes and user groups, with progressive feature unlocks by pricing tier (Free → Professional → Business).

---

## Cross-cutting design space analysis

The eight platforms reveal seven fundamental axes along which button/control designs vary. Understanding these axes is essential for making principled choices for Clef Base.

### The ontological axis: what IS a button?

Three distinct models emerge. **Button-as-field** (Coda button columns, Airtable button fields) embeds the action trigger in the data layer — each row gets its own button instance, automatically contextualized to that row's data. **Button-as-component** (Retool, Glide, Softr) treats the button as a UI element configured in a visual builder, separate from the data model. **Button-as-block** (Notion button blocks, Coda canvas buttons) places the button in a content-first document model.

The field model excels at row-contextual actions (mark as done, archive, send invoice) but struggles with app-global actions. The component model is flexible but loses automatic row context. The block model is great for doc-like interfaces but awkward for data-heavy applications. **Clef should support all three through its widget pipeline**, mapping each to the same underlying ActionBinding concept.

### The action specification axis: formula vs. visual vs. code

Coda and AppSheet use **formula/expression languages** — powerful for single-expression actions but awkward for multi-step logic. Bubble and Glide use **visual workflow builders** — intuitive for non-programmers but can hide important execution semantics (like Bubble's parallel execution). Retool and Airtable offer **code** (JavaScript) — maximally flexible but excluding non-technical users.

The winning pattern is **layered authoring**: a visual surface for simple actions, an expression/formula layer for computed parameters, and a code escape hatch for complex orchestration. Coda's approach of toggling between visual dropdown and formula editor (`f` icon) is the closest to this ideal.

### The scope axis: row, page, or app-global

Row-contextual actions (Coda's `thisRow`, Airtable's record context, AppSheet's per-record actions) are the most common pattern. Page-contextual actions (Bubble's page workflows, Notion's page blocks) operate on the current view. App-global actions (Coda's canvas buttons, AppSheet's automation bots) operate without row context.

**The critical question is how context flows to the action.** Coda uses `thisRow` keyword references. Retool uses `{{ component.selectedRow }}` bindings. AppSheet uses `[ColumnName]` references. Glide uses implicit screen context. Clef's concept architecture naturally provides context through its state model — each concept action already declares its parameters, and the ActionBinding can map context values to those parameters.

### The composition axis: single action to full workflow

A clear spectrum emerges: **single-action buttons** (Softr) → **action chains** (Coda's `RunActions`, Notion's multi-step, Glide's compound actions) → **workflow engines** (Bubble, AppSheet bots, Airtable automations). The key insight is that action chains and workflows are the same thing at different scales. What distinguishes them is whether they support branching (if/else), iteration (for-each/loops), error recovery (try/catch), and reuse (named/parameterized).

### The execution model axis: sync vs. async, optimistic vs. pessimistic

**Glide and AppSheet use optimistic updates** — the UI changes immediately, syncing in the background. This feels fast but can produce inconsistencies. **Coda uses pessimistic/synchronous execution** — the doc recalculates between `RunActions` steps. **Retool exposes query state** (`isFetching`) so the builder can bind loading indicators explicitly. **Bubble provides almost no execution feedback** by default.

No platform lets the builder **choose** the execution model per action. Clef's explicit return variants make this possible: an action declared with only `ok` and `error` variants could safely use optimistic updates, while an action with `invalid` or `notfound` variants should use pessimistic execution with pre-flight validation.

### The feedback axis: loading, error, success, confirmation

This is where every platform falls short:

- **Loading**: Only Retool has systematic, automatic loading states (via `isFetching`). Everyone else requires manual implementation.
- **Errors**: No platform has structured error handling integrated with the action system. Coda has no try/catch. Bubble uses browser alerts. Retool requires per-query failure handlers.
- **Confirmation**: AppSheet has the cleanest native implementation ("Needs confirmation?" toggle). Notion's "Show confirmation" action is a good but manual approach. Coda, Glide, and Bubble lack native confirmation entirely.
- **Success**: Only Airtable (Interface buttons with "Color after" and check icons) provides automatic success feedback.

### The parameter collection axis

**How do you collect user input before executing an action?** AppSheet's `[_INPUT]` system prompts users with dialog fields at runtime — the most principled approach. Coda's "Open Row For Editing" toggle opens a modal for newly created rows. Retool uses form components bound to query parameters. Bubble uses input elements on the page. Glide uses form screens. **No platform has a general-purpose "collect parameters for this action" mechanism** that automatically generates input UI from the action's parameter signature.

---

## Proposals for Clef Base

### Proposal 1: decompose Control into three concepts

The current Control concept ("UI controls for automation management") conflates three distinct ideas that should be separate concepts, each with its own state, actions, and operational principles.

**ActionBinding** — the core concept that connects a user interaction to a concept action invocation. Its state includes: the target concept and action (e.g., `Task/complete`), parameter mappings (binding context values to action parameters), preconditions (when the action is available), and execution policy (optimistic/pessimistic, confirmation required). This is what makes a button "do something."

```
concept ActionBinding
  state
    target: ActionRef                    // e.g., Task/complete
    parameterMap: Map<ParamName, Expr>   // e.g., {taskId: context.row.id}
    precondition: Expr?                  // e.g., context.row.status != "done"
    confirmWhen: Expr?                   // e.g., target.isDestructive
    executionPolicy: "optimistic" | "pessimistic" | "auto"
  actions
    invoke(context: ActionContext)
      ok: {result: ActionResult, trace: FlowTraceId}
      error: {variant: ErrorVariant, message: string, trace: FlowTraceId}
      invalid: {violations: Violation[], trace: FlowTraceId}
      unauthorized: {reason: string}
    bind(target: ActionRef, params: Map<ParamName, Expr>)
  principle
    // After bind(t, p), invoke(ctx) calls t with p resolved against ctx
    // invoke always produces a FlowTrace entry
    // if precondition evaluates false, invoke returns unauthorized
    // if confirmWhen evaluates true, invoke pauses for user confirmation before executing
```

**ActionChain** — composes multiple ActionBindings into a sequential, conditional flow. This replaces the need for Coda's `RunActions()` or Bubble's Custom Events at the specification level.

```
concept ActionChain
  state
    steps: List<ChainStep>              // ordered sequence
    errorPolicy: "stop" | "continue" | "rollback"
  types
    ChainStep = {
      binding: ActionBinding,
      condition: Expr?,                  // "only when" gate
      onError: ActionBinding?            // error recovery action
    }
  actions
    execute(context: ActionContext)
      ok: {results: List<StepResult>, trace: FlowTraceId}
      partialFailure: {completed: List<StepResult>, failed: StepResult, trace: FlowTraceId}
      error: {step: number, variant: ErrorVariant, trace: FlowTraceId}
  principle
    // Steps execute sequentially; each step's result is available to subsequent steps
    // If a step's condition is false, it is skipped
    // errorPolicy determines behavior on step failure
```

**ControlState** — the renamed, focused version of the current Control concept. It holds reactive UI state (like Coda's controls — sliders, dropdowns, date pickers) that other concepts can read. This is NOT about action triggering; it's about interactive state that feeds into filters, parameter bindings, and display logic.

```
concept ControlState
  state
    value: Any
    defaultValue: Any
    controlType: ControlType            // text, select, slider, date, toggle, etc.
    options: List<Any>?                 // for select/radio types
    personal: boolean                   // per-user vs. shared state
  actions
    set(newValue: Any)
      ok: {previous: Any, current: Any}
      invalid: {violations: Violation[]}
    reset()
      ok: {value: Any}                 // returns to defaultValue
  principle
    // After set(v), value = v
    // After reset(), value = defaultValue
    // If personal, each Session maintains independent value
```

The existing **AutomationRule** concept remains for event-driven, non-UI triggers. The existing **Workflow** concept handles multi-step state machines with durable state. ActionBinding and ActionChain sit between these: they are user-initiated (not event-driven) and stateless (not state machines).

**Why this decomposition:** It follows Daniel Jackson's principle that each concept should have one clear purpose with a single operational principle. The current Control concept tries to be both a state holder and an action trigger, which creates conceptual confusion. By separating ActionBinding (what happens when you click) from ControlState (what value a slider holds), Clef avoids the ambiguity that plagues Coda's overloaded button/control model.

### Proposal 2: three layers for specifying what a button does

A user should be able to specify button behavior at three levels of complexity, each building on the previous. The system should auto-detect the appropriate level based on what the user configures.

**Level 1: Direct action invocation.** The simplest case: bind a button directly to a concept action. The visual builder shows a concept picker → action picker → parameter binder. Parameters can be bound to context values (current row, current user, page state, ControlState values) or literal values. This covers ~70% of button use cases (mark complete, delete, navigate, toggle status).

In the visual builder, this looks like:
- "When clicked: **[Task]** → **[complete]**"
- "Parameters: taskId = **[this row's id]**"
- The builder auto-populates available context values for each parameter based on the action's signature.

**Level 2: ActionChain.** For multi-step sequences, the builder switches to a vertical step editor (similar to Notion's multi-step UI). Each step specifies an ActionBinding, optional condition, and optional error handler. Steps can reference results from previous steps using `step[n].result` syntax.

In the visual builder:
- Step 1: Task/complete → {taskId: row.id}
- Step 2 (only when step[1].ok): Notification/send → {recipient: row.assignee, message: "Task completed"}
- Step 3 (only when step[1].error): Notification/send → {recipient: currentUser, message: step[1].error.message}

**Level 3: Workflow/AutomationRule reference.** For complex, durable, or event-driven behavior, the button references an existing Workflow or AutomationRule. This is the escape hatch for logic that exceeds what ActionChain can express (state machines, long-running processes, external API orchestration).

In the visual builder: "When clicked: **Run workflow** → **[Invoice Processing Pipeline]** with {invoiceId: row.id}"

**Parameter computation** uses a lightweight expression language that resolves against the action context. The context object provides: `row` (current row data if in a table), `page` (current page state), `user` (current Session/user), `controls` (all ControlState values on the page), and `step[n]` (results of previous ActionChain steps). This is more structured than Coda's formula-in-everything approach — expressions only compute parameter values, they don't specify actions.

### Proposal 3: automatic state management from return variants

This is Clef's single biggest competitive advantage. Because every concept action declares its return variants explicitly (`ok`, `error`, `notfound`, `invalid`, `unauthorized`), the UI layer can **automatically generate appropriate feedback** without any builder configuration.

**The ActionExecution state machine** maps directly to UI states:

```
idle → [user clicks] → confirming? → [user confirms] → validating → executing → 
  → ok: success (auto-dismiss after 2s)
  → error: error (with message + retry button)
  → invalid: validation (with field-level errors from Validator)
  → notfound: not-found (with explanation)
  → unauthorized: forbidden (with explanation)
```

**Automatic loading states.** When an ActionBinding's `invoke` is called, the widget enters a `pending` state. The WidgetResolver renders the button as disabled with a spinner. This is derived from the FlowTrace — a pending trace means the action is in flight. No builder configuration needed. This surpasses Retool's `isFetching` approach because it's automatic rather than requiring explicit binding.

**Automatic error display.** When an action returns an `error` variant, the system renders an inline error message using the variant's `message` field. If the action has a `retry` affordance (determined by the concept's operational principle — idempotent actions are retryable), a retry button appears automatically. The ActionLog entry is created regardless, so the user can always find the error in their action history.

**Automatic confirmation for destructive actions.** Rather than requiring a manual "Needs confirmation?" toggle (AppSheet) or a separate "Show confirmation" step (Notion), Clef can derive confirmation requirements from the concept specification:

- Actions that return `invalid` variants → pre-flight Validator check; show violations before executing
- Actions annotated with `destructive: true` → automatic confirmation dialog
- ActionBindings whose `confirmWhen` expression evaluates to true → contextual confirmation
- Actions that would violate a sync invariant → automatic warning with invariant explanation

**Automatic optimistic UI.** The `executionPolicy` on ActionBinding determines the update strategy:
- `"optimistic"`: Apply the expected `ok` result immediately; roll back if any other variant returns. Safe for simple, low-risk mutations.
- `"pessimistic"`: Show loading state; apply result only after server response. Required for actions with side effects or complex invariants.
- `"auto"` (default): The system decides based on the action's variant set. If the only variants are `ok` and `error`, optimistic is safe. If `invalid`, `notfound`, or `unauthorized` variants exist, pessimistic is used.

**Mapping variant data to UI elements.** The `invalid` variant from Validator produces field-level errors that the widget can render inline (red borders on invalid fields, error text below). The `unauthorized` variant can trigger an authorization prompt or redirect to login. The `notfound` variant can show a "this item no longer exists" state with a back button. All of this is derivable from the concept spec without any builder configuration — a capability no existing platform offers.

### Proposal 4: dual-audience authoring that shares a single source of truth

**For concept authors writing `.concept` files**, an ActionBinding is specified declaratively:

```yaml
# In a .widget or .concept file
widget InvoiceActions:
  context: Invoice                       # row context type
  bindings:
    - name: "Send Invoice"
      target: Invoice/send
      params:
        invoiceId: context.id
        recipient: context.customer.email
      precondition: context.status == "draft"
      confirmWhen: context.amount > 10000
      executionPolicy: auto
      icon: "send"
      variant: "primary"
    
    - name: "Void Invoice"  
      target: Invoice/void
      params:
        invoiceId: context.id
      precondition: context.status in ["sent", "overdue"]
      confirmWhen: true                  # always confirm destructive
      executionPolicy: pessimistic
      icon: "x-circle"
      variant: "destructive"
```

**For end users building in Clef Base**, the visual builder provides:

1. **Quick bind**: Right-click a concept action in the sidebar → "Add button for this action" → button appears with auto-mapped parameters based on the current page/row context. The system infers parameter bindings from type matching (if the action needs an `invoiceId: InvoiceId` and the current row is an Invoice, it auto-binds `row.id`).

2. **Action picker panel**: A three-column layout: (1) Concept list → (2) Action list for selected concept → (3) Parameter binding form for selected action. Each parameter shows its type, a dropdown of compatible context values, and a formula editor toggle for computed values.

3. **Chain builder**: When "Add step" is clicked, the single-action view expands to a vertical chain editor. Each step is a card showing the action, parameters, and optional condition. Drag to reorder. Click the error-handler icon on any step to configure recovery behavior.

4. **Preview panel**: Shows the button in its target context with a simulation of what each variant response would look like (click "Simulate error" to see the error state, "Simulate invalid" to see validation errors, etc.).

**Roundtripping between code and visual builder** is achieved because the visual builder writes the same `.widget` spec format that concept authors use. The builder is a structured editor for this spec — not a separate representation. Changes in either direction are reflected immediately. This avoids the "generated code you can't edit" problem that plagues Retool and Bubble.

### Proposal 5: buttons in the Interactor → Affordance → Widget pipeline

In Clef Surface's widget selection pipeline, a button is **not** a single Interactor — it's a family of Interactors at different abstraction levels.

**Interactor taxonomy for action triggers:**

- **Invoke** — one-shot action execution (maps to: button, menu item, toolbar action, swipe action)
- **Commit** — finalize a pending state change, typically after form input (maps to: submit button, save button)
- **Toggle** — switch between two states (maps to: toggle switch, checkbox, radio group acting as state changer)
- **Navigate** — move to a different view/context (maps to: link, breadcrumb, tab)
- **Trigger** — initiate a background process without immediate UI feedback (maps to: background sync button, webhook trigger)

Each Interactor declares the **semantic interaction type**, not the visual form. The Affordance layer declares what the widget can do (supports ActionBinding, supports loading state, supports inline error display, etc.). The WidgetResolver then selects the appropriate widget based on context:

- ActionBinding on a table row → button cell in the table (compact)
- ActionBinding on a detail page → prominent button with label and icon
- ActionBinding in a toolbar → icon button or dropdown menu item
- ActionBinding that is destructive → red-styled button with confirmation affordance
- ActionBinding targeting a Workflow → button with progress indicator affordance

**The key insight:** "Button" is a widget, not an Interactor. The Interactor is "Invoke" — the abstract interaction of triggering an action. Different contexts resolve "Invoke" to different widgets: a button in a toolbar, a row action in a table, a floating action button on mobile, or a context menu item. This mirrors how Coda buttons appear differently in canvas (large, labeled) vs. table columns (compact, per-row) vs. detail views (full-width) — but Clef makes this adaptation explicit through the pipeline rather than ad hoc.

### Proposal 6: how the concept-oriented foundation creates genuine competitive advantages

Clef's architecture enables five capabilities that no existing platform can match, each flowing directly from the concept-oriented foundation rather than being bolted on.

**Automatic variant-driven UI is the killer feature.** Every concept action in Clef declares its return variants explicitly. This means the system knows, at specification time, every possible outcome of an action — not just success and failure, but `notfound`, `invalid`, `unauthorized`, and any custom variants. The UI layer auto-generates appropriate visual states for each variant. Compare this to Coda, where errors produce a generic toast "unexpected error occurred," or Bubble, where default errors show a browser alert. In Clef, clicking "Send Invoice" on a voided invoice automatically shows the `invalid` variant's violation message with field-level detail — **zero builder configuration required**.

**Sync-driven cross-concept coordination replaces manual automation wiring.** In Airtable, if a button press should update one table and trigger a record creation in another, you need a checkbox-flip workaround, an automation watching for that checkbox, and careful timing. In Bubble, you need separate workflows or API calls. In Clef, a sync declaration handles this at the framework level:

```
sync TaskComplete:
  when Task/complete(taskId)
  then ActivityLog/record(action: "complete", entityId: taskId)
  then Notification/send(recipient: task.assignee.manager, message: "Task completed")
```

The button's ActionBinding targets `Task/complete`. The SyncEngine handles coordination automatically. No manual wiring, no race conditions, no missed triggers. This is what Coda's formula system aspires to but cannot achieve because Coda formulas are imperative (`RunActions` executes sequentially in a single thread), while Clef's syncs are declarative and the framework handles ordering.

**Pre-flight validation from Validator eliminates preventable failures.** No existing platform uses pre-flight validation to block actions before they execute. They all follow a reactive pattern: try the action, fail, show an error. Clef's Validator concept can check constraints before ActionBinding invokes the target action. If the Validator reports violations, the `invalid` variant is returned immediately — without even attempting the action. This means the UI can show "Cannot send invoice: amount is zero, recipient email is missing" before the user even submits, with red highlights on the specific fields.

**ActionLog provenance creates automatic undo capability.** Because every ActionBinding invocation creates an ActionLog entry with full context (who, what, when, parameters, result variant), the system can offer undo for any reversible action. Coda has limited undo for data mutations. Airtable has record revision history but no action-level undo. Clef's ActionLog, combined with the concept's inverse action (if declared), enables "Undo this action" buttons that appear automatically after successful mutations.

**Operational principles enable intelligent UI defaults.** A concept's operational principle (e.g., "After `Task/complete(id)`, `Task/status(id)` returns 'done'") tells the system what the expected post-condition of an action is. This enables true optimistic UI: the system can predict the result of `Task/complete` (status becomes "done") and update the UI immediately, then verify against the actual response. If the actual response diverges from the operational principle, the system knows something unexpected happened and can alert the user. No existing platform has this semantic understanding of action outcomes.

### Proposal 7: concrete fixes for every usability audit finding

**Silent failure on ControlBlock Invoke.** The ControlBlock currently has an "Invoke" button with no loading or error feedback. Under the proposed design, ControlBlock's Invoke button becomes an ActionBinding with automatic variant-driven feedback. When clicked: (1) the button enters `pending` state with a spinner, (2) FlowTrace tracks the invocation, (3) on `ok`, the button shows a brief success indicator (green check, auto-dismisses), (4) on `error`, an inline error message appears with the variant's error message and a retry button, (5) on `invalid`, field-level violations are highlighted. **Implementation**: Replace the raw `onClick` handler with `ActionBinding.invoke(context)` and let the WidgetResolver's Invoke Interactor handle all state transitions automatically.

**Dead-end "Leave Space" button.** The Leave Space button currently navigates the user away with no confirmation, feedback, or recovery path. Fix: (1) The ActionBinding for "Leave Space" sets `confirmWhen: true` since it's a destructive action (leaving a space may lose unsaved state), producing an automatic confirmation dialog: "You'll lose access to [Space Name]. This cannot be undone. Are you sure?" (2) The action's `ok` variant navigates to the space list. The `error` variant (e.g., "you're the last admin, cannot leave") shows an inline explanation with guidance. (3) The `unauthorized` variant (insufficient permissions to leave) shows an appropriate message. All derived from the concept spec, no manual UI work.

**Missing retry on fetch failures.** Any query or data fetch in Clef Base produces a FlowTrace entry. When a fetch action returns an `error` variant, the proposed system automatically renders a retry affordance. The retry button re-invokes the same ActionBinding with the same parameters. **For automatic retry**: the ActionBinding can declare a `retryPolicy` (exponential backoff, max attempts) in its spec. The FlowTrace tracks retry attempts. The UI shows: "Failed to load. Retrying in 3s... (attempt 2/3)" with a manual retry button. After max retries, the error state persists with a clear message and manual retry option.

```yaml
retryPolicy:
  maxAttempts: 3
  backoff: exponential
  initialDelay: 1000      # ms
  maxDelay: 10000
```

**Inconsistent error states across the app.** The root cause is that each component currently implements its own ad hoc error handling (or doesn't). The fix is systematic: every component that invokes an action goes through ActionBinding, which produces FlowTrace entries, which the WidgetResolver maps to consistent UI states. The error state for a table row button looks the same as the error state for a toolbar button or a form submit button — because they all use the same Invoke Interactor → Affordance → Widget pipeline. The visual design of error states (red border, error icon, message text, retry button) is defined once in the Affordance declarations and applied everywhere.

**Implementation priority for the audit fixes:**

1. **First** (highest impact, lowest effort): Add automatic `pending` and `error` states to ControlBlock by wrapping its Invoke handler in ActionBinding. This fixes the silent failure immediately.
2. **Second**: Add `confirmWhen: true` to the Leave Space ActionBinding and implement the confirmation dialog in the Invoke Interactor's Affordance.
3. **Third**: Implement the `retryPolicy` mechanism on ActionBinding, starting with data fetch actions.
4. **Fourth** (highest effort): Refactor all action-triggering components to use the ActionBinding → FlowTrace → WidgetResolver pipeline, ensuring consistent error states app-wide.

Each fix is incremental — you can ship fix #1 in a single PR without waiting for the full system to be in place, because ActionBinding is a standalone concept that doesn't require ActionChain or the full widget pipeline to provide immediate value.

---

## Conclusion: from bolted-on to built-in

The competitive landscape reveals a consistent pattern: **feedback, error handling, and confirmation are afterthoughts in every platform**. Coda is missing confirmation dialogs entirely. Bubble's loading indicator is a nearly invisible blue bar. Retool's confirmation modals can't be conditional. AppSheet's approach is the most principled but still requires manual per-action configuration.

Clef Base can break this pattern by deriving interaction states from concept specifications rather than requiring builders to configure them manually. The explicit-variants model means the system knows every possible outcome before the action runs. The Validator concept enables pre-flight checks that prevent failures rather than just reporting them. The sync-driven architecture eliminates the manual automation wiring that plagues every competitor. And the ActionLog creates automatic audit trails and undo capability that no formula-based or visual-builder system can match.

The proposed three-concept decomposition (ActionBinding, ActionChain, ControlState) gives Clef a cleaner ontology than any competitor. Coda conflates buttons and controls. Airtable splits buttons into incompatible grid-view and interface variants. Bubble conflates sequential and parallel execution. Clef's concept-oriented discipline avoids these muddles by giving each idea its own concept with its own operational principle. The result should be a system where adding a button to a page is as simple as Notion's approach, where composing multi-step actions is as flexible as Retool's JavaScript queries, and where loading, error, confirmation, and authorization states are automatic — not because they're hardcoded defaults, but because they're derived from the formal semantics that the concept-oriented architecture already requires.