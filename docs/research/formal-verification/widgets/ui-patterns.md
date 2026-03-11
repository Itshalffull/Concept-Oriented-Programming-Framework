# UI patterns for formal verification mapped to Clef Surface

**Every major production verification system converges on a small set of recurring UI patterns—master-detail property browsers, tri-state gutter icons, collapsible trace trees, and multi-solver dispatch panels—that map cleanly onto an extended Clef Surface architecture requiring roughly 12 new Interactor types and 20 new Affordance declarations.** This catalog draws from 25+ production tools spanning theorem provers, model checkers, CI/CD dashboards, security analyzers, and AI-assisted proving systems. The patterns cluster predictably around the seven domain concepts (FormalProperty, Contract, Evidence, VerificationRun, SolverProvider, SpecificationSchema, QualitySignal), and most can be implemented by composing existing headless primitives from Radix, React Aria, and Zag.js with targeted custom components for trace timelines, formula editing, and proof-tree interaction.

---

## The five universal layout archetypes across verification tools

Production verification interfaces converge on five dominant layout patterns, each serving a distinct workflow stage. Understanding these archetypes is essential before mapping individual widgets.

**1. IDE panel layout (editor + synchronized info panel).** Used by Lean 4 Infoview, Dafny, Isabelle/jEdit, Coq/VsCoq, Frama-C Ivette. The editor occupies the primary pane; a secondary panel (typically right or bottom) displays context-sensitive verification state that tracks cursor position. Dafny's **green/red gutter bars** forming a continuous vertical verification status line and Lean 4's **cursor-tracking goal state** that updates as you navigate through a proof are the purest expressions of this pattern. Isabelle extends it with an **overview column**—a thin minimap strip on the far right showing red/orange/green status across the entire file.

**2. Session tree + task viewer (three-pane).** Used by Why3 IDE, Certora Rule Report, TLA+ Toolbox. A hierarchical tree on the left (file → theory → goal → proof attempt) drives a tabbed content area on the right showing the selected item's detail. Why3's proof session tree is the canonical example: **five-level hierarchy** (file → theory → goal → transformation → sub-goal) with green checkmarks, question marks, and red indicators per node. Certora extends this with **progress counters** ("3/5 children completed") on parent nodes.

**3. Dashboard grid with quality gate.** Used by SonarQube, Codecov, Snyk, Datadog, Grafana. A prominent pass/fail gate badge at the top, followed by metric cards organized in a responsive grid, with drill-down to filtered issue lists. SonarQube's **A-E letter ratings** with color gradients (green through red) applied across Reliability, Security, and Maintainability dimensions, and its **New Code vs. Overall Code** dual-column structure, define this archetype.

**4. Static HTML report with source-mapped navigation.** Used by CBMC Viewer, Frama-C WP JSON reports, Why3 HTML export. Post-analysis generation of browsable HTML with summary statistics, property tables (pass/fail per row), and source code views with **line-level color annotations** (green = covered, red = uncovered). CBMC Viewer's Jinja2-templated reports with clickable trace steps that link to source lines exemplify this.

**5. Inline suggestion overlay (ghost text / clickable list).** Used by GitHub Copilot, Cursor, Lean Copilot, CoqPilot. For AI-assisted proving: either **dimmed ghost text** with Tab-to-accept (Copilot/Cursor) or a **color-coded clickable suggestion list** in an info panel (Lean Copilot, where green = proof-completing tactics, blue = progress-making tactics). Lean Copilot's confidence-ranked list with remaining-goals preview beneath each blue suggestion is the richest variant for formal verification.

---

## Mapping 12 UI pattern categories to the seven domain concepts

### FormalProperty: status badges, gutter icons, and filterable property tables

The FormalProperty concept aggregates the most patterns from the widest range of tools. The **universal property status palette** across all surveyed tools is:

| Status | Color | Icon | Used by |
|--------|-------|------|---------|
| Proved/Valid | Green | Filled circle, checkmark, thin vertical bar | Frama-C, Why3, Dafny, Certora, JasperGold |
| Refuted/Violated | Red | X mark, thin vertical bar, filled circle | Certora, Dafny, Frama-C, CBMC |
| Unknown | Gray/Yellow | Question mark, empty circle | Why3, Frama-C, Isabelle |
| Timeout | Orange | Clock icon, orange bar | Certora, Why3, JasperGold |
| Running | Blue/Yellow | Spinner, animated dot, circling arrow | Dafny, Certora, Isabelle |

**Property browsers** take three forms: (a) **flat filterable tables** with severity/status/type columns (SonarQube Issues, Frama-C Properties panel, CBMC bug report, Snyk issue cards), (b) **hierarchical session trees** with status rollup (Why3, Certora rule tree, Isabelle Theories panel), and (c) **inline ACSL-style annotations** with margin status markers (Frama-C, Dafny gutter bars). The most sophisticated is Certora's rule tree, which **auto-opens single-child nodes**, displays descriptions from annotations, and allows **wildcard filtering** on rule names.

