# UI patterns for process management systems: a widget-by-widget field guide

**Process/workflow management tools converge on roughly 85 distinct widget patterns organized around four interaction domains: visual flow authoring, execution monitoring, human task management, and AI/connector configuration.** The most critical finding is that a single open-source library—React Flow/xyflow—has become the de facto canvas primitive powering most modern workflow editors, while the remaining widget surface area breaks cleanly into ~15 widget families that map well to a semantic selection pipeline like Clef Surface's Interactor/classify → WidgetResolver/resolve → Widget architecture. Gaps exist primarily in three areas: node-graph canvas primitives (no existing widget library covers this), structured condition builders (the field+operator+value pattern is universal but absent from component libraries), and execution-overlay composites (combining BPMN renderers with real-time state indicators). This report catalogs every pattern discovered, organized by the four priority tiers, with specific mapping recommendations and new `.widget` spec proposals.

---

## Priority 1: the anatomy of visual process editors

Visual process editors—the primary authoring surface for ProcessSpec—share a remarkably consistent architecture across n8n, Node-RED, Make.com, Retool Workflows, Camunda Modeler, and Flyde. The canvas is always a pannable, zoomable surface with a dotted-grid background, rendered either as HTML-over-SVG (React Flow) or pure SVG (bpmn-js/JointJS). Every tool uses a left-to-right or top-to-bottom data flow convention with **bezier curves** as the dominant edge style for workflow tools and **manhattan/orthogonal routing** for BPMN-compliant editors.

Node placement follows three patterns with varying adoption: **drag-from-palette** (Node-RED, Camunda Modeler) places a categorized vertical palette on the left; **search-and-add** (n8n, Make.com) opens a searchable panel via a "+" button or keyboard shortcut; and **context-sensitive addition** (bpmn-js) shows a context pad on the selected element for in-place type morphing. n8n's approach—where clicking "+" on an existing node opens a filtered picker and auto-wires the connection—consistently produces the lowest-friction authoring experience. Connection creation universally uses drag-from-output-port-to-input-port, though Node-RED adds Ctrl+click sequential wiring and the powerful splice-on-drop pattern (drag a node over a wire to insert it inline).

The open-source library landscape reveals clear winners. **React Flow (xyflow)** dominates with ~90k weekly npm downloads, providing HTML nodes, SVG edges, built-in MiniMap/Controls/Background components, and d3-zoom integration—but no built-in layout algorithms. **Rete.js** differentiates with typed sockets for connection validation and built-in dataflow/control-flow engines, making it better for visual programming languages. **JointJS** offers the strongest BPMN shape support and manhattan routing but locks premium features behind a commercial license. For layout, **elkjs** (the Eclipse Layout Kernel ported to JS) handles complex branching with subflows at **7.8 MB** but is necessary for production-quality results, while the simpler **dagre** works only for basic tree layouts and is now unmaintained.

### Step configuration follows a universal panel pattern

Every tool opens a right-side panel or overlay when a node is clicked, with parameters rendered dynamically from a schema. The critical widgets inside this panel are:

The **expression toggle** is the single most important micro-interaction: every field has a small button (n8n uses `$=`) switching between "Fixed" mode (standard form widget) and "Expression" mode (inline code editor). This toggle maps to a new Interactor type—a dual-mode input affordance that changes the underlying widget while preserving the field's semantic role. n8n's CodeMirror 6-based expression editor provides `$`-variable autocompletion dynamically derived from upstream node output schemas, with a live preview of the evaluated result below the editor.

The **field mapper** pattern is equally universal but implemented differently across tools. **Zapier** uses "pills"—colored bubbles showing app icon, step number, field name, and sample value—inserted by clicking from a dropdown. **Make.com** shows a hierarchical data tree of upstream module outputs that users drag into fields as colored tokens. **n8n** provides both drag-and-drop from the Input/Output panel and an expression editor with a Variable Selector tree. The common abstraction: a widget that displays available upstream data references and inserts them into the current field, preserving both the reference path and a human-readable preview. For the Clef Surface pipeline, this maps to an Interactor of type `DataReferenceSelector` that resolves to either a `PillInserter` widget (inline token mode) or `ExpressionEditor` widget (code mode).

