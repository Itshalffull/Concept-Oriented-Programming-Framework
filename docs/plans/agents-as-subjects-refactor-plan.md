# Agents as Subjects — Identity, Authorization, Governance, Pilot, and Process Refactor Plan

**Version:** 0.2.0  
**Date:** 2026-04-17  
**Status:** Design specification — pre-implementation

## Changelog

**v0.2.0 (2026-04-17)** — Substantive refactor based on critique pass:

- Reframed `Subject` as unification layer, not universal dependency
- Added explicit threat model and Subject-level protections
- Promoted `Attribution` to first-class concept separate from `AgenticDelegate`
- Corrected Pilot "for free" claim with specific Subject-threading requirements
- Added policy epoch model with declared reconciliation strategies
- Added DAG-based concurrent amendment handling
- Expanded migration sequence into phased plan with entry and exit criteria
- Added bootstrap governance layer and `program.md` authoring flow
- Resolved Constitution ownership under governance
- Added concern ownership and remediation-oriented checklist updates

---

## Kanban Cards (Vibe Kanban)

| Card | PRD Sections | Blocked By | Blocks | Commit |
|---|---|---|---|---|
| **MAG-952** Subject unification layer + registration syncs | §2, §4, §13 | — | MAG-954, MAG-956 | — |
| **MAG-958** AgentRegistration concept + Subject sync integration | §4, implementation PRD | — | MAG-954 | — |
| **MAG-953** Executable access unification + GovernanceOffice disposition | §5, §6, §12 | — | MAG-954, MAG-955, MAG-956, MAG-957 | — |
| **MAG-954** Agent runtime subject binding + attribution chain | §7, §8 | MAG-952, MAG-953 | MAG-957 | — |
| **MAG-955** Pilot inherited auth + Subject threading + `PilotMode` | §9 | MAG-953 | — | — |
| **MAG-956** Process dispatch eligibility separation + shadow mode | §10 | MAG-952, MAG-953 | MAG-957 | — |
| **MAG-957** Governance amendment flow + policy epochs + bootstrap/program flow | §11, §13, §16 | MAG-953, MAG-954, MAG-956 | — | — |
| **MAG-959** ContentReconciler concept + program/admin reverse projection | §16, implementation PRD | — | — | — |

---

## 1. Problem Statement

The repo is close to supporting "agents are just users in the system," but the current model is not yet cleanly Clef-native.

Main problems:

1. Identity and runtime are still partially conflated.
2. Executable authority is duplicated across `Authorization`, governance `Role`, and governance `Permission`.
3. `AgenticDelegate` is overloaded.
4. The accountability chain is under-modeled.
5. Pilot authorization is mostly implicit and incompletely threaded for aggregate actions.
6. Process dispatch risks becoming a second authorization system.
7. Governance amendment, merge, and live reconciliation are under-specified.
8. The bootstrap path for `program.md` is not explicit.

The target is:

- concepts remain independent
- cross-cutting identity is unified without making every concept depend on `Subject`
- executable access has one canonical owner
- governance owns higher-order policy, amendment, and accountability
- agents act through the same subject-facing authorization paths as other principals

---

## 2. Target Model

### 2.1 High-Level Design

```text
User / AgentRegistration / ServiceAccount
        -> sync into Subject
        -> Authentication / Session
        -> Authorization / AccessControl

Persona content
        -> PromptAssembly
        -> AgentSession(subjectId, attributionRef, effectivePolicySnapshotRef)
        -> AgentLoop

AgentSession
        -> direct concept invocation
        -> or Pilot
        -> same underlying authorization path

ProcessSpec
        -> assigns work to subjects / executable roles / pools
        -> ExecutionDispatch resolves mode
        -> Authorization resolves eligibility

Governance
        -> GovernanceOffice / AgenticDelegate / Attribution / Constitution /
           Proposal / protection policies / reconciliation policies
```

### 2.2 Clef-Native Ownership Split

