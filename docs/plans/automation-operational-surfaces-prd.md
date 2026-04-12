# PRD: Automation Operational Surfaces

## Status: Draft
## Authors: 2026-04-12
## Depends on:
- Completed: Automation Authoring UI (MAG-670, docs/plans/automation-ui-prd.md)
- Completed: ActionBinding pipeline (clef-base integration)
- Completed: Surface Contract Theming (MAG-657)

---

## 1. Problem Statement

MAG-670 shipped the *authoring* half of Clef's automation story — Flow Builder, steps/graph views, data mapping, error branches, replay, version history. That PRD treated every non-authoring concept as "already exists, out of scope."

The catch: those non-authoring concepts — timers, webhook inboxes, connectors, queues, retry/compensation policies, LLM steps, eval runs, provider dispatch — have **no frontend at all**. You can author a ProcessSpec but you can't:

- See what's scheduled or pause a cron job
- Inspect incoming webhook payloads or replay one
- Browse a library of connectors (Gmail/Slack/etc.) or configure credentials
- Watch queue depth or adjust concurrency
- Set a retry policy or compensation plan from the step inspector
- Configure the LLM step of a process (model, prompt, tools, temperature)
- Run and view automation evaluations / regression tests
- Check provider health across ManifestAutomationProvider / SyncAutomationProvider / WebhookAutomationProvider / LLMAutomationProvider / ProcessAutomationProvider

Clef Base today has a Flow Builder but no operational dashboard around it. This PRD closes that gap.

---

## 2. Design Principles

**Inherited from the automation UX research** (`docs/research/automation/`, same lessons that shaped MAG-670). These patterns apply to operational surfaces, not just authoring, and every card below must honor them:

- **Progressive disclosure.** Default view is the simple, common case; advanced config hides behind tabs/expanders. Step inspector shows Action + I/O Mapping + Error tabs by default; Retry / Compensation / LLM / Connector tabs appear only when the step kind or user intent calls for them. Connector config escalates from "pick connector" → "configure params" → "test connection."
- **Live sample data drives understanding.** Webhook inbox shows real payloads that seed replay. Connector call log stores real request/response pairs that feed eval-run inputs. Retry policies preview what "5 retries with 2x backoff starting at 250ms" *actually* means as a timeline. Nothing is an abstract form — every config surface is backed by the concrete data it will operate on.
- **First-class error & recovery paths.** Retry policy and compensation plan are not hidden footer-settings — they're tabs at the same level as Action. The UI treats failure as an expected branch, not an exception state.
- **Replay / redrive / rerun is universal.** Already core to the Flow Builder; extend it consistently to webhooks (replay from inbox), schedules (run-now), eval runs (clone input and rerun), queues (re-queue drained item), connectors (retry failed call).
- **Governance-aware observability.** Every surface that shows data is role-gated at the field level (reusing MAG-681 StepIOVisibility pattern). Provider dashboard, AutomationScope admin, and approval inbox are the explicit governance surfaces; scheduled jobs / webhooks / queues each show a "who can touch this" badge.

**Clef-specific principles:**

1. **Compose with what exists.** Every concept listed already has state, actions, and syncs. No new data concepts are required — only widgets, views, and (sparingly) projection syncs.
2. **Each surface is a view.** Use `ViewShell + FilterSpec + SortSpec + ProjectionSpec + PresentationSpec + InteractionSpec` — no bespoke React plumbing per concept.
3. **Reuse the Flow Builder's step inspector.** Retry policy, compensation plan, LLM-step config, and connector-call config are all step-level settings. They become *tabs* inside the existing step inspector rather than new top-level screens. (This *is* progressive disclosure applied to step config.)
4. **Provider dashboards are read-only by default.** Authors don't write providers from the UI — they author ProcessSpecs and user syncs and let AutomationDispatch route.
5. **Concept-mediated buttons everywhere.** Every action (pause job, replay webhook, flush queue, invalidate connector credential) goes through `ActionBinding` + `ActionButton`.

---

## 3. Scope

### 3.1 In Scope