**Clef Surface mapping for FormalProperty:**

- **Property list/tree**: `group-repeating` containing items with `display-badge` (status), `display-text` (name, property_text), `single-choice` (kind selector). Affordance: React Aria `TreeView` for hierarchical, Radix `Accordion` for flat grouped lists.
- **Status badge**: `display-status` interactor. Existing affordance `badge` works, but needs a new **`verification-status-badge`** affordance with 5-state color mapping.
- **Gutter status**: NEW interactor needed — **`display-gutter-mark`** — a line-associated status indicator for IDE integration. Affordance: Monaco Editor decorations API for implementation.
- **Priority indicator**: `display-badge` with severity color. Maps to existing affordance.
- **Inline property editor**: `edit:text-long` with formula syntax. Affordance: new **`formula-input`** (see SpecificationSchema below).

### Contract: assume-guarantee pair visualization and composition graphs

Contract UIs are the least well-served by existing tools, appearing primarily in Certora's **Call Resolution tab** (showing how contract calls dispatch between components), Alloy's **graph visualizer** (showing atom-to-atom relations), and hardware verification's **cone of influence analysis** (JasperGold highlighting design elements that affect a property).

The dominant pattern is a **bipartite or directed graph** with source/target nodes connected by labeled edges representing assumptions and guarantees. Alloy's Visualizer provides the richest example: **rectangular nodes** per atom, **directed arrows** with relation-name labels, customizable themes controlling shape/color/visibility per signature type, and three view modes (graph, tree, text). Sterling (Alloy's web alternative) extends this with D3.js-based draggable nodes, pan/zoom, and a **Script View** exposing all instance data as JavaScript for custom visualization.

For **composition chains**, the closest production analog is GitHub Actions' **workflow DAG** and CircleCI's pipeline visualization—both render jobs as colored rounded rectangles connected by dependency edges with real-time status color transitions (gray → yellow → green/red). Datadog's **Service Map** topology (nodes = services, edges = request flows, color/size = health metrics) is another strong reference for contract compatibility visualization.

**Clef Surface mapping for Contract:**

- **Assume/guarantee list pairs**: Two `group-repeating` sections (assumptions, guarantees), each containing `edit:text-long` formula entries. Affordance: dual-column layout with `textarea` or `formula-input`.
- **Source/target selection**: `selection:single-pick` for source concept, `selection:single-pick` for target. Affordance: `combobox` with concept search.
- **Compatibility status**: `display-status` badge. Existing affordance works.
- **Composition graph**: NEW interactor needed — **`display-dependency-graph`** — a directed graph showing contract chains. Affordance: new **`dag-viewer`** widget built on a force-directed layout (D3.js or vis.js). Inherits from existing graph visualization patterns but adds status coloring per edge.
- **Contract matrix**: Adaptation of existing **permission matrix** pattern (roles × resources grid) → **contracts × components grid** with compatibility status cells. Affordance: new **`contract-matrix`** widget spec.

### Evidence: trace viewers, proof certificates, and counterexample browsers

Evidence UIs are the most diverse category. Production tools offer **six distinct counterexample/trace visualization paradigms**:

**1. Tree-structured state sequence** (TLA+ Toolbox). Each state is expandable with +/- to see variable values. **Color-coded changes**: distinct background colors for value-changed, value-added, value-removed. Supports adding custom expressions evaluated at each state via the Error-Trace Explorer. Variables can be filtered to show only changed values.

**2. Call trace with highlighted counterexample values** (Certora). A tree of function calls from rule start to violated assertion. Counterexample values shown as **gray boxes with tooltips** providing semantic information (parameter, return value, etc.). Values classified as Concrete, Don't Care, Havoc, or Havoc Dependent. **State-Diff feature** compares storage state between snapshots. **Jump-To-Source** buttons link to source code.

**3. Step-by-step HTML trace with source links** (CBMC Viewer). Each trace step linked to corresponding source line. Variable assignments, function call/return steps, branch decisions, and the final failing assertion rendered as a linear, clickable sequence.

**4. Waveform/timeline viewer** (JasperGold, VC Formal/Verdi). Signal values displayed as horizontal lanes over time. Standard in hardware verification. Minimum-length traces generated automatically (QuietTrace™). Color-coded signal transitions.

**5. Formula evaluation display** (NuSMV Counterexample Visualizer). Three-panel layout: LTL specifications list (top), truth values of each subformula at each step (middle), variable values for all steps (bottom). **Causal highlighting ("Red Dots")** from IBM RuleBase marks variable values that are causal to the failure.

**6. Proof diffs** (Coq). Green highlighting for added hypotheses/terms, red for removed terms between successive proof steps. Configurable tags for `diff.added`, `diff.removed` with foreground color, bold, italic, underline, strikeout options.