- Identity-producing concepts own their own source-of-truth state.
- `Subject` provides optional unification for cross-cutting consumers.
- `Authorization` owns executable access.
- `GovernanceOffice`, `AgenticDelegate`, `Attribution`, `Constitution`, and proposal workflows own higher-order organizational and accountability concerns.
- `AgentSession` owns runtime execution, not identity truth.
- `Pilot` owns verb vocabulary, not business-specific authorization.
- `Process` owns workflow state and routing, not eligibility truth.

### 2.3 Subject as Unification Layer, Not Dependency

`Subject` should be treated like `ContentPool`: a unification layer that concepts can feed and consumers can query, not a universal dependency.

Rules:

- `User`, `AgentRegistration`, and `ServiceAccount` emit identity facts into `Subject` through syncs.
- Those concepts do not depend on `Subject`.
- Cross-cutting consumers such as authorization shims, rate limiting, anomaly detection, and audit correlation may query `Subject`.
- Identity-type-specific flows may continue to target `User` or another source concept directly.
- `Authorization` may expose both Subject-targeting APIs and identity-type-specific APIs during migration.

---

## 3. Current-State Audit

### 3.1 Identity / Access Concepts Already Present

The repo already has:

- `specs/app/user.concept`
- `repertoire/concepts/identity/authentication.concept`
- `repertoire/concepts/identity/session.concept`
- `repertoire/concepts/identity/authorization.concept`
- `repertoire/concepts/identity/access-control.concept`

### 3.2 Governance Concepts Already Present

The repo also has:

- `repertoire/concepts/governance-identity/Role.concept`
- `repertoire/concepts/governance-identity/Permission.concept`
- `repertoire/concepts/governance-identity/AgenticDelegate.concept`

### 3.3 Runtime Concepts Already Present

The repo already has:

- `AgentSession`
- `AgentLoop`
- `AgentRole`
- `ToolBinding`
- `Conversation`
- persona compilation to `PromptAssembly`
- `ProcessConversation`
- `ExecutionDispatch`
- `Pilot`

### 3.4 Structural Gaps

The main gaps are:

- no explicit accountability chain concept
- no clear `Subject` unification layer
- governance `Role` and `Permission` overlap with executable access
- incomplete Pilot Subject threading
- incomplete live-session reconciliation design
- no explicit bootstrap governance flow for `program.md`

---

## 4. Subject Model

### 4.1 Recommendation

Introduce `Subject` as a unification/projection concept for acting principals.

Suggested shape:

```text
Subject
- id
- kind = human | agent | service
- backingRef
- status
```

### 4.2 Why Not Expand `User` Blindly

`User` is human-coded in name and current product semantics. Forcing every actor into `User` would blur boundaries and make service and agent identity less clear.

### 4.3 Sync Strategy

Use syncs:

- `User/register` -> `Subject/register(kind: "human")`
- `AgentRegistration/register` -> `Subject/register(kind: "agent")`
- `ServiceAccount/register` -> `Subject/register(kind: "service")`

### 4.4 `AgentRegistration` Boundary

`AgentRegistration` should be a real identity-suite concept and the source of truth for agent principals.

It should not be:

- persona content
- a governance entity
- an `AgentSession` runtime record

Recommended purpose:

- register and manage agent principals as durable acting identities

Recommended state shape:

- registrations: set `A`
- displayName: `A -> String`
- status: `A -> "active" | "disabled" | "revoked"`
- personaRef: `A -> option String`
- ownerSubject: `A -> String`
- agentClass: `A -> String`
- metadata: `A -> String`

Recommended lifecycle:

- `register`
- `setPersona`
- `disable`
- `revoke`
- `get`
- `listByOwner`

Separation:

- `AgentRegistration` = principal
- persona page = authored behavior
- `AgentSession` = runtime execution

### 4.5 Deliverable

Create one canonical cross-cutting principal view without making every concept depend on it.

---

## 5. Access Model Unification

### 5.1 Recommendation

Keep executable access in the identity suite:

- `Authorization`
- `AccessControl`

These remain the canonical owners of:

- executable roles
- permission grants
- permission checks
- composable access decisions

### 5.2 Governance `Permission`