**Triggers:**
- Schedule manager (Timer + ScheduledJob)
- Webhook inbox viewer + replay

**Outbound integrations:**
- Connector library browser
- Connector credential management
- Connector call log
- LLM tool registry browser (compose with tool-picker in LLM step config)

**Step-level config (new tabs in step inspector):**
- Retry policy editor
- Compensation plan editor
- LLM step config (model/prompt/tools/temperature)
- Connector-call step config

**Reliability / ops:**
- Checkpoint viewer inside ProcessRunView
- Queue monitor (depth, concurrency, priority)

**Governance:**
- AutomationScope admin editor (edit allow/deny lists for user syncs)
- Approval inbox (if `control.concept` supports approvals — verify during implementation)

**Testing:**
- Eval runs list + detail view
- Eval authoring (compose with ProcessSpec authoring)

**Provider observability:**
- AutomationDispatch provider dashboard — what's registered, what fired recently, health per provider

### 3.2 Out of Scope

- Authoring new connector types (those are developer-authored via `/create-concept` + connector handler)
- Real-time collaboration on schedule edits
- Custom queue/retry policy algorithms beyond what concepts support
- Provider *implementation* — only observability

---

## 4. Architecture

### 4.1 Existing Concepts — No Changes Required

- `process-automation/timer.concept`, `automation/scheduled-job.derived`
- `process-automation/webhook-inbox.concept`, `webhook-dispatch-provider.concept`, `WebhookAutomationProvider.concept`
- `process-automation/connector-call.concept`
- `process-llm/llm-call.concept`, `evaluation-run.concept`, `tool-registry.concept`
- `process-reliability/retry-policy.concept`, `compensation-plan.concept`, `checkpoint.concept`
- `automation/queue.concept`, `control.concept`
- `automation-providers/AutomationDispatch.concept`, `AutomationScope.concept`, all four provider concepts

### 4.2 New Widgets

Grouped by surface. Most are view-like and will back a ViewShell or step-inspector tab.

- `schedule-manager.widget` — list + edit of Timer / ScheduledJob
- `webhook-inbox.widget` — incoming payload list, detail pane, replay button
- `connector-library.widget` — grid/list of connector types with search
- `connector-config.widget` — credential binding + config for a single connector instance
- `connector-call-log.widget` — call history with status filter
- `retry-policy-editor.widget` — tab inside step inspector (max retries, backoff, jitter)
- `compensation-plan-editor.widget` — tab inside step inspector (rollback action picker)
- `llm-step-config.widget` — tab inside step inspector (model, prompt, tools, temperature, max tokens)
- `connector-step-config.widget` — tab inside step inspector (connector + action + param mapping)
- `tool-registry-browser.widget` — picker for LLM tools
- `checkpoint-viewer.widget` — tab inside ProcessRunView
- `queue-monitor.widget` — depth, concurrency, per-queue priority settings
- `automation-scope-editor.widget` — admin UI for allow/deny lists
- `approval-inbox.widget` — pending approvals list (if `control.concept` supports this; otherwise deferred)
- `evaluation-run-view.widget` — eval detail
- `automation-provider-dashboard.widget` — registered providers + health + recent dispatches

### 4.3 New Views (clef-base)

Each backed by ViewShell. No bespoke React.

- `ScheduledJobsView`
- `WebhookInboxView`
- `ConnectorLibraryView`
- `ConnectorInstancesView`
- `ConnectorCallLogView`
- `QueueMonitorView`
- `AutomationScopeAdminView`
- `ApprovalsInboxView` (conditional)
- `EvaluationRunsView`
- `AutomationDispatchView` (provider dashboard)

### 4.4 Step Inspector Tabs

Rather than new top-level screens, the Flow Builder's step inspector gets a tab strip. Tabs conditionally render based on step kind:

| Tab | Visible when | Widget |
|---|---|---|
| Action | always | existing action-editor |
| Retry | step has retry-capable kind | retry-policy-editor |
| Compensation | step has compensable side effect | compensation-plan-editor |
| LLM | step kind is `llm-call` | llm-step-config |
| Connector | step kind is `connector-call` | connector-step-config |
| I/O Mapping | always | data-mapping (existing) |
| Error | always | error-branch (existing) |

