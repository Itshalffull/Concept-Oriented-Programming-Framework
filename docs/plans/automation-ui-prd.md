# PRD: Automation & Workflow Authoring UI

## Status: MVP + V1 landed (2026-04-12) — see Card Status below
## Authors: 2026-04-12
## Depends on:
- Research: `docs/research/automation/` (3 docs)
- Completed: ActionBinding + ProcessSpec + Workflow data model (in place)
- Completed: action-editor.widget spec (progressive disclosure, MAG-635)
- Completed: Surface Contract Theming (MAG-657 epic)

---

## 1. Problem Statement

Clef has a solid automation **data model** — `ProcessSpec`, `ProcessRun`, `StepRun`, `Workflow`, `AutomationRule`, `RetryPolicy`, `CompensationPlan`, plus the new `ActionBinding`, `UndoStack`. But it has **zero workflow authoring UI**. The only existing automation screens are:

- `WorkflowsView` — list of workflows (no editor)
- `ProcessRunView` — read-only run inspector with three tabs
- `StepChecksView` — check results per step
- `AutomationRule` seeds with placeholder `{"type":"log"}` actions (no real dispatch)

The three automation research docs converge on five UX patterns:

1. **Progressive disclosure "Steps + Graph"** — synchronized linear narrative + node-link canvas, togglable without data loss
2. **Live sample data for mapping** — real data drives field pickers, output previews
3. **First-class error branches** — catch/fault paths as explicit control flow, not afterthoughts
4. **Replay/redrive/rerun debugging** — rerun past runs with same inputs, restart from failure point
5. **Governance-aware observability** — versioning, role-gated visibility, permissions aligned to shipping

Users building automation in Clef Base today cannot do any of this from the UI — they must edit YAML seed files and reboot. This PRD specifies the minimum viable automation UI that closes those gaps.

---

## 2. Design Principles

1. **Compose with existing concepts** — no new data concepts needed; the UI binds to existing `ProcessSpec`, `Workflow`, `AutomationRule`, `ActionBinding`, `ProcessRun`.
2. **Use action-editor widget's progressive disclosure** — the widget already designed for single action → ProcessSpec → Workflow. Extend it, don't replace it.
3. **Concept-mediated actions** — every button in the builder uses `ActionButton` with `ActionBinding` seeds. Builder buttons are not special.
4. **Two-representation synchronization** — "Steps view" and "Graph view" are two projections of the same `ProcessSpec` data. Switching is a render mode, not a model change.
5. **Preserve existing read views** — WorkflowsView and ProcessRunView stay as inspectors. The builder is additive.

---

## 3. Scope

### 3.1 In Scope

- **Flow Builder Shell** — three-pane layout with palette, canvas/steps, inspector
- **Steps view** (linear narrative) + **Graph view** (node-link canvas) with toggle
- **Data mapping widget** — field pills, sample data, type hints
- **Error branch authoring** — catch/fault paths on any action
- **Step-level test runner** — invoke single step with sample input, inline output
- **Run replay/redrive** — rerun past run, restart from failure point
- **Workflow version history** — diff viewer, rollback
- **AutomationRule action dispatch** — replace `log` placeholder with real dispatch
- **Permissions & run-as** — role-gated visibility, service account binding

### 3.2 Out of Scope

- Real-time collaboration on the canvas
- Custom node types beyond built-in (trigger, action, logic, catch)
- Full monitoring dashboards (use existing StepChecksView + ProcessRunView)
- Template marketplace / import-from-library

---

## 4. Architecture

### 4.1 Existing Concepts — No Changes Needed

**Automation data model:**
- **ProcessSpec** — already has steps, edges, versions, draft/active/deprecated
- **ProcessRun + StepRun** — already tracks per-step state and retry counts
- **Workflow** — already FSM with guarded transitions
- **AutomationRule** — already event-condition-action (but needs real dispatch)
- **RetryPolicy + CompensationPlan** — already support retry/rollback

**Diagram infrastructure — reuse, do not rebuild:**
- **Canvas** (`repertoire/concepts/content/canvas.concept`) — items, positions, selection, pan/zoom, applyLayout
- **ConnectorPort** (`repertoire/concepts/diagramming/connector-port.concept`) — typed connection points with direction (in/out), port_type validation, max_connections
- **ConstraintAnchor** — anchoring connectors to ports so edges follow nodes
- **DiagramNotation** — palette/shape vocabulary per domain
- **SpatialLayout** — hierarchical/tree/force layout algorithms (already has `hierarchical` for flowcharts)
- **DiagramExport** — PNG/SVG/JSON export
- **GraphAnalysis** — cycle detection, reachability, topological ordering (useful for validating process graphs)
- **FlowchartEditor [T]** (`repertoire/concepts/diagramming/flowchart-editor.derived`) — pre-composed Canvas + DiagramNotation + SpatialLayout + DiagramExport with flowchart palette and hierarchical auto-layout. **This is the graph canvas.**