Governance `Permission` overlaps directly with executable access.

Audit conclusion:

- current `Permission` is not a distinct mature policy engine
- current handler behavior is an exact `who:where:what` triple-match store
- the advertised optional `condition` field is stored but not actually evaluated
- live call sites already mix `Permission` and `Authorization` API shapes, which is evidence of conceptual drift rather than clean separation

Disposition:

- treat governance `Permission` as duplicate executable access
- deprecate it as a general-purpose permission model
- migrate surviving executable checks to `Authorization`
- move delegation-scope semantics into `AgenticDelegate`, `Attribution`, or `ActionRequest`
- if real conditional policy is later needed, extend `Authorization` or `AccessControl` rather than keeping a parallel grant system

### 5.3 Governance `Role` -> `GovernanceOffice`

Commit to renaming governance `Role` to `GovernanceOffice`.

Reason:

- RBAC does not capture term limits, max holders, or succession semantics
- office assignment can sync into executable role grants without conflating organizational office with executable access

### 5.4 Deliverable

One canonical executable access model, with governance office assignment syncing into it where needed.

### 5.5 Authorization Hardening

Standardizing on `Authorization` also requires tightening it.

Audit conclusion:

- `Authorization` is clearly the intended canonical executable access model
- but the current handler is too permissive in places and should be hardened before it becomes the sole authority path

Required hardening:

- remove implicit permission grants when a subject has no assigned role
- keep handler variants aligned with concept spec
- preserve a clean migration path from user-targeting APIs to Subject-targeting APIs

---

## 6. Threat Model and Subject-Level Protections

### 6.1 Threat Model

Any subject may operate at machine speed. Agents are especially vulnerable to:

- prompt injection
- tool hijack
- delegated spawn chains
- mass action in a short interval

The relevant axis is not human vs agent. It is behavior, speed, and accountability.

### 6.2 Principle

Protections should apply uniformly at the Subject layer.

### 6.3 Required Governance-Owned Protections

- `RateLimitPolicy` targeting Subject
- `AnomalyPolicy` targeting Subject
- accountability policy requiring complete attribution chain
- non-repudiation requirements for irreversible actions

### 6.4 Deliverable

Treat Subject-level protections as core infrastructure, not optional add-ons.

---

## 7. Attribution and Accountability Chain

### 7.1 Recommendation

Introduce `Attribution` as a first-class concept distinct from `AgenticDelegate`.

### 7.2 Separation of Concerns

- `AgenticDelegate` records standing delegation relationship.
- `Attribution` records the concrete chain present at action time.

### 7.3 Structure

Recommended chain entry:

- `subject_id`
- `delegation_ref`
- `role_at_time`

### 7.4 Invariants

- every action records attribution at execution time
- agent-spawns-agent extends the chain transitively
- any action without complete attribution is rejected

### 7.5 Example Policies Reading the Chain

- reject if any chain link has revoked delegation
- inherit the most restrictive scope in the chain
- require every irreversible action to include non-repudiation across the chain

---

## 8. Agent Runtime Refactor

### 8.1 Recommendation

`AgentSession` becomes a runtime execution instance bound to a subject and attribution chain.

Required additions:

- `subjectId`
- `delegateRef`
- `attributionRef`
- `effectivePolicySnapshotRef`

### 8.2 Principle

`AgentSession` is not identity. It is a runtime owned by identity.

### 8.3 Spawn Flow

At spawn, resolve:

- subject
- persona
- delegation scope
- attribution root
- effective policy snapshot
- constitution reference
- process/workspace scope

Recommended effective policy snapshot shape:

- derived artifact, not a primary source-of-truth concept
- keyed by acting subject plus relevant execution scope
- includes:
  - grants from `Authorization`
  - office-derived grants from `GovernanceOffice`
  - active delegation constraints
  - constitution refs
  - `PilotMode` restrictions
  - protection policies relevant to the session
  - policy epoch

### 8.4 `AgenticDelegate` Refactor

Narrow `AgenticDelegate` to:

- delegator subject
- delegate subject
- `scopeKind`
- `scopePayload`
- approval mode
- expiry
- revocation status

