# GovernedProcess — PRD

## Vision

Governance structures and process execution are unified: governance workflows
ARE processes, and processes operate within governance structures. Teams
(Circles) define their available processes, roles gate participation,
proposals flow through vote and execution steps as process runs, reputation
adjusts based on participation, and passed proposals can modify the
governance structure itself.

## Architecture

```
Circle ("Marketing Team")
├── Members (via Membership, with Roles)
├── Processes bound to this Circle:
│   ├── "Content Review" ProcessSpec
│   ├── "Budget Request" ProcessSpec (includes Vote step)
│   └── "Role Change" ProcessSpec (Proposal → Vote → Execute)
├── Policies (guards on process steps)
├── Reputation (per-member, adjusts from participation)
└── Active Proposals (content-native pages with sections)
```

Key flows:
- **Proposal lifecycle is a process**: Proposal/create → ProcessRun through
  draft → sponsor → vote → execute steps
- **Vote is a process step**: StepRun(type: "vote") dispatches to Vote concept
- **Reputation weights votes**: Weight resolved from Reputation scores
- **Passed proposals change governance**: Execution/execute modifies
  Role/Permission/Membership/Treasury

## Deliverables

### Phase 1: Integration Syncs
Wire governance concepts to process concepts via syncs.

| # | Sync | Status | Commit |
|---|------|--------|--------|
| 1.1 | Circle binds processes (Circle → ProcessSpec association) | **done** | 335d6a6d |
| 1.2 | Role gates process start (ProcessRun/start → Role/check) | **done** | 335d6a6d |
| 1.3 | Proposal lifecycle as process (Proposal/create → ProcessRun) | **done** | 335d6a6d |
| 1.4 | Vote as process step (StepRun → Vote/startSession) | **done** | 335d6a6d |
| 1.5 | Vote result advances process (Vote/tally → ProcessRun/advance) | **done** | 335d6a6d |
| 1.6 | Execution as process step (StepRun → Execution/schedule) | **done** | 96025a71 |
| 1.7 | Policy guards process steps (StepRun → Policy/evaluate) | **done** | 96025a71 |
| 1.8 | Reputation from participation (ProcessRun/complete + Vote → Reputation/earn) | **done** | 96025a71 |
| 1.9 | Reputation weights votes (Vote/castVote → Weight/updateWeight) | **done** | 96025a71 |
| 1.10 | Proposal changes permissions (Execution → Role/assign + Membership/join + Permission/grant) | **done** | 96025a71 |

### Phase 2: Content-Native Schemas
Make Circle and Policy content-native pages with child blocks.

| # | Schema | Child Schema | Status | Commit |
|---|--------|-------------|--------|--------|
| 2.1 | circle (name, domain, governance_model, lead/rep links, status) | circle-member (member_id, role, joined_date, reputation_score, active, delegation_to) | **done** | 179624b6 |
| 2.2 | policy (name, domain, scope, enforcement, status, evaluator) | policy-clause (deontic: May/Must/MustNot, attributes, aim, condition, or_else, severity) | **done** | 179624b6 |

### Phase 3: GovernedProcess Derived Concept
Compose governance + process into a unified abstraction.

| # | Deliverable | Status | Commit |
|---|-------------|--------|--------|
| 3.1 | GovernedProcess derived concept | **done** | 96025a71 |
| 3.2 | Update ClefBase hierarchy (add GovernedProcess) | **done** | see below |

### Phase 4: Widgets
New widgets for the governance-process integration.

| # | Widget | Purpose | Status | Commit |
|---|--------|---------|--------|--------|
| 4.1 | vote-ballot | Cast vote interface with options, quorum progress, deadline | **done** | 96025a71 |
| 4.2 | reputation-badge | Compact score display with rank and trend (expandable history) | **done** | 1387d03f |
| 4.3 | reputation-history | Included in reputation-badge expanded panel | **done** | 1387d03f |
| 4.4 | circle-dashboard | Team overview: members, processes, proposals, reputation | **done** | 1387d03f |
| 4.5 | governance-process-timeline | Process timeline with governance checkpoints | **done** | dce12a1e |
| 4.6 | policy-compliance-panel | Policy pass/fail status for current action | pending | |

### Phase 5: Views
ViewShell registrations for governance-process pages.

| # | View | Presentation | Status | Commit |
|---|------|-------------|--------|--------|
| 5.1 | circle-processes | Table of processes available to a circle | **done** | dce12a1e |
| 5.2 | active-proposals | Card grid of proposals, filterable by status/circle | **done** | dce12a1e |
| 5.3 | reputation-leaderboard | Table of members ranked by reputation | **done** | dce12a1e |
| 5.4 | governance-activity | Timeline of all governance events | **done** | dce12a1e |