### 4.2 Composition Strategy — Flow Builder as a Specialized Diagram Editor

The Flow Builder is a **ProcessSpec-bound FlowchartEditor**, not a new canvas. The graph view delegates entirely to Canvas + FlowchartEditor; we add a projection layer that keeps `ProcessSpec.steps/edges` and `Canvas.items/connectors` in sync.

- Each `ProcessSpec` step → a Canvas item with typed `ConnectorPort`s (in port for incoming edges, out port per branch / default / catch)
- Each `ProcessSpec` edge → a Canvas connector anchored via `ConstraintAnchor` to ports on source/target
- Catch/fault paths → additional typed out-ports on the action node (`port_type: "catch"`), rendered with distinct notation from DiagramNotation
- Auto-layout → `Canvas/applyLayout(algorithm: "hierarchical")` (inherited via FlowchartEditor)
- Process graph validation → `GraphAnalysis` for cycle/reachability checks on save
- Export → `DiagramExport` for PNG/SVG/JSON of the flow

### 4.3 New UI-Only Widgets

- `flow-builder.widget` — shell widget (palette, canvas host, inspector); embeds FlowchartEditor for the graph pane
- `flow-steps-view.widget` — linear narrative renderer (the non-canvas projection of the same data)
- `flow-step-inspector.widget` — right-pane config (uses action-editor widget)
- `data-mapping.widget` — field pill picker with sample data
- `error-branch.widget` — catch/fault path editor (adds typed catch ports + catch connectors)
- `workflow-version-history.widget` — diff + rollback UI

No new canvas widget. The graph pane is a FlowchartEditor surface.

### 4.3 New React Components (clef-base)

- `FlowBuilderView` — routes to the builder for a given ProcessSpec ID
- Implements widget specs above via concept-mediated pattern

### 4.4 New Syncs

- `ProcessSpecToCanvas` — on `ProcessSpec/create|updateStep|addEdge`, project steps → Canvas items and edges → connectors with ConstraintAnchor bindings
- `CanvasToProcessSpec` — on `Canvas/moveItem|createConnector|deleteItem` inside a flow-builder canvas, write back to ProcessSpec (positions are metadata; structural edits go through ProcessSpec actions)
- `FlowGraphValidate` — on `ProcessSpec/publish`, run `GraphAnalysis/detectCycles` + reachability; block publish on errors
- `DispatchAutomationAction` — when `AutomationRule/execute` fires with action type `invoke-action-binding`, route to `ActionBinding/invoke`. Replaces `log` placeholder dispatch.
- `ReplayRun` — when user requests replay, clone the past `ProcessRun` inputs and start a new run.

### 4.5 No New Concepts Required

The data model is already complete. All deliverables are UI + syncs composing existing automation and diagramming concepts.

---

## 5. Deliverables

### 5.1 MVP (ship first)

1. **Flow Builder shell** — Three-pane layout widget + React component wiring. Palette on left (triggers/actions/logic nodes). Canvas/steps area in center. Inspector on right. Switches between steps and graph view.
2. **Steps view** — Linear list of steps with insert-between, reorder, collapse. Matches ProcessSpec's step array ordering.
3. **Graph view** — FlowchartEditor-backed canvas. ProcessSpec ↔ Canvas projection syncs keep step/edge data in sync with Canvas items/connectors. Drag-to-connect uses existing ConnectorPort + ConstraintAnchor. Auto-layout via `Canvas/applyLayout("hierarchical")`. Mini-map from Canvas viewport primitives.
4. **Step inspector** — Right pane configuring selected step: type, params, condition, retry policy. Uses action-editor widget for step action config.
5. **Data mapping widget** — Field pill picker. Shows available fields from preceding steps' outputs. Type-checked binding to current step's inputs.
6. **Error branch authoring** — Add catch node after any action. Catch has its own action config (notify, retry, fallback).
7. **AutomationRule real dispatch sync** — `DispatchAutomationAction` sync routes rule actions to `ActionBinding/invoke`. Replace placeholder `log` seeds with real bindings.

### 5.2 V1 (after MVP ships)