Recommended initial `scopeKind` values:

- `all`
- `action_set`
- `resource_prefix`
- `workspace`
- `process_role`
- `pilot_mode`

Examples:

- `action_set` -> `["ContentNode/edit", "ProcessRun/start"]`
- `workspace` -> `"workspace:abc"`
- `pilot_mode` -> `"read_only"`
- `resource_prefix` -> `"project:123/*"`

### 8.5 `ActionRequest`

Move supervised-action behavior out of `AgenticDelegate` into `ActionRequest` or equivalent request workflow concept.

Enforcement contract:

- `Authorization` answers whether the subject may perform the action in principle
- `AgenticDelegate` constrains whether the delegate may perform it on behalf of the delegator
- `Attribution` records the acting chain
- `ActionRequest` owns concrete supervised actions that require review or approval at execution time

### 8.6 Deliverable

Make agents first-class runtime actors without making runtime the source of identity truth.

---

## 9. Pilot and Invocation Path

### 9.1 Recommendation

Pilot inherits authorization through the same gates that protect direct UI use, provided the underlying systems gate by Subject.

### 9.2 Where Plumbing Is Required

Three Pilot actions need explicit Subject threading:

- `snapshot`
- `destinations`
- view-level `read`

These are plumbing changes, not a parallel permission system.

### 9.3 Pilot Scope Reductions as Governance Modes

Use `PilotMode` for restrictions like:

- navigate + read only
- no submit
- no destructive interaction

`PilotMode` is governance-owned. Pilot still owns the verb vocabulary.

### 9.4 Deliverable

Audit every Pilot action and classify it as:

- inherits gating naturally
- requires Subject-threading
- requires `PilotMode`

No Pilot action should bypass authorization.

---

## 10. Process Dispatch Refactor

### 10.1 Recommendation

`ExecutionDispatch` owns mode resolution, not final eligibility truth.

### 10.2 Assignment Model

Processes should assign work to:

- subjects
- executable roles
- pools resolved to subjects

### 10.3 Enforcement Model

Add eligibility checks through `Authorization`, but roll them out in shadow mode first.

Final runtime contract:

- `ExecutionDispatch` resolves mode
- `Authorization` provides grants and role membership facts
- `AccessControl` provides the final allow/deny decision over `(resource, action, context)`
- delegation, constitution, office-derived grants, and Pilot restrictions feed that final decision path rather than living as disconnected checks

### 10.4 Deliverable

Separate routing from eligibility cleanly.

---

## 11. Governance Proposal and Amendment Flow

### 11.1 Recommendation

Governance should own:

- proposals
- constitutions
- delegation
- offices
- amendment workflow
- protection policies

It should not duplicate executable access.

### 11.2 Canonical Amendment Flow

```text
subject or session emits Proposal
    -> Proposal enters governed process
    -> review makes proposal merge-eligible
    -> merge mutates canonical governance/access state
    -> policy epoch increments
    -> affected sessions reconcile
```

### 11.3 Live Session Reconciliation

Use the policy epoch design from the layering doc:

- sessions pin an effective policy snapshot `(bundle_id, epoch)`
- boundary checks occur between iterations, before tool invocation, and before action commit
- changes are delivered by subscription, not polling
- each governance entity declares reconciliation strategy:
  - `continue`
  - `pause`
  - `degrade`
  - `require_reapproval`
  - `terminate`

### 11.4 Concurrent Amendment Handling

Use the Versioning Kit DAG model:

- proposals are branches
- approval is merge intent, not merge
- conflict detection occurs at merge time
- dependencies are explicit
- cyclic dependencies are rejected at submission time
- epoch increments only on merge to main

### 11.5 Proposal Review and Resolution Shape

Initial recommendation:

- `Proposal` is a first-class concept
- review and resolution should initially remain process/workflow state over `Proposal`
- split `ProposalReview` or `AmendmentResolution` into standalone concepts only if they later gain independent lifecycle

### 11.6 Deliverable