The **condition builder** widget powers IF nodes, Switch nodes, route filters, and BPMN gateway conditions. It follows a universal structure: rows of `(left value, operator, right value)` with data-type-aware operator dropdowns (String operators: contains/equals/regex; Number operators: >/</=; Date operators: before/after; Boolean: is-true/is-false) and **AND/OR combinator toggles** between rows. n8n's implementation adds an "Add Condition" button and supports both structured mode and raw expression mode—a pattern that maps cleanly to a `ConditionBuilder` widget spec with a `combinator` state machine (AND↔OR) and extensible operator registries per data type.

### Conditional routing and versioning complete the authoring surface

Conditional routing in BPMN tools uses diamond-shaped gateway symbols (XOR with "X", parallel with "+") with conditions defined on outgoing sequence flows via the properties panel. n8n takes a more accessible approach: its IF node shows a structured condition builder with two labeled outputs ("true"/"false"), while its Switch node supports N outputs with per-output routing rules or a single expression returning the output index. Make.com's Router module splits flow into parallel branches where each connection line gets a filter configuration dialog. The key widget need: a **branch visualizer** that renders multiple labeled output connectors from a single node, color-coding taken vs. not-taken paths during execution.

For loops, tools diverge: n8n provides a dedicated Loop Over Items node and supports loop-back connections from downstream to upstream nodes; BPMN uses multi-instance markers (parallel `|||` or sequential `≡`); Make.com's Iterator/Repeater modules handle array iteration. The parallel fork/join pattern is more consistent: BPMN parallel gateways split and synchronize; n8n's Merge node joins branches with modes (Combine by Position, Wait for All); Retool blocks automatically wait for upstream dependencies.

Process versioning has converged on a **draft/published state machine** (n8n, Retool) supplemented by **named versions/milestones** (n8n, Camunda). Camunda offers the richest versioning: a visual diff view highlights additions in green on the BPMN diagram, a "Changes" sidebar lists modifications, and a code tab shows XML diff. The deployment pipeline moves through Development → Testing → Staging → Production stages. All tools now integrate with Git (n8n's source control, Camunda's Git Sync, Retool's branching, Airflow 3's GitDagBundle). For the widget library, this requires a `VersionTimeline` widget showing version entries with timestamps, a `DiffViewer` widget (both visual-diagram and text modes), and state-badge widgets for Draft/Published/Deprecated lifecycle states.

---

## Priority 2: execution monitoring demands seven widget families

Execution monitoring UIs overlay run-time state onto the process definition, creating a dual-layer visualization challenge. Research across Temporal, Camunda Operate, Airflow, Prefect, n8n, and Dagster reveals seven distinct widget families.

### Run list dashboards share universal column patterns

Every tool displays run lists with these core columns: **Run ID**, **Workflow/Process Name**, **Status** (badge), **Start Time**, **Duration** (live-updating for running instances), and **Trigger Type** (manual/scheduled/event icons). Status badges follow a near-universal color convention: Running = **blue** (often with pulsing animation), Completed = **green**, Failed = **red**, Cancelled = **gray**, Timed Out = **orange**, Waiting = **amber**. Airflow is the most granular with **13 distinct task states**, each with a unique color.

Filtering varies significantly. Temporal's List Filters use a SQL-like syntax against indexed Search Attributes, with "Saved Views" for bookmarked queries. Camunda Operate filters by process version, variable values (with operators including `like` with wildcards), and date ranges. n8n provides simpler status/date/workflow filters but adds custom metadata key-value pairs. The drill-down navigation is universal: **Run List → Run Detail → Step Detail**, with increasing specificity at each level. The widget implication: a `RunListTable` widget with configurable columns, pluggable filter bar, status badge rendering, and live-updating duration cells—plus a `StatusBadge` widget with ~8 states and consistent color mapping.

### Flow execution overlays are the most complex visualization challenge

**Camunda Operate** provides the gold standard: a bpmn-js BPMN diagram rendered as an interactive SVG with overlays added via the bpmn-js overlay API. Green highlighting marks completed nodes, blue arrows trace the executed path, a **green dot token indicator** shows the current execution position, and red incident markers (20×20px circles with white count text) flag errors. Instance counter labels on active nodes show running token counts. This requires a new `ProcessDiagramOverlay` composite widget that accepts a base diagram renderer and an overlay data model mapping node IDs to states.

