# PRD: Invocation Lifecycle Concept

## Status: Draft
## Authors: 2026-04-13
## Depends on:
- Existing: ActionBinding concept (dispatches user intents into concept actions)
- Existing: FlowTrace / runtime-flow (records execution but isn't bound to UI surfaces)
- Existing: usability-audit.md §Silent Failures Everywhere — the problem we're solving

---

## 1. Problem Statement

Every `ActionBinding/invoke` today completes-and-forgets from the UI's perspective. The kernel returns a typed variant (`ok | error | ...`), the sync engine may dispatch downstream effects, and FlowTrace records the whole chain — but none of this is observable from a running widget. The audit flagged silent failures across ConceptBrowser install/remove, ControlBlock invoke, Schema apply/remove, Dashboard health fetch, view row/bulk actions, and more.

React components paper over it with ad-hoc `useState<{loading, error}>`, but the pattern is:
1. Framework-specific (React hooks, Vue composables, Svelte stores — all bespoke per target)
2. Non-observable from outside the widget that owns it (Score can't query "what's pending", tests can't assert status sequences)
3. Non-reusable (optimistic UI, retry, undo-tied-to-in-flight all reinvent the wheel)

The architecturally correct fix in Clef is a **first-class Invocation concept** whose state *is* the observable lifecycle of every ActionBinding call. UI bindings (React hooks, Vue composables, CLI progress, MCP tool-call status) are all generated from the concept's surface, not hand-authored.

---

## 2. Design decisions (settled up-front)

### 2.1 One Invocation per ActionBinding/invoke call

An Invocation is spawned on `ActionBinding/invoke` and completes on the matching completion (ok/error/any variant). Sync-spawned downstream dispatches are *not* wrapped in separate Invocation records — those are a FlowTrace concern. The Invocation boundary is the user-initiated action, not every internal sync hop.

### 2.2 Status is a derived field, not an enum-valued action

The concept carries `startedAt`, `completedAt: option`, `error: option`, `result: option` as raw fields. `status` is computed: `completedAt == null ⇒ "pending"`; `error != null ⇒ "error"`; else `"ok"`. Keeps the state minimal and invariants obvious; UI bindings derive the four-state FSM from the timestamps.

### 2.3 Retention: gc on dismiss, bounded buffer for pending

Completed Invocations persist until `dismiss(invocation)` or until a bounded ring buffer evicts them (default 100 per session). Pending Invocations never get gc'd — if a call never completes, that's a bug to surface, not hide.

### 2.4 Retry re-invokes with saved params

`retry(invocation)` dispatches a **new** `ActionBinding/invoke` with the original binding + params, and creates a new Invocation. Original stays as a completed (error) record for auditability. The new Invocation carries `retriedFrom: option Invocation` pointing back to its predecessor.

### 2.5 Optimistic updates are out of scope for v1

Optimistic UI (widget shows new state before kernel confirms) is a distinct pattern that needs rollback machinery tied to UndoStack. It composes with Invocation cleanly (subscribe to invocation status, rollback on error) but isn't a responsibility of this concept. Follow-up card if needed.

### 2.6 Binding targets get generated, not hand-authored

The concept ships one headless `invocation-status.widget` spec with anatomy (pending-indicator, success-chip, error-panel, retry-button, dismiss-button) and FSM states (idle → pending → ok | error → idle). Framework targets (React, Vue, Svelte, CLI, MCP, SSE) each produce their own rendering from that spec via existing widget codegen pipelines.

### 2.7 Invocation subscription is connection-scoped

In a multi-user app, User A's pending install shouldn't show on User B's screen. Invocations are keyed by the Connection (from `Connection [K]` concept) that originated them. Observers subscribe via the standard Connection/observe channel filtered by connection id.

---

## 3. Scope

### 3.1 New concept (1)

| Concept | Purpose | Actions |
|---|---|---|
| `Invocation [I]` | Observable lifecycle of every ActionBinding/invoke call — first-class state for pending/ok/error across UI surfaces | `start`, `complete`, `fail`, `retry`, `dismiss`, `query` |

### 3.2 New syncs (2)

1. `TrackInvocationStart` — when `ActionBinding/invoke` fires → `Invocation/start`
2. `TrackInvocationComplete` — when the bound action returns (any variant) → `Invocation/complete` or `Invocation/fail`

Both generic; no per-binding wiring.

### 3.3 New widget (1 spec, N target implementations)

`invocation-status.widget` — headless spec with:
- **Anatomy**: `root`, `indicator`, `label`, `progress`, `error-panel`, `retry-button`, `dismiss-button`, `timestamp`
- **States**: `idle | pending | ok | error`, transitions driven by concept state
- **A11y**: `role="status"`, `aria-live="polite"` for status changes, retry/dismiss as buttons with labels
- **Props**: `invocationId`, `verbose: Bool`, `autoDismissMs: option Int`

Target codegen (React, Vue, etc.) follows existing widget generator.

### 3.4 Concept surface for callers

Two ergonomic entry points on top of the raw actions:
- `observe(binding) -> stream Invocation` — subscribe to all pending/recent invocations of a given binding id
- `latest(binding) -> option Invocation` — most recent invocation for a binding, regardless of status

### 3.5 Migration of audit-flagged call sites

- ConceptBrowser install/remove
- ControlBlock invoke
- Schema apply/remove in EntityDetailView
- Dashboard health fetch
- ViewRenderer row + bulk actions
- BoardDisplay (when DnD lands), CalendarDisplay (when event creation lands)

Each migrates from ad-hoc `useState` to the generated binding for the target framework.

---

## 4. Architecture

### 4.1 Invocation state model

```
state
  invocations: set I
  connection: I -> K                    -- Connection that originated this invocation
  binding: I -> String                  -- ActionBinding id
  params: I -> Bytes                    -- serialized input params (for retry)
  result: I -> option Bytes             -- completion output
  error: I -> option String             -- error message if failed
  startedAt: I -> DateTime
  completedAt: I -> option DateTime
  retriedFrom: I -> option I            -- predecessor invocation if this is a retry
  dismissedAt: I -> option DateTime
```

Invariants:
- Invocations cannot start with completedAt set
- completedAt set ⇒ (result set ⊕ error set), exactly one
- retriedFrom points to a completed invocation with error set
- dismissed invocations can still be observed but are excluded from active queries

### 4.2 Action signatures

```
start(invocation: I, connection: K, binding: String, params: Bytes, startedAt: DateTime) -> ok | duplicate | error
complete(invocation: I, result: Bytes, completedAt: DateTime) -> ok | not_found | already_completed
fail(invocation: I, error: String, completedAt: DateTime) -> ok | not_found | already_completed
retry(invocation: I, newInvocation: I, startedAt: DateTime) -> ok | not_found | not_failed
dismiss(invocation: I, dismissedAt: DateTime) -> ok | not_found
query(connection: K, binding: option String, since: option DateTime) -> ok(invocations: list I)
```

### 4.3 Sync wiring

```
sync TrackInvocationStart
  when ActionBinding/invoke(binding: ?b, params: ?p, connection: ?conn) => pending(invocation: ?i)
  where bind(uuid() as ?id, now() as ?t)
  then Invocation/start(invocation: ?id, connection: ?conn, binding: ?b, params: ?p, startedAt: ?t)

sync TrackInvocationComplete
  when ActionBinding/invoke => ok(result: ?r) | error(message: ?m) | <any other variant>
  where bind(now() as ?t)
  then
    branch (variant == "error")
      Invocation/fail(invocation: ?i, error: ?m, completedAt: ?t)
    else
      Invocation/complete(invocation: ?i, result: ?r, completedAt: ?t)
```

Requires `ActionBinding/invoke` to carry an invocation id through to its completion. If it doesn't today, add a minor extension: `invoke` returns `pending(invocation: I)` before the actual result; the completion pattern-matches on invocation id.

### 4.4 Widget binding generation

React target generator produces, given `invocation-status.widget`:

```ts
// Generated
export function useInvocation(invocationId: string): InvocationState {
  // subscribes via Connection/observe to Invocation completions
  // returns { status, result, error, retry(), dismiss() }
}

export function InvocationStatusIndicator({ invocationId, verbose, autoDismissMs }) {
  // renders the widget's anatomy by FSM state, wires retry/dismiss to concept actions
}
```

Same shape for Vue (`useInvocation()` composable + `<InvocationStatusIndicator>` component), Svelte (store + component), CLI (progress spinner writing to stderr on fail), MCP (tool-call status embedded in the tool's structured response).

---

## 5. Phasing

### Phase 1 — Concept core (2 cards)

1. `Invocation` concept spec + handler + conformance tests
2. Two generic syncs (TrackInvocationStart + TrackInvocationComplete); if ActionBinding/invoke needs to expose invocation id, extend it

### Phase 2 — Widget + React generation (2 cards)

3. `invocation-status.widget` headless spec
4. React codegen: `useInvocation` hook + `<InvocationStatusIndicator>` component

### Phase 3 — Migration (2 cards, each touches multiple call sites)

5. Migrate ConceptBrowser + ControlBlock + EntityDetail schema apply/remove + Dashboard health fetch to `useInvocation`
6. Migrate ViewRenderer row + bulk actions + add retry affordance for failed queries

### Phase 4 — Retry + dismiss affordance polish (1 card)

7. End-to-end test of retry flow (failed action → red chip with retry button → re-invoke → green → auto-dismiss)

---

## 6. Success Criteria

1. Every `ActionBinding/invoke` from a UI surface produces a live Invocation record observable via Score queries
2. Silent-failure call sites from the audit now show pending/ok/error states without bespoke useState logic
3. Failed invocations expose a `retry()` that re-invokes with saved params
4. The same `invocation-status.widget` renders consistently across React (confirmed) and is positioned to plug into Vue/Svelte/CLI later with no concept changes
5. FlowTrace can correlate an Invocation to its underlying sync chain for debugging
6. Tests assert status sequences deterministically: `start → pending → fail(message) → retry → start → complete(result) → dismiss`

---

## 7. Non-goals

- **Optimistic UI rollback** — separate concept tied to UndoStack; Invocation emits the events optimistic-UI would subscribe to, but doesn't implement the rollback pattern
- **Invocation records as the FlowTrace replacement** — FlowTrace stays the ground truth for causal chains; Invocation is the user-observable boundary
- **Cross-session invocation resumption** — if a session dies with pending invocations, they stay pending until explicit cleanup; we don't auto-recover across reconnects in v1
- **Rate limiting / back-pressure** — separate concept; Invocation just records what happened

---

## 8. Open Questions

1. **Params serialization format** — JSON bytes for v1 is fine, but some bindings pass binary blobs. Lean opaque Bytes + let the provider decide; document that retry requires round-trippable params
2. **Invocation id ownership** — generated by the sync on start, or pre-allocated by ActionBinding/invoke? Lean sync-generated so invoke's contract stays pure
3. **Multi-invocation batch status** — when BulkAction fires N invokes, the user wants "3 of 5 succeeded, 2 failed." Leave to a future BatchInvocation wrapper concept that observes N Invocations, or fold into this concept? Lean separate wrapper
4. **Connection-less invocations** — CLI and scheduled-trigger invocations don't have an interactive Connection. Allow null connection? Or attach to a synthetic "system" connection? Lean synthetic system connection so the query model stays uniform
5. **Auto-dismiss policy** — successful invocations auto-dismiss after 3s by default (configurable via widget prop), errors persist until manually dismissed. Agreed? Yes, matches Notion/Linear norms

---

## 9. Card Plan

7 cards under epic MAG-842 "Invocation Lifecycle". All shipped 2026-04-13.

| Card | Title | Commit |
|---|---|---|
| INV-01 | Invocation[I, K] concept + handler + conformance | 71f07894 |
| INV-02 | TrackInvocation syncs + ActionBinding pending/ok/error threading | ab247397 |
| INV-03 | invocation-status.widget headless spec | 777b7e35 |
| INV-04 | useInvocation hook + InvocationStatusIndicator | 689c8bbd |
| INV-05 | Migrate ConceptBrowser / RecursiveBlockEditor / EntityDetail / Dashboard | dea75f7f |
| INV-06 | Migrate ViewRenderer row + bulk + query retry | 81cf1ffa |
| INV-07 | End-to-end fail → retry → complete lifecycle test | 9711dee1 |