Define one auditable amendment path that works for humans and agents and propagates predictably to live sessions.

---

## 12. Refactor Scope

### 12.1 Concept Changes

New or newly standardized:

- `Subject`
- `Attribution`
- `ActionRequest`
- `RateLimitPolicy`
- `AnomalyPolicy`
- `PilotMode`
- `AgentRegistration`
- governance-authored exposure metadata consumed through `Annotation` / `Projection`
- `ContentReconciler` as a provider-backed reverse-projection / reconciliation concept for content-native admin surfaces

Modified:

- `Authorization` to support Subject-targeting APIs
- `AccessControl` to become the canonical final decision surface for runtime checks
- `AgentSession` to carry `subjectId`, `attributionRef`, and `effectivePolicySnapshotRef`
- `ExecutionDispatch` to consume authorization eligibility
- `AgenticDelegate` to narrow purpose

Renamed / deprecated / absorbed:

- governance `Role` -> `GovernanceOffice`
- governance `Permission` -> deprecate as duplicate executable access and migrate call sites into `Authorization`

State kept on existing concepts rather than split out:

- policy epoch
- reconciliation strategy
- proposal dependency edges
- merge eligibility
- effective policy snapshot as a derived coordination artifact

### 12.2 Syncs

Likely new sync categories:

- `User` -> `Subject`
- `AgentRegistration` -> `Subject`
- `ServiceAccount` -> `Subject`
- `GovernanceOffice` membership -> executable role grant
- proposal merge -> canonical state mutation
- policy mutation -> session reconciliation trigger

Bind exposure should start as governance-authored metadata projected through `Annotation` / `Projection`, not as a first-class concept. Promote it only if exposure gains an independent lifecycle such as approval, publication state, revocation history, or audience-specific exception management.

### 12.3 Views / Widgets / clef-base Surfaces

Likely needed:

- subject administration
- office assignment surface
- delegation management surface
- attribution/audit views
- unified agent operations view

### 12.4 Seeds

Likely needed:

- subject-oriented access seeds
- governance office seeds
- Pilot mode seeds
- exposure-policy seeds

---

## 13. Migration Plan (Phased)

Each phase has entry criteria, exit criteria, and backward-compatibility commitments.

### Phase 0 — Foundation

- add `Subject`
- sync every existing `User` to `Subject(kind=human)`
- add Subject admin views
- add explicit backfill script `scripts/backfill-subjects-from-users.ts`

Exit when:

- Subject is queryable for every existing principal
- no auth path depends on it yet

Backward compat:

- full

### Phase 1 — Authorization Gains Subject API

- add Subject-targeting methods to `Authorization`
- keep old User-targeting methods as shims
- define `AccessControl` as final decision surface over Subject-based request context

Exit when:

- all internal callers use Subject API
- old API remains functional but deprecated
- runtime decision points have a clear `AccessControl` integration target

Backward compat:

- full via shim

### Phase 2 — Agent Identity as Subject

- add `AgentRegistration`
- sync `AgentRegistration` -> `Subject(kind=agent)`
- add optional `subjectId` to `AgentSession`
- add backfill script `scripts/backfill-agent-session-subjects.ts`

Exit when:

- every new `AgentSession` is born with `subjectId`
- agents are queryable as Subjects

Backward compat:

- existing sessions continue to run until backfilled

### Phase 3 — Governance Audit and Decisions

- audit governance `Permission` for real ABAC semantics
- audit governance `Role` for office semantics already in use
- document the exact absorption / deprecation path

Current conclusion captured by this PRD:

- governance `Permission` is duplicate executable access, not a distinct ABAC engine
- governance `Role` becomes `GovernanceOffice`

Exit when:

- scope decisions are committed in writing

Backward compat:

- audit only

### Phase 4 — GovernanceOffice Disposition

- rename governance `Role` -> `GovernanceOffice`
- add sync from office membership to executable role grants

Exit when:

- rename propagates through references
- sync-backed grants preserve behavior

Backward compat:

- full via sync layer

### Phase 5 — Governance Permission Disposition