For **proof certificates and solver logs**, the primary patterns are: raw log viewers (TLA+ TLC Console), structured JSON reports (Frama-C WP JSON, CBMC JSON), and **TAC reports** (Certora's Control Flow Graph visualization with SAT path in red, UNSAT proof in green, timeout difficulty in violet gradient).

**Clef Surface mapping for Evidence:**

- **Trace stepper**: NEW interactor — **`display-trace-stepper`** — step forward/back through states with synchronized detail panel. Affordance: new **`trace-stepper`** widget using Zag.js state machine (idle → playing → paused → step-forward → step-backward).
- **Variable value inspector**: Adaptation of existing `group-repeating` with `display-text` pairs. For matrix layout (variables × time steps): NEW affordance **`variable-timeline-grid`**.
- **Counterexample graph**: Extension of `display-dependency-graph` with node/edge status coloring. Alloy's graph/tree/text triple view maps to existing **view switcher** pattern.
- **Proof certificate viewer**: `output:display-text` with syntax highlighting. Affordance: `code-block` or Monaco Editor read-only.
- **Confidence score**: `output:display-number` rendered as `badge` with color threshold.
- **State diff**: Existing **diff viewer** pattern applies directly. Affordance: side-by-side or unified diff with red/green coloring.
- **Solver log**: `output:display-text` with ANSI color support. Affordance: `log-viewer` (scrollable, searchable, filterable by level).

### VerificationRun: progress monitoring, resource dashboards, and run comparison

Run monitoring patterns cluster around three paradigms:

**Live progress indicators.** Dafny's **scrollbar color map** showing verification status across the file is the most innovative—the scrollbar itself becomes a minimap of verification state. Isabelle's **Theories panel** shows per-theory colored progress bars. Certora displays **rule progress counters** ("3/5 children completed") in the tree. GitHub Actions provides **real-time DAG visualization** with color transitions as jobs progress.

**Resource usage dashboards.** TLA+ Toolbox's **state space progress table** (Diameter, States Found, Distinct States, Queue Size) with clickable column headings generating **line graphs** of metrics vs. execution time. Certora's **Live Statistics panel** shows per-function difficulty metrics with LOW/MEDIUM/HIGH classifications. Dafny provides **resource measurements** via hover widgets showing how many resources the solver consumed per assertion batch.

**Run comparison.** Codecov's **PR coverage diff** (base vs. head with delta indicators) is the clearest pattern. CircleCI Insights shows **duration trends, success rate trends, and credit spend trends** with branch filtering. Why3 marks changed goals as **"(obsolete)"** with visual distinction between current and stale results.

**Clef Surface mapping for VerificationRun:**

- **Run list**: `group-repeating` with `display-status` badge, `display-date` (start/end), `display-number` (properties checked, time, memory). Affordance: sortable table.
- **Progress indicator**: `output:display-progress` for overall run. NEW variant needed: **`display-progress-segmented`** showing per-property status segments (like Dafny's scrollbar map). Affordance: new **`segmented-progress-bar`**.
- **Resource usage chart**: NEW interactor — **`display-resource-chart`** — time-series panel showing solver calls, memory, time. Affordance: new **`sparkline-chart`** widget wrapping a lightweight charting library.
- **Run comparison table**: Existing **diff viewer** pattern extended with NEW **`run-comparison-table`** affordance showing property × run matrix with status cells (inspired by Why3's HTML export with green/orange/red/gray cells).
- **Timeout budget**: `edit:number-exact` for timeout setting, `output:display-progress` for budget remaining.
- **Start/stop controls**: `control:action-primary` (start), `control:action-danger` (stop/cancel). Existing affordances work.

### SolverProvider: multi-backend dispatch panels and health monitoring

Three production paradigms for solver management emerged:

**Context menu prover list** (Why3). Right-click a goal to see detected provers. Run a prover on selected goals. Preferences dialog has a **Provers tab** to hide/configure provers, set time/memory/step limits per prover, and configure editors for interactive provers. Proof **strategies** combine prover calls in an assembly-style language with parallel dispatch (`p1 t1 m1 | p2 t2 m2`—first success wins).

**Dedicated multi-prover panel** (Isabelle Sledgehammer). Checkboxes for each prover (CVC4, Z3, E, SPASS, Vampire) with a text input for additional facts. Results appear incrementally. Proposed proof snippets are **"sendback" clickable**—one click inserts the proof into the source.

**Integration tile grid** (Datadog). 750+ integrations displayed as tiles with icon, name, and installed/available status. Clicking opens tabbed configuration (Overview, Configuration, Metrics, Logs, Dashboards).

**Clef Surface mapping for SolverProvider:**

- **Solver list**: `group-repeating` with `display-text` (name), `display-badge` (health status), `display-text` (supported languages). Affordance: card grid or table.
- **Health status**: `display-status` with custom states (healthy/degraded/offline). Existing `badge` affordance works.
- **Capability matrix**: Adaptation of **permission matrix** pattern → solvers × property-kinds grid with support indicators. Affordance: existing **`permission-matrix`** pattern with boolean cells.
- **Priority routing**: `selection:range-select` for priority ordering. Affordance: **`sortable-list`** (drag-to-reorder), implementable via Radix or dnd-kit.
- **Solver selection per goal**: `selection:single-choice` (single solver) or `selection:multi-choice` (parallel dispatch). Affordance: `select` dropdown or `checkbox-group`.
- **Timeout/memory config per solver**: `edit:number-exact` with stepper. Existing affordance works.

### SpecificationSchema: pattern selectors, parameterized templates, and formula editors

The Dwyer pattern system and its tool implementations provide the primary reference. Prospec 2.0 implements a **guided wizard flow**: (1) select scope from 5 options with visual timeline illustrations, (2) select pattern from occurrence/order categories with descriptions, (3) fill in composite propositions as parameters. PROPEL extends this with **dual representation**—disciplined natural language alongside finite-state automata, with users toggling between views.

For formula editing, Monaco Editor's **diagnostics/markers API** (`setModelMarkers` with severity levels producing squiggly underlines, gutter icons, and hover tooltips) combined with `registerCodeActionProvider` for tactic suggestions forms the implementation backbone. Lean 4's **unicode input** (backslash abbreviations like `\alpha` → α) and Isabelle's **Symbols panel** (grid organized by category tabs) handle specialized notation input.

**Clef Surface mapping for SpecificationSchema:**

- **Pattern selector**: `selection:single-choice` with card layout. Affordance: new **`pattern-card-selector`** — a `radio-card` variant displaying pattern name, description, visual diagram, and frequency-of-use indicator. Extends existing `radio-card` affordance.
- **Scope selector**: `selection:single-choice` with 5 options. Affordance: `segmented-control` with timeline-style visual labels (Globally, Before R, After Q, Between Q and R, After Q until R).
- **Parameter form**: `group-fields` containing `edit:text-short` inputs for P, Q, R, S propositions. Affordance: `text-input` with autocomplete for known symbols.
- **Formula preview**: NEW interactor — **`display-formula`** — live-updating rendered formula as parameters change. Affordance: new **`formula-display`** widget with syntax highlighting and LaTeX/Unicode rendering.
- **Template instantiation**: `control:action-primary` ("Create Property from Template"). Existing affordance works.
- **Dual representation toggle**: `selection:toggle` between natural language and formal notation views. Affordance: `toggle-switch` or `segmented-control`.

### QualitySignal: quality gates, rollup matrices, and deploy gate indicators

SonarQube's quality gate is the canonical reference: a prominent **pass/fail shield badge** at the page top, followed by **dimension-specific letter ratings** (A-E with green-to-red gradient) for Reliability, Security, Maintainability, plus percentage metrics for Coverage and Duplications. The **New Code vs. Overall Code** dual-column layout enables regression detection.

For multi-dimensional rollup, Datadog's **Monitor Summary Widget** (grid of monitors color-coded green/yellow/red/gray) and Grafana's **Status History panel** (periodic state snapshots as colored cells in a time × series grid) provide the richest references. Snyk's **SLA Management Report** shows severity breakdown by compliance status (within SLA, at risk, breached) with trend lines.

**Clef Surface mapping for QualitySignal:**

- **Quality gate badge**: `display-status` with pass/fail/warn states. Affordance: new **`quality-gate-badge`** — a large, prominent status indicator (shield shape) with color and label.
- **Dimension rollup**: `group-section` containing multiple `display-status` badges per dimension (snapshot, conformance, contract, unit, flaky, formal). Affordance: new **`quality-dimension-card`** — a metric card showing dimension name, rating badge, count, and trend sparkline.
- **Deploy gate status**: `display-status` with blocking/non-blocking semantics. Affordance: `badge` with tooltip explaining gate conditions.
- **Signal matrix**: NEW interactor — **`display-quality-matrix`** — dimensions × time/version grid with colored cells. Affordance: new **`status-grid`** widget (rows = dimensions, columns = snapshots, cells = pass/fail/warn/unknown).
- **Drilldown navigation**: `control:navigate` from rollup to individual signal detail. Existing affordance works.
- **Trend chart**: NEW interactor — **`display-trend-sparkline`** — inline mini time-series. Affordance: new **`sparkline`** widget (SVG-based, embeddable in cards/cells).

---

## Gap analysis: 12 new Interactor types for Clef Surface

The existing Clef Surface architecture covers approximately **65% of the verification UI patterns** discovered. Standard selection, edit, control, and output interactors handle property forms, solver configuration, and basic status display. The remaining 35% requires new interactors in three categories: **verification-specific display**, **interactive exploration**, and **compositional visualization**.

### New Interactor type specifications

**1. `display-verification-status`** — Classification: output. A tri-color-or-more status indicator specialized for the 5-state verification palette (proved/refuted/unknown/timeout/running). Differs from generic `display-status` by supporting animated transitions between states (running → proved) and gutter-mark rendering mode.

- Affordance: `verification-status-badge` (specificity: when `schema.domain = "verification"` AND `field.type = "enum"` AND `field.enum ⊆ {proved, refuted, unknown, timeout, running}`)
- Widget spec anatomy: icon (configurable per state) + label + optional tooltip with solver details
- States: idle, animating (pulse for running), settled (proved/refuted/unknown/timeout)
- Headless primitive: Zag.js presence machine for animated transitions, Radix `Badge` for rendering

**2. `display-proof-tree`** — Classification: output/interactive. A collapsible hierarchical tree where each node carries verification status and clicking a node loads its detail. Maps to Why3 session tree, Certora rule tree, Isabelle SideKick.

- Affordance: `proof-session-tree` (specificity: when `schema.structure = "tree"` AND `node.has("status")`)
- Widget spec anatomy: tree container → tree-item (expand/collapse trigger + status badge + label + progress counter) → nested children
- States: expanded, collapsed, loading, selected, focused
- Headless primitive: **React Aria TreeView** (has built-in tree, critical for this), Zag.js Tree View
- Accessibility: arrow-key navigation, ARIA tree role, announce status changes

**3. `display-trace-timeline`** — Classification: output/interactive. A horizontal timeline of execution states with variable lanes, inspired by hardware waveform viewers and TLA+ error trace. Each column is a time step; each row is a variable. Cells show values with change highlighting.

- Affordance: `trace-timeline-viewer` (specificity: when `schema.type = "trace"` AND `data.has("steps")`)
- Widget spec anatomy: time axis (horizontal) + variable lanes (vertical) + cells (value display with change-color) + step cursor (draggable vertical line) + zoom/pan controls
- States: idle, playing (auto-advance), paused, stepping
- Connect: synchronizes with source editor (clicking a step highlights corresponding code line)
- Headless primitive: Custom implementation. Use Radix `ScrollArea` for the container, Zag.js `Slider` for the step cursor. No existing headless primitive covers this fully.

**4. `display-formula`** — Classification: output. A rendered mathematical/logical formula with syntax highlighting, Unicode symbols, and optional LaTeX rendering. Used for property_text display and template preview.

- Affordance: `formula-display` (specificity: when `field.format = "formula"` OR `field.language ∈ {LTL, CTL, TLA+, Lean, Coq, Dafny}`)
- Widget spec: monospace text with semantic coloring (keywords, operators, variables, constants), optional MathJax/KaTeX rendering toggle
- States: static, updating (when parameters change)
- Headless primitive: Monaco Editor in read-only mode with custom tokenizer, or KaTeX for pure display

**5. `edit-formula`** — Classification: edit. A code editor input specialized for formal specification languages with autocomplete, symbol palette, live validation, and diagnostics.

- Affordance: `formula-editor` (specificity: when `field.format = "formula"` AND `interactor = "edit"`)
- Widget spec anatomy: editor area (Monaco-based) + symbol palette sidebar (Isabelle-style grid) + diagnostics gutter + autocomplete popup + live preview pane
- States: idle, editing, validating, valid, invalid
- Connect: sends content to verification backend; receives diagnostics markers
- Headless primitive: Monaco Editor with `registerCompletionItemProvider`, `setModelMarkers`, custom `ITokensProvider`

**6. `display-dependency-graph`** — Classification: output/interactive. A directed acyclic graph for contract chains, theory imports, or workflow dependencies. Nodes carry status; edges carry labels.

- Affordance: `dag-viewer` (specificity: when `schema.structure = "graph"` AND `edges.directed = true`)
- Widget spec anatomy: canvas/SVG container + nodes (rounded rect with status badge + label) + edges (labeled arrows) + zoom/pan controls + node click handler → detail panel
- States: idle, layout-computing, interactive (drag nodes), focused-node
- Headless primitive: D3-force for layout, Radix `Popover` for node detail overlays. Extends existing graph visualization pattern.

**7. `display-quality-matrix`** — Classification: output. A grid of status cells across two dimensions (e.g., quality dimensions × time snapshots, or properties × solvers). Each cell colored by status.

- Affordance: `status-grid` (specificity: when `schema.structure = "matrix"` AND `cell.type = "status"`)
- Widget spec anatomy: row headers (dimension names) + column headers (snapshot labels) + cells (colored status indicator + optional value) + row/column aggregation summaries
- States: idle, hovering-cell (shows tooltip), selected-cell (drills down)
- Headless primitive: HTML `<table>` with Radix `Tooltip` per cell. Extends existing permission-matrix pattern.

**8. `display-coverage-overlay`** — Classification: output. Source code view with line-level color annotations (green/yellow/red) for coverage or verification status. Maps to CBMC Viewer, SonarQube file view, JasperGold coverage heatmap.

- Affordance: `coverage-source-view` (specificity: when `data.type = "coverage"` AND `data.has("lines")`)
- Widget spec anatomy: line numbers gutter + coverage color gutter (green/yellow/red per line) + source text + hover tooltip per line (coverage details)
- States: idle, hovered-line (shows detail), filtered (show only uncovered)
- Headless primitive: Monaco Editor with `deltaDecorations` API for line-level background coloring

**9. `display-segmented-progress`** — Classification: output. A progress bar divided into colored segments representing per-item status. Maps to Dafny's scrollbar color map and Isabelle's theory progress strips.

- Affordance: `segmented-progress-bar` (specificity: when `data.type = "progress"` AND `data.has("segments")`)
- Widget spec anatomy: horizontal bar divided into proportional segments, each colored by status + tooltip per segment showing item name/count
- States: idle, animating (segments grow as verification progresses), complete
- Headless primitive: Radix `Progress` extended with segmented rendering. Implementable as styled `<div>` segments.

**10. `control-trace-stepper`** — Classification: control/interactive. Forward/back/play/pause controls for stepping through counterexample traces. Maps to TLA+ Error-Trace Explorer, Alloy temporal navigation, NuSMV visualizer.

- Affordance: `trace-step-controls` (specificity: when `context.type = "trace"`)
- Widget spec anatomy: |◀ (first) + ◀ (prev) + ▶ (play/pause) + ▶| (next) + ▶| (last) + step counter ("Step 3 of 12") + speed control
- States: idle, playing, paused, at-start, at-end
- Headless primitive: Zag.js custom state machine. No existing headless primitive covers media-player-style step controls for data (vs. video).

**11. `display-suggestion-list`** — Classification: output/interactive. A ranked list of AI-generated suggestions with confidence indicators and click-to-apply behavior. Maps to Lean Copilot's tactic suggestions (green = completes proof, blue = makes progress), Isabelle Sledgehammer sendback results.

- Affordance: `suggestion-list` (specificity: when `data.type = "suggestions"` AND `data.items.has("confidence")`)
- Widget spec anatomy: ordered list of suggestion items, each with: confidence indicator (color dot or score), suggestion text (monospace), remaining goals preview (for blue/partial suggestions), click-to-apply action
- States: loading, populated, empty, item-hovered (preview), item-applied
- Headless primitive: Radix `Listbox` or React Aria `ListBox` with custom rendering

**12. `edit-pattern-wizard`** — Classification: edit/composition. A multi-step wizard for selecting and parameterizing specification patterns. Maps to Prospec 2.0's guided flow (scope → pattern → propositions → preview).

- Affordance: `specification-wizard` (specificity: when `schema.type = "specification-template"`)
- Widget spec anatomy: step indicator (1. Scope → 2. Pattern → 3. Parameters → 4. Preview) + scope selector (segmented-control with timeline visuals) + pattern selector (radio-card grid) + parameter form (text inputs with autocomplete) + formula preview pane
- States: step-1, step-2, step-3, step-4, complete
- Headless primitive: Zag.js `Steps` machine for wizard navigation, Radix `RadioGroup` for selections, Monaco for formula preview

---

## Existing Clef Surface patterns that apply directly

Several existing domain patterns from the UI library map directly to verification concepts without modification:

**Property panels** (schema types to click-to-edit widgets) directly serve FormalProperty editing. A FormalProperty's fields (target symbol, kind, property_text, scope, status, priority) map to a standard property panel with type-adaptive inputs. The `kind` field uses `selection:single-choice` → `select` or `segmented-control`. The `status` field uses `display-status` → `badge`. The `property_text` uses the new `edit-formula` interactor.

**Query builders** (filter rows with type-adaptive inputs) serve property browsing and evidence filtering. Filtering properties by status, kind, priority, and target maps exactly to the query builder pattern. SonarQube's left-sidebar cumulative filters and Snyk's grouped filter sidebar both follow this pattern.

**View switchers** (table/board/calendar/timeline/gallery/chart) serve multiple concepts. Evidence can be viewed as table (list of artifacts), gallery (visual previews), or timeline (chronological). Alloy's three-mode visualizer (graph/tree/text) maps to a view switcher with custom view types.

**Workflow editors** (states, transitions, execution visualization) serve VerificationRun lifecycle and QualitySignal deploy gates. The run lifecycle (queued → running → completed/failed/timeout) maps to a workflow state machine. Deploy gate conditions map to workflow transition rules.

**Queue monitors** (throughput, failures, job details) serve VerificationRun monitoring. The queue monitor pattern with throughput charts, failure counts, and job detail drill-down maps directly to verification run queues.

**Diff viewers** (side-by-side, unified) serve Evidence comparison (counterexample diffs, proof diffs) and VerificationRun comparison. Coq's proof diffs (green added / red removed) and Certora's state-diff feature use this pattern directly.

**Formula editors** (syntax highlighting, autocomplete, live preview) serve SpecificationSchema and FormalProperty property_text editing. The existing formula editor pattern needs extension with verification-specific language support but the core interaction model applies.

---

## Complete concept-to-widget mapping table

| Concept | Field/View | Interactor | Affordance | New? |
|---------|-----------|------------|------------|------|
| **FormalProperty** | status | display-verification-status | verification-status-badge | NEW |
| | kind | selection:single-choice | segmented-control | Existing |
| | property_text | edit-formula | formula-editor | NEW |
| | property list | display-proof-tree | proof-session-tree | NEW |
| | priority | selection:single-choice | select | Existing |
| | dependencies | display-dependency-graph | dag-viewer | NEW |
| | gutter indicators | display-gutter-mark | gutter-status-icon | NEW |
| **Contract** | source/target | selection:single-pick | combobox | Existing |
| | assumptions | group-repeating + edit-formula | formula-editor | NEW |
| | guarantees | group-repeating + edit-formula | formula-editor | NEW |
| | compatibility | display-verification-status | verification-status-badge | NEW |
| | composition chain | display-dependency-graph | dag-viewer | NEW |
| | compatibility matrix | display-quality-matrix | status-grid | NEW |
| **Evidence** | trace | display-trace-timeline | trace-timeline-viewer | NEW |
| | trace stepping | control-trace-stepper | trace-step-controls | NEW |
| | counterexample graph | display-dependency-graph | dag-viewer | NEW |
| | proof certificate | output:display-text | code-block | Existing |
| | solver log | output:display-text | log-viewer | Extended |
| | coverage | display-coverage-overlay | coverage-source-view | NEW |
| | confidence | output:display-number | badge (with threshold color) | Existing |
| | state diff | diff-viewer (existing pattern) | side-by-side-diff | Existing |
| **VerificationRun** | run list | group-repeating | sortable-table | Existing |
| | progress | display-segmented-progress | segmented-progress-bar | NEW |
| | resource chart | display-resource-chart | sparkline-chart | NEW |
| | run comparison | display-quality-matrix | run-comparison-table | NEW |
| | solver used | output:display-text | badge | Existing |
| | timeout budget | edit:number-exact + display-progress | number-input + progress-bar | Existing |
| | start/stop | control:action-primary/danger | button | Existing |
| **SolverProvider** | solver list | group-repeating | card-grid or table | Existing |
| | health status | display-verification-status | verification-status-badge | NEW |
| | capabilities | display-quality-matrix | status-grid | NEW |
| | priority routing | selection:range-select | sortable-list | Extended |
| | timeout config | edit:number-exact | number-input + stepper | Existing |
| | language support | output:display-text | chip-group | Existing |
| **SpecificationSchema** | pattern selector | edit-pattern-wizard | specification-wizard | NEW |
| | scope selector | selection:single-choice | segmented-control | Existing |
| | parameters | group-fields + edit:text-short | text-input with autocomplete | Existing |
| | formula preview | display-formula | formula-display | NEW |
| | template list | group-repeating | card-grid | Existing |
| | dual representation | selection:toggle | toggle-switch | Existing |
| **QualitySignal** | gate status | display-verification-status | quality-gate-badge | NEW |
| | dimension rollup | group-section + display-status | quality-dimension-card | NEW |
| | signal matrix | display-quality-matrix | status-grid | NEW |
| | trend | display-trend-sparkline | sparkline | NEW |
| | deploy gate | display-verification-status | quality-gate-badge | NEW |
| | drilldown | control:navigate | button (link variant) | Existing |

---

## Widget spec sketches for the three highest-priority new components

### `verification-status-badge` widget

```
.widget verification-status-badge {
  anatomy: container > (icon + label + ?tooltip-trigger)
  
  states:
    proved:    { icon: "check-circle-filled", color: "green-600", label: "Proved" }
    refuted:   { icon: "x-circle-filled",     color: "red-600",   label: "Refuted" }
    unknown:   { icon: "question-circle",      color: "gray-400",  label: "Unknown" }
    timeout:   { icon: "clock",                color: "orange-500", label: "Timeout" }
    running:   { icon: "spinner",              color: "blue-500",  label: "Running",
                 animation: "pulse 1.5s infinite" }
  
  sizes: sm (16px icon, no label) | md (20px icon, label) | lg (24px icon, label + detail)
  
  accessibility:
    role: "status"
    aria-live: "polite"  // announces status changes
    aria-label: "{label}: {detail}"
  
  connect:
    input: { status: enum, detail?: string, solver?: string }
    output: { onClick?: () => void }  // optional drilldown
  
  headless: Radix Badge + Zag.js Presence (for animated transitions)
}
```

### `proof-session-tree` widget

```
.widget proof-session-tree {
  anatomy: tree-root > tree-item* {
    tree-item: expand-trigger + status-badge + label + ?progress-counter + ?children
  }
  
  features:
    - Auto-open single-child nodes (Certora pattern)
    - Collapse proved subtrees (Why3 "!" shortcut)
    - Wildcard filter input above tree
    - Status rollup: parent inherits worst child status
    - Progress counter on parent: "3/5 children completed"
    - Keyboard: ArrowUp/Down navigate, ArrowRight expand, ArrowLeft collapse
    - Context menu: run prover, apply transformation (Why3 pattern)
  
  states:
    node-expanded | node-collapsed | node-loading | node-selected | node-focused
  
  accessibility:
    role: "tree" (container), "treeitem" (nodes)
    aria-expanded: boolean
    aria-level: depth
    aria-setsize + aria-posinset for siblings
  
  connect:
    input: { tree: TreeNode[], filter?: string }
    output: { onSelect: (node) => void, onExpand: (node) => void }
  
  headless: React Aria TreeView (preferred, built-in tree support) 
            or Zag.js TreeView
}
```

### `trace-timeline-viewer` widget

```
.widget trace-timeline-viewer {
  anatomy: 
    toolbar > (step-controls + zoom-controls + filter-toggle)
    header-row > (row-label-spacer + step-column-headers*)
    variable-lanes > lane* {
      lane: variable-name + cell* { cell: value-display + ?change-indicator }
    }
    step-cursor (vertical line, draggable)
  
  features:
    - Horizontal scroll with sticky variable-name column
    - Color-coded cells: white=unchanged, yellow=changed, green=added, red=removed
      (TLA+ Toolbox color scheme)
    - Step cursor: draggable vertical line synchronized with source editor
    - Variable filtering: all | changed-only | changed-in-current-frame
    - Click cell to inspect full value in detail panel
    - Causal highlighting: "red dot" markers on causal values (IBM RuleBase pattern)
    - Formula evaluation sub-row: T/F per subformula per step (NuSMV pattern)
    - Play/pause auto-advance through steps
  
  states:
    idle | stepping | playing | paused | cell-inspecting
  
  accessibility:
    role: "grid"
    aria-rowcount, aria-colcount for virtual scrolling
    arrow-key navigation between cells
    announce cell value on focus
  
  connect:
    input: { steps: Step[], variables: Variable[], 
             causalMarkers?: CausalMark[], formulaEvals?: FormulaEval[] }
    output: { onStepChange: (stepIndex) => void, 
              onCellSelect: (variable, step) => void }
    sync: { editorCursorLine: bidirectional }  // sync with source editor
  
  headless: Custom implementation
    - Radix ScrollArea for horizontal/vertical scroll
    - Zag.js Slider for step cursor
    - Zag.js state machine for play/pause/step controls
    - Virtual scrolling (TanStack Virtual) for large traces
}
```

---

## Implementation priority and headless primitive coverage

The 12 new interactors vary in implementation complexity. Sorted by a combination of frequency-of-use across tools and implementation effort:

- **Tier 1 (build first, highest coverage):** `verification-status-badge` (used by every concept), `proof-session-tree` (used by FormalProperty, Evidence, VerificationRun), `display-formula` / `edit-formula` (used by FormalProperty, Contract, SpecificationSchema). These three cover **~60% of new UI surface**.
- **Tier 2 (high value, moderate complexity):** `trace-timeline-viewer` + `control-trace-stepper` (Evidence), `display-quality-matrix` / `status-grid` (QualitySignal, SolverProvider, VerificationRun), `display-segmented-progress` (VerificationRun).
- **Tier 3 (specialized, build on demand):** `display-dependency-graph` / `dag-viewer` (Contract, Evidence), `display-coverage-overlay` (Evidence), `edit-pattern-wizard` (SpecificationSchema), `display-suggestion-list` (AI-assisted features), `display-trend-sparkline` (QualitySignal).

**Headless library coverage summary:** React Aria provides the strongest foundation with its built-in TreeView (critical for `proof-session-tree`), Table, and ListBox. Radix covers Accordion, Tabs, Dialog, ScrollArea, Tooltip, Progress, and Badge for general UI chrome. Zag.js contributes state-machine-powered interaction logic ideal for `trace-step-controls`, `trace-timeline-viewer` playback states, and animated status transitions. **Monaco Editor** is essential for `edit-formula`, `display-coverage-overlay`, and any inline editor integration. The only components requiring fully custom implementation from scratch are `trace-timeline-viewer` (no headless primitive for waveform-style data grids) and `display-dependency-graph` (requires D3-force or similar layout engine).

---

## Conclusion

The survey of 25+ production verification tools reveals a surprisingly convergent design vocabulary. **Five layout archetypes and six counterexample visualization paradigms** account for nearly all observed interfaces. The most impactful insight is that **formal verification UIs are not fundamentally different from CI/CD quality dashboards**—both center on property-status aggregation, drill-down from summary to detail, and inline editor integration. The key differences are the need for interactive proof stepping, formula-aware editing, and multi-solver dispatch.

The Clef Surface architecture is well-positioned to absorb these patterns. Its existing interactor taxonomy covers selection, editing, and basic output; the 12 proposed new interactors fill the verification-specific gaps without requiring fundamental architectural changes. The most architecturally significant addition is the **`trace-timeline-viewer`**, which has no precedent in standard component libraries and demands custom implementation—but its interaction model (step cursor + variable lanes + change highlighting + editor synchronization) is well-defined by decades of hardware verification waveform viewers. Building from React Aria's TreeView, Zag.js's state machines, and Monaco Editor's diagnostics API, a complete auto-generated verification interface is achievable with the proposed extensions.