### 4.5 New Syncs

Minimal — most work is pure UI over existing concepts.

- `ReplayWebhook` — on user replay action, re-inject a stored webhook payload through `WebhookAutomationProvider/dispatch`
- `PauseScheduledJob` / `ResumeScheduledJob` — user-initiated; route to Timer/ScheduledJob lifecycle actions
- `ReuseEvalRunInput` — clone an eval run's input to start a new run (parallels ReplayRun)

### 4.6 ActionBinding Seeds

Each user-facing button gets a binding seed. Grouped:

- Schedules: pause, resume, run-now, edit, delete
- Webhooks: replay, mark-seen, delete
- Connectors: test-connection, rotate-credential, disable, enable
- Queues: pause-queue, drain-queue, set-concurrency, set-priority
- Approvals: approve, reject, reassign
- Eval runs: run, compare-to-baseline
- AutomationScope: add-allowed-action, remove-allowed-action

---

## 5. Deliverables

### 5.1 Phase 1 — Triggers & Inbox (ship first)

1. `schedule-manager.widget` + `ScheduledJobsView` + pause/resume/run-now bindings
2. `webhook-inbox.widget` + `WebhookInboxView` + `ReplayWebhook` sync + replay/delete bindings

### 5.2 Phase 2 — Step Inspector Tabs

3. Tab strip in flow-step-inspector (extend existing spec)
4. `retry-policy-editor.widget`
5. `compensation-plan-editor.widget`
6. `llm-step-config.widget` + `tool-registry-browser.widget`
7. `connector-step-config.widget`

### 5.3 Phase 3 — Connectors Surface

8. `connector-library.widget` + `ConnectorLibraryView`
9. `connector-config.widget` + `ConnectorInstancesView` + credential bindings
10. `connector-call-log.widget` + `ConnectorCallLogView`

### 5.4 Phase 4 — Ops

11. `queue-monitor.widget` + `QueueMonitorView` + queue-control bindings
12. `checkpoint-viewer.widget` (tab inside ProcessRunView)
13. `automation-provider-dashboard.widget` + `AutomationDispatchView`

### 5.5 Phase 5 — Governance & Testing

14. `automation-scope-editor.widget` + `AutomationScopeAdminView` + scope-edit bindings
15. `approval-inbox.widget` + `ApprovalsInboxView` (conditional on control.concept capability)
16. `evaluation-run-view.widget` + `EvaluationRunsView` + `ReuseEvalRunInput` sync

---

## 5.6 Research-Pattern Checklist (must be verified on every card)

Each card's acceptance criteria must explicitly confirm the applicable patterns:

| Pattern | How each surface applies it |
|---|---|
| Progressive disclosure | Advanced config hidden in tabs/expanders; default renders the 80% case |
| Live sample data | Real payloads / call logs / past runs seed every config + test surface |
| First-class error paths | Retry + compensation tabs at action-level; failure states rendered explicitly, not as disabled states |
| Replay / rerun | Every terminal state has a "run again" / "replay" affordance routed through ActionBinding |
| Governance-aware | Role-gated field visibility via StepIOVisibility pattern; explicit scope/approval surfaces |

## 6. Success Criteria

1. A user can schedule a workflow, watch it fire on a cron, pause it, and run it immediately — all from the UI.
2. A webhook fires, lands in the inbox, user inspects the payload and replays it to rerun the automation.
3. A step inspector exposes retry, compensation, LLM, and connector config as contextual tabs without cluttering the default view.
4. A user browses the connector library, configures a Slack connector with a credential, and wires it into a ProcessSpec step.
5. Ops can see queue depth, adjust concurrency, and drain a stuck queue.
6. An admin can edit AutomationScope to allow a new concept action for user-authored syncs.
7. An eval run compares this run's output to a baseline.
8. The provider dashboard shows which automation providers are registered, which dispatched most recently, and their health.

---

## 7. Card Plan

See VK cards under epic "Automation Operational Surfaces — Epic" for the phase-mapped card breakdown.