- deprecate governance `Permission` as a general-purpose executable access model
- migrate executable checks to `Authorization`
- if real conditional policy is needed, extend `Authorization` or `AccessControl`
- remove API-shape drift where call sites treat `Permission` like `Authorization`

Exit when:

- one canonical executable access model owns executable decisions

Backward compat:

- full during transition

### Phase 6 — AgenticDelegate Narrowing with Replacement

- add `ActionRequest`
- migrate supervised-action flows off `AgenticDelegate`
- narrow `AgenticDelegate` to delegation relation only
- standardize delegation scope as `scopeKind + scopePayload`

Exit when:

- `AgenticDelegate` is purely a relation
- delegation scope is no longer modeled via governance `Permission`

Backward compat:

- old paths remain until callers migrate

### Phase 7 — Process Dispatch Eligibility Separation

- add authorization eligibility checks to `ExecutionDispatch`
- start in shadow mode
- review denials
- switch to enforcement when shadow logs are clean

Exit when:

- enforcement is on
- no production breakage from rollout

Backward compat:

- shadow mode is non-blocking

### Phase 8 — Pilot Subject Threading

- audit every Pilot action
- add Subject context to Pilot actions
- add filtering for `snapshot`, `destinations`, and view-level `read`
- add `PilotMode`

Exit when:

- every Pilot action either inherits gating or has explicit Subject/plumbing/mode support

Backward compat:

- open-by-default transition if needed, then tighten

### Phase 9 — Live Session Policy Reconciliation

- add policy epoch to effective policy bundles
- add subscriptions
- add reconciliation strategies
- add boundary checks to `AgentLoop`

Exit when:

- governance change can revoke or degrade a running session with declared semantics

Backward compat:

- default strategy `continue`

### Phase 10 — Amendment Workflow

- add `Proposal`
- wire proposal review through `ProcessSpec`
- add merge-time conflict detection using Versioning Kit
- enforce dependency graph

Exit when:

- humans and agents can propose governed changes through one canonical flow

Backward compat:

- direct edits may continue during migration

### Phase 11 — Subject-Level Protections

- add `RateLimitPolicy`
- add `AnomalyPolicy`
- add monitoring views

Exit when:

- subject-level protections work for any acting principal

Backward compat:

- opt-in during rollout

### Phase 12 — `program.md` Authoring Flow

- define `ProgramSpec` content schema
- implement `ProgramCompiler`
- add reverse-projection / reconciliation support between live governance and authored program content

Exit when:

- a fresh clef-base instance can be set up entirely through `program.md`

Backward compat:

- manual editing remains available

---

## 14. Deliverables

Architectural deliverables:

- Subject unification layer
- canonical executable access model
- narrowed delegation model
- first-class attribution model
- corrected Pilot authorization model
- policy epoch reconciliation model
- governed amendment flow
- bootstrap `program.md` flow
- Bind exposure modeled as governance-authored metadata first, not prematurely split into a standalone concept

Code deliverables:

- concept updates
- sync updates
- handler updates
- seed updates
- clef-base admin surfaces
- tests covering attribution, Pilot filtering, dispatch eligibility, reconciliation, and authorization hardening

---

## 15. clef-base Integration Checklist

- Does the design treat `Subject` as a unification layer rather than a hard dependency? If no: move writes back to source identity concepts and keep `Subject` projection-only.
- Does every acting principal resolve to a Subject when cross-cutting handling is required? If no: add registration syncs and backfills.
- Do humans and agents pass through the same executable authorization path? If no: identify divergent paths and unify or shim them.
- Is governance `Role` renamed to `GovernanceOffice` and synced into executable grants? If no: rename and add sync before further policy work.
- Is governance `Permission` removed as a duplicate executable access model? If no: migrate remaining call sites and remove the parallel grant path.
- Is `Authorization` hardened before becoming the sole executable authority path? If no: remove implicit grants and align handler behavior with spec.
- Is `AgenticDelegate` narrowed to standing delegation only? If no: move supervised action behavior into `ActionRequest`.
- Does every action carry `Attribution`? If no: add runtime attribution capture and reject incomplete actions.
- Does Pilot reuse existing gated paths and only add Subject-threading where needed? If no: audit each Pilot action and patch the missing path.
- Does process dispatch distinguish routing from eligibility? If no: add authorization check in shadow mode first.
- Can governance changes affect live sessions through declared reconciliation strategy? If no: add policy epoch and subscription model.
- Can a concept that does not need cross-cutting identity ignore `Subject` entirely? If no: remove the accidental dependency.