**n8n's execution view** takes a simpler approach: nodes on the canvas display green checkmarks (success) or red indicators (failure), with item count badges (e.g., "15 items") and a 3-pane Node Inspector (Input | Parameters | Output). **Airflow's Grid View** uses a matrix of rows (tasks) × columns (runs) with colored cells—a compact pattern ideal for high-run-count scenarios. The Gantt View shows horizontal bars per task revealing duration and parallelism. **Temporal**, lacking a visual diagram, provides Timeline (Gantt-like), Compact (linear progression), and Full History (git-tree with colored dots) views. Each tool's approach represents a different widget: `NodeStatusOverlay`, `ExecutionGrid`, `GanttTimeline`, and `EventTree`.

### Step detail panels, event timelines, and variable inspectors

Step detail panels universally include a **JSON tree viewer** (expandable/collapsible with syntax highlighting), attempt/retry history (Temporal shows retry count, last failure, next retry time), timing breakdowns (Dagster's Gantt chart per step), and error displays (formatted stack traces with error classification). The widget need: a `JSONTreeViewer`, a `RetryTimeline`, a `TimingBreakdown` bar, and a `StackTraceFormatter`.

Event timelines range from Temporal's ~40 distinct event types grouped into collapsible Event Groups to Celonis's process mining visualizations with variant analysis and conformance checking. Audit trails follow a consistent table pattern: timestamp, actor, event type, and expandable details. The variable inspector pattern (Camunda's Variable Panel) shows name, type, value, and scope in an editable table with JSON/diff viewer modals for complex values.

Real-time update strategies divide into three tiers: **WebSocket subscriptions** (Temporal Cloud, Prefect Cloud) for instant updates, **GraphQL subscriptions** (Dagster) for typed real-time data, and **polling with exponential backoff** as the universal fallback. All tools use **optimistic UI** for user-initiated actions (cancel, retry) where status badges update immediately before server confirmation.

---

## Priority 3: human task UIs center on three interaction cycles

Human task UIs map to the claim-work-complete cycle of WorkItem, the approve-or-reject cycle of Approval, and the warn-escalate cycle of Escalation. Research across Camunda Tasklist, Flowable, ServiceNow, Jira, and Oracle BPM reveals consistent patterns.

### Task inboxes distinguish offered, claimed, and active work

The **master-detail layout** dominates: task list on the left, task form/detail on the right (Camunda Tasklist, Flowable Work). Tasks have a clear lifecycle—**Created → Claimed → Completed**—with pre-configured filter tabs: "Assigned to me" (claimed), "Unassigned" (offered to candidate group), and "Completed." The critical interaction: a **Claim button** on unclaimed tasks that transitions the task to the user's personal queue and removes it from others' group view. After claiming, the Claim button transforms into Save and Complete buttons. Priority display uses color-coded badges (Red = P1/Critical, Orange = P2/High, Yellow = P3/Medium, Blue/Gray = P4/Low) with icon variants (Jira's arrow icons: ↑↑ Critical, ↑ High, → Medium, ↓ Low). Due date warnings follow a **green → yellow → orange → red color progression** as deadlines approach.

For the widget library, this maps to a `TaskListItem` widget (title, assignee, priority badge, due date, process name, claim button), a `TaskInbox` composite with filter tabs and master-detail layout, and `PriorityBadge`/`DueDateIndicator` display widgets. The Interactor classification: when the domain concept is `WorkItem` and the user's role is `candidate`, classify as `ClaimableTask`; when the user is `assignee`, classify as `ActiveTask`.

### Dynamic forms render from JSON schemas through three competing approaches

**Camunda form-js** uses a flat JSON `components` array where each component has `type`, `key`, `label`, `layout`, and `validate` properties. Component types include textfield, number, checkbox, radio, select, textarea, taglist, datetime, dynamiclist, button, group, table, and iframe. Conditional visibility uses FEEL expressions. **Form.io** uses a richer JSON schema with `conditional` properties supporting JSONLogic. Its built-in wizard mode (`display: "wizard"`) provides multi-step forms with progress bars. **React JSON Schema Form (RJSF)** separates data schema (standard JSON Schema) from UI schema, using `dependencies` with `oneOf` for conditional fields, and supports Material UI, Ant Design, and Chakra UI themes.

The data flow is consistent: process creates user task → tasklist fetches task + form schema → renderer loads schema + process variables as initial data → user fills form → validation → completion variables flow back to process. The widget library needs a `SchemaFormRenderer` widget that accepts a JSON schema and renders it according to the UI framework, plus field-level widgets for each input type with conditional visibility support.

### Approval workflows and SLA indicators

Approval UIs use a **horizontal stepper** showing sequential chain progress (✅ Approved → 🔄 Pending → ⬜ Not Started) or a **voting panel** for parallel approvals showing all approvers with individual status and a quorum display ("2 of 3 approved"). GitHub's PR review pattern is the most refined exemplar: three review states (Comment, Approve, Request Changes), reviewer sidebar with write-access distinction, stale review dismissal on new commits, and CODEOWNERS-based automatic assignment. Policy displays show rules as text ("Requires approval from 2 of 5 reviewers") or matrices (amount thresholds × required roles).

SLA indicators are best exemplified by ServiceNow's Horizon Design System SLA Timer: **five visual states** (green = on track, yellow = warning, red = breached, gray = paused/achieved) with adaptive time formatting (years → months → days → hours → minutes). The widget displays remaining time with a colored background providing at-a-glance urgency. An SLA ribbon across the record shows multiple active SLAs simultaneously. Escalation visualization uses **tier badges** (L1/L2/L3 with blue→orange→red progression), **escalation chain indicators** (horizontal flow showing tier progression), and **alert banners** for escalated items.

---

## Priority 4: LLM and automation UIs introduce six new widget families

LLM tooling and connector configuration UIs (mapping to LLMCall, ToolRegistry, ConnectorCall, WebhookInbox, and Timer) introduce widget patterns largely absent from traditional process management tools.

### Prompt editors and model selectors

The **model selector** is a provider-grouped dropdown (OpenAI → gpt-4o/gpt-4o-mini, Anthropic → claude-3.5-sonnet) used by Dify, LangFlow, Humanloop, and OpenAI Playground. Dify adds a notable pattern: **preset parameter buttons** (Creative / Balanced / Precise) that auto-configure temperature, TopP, and max tokens in one click. The **multi-message prompt editor** shows System/User/Assistant message blocks in a stacked layout, with Dify supporting additional interaction pairs for few-shot examples. Variable insertion universally uses `{{variable}}` or `{variable}` syntax with auto-detection—when LangFlow detects a new variable in the template, a new input port dynamically appears on the node.

The **prompt playground** appears in every LLM tool: a chat-style test panel (LangFlow, Humanloop) or a split-pane layout with prompt on the left and live responses on the right. LangFlow's playground uniquely shows the agent's reasoning process—tool selection, intermediate steps—alongside the final response. **Prompt versioning** has become sophisticated: PromptLayer provides full version control with commit messages, diff views, approval workflows, release labels (dev/staging/prod), and **A/B traffic routing** between versions with percentage sliders.

For structured output, Dify offers a dual-mode schema editor: a **visual editor** (Add Field → configure name, type, description, required, enum) and a **raw JSON Schema editor** toggled by a switch. OpenAI Playground adds a "Generate" button that converts plain-text descriptions into JSON Schema suggestions. Output validation follows Guardrails AI's architecture: extraction → pruning → schema verification, with `on_fail` actions (EXCEPTION, REASK, FIX, NOOP) and repair loops that re-prompt the LLM with specific validation error feedback.

### Connector and webhook configuration

The **HTTP request builder** (n8n HTTP Request node) contains: method dropdown, URL with expression support, auth selector (None, Basic, OAuth2, API Key, Bearer, Header), headers key-value editor, body editor with content-type selector (JSON, Form URL-Encoded, Multipart, Raw), and response format selector. n8n's **cURL import button** auto-populates all fields from a pasted curl command—a high-value convenience pattern. Test panels let users execute the request and see results in the output panel.

Webhook configuration (n8n Webhook node) generates **dual URLs**: a Test URL (active only during development, data shown in editor) and a Production URL (registered when workflow is published). Configuration includes method selection, authentication options, and response mode (Immediately, When Last Node Finishes, or Using Respond-to-Webhook Node). The "Listen for Test Event" button registers a temporary webhook and displays received payloads inline.

### Timer configuration and evaluation dashboards

Cron expression builders use **five clickable field selectors** (Minute, Hour, Day of Month, Month, Day of Week) with per-field options (every, specific values, range, step intervals). The key usability features: a **human-readable description** updating in real-time ("At 09:00 AM, Monday through Friday") and a **next-run preview** showing upcoming N execution times. The `cron-builder-ui` React component (built on Radix UI/shadcn) provides these patterns as a reusable component.

Evaluation dashboards (MLflow, W&B, LangSmith, Braintrust) center on **run comparison tables** with rows per test case and score columns. MLflow highlights changed parameters in yellow; Braintrust explicitly flags **score regressions and improvements** with colored indicators. Visualization patterns include metric history line charts, parallel coordinates plots for hyperparameter relationships, and scatter plots for metric correlations. LangSmith adds a **trace tree viewer** showing parent-child run spans with inputs/outputs at each step. Braintrust's diff mode shows side-by-side output comparisons with highlighted changes—critical for prompt iteration. Cost tracking (tokens used, dollar amounts) appears in LangSmith, Braintrust, and W&B as first-class dashboard elements.

---

## Mapping to Clef Surface and proposed new widget specs

The Interactor/classify → WidgetResolver/resolve → Widget pipeline maps naturally to these domains. Classification operates on two axes: the **domain concept** (ProcessSpec, StepConfig, ProcessRun, WorkItem, LLMCall, etc.) and the **interaction intent** (author, configure, monitor, claim, approve, test). Resolution then selects the appropriate widget based on contextual factors (available screen space, user role, data type).

### Existing Clef Surface concepts that likely cover needs

Standard form widgets (text inputs, dropdowns, toggles, date pickers, numeric inputs, checkboxes) cover most step configuration fields. Table/list widgets handle run dashboards, task inboxes, event logs, and variable inspectors. Badge/pill widgets map to status indicators, priority labels, and SLA states. Modal/panel widgets handle properties panels and detail views. Stepper/progress widgets cover approval chains and wizard forms.

### Proposed new .widget specs for identified gaps

The following patterns have no standard widget library equivalent and require new `.widget` specs:

**`NodeGraphCanvas.widget`** — The foundational canvas surface for visual process editing. Wraps React Flow/xyflow with Clef Surface integration. Declares affordances for: node placement (drag-from-palette, click-to-add), connection creation (drag-from-port), canvas navigation (zoom, pan, fit-to-view), selection (click, rubber-band, multi-select), and auto-layout (via elkjs). Machine states: `idle`, `connecting` (dragging from port), `panning`, `selecting` (rubber-band), `dragging-node`, `dragging-group`. Exposes node/edge data model for parent widget composition.

**`ExpressionToggleInput.widget`** — The dual-mode input that switches between Fixed (standard form widget) and Expression (CodeMirror editor with variable autocomplete and live preview). Machine states: `fixed-mode`, `expression-mode`, `editing`, `previewing`. The Interactor classifies any form field with `allowsExpression: true` to this widget. Resolution selects the inner Fixed widget based on the field's data type.

**`DataReferenceSelector.widget`** — The field mapper / pill inserter. Renders available upstream data references as a searchable tree (Make.com style) or dropdown with colored pills (Zapier style). Supports drag-and-drop insertion into target fields. Affordances: browse upstream outputs, search, drag-to-insert, click-to-insert. Machine states: `collapsed`, `browsing`, `searching`, `inserting`.

**`ConditionBuilder.widget`** — The field+operator+value row builder with AND/OR combinators. Each row contains: left-value field (with expression support), operator dropdown (data-type-aware), right-value field. Machine states: `viewing`, `editing-row`, `adding-row`, `switching-combinator`. Supports recursive nesting for complex condition trees.

**`ExecutionOverlay.widget`** — A composite that accepts a base diagram renderer (NodeGraphCanvas or BPMN viewer) and an overlay data model mapping node IDs to execution states. Renders: status colors on nodes, token position indicators, item count badges, incident markers, animated flow along edges. Machine states: `static` (historical view), `live` (real-time updates), `replay` (time-travel through execution history).

**`CronExpressionBuilder.widget`** — Five-field visual cron editor with human-readable description and next-run preview. Machine states: `preset-mode` (common schedule buttons), `visual-mode` (field selectors), `advanced-mode` (raw expression). Affordances: field selection, preset application, next-run computation.

**`ApprovalTracker.widget`** — Horizontal stepper + voting panel composite. Renders sequential approval chains with per-step status (approved/pending/rejected/not-started) and parallel approval grids with quorum tracking. Machine states: `viewing`, `voting` (active approver), `delegating`. Includes policy display ("2 of 5 must approve").

**`SLATimer.widget`** — Five-state countdown display following ServiceNow's pattern. States: `on-track` (green), `warning` (yellow), `critical` (orange), `breached` (red), `paused` (gray). Displays adaptive time formatting. Includes optional breach prediction indicator.

**`PromptEditor.widget`** — Multi-message prompt editor with System/User/Assistant blocks, `{{variable}}` auto-detection with dynamic input creation, token count indicator, and integrated test panel. Machine states: `editing`, `testing` (playground active), `comparing` (version diff). Includes model selector and parameter presets.

**`JSONSchemaEditor.widget`** — Dual-mode structured output definition: visual field builder (add field, configure type/description/required/enum) and raw JSON Schema editor with toggle between modes. Used for both LLM output schemas and webhook payload definitions.

---

## Cross-cutting concerns shape every widget decision

**Accessibility** for canvas editors is the hardest unsolved problem. bpmn-js provides some ARIA landmark support, but no production workflow editor offers full screen-reader navigation of node graphs. The pragmatic approach: provide a parallel **text-based flow outline** (accessible tree of nodes with connections described as relationships) alongside the visual canvas, ensuring keyboard users can navigate, select, and configure nodes without a mouse. React Flow supports keyboard shortcuts for node selection and deletion but lacks comprehensive ARIA roles for the graph structure.

**Mobile/responsive patterns** are largely absent. Canvas editors (n8n, Node-RED, Camunda Modeler) are desktop-only experiences. Task inboxes (Camunda Tasklist, Jira mobile) and approval UIs (Power Automate mobile, ServiceNow mobile) adapt to mobile via simplified list views with tap-to-expand detail panels. Execution dashboards partially adapt (Airflow's Grid View works on tablets; Temporal's timeline is desktop-optimized). The practical guideline: process authoring is desktop-only; task claiming/approval should be mobile-first; monitoring is tablet-minimum.

**Real-time updates** use a three-tier strategy across the industry: WebSocket subscriptions for instant state changes in monitoring views, Server-Sent Events for log streaming, and polling with exponential backoff as the universal fallback. Optimistic UI is standard for user-initiated actions—status badges update immediately on cancel/retry before server confirmation. The widget library should expose a `LiveDataSource` abstraction that widgets subscribe to, with the transport mechanism (WebSocket, SSE, polling) configured at the application level rather than per-widget.

## Conclusion

The 85 widget patterns discovered across these four domains reveal that process management UIs are far more standardized than they appear. The visual canvas and expression system are the two genuinely complex authoring primitives—everything else composes from well-understood form, table, badge, and timeline widgets. The ten proposed `.widget` specs target the precise gaps where existing component libraries fall short: canvas interaction, dual-mode expressions, data reference selection, condition building, execution overlay, cron configuration, approval tracking, SLA timers, prompt editing, and schema definition. Prioritizing `NodeGraphCanvas`, `ExpressionToggleInput`, and `ExecutionOverlay` first would unlock the two highest-value tiers (process authoring and execution monitoring) while the remaining specs address human tasks and AI integration. The most underserved area across the entire industry remains accessibility for visual flow editors—an opportunity for Clef Surface to differentiate by shipping the text-based flow outline as a first-class alternative to the canvas from day one.