8. **Step-level test runner** — Button in inspector: "Test this step." Prompts for sample input (or uses past run input), invokes step in isolation, shows output inline.
9. **Run replay/redrive** — Button in ProcessRunView: "Replay this run" or "Restart from step X." Clones inputs, starts new run.
10. **Workflow version history UI** — Diff viewer between ProcessSpec versions. Rollback button. Publish button with release notes field.
11. **Permissions & run-as** — Role-gated visibility of step inputs/outputs in ProcessRunView. "Run as" dropdown on Workflow/ProcessSpec for service accounts.

### 5.3 Deferred

- Custom node types
- Template gallery
- Real-time collaboration

---

## 6. Implementation Plan

**Phase 1 — Builder Shell (MVP core)**

- MAG-A: flow-builder.widget spec + React adapter
- MAG-B: flow-steps-view.widget + rendering from ProcessSpec
- MAG-C: Integrate FlowchartEditor into flow-builder + ProcessSpec↔Canvas projection syncs (no new canvas widget)
- MAG-D: flow-step-inspector.widget + action-editor integration
- MAG-E: `FlowBuilderView` React component wiring all four

**Phase 2 — Authoring Features**

- MAG-F: data-mapping.widget + field pill picker
- MAG-G: error-branch.widget + catch path support
- MAG-H: AutomationRule dispatch sync (replace `log` with `ActionBinding/invoke`)

**Phase 3 — Debugging & Ops (V1)**

- MAG-I: Step-level test runner
- MAG-J: Run replay/redrive
- MAG-K: Workflow version history UI
- MAG-L: Permissions & run-as

---

## 7. Success Criteria

1. **A user can build a 3-step process in Clef Base without touching YAML** — pick trigger, configure 3 action steps, save, run it.
2. **Steps view and Graph view stay in sync** — edit in one, the other reflects it.
3. **Error paths are first-class** — catch node attaches to any action, appears in both views.
4. **Data mapping shows real sample data** — field pills populate from live data, type checks catch mismatches at config time.
5. **AutomationRules actually dispatch** — no placeholder `log` actions; every rule routes to real `ActionBinding/invoke`.
6. **Past runs can be replayed** — clicking "Replay" on a run clones inputs and fires a new run.

---

## Card Status

| Card | Title | Status | Commit |
|---|---|---|---|
| MAG-671 | flow-builder shell widget | Done | `d251b21b` |
| MAG-672 | flow-steps-view widget | Done | `ab9ef883` |
| MAG-674 | FlowchartEditor integration + projection syncs | Done | `e5c85b7c` |
| MAG-675 | data-mapping widget | Done | `c5e7e8bb` |
| MAG-676 | error-branch widget | Done | `680c1704` |
| MAG-677 | AutomationRule dispatch sync | Done | `12a0b319` |
| MAG-678 | step-test-runner widget | Done | `59bf8ba8` |
| MAG-679 | ReplayRun sync | Done | `33201279` |
| MAG-680 | workflow-version-history widget | Done | `6ab106cb` |
| MAG-681 | Permissions & run-as syncs | Done | `0423d6e4` |

## Known Follow-ups (concept API gaps surfaced during implementation)

These gaps were documented during sync/widget work but are out of scope for the current cards. Track as new cards when revisited:

- **ProcessSpec granular mutation** — spec stores `steps` and `edges` as opaque `Bytes` in `create`/`update`; no `addStep` / `addEdge` / `removeStep`. ProcessSpecToCanvas / CanvasToProcessSpec currently project at spec-level granularity. Adding granular actions (or a handler-level decode/traverse) would enable per-step projection fidelity.
- **Canvas has no `createConnector` primitive** — edges are structural via `ConstraintAnchor/setFlowDirection`. CanvasToProcessSpec currently triggers on `Canvas/groupNodes` as the nearest semantic proxy.
- **GraphAnalysis** exposes only `analyze(algorithm: ...)` — no dedicated `detectCycles`. FlowGraphValidate uses `analyze(algorithm: "cycle-detection")`.
- **ProcessRun** lacks `replay` and `attachContext` actions; **StepRun** lacks `seed` (selective redrive) and `getIO` (visibility gating). ReplayRun triggers on `get_status` as a stand-in; StepIOVisibility gates on `StepRun/get`.
- **ProcessSpec step record** has no `visibility` field — StepIOVisibility reads visibility from Authorization state as a workaround.
- **FlowBuilderView** React adapter (MAG-671 scope-deferred) — wires the shell widget + sub-widgets into clef-base once the action-editor, step-test-runner, and version-history widgets are available to compose.

## Appendix: Companion Docs

- `docs/research/automation/Automation UI_UX Deep Dive Recommendation.md`
- `docs/research/automation/claude-research-automation.md`
- `docs/research/automation/deep-research-report-on-automation-ux.md`