---

## 16. Bootstrap Governance and `program.md`

### 16.1 Bootstrap Layer

A fresh clef-base instance starts with a small bootstrap governance layer:

- Admin Subject auto-created
- Admin may spawn subjects, delegate, and amend governance
- bootstrap rights cannot be amended through `program.md`
- changing bootstrap rights requires out-of-band instance configuration

### 16.2 Authoring Flow

```text
Fresh clef-base instance
    -> Admin Subject auto-created
    -> Admin spawns Setup Agent
    -> Admin + Setup Agent draft ProgramSpec
    -> ProgramCompiler emits proposal set
    -> review / merge workflow runs
    -> live governance updates
```

### 16.3 Bidirectional Projection

- edits to `program.md` compile into proposals through `ProgramCompiler`
- `ProgramCompiler` fits the current `ContentCompiler` model only on the forward path
- direct live-governance edits require a separate `ContentReconciler` path
- reverse projection must distinguish:
  - clean round-trip updates
  - lossy-but-representable updates with explicit divergence annotations
  - changes that require review instead of automatic source rewrite
- both authored edits and reconciled live changes route through the same amendment workflow

Recommended reconciler contract:

- `project(liveRef) -> authoredModel | divergence`
- `diff(authoredPage, projectedModel) -> patch | conflict`
- `reconcile(pageId, liveRef) -> ok | conflict | lossy | requires_review`

`ContentReconciler` should be a provider-backed concept, not a generic helper:

- it has one purpose: reconcile live structured state back into authored content
- provider dispatch varies by schema just like `ContentCompiler`
- only some schemas/providers support true round-trip

This keeps the forward and reverse contracts explicit:

- `ContentCompiler` = authored content -> compiled artifact
- `ContentReconciler` = live artifact/state -> authored-content patch or divergence report

### 16.4 Dependencies

This depends on:

- phased amendment workflow
- Versioning Kit
- `ProgramCompiler`
- reverse projection / reconciliation support

### 16.5 Framework Note: `ContentCompiler` Is Not Enough

This design exposed a broader framework issue: one-way `ContentCompiler` is insufficient for serious content-native administration.

Current `ContentCompiler` semantics are:

- authored content plus schema
- provider dispatch
- compiled output reference and status

That is useful, but it is compile-only. It does not provide:

- reverse projection from live state back into authored content
- reconciliation when live state is richer than authored structure
- round-trip guarantees

The recommended framework direction is:

- keep `ContentCompiler` as the forward compiler
- add `ContentReconciler` as the reverse-projection / reconciliation concept
- compose the two only for schemas that declare round-trip support

That prevents fake reversibility while still enabling `program.md`, persona pages, workflow pages, and other content-native admin surfaces to participate in controlled live-state projection.

---

## 17. Recommendation

The recommended direction is:

1. Treat `Subject` as unification layer, not universal source of truth.
2. Keep executable access in `Authorization`.
3. Use `AccessControl` as the final decision surface over grants plus governance constraints.
4. Rename governance `Role` to `GovernanceOffice`.
5. Collapse or absorb governance `Permission`.
6. Narrow `AgenticDelegate` and put delegation scope directly on it.
7. Promote `Attribution`.
8. Make `AgentSession` run as subject with effective policy snapshot.
9. Make Pilot inherit authorization through existing paths plus explicit Subject-threading for aggregate actions.
10. Build governance amendment and live reconciliation as first-class flows.
11. Add `ContentReconciler` for content-native admin surfaces instead of overloading `ContentCompiler`.

That is the cleanest path to making agents act like first-class users without violating Clef's independence rules.
