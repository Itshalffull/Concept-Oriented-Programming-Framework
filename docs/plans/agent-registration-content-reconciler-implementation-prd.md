# AgentRegistration and ContentReconciler Implementation PRD

**Version:** 0.1.0  
**Date:** 2026-04-17  
**Status:** Implementation planning

## 1. Purpose

Turn the settled architecture into two concrete implementation tracks:

- `AgentRegistration` as the durable identity concept for agent principals
- `ContentReconciler` as the provider-backed reverse-projection concept paired with `ContentCompiler`

This PRD is intentionally narrower than the umbrella architecture docs. It exists to make execution legible, bounded, and assignable without losing the larger architectural intent.

## 2. Relationship to Existing PRDs

This plan refines and executes decisions already made in:

- [agents-as-subjects-refactor-plan.md](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/docs/plans/agents-as-subjects-refactor-plan.md:1)
- [agent-llm-process-bind-pilot-layering.md](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/docs/architecture/agent-llm-process-bind-pilot-layering.md:1)

It breaks down two existing umbrella cards rather than replacing them:

- `MAG-952` owns the broader Subject unification direction
- `MAG-957` owns the broader governance/program/amendment direction

Execution is now split into:

- `MAG-958` for `AgentRegistration`
- `MAG-959` for `ContentReconciler`

## 3. Kanban Cards

| Card | Purpose | Parent | Blocked By | Blocks | Commit |
|---|---|---|---|---|---|
| **MAG-958** AgentRegistration Concept + Subject Sync Integration | Implement durable agent-principal identity, status lifecycle, persona binding, owner binding, Subject sync, and backfill/admin support | MAG-952 | — | MAG-954 | — |
| **MAG-959** ContentReconciler Concept + Program/Admin Reverse Projection | Implement provider-backed reverse projection and reconciliation for `program.md` and other content-native admin surfaces | MAG-957 | — | — | — |

## 4. Problem Statement

Two architecture decisions are now stable enough to implement, but the repo does not yet have the corresponding concepts:

1. Agents should not be identified by persona pages or runtime sessions. They need a real principal concept.
2. One-way `ContentCompiler` is not sufficient for content-native administrative systems that must absorb live-state changes back into authored content.

Without `AgentRegistration`:

- agent identity remains conflated with persona or runtime
- subject syncs have no clean agent-side source of truth
- ownership, lifecycle, and revocation semantics stay muddy

Without `ContentReconciler`:

- `program.md` is compile-only
- live governance changes cannot be projected back into authored content in a typed way
- divergence handling remains hand-wavy instead of contractual

## 5. Design Overview

### 5.1 `AgentRegistration`

`AgentRegistration` is an identity-suite concept.

It owns one purpose:

- register and manage agent principals as durable acting identities

It does not own:

- authored behavior (`persona`)
- runtime execution (`AgentSession`)
- governance or delegation policy

Canonical separation:

- `AgentRegistration` = principal
- persona page = authored behavior
- `AgentSession` = runtime

### 5.2 `ContentReconciler`

`ContentReconciler` is a provider-backed concept paired with `ContentCompiler`.

It owns one purpose:

- reconcile live structured state back into authored content through typed projection, diff, and divergence reporting

It does not own:

- forward compilation
- governance review logic
- live-state mutation itself

Canonical separation:

- `ContentCompiler` = authored content -> compiled artifact
- `ContentReconciler` = live artifact/state -> authored-content patch or divergence report

## 6. `AgentRegistration` Specification Direction

### 6.1 Recommended State

Suggested initial state shape:

```text
registrations: set A
displayName: A -> String
status: A -> "active" | "disabled" | "revoked"
personaRef: A -> option String
ownerSubject: A -> String
agentClass: A -> String
metadata: A -> String
```

Notes:

- `metadata` starts as opaque JSON/string to avoid premature field-splitting
- `agentClass` supports coarse classification without making persona the identity type
- `ownerSubject` gives clear administrative authority over the registration

### 6.2 Recommended Actions

Initial action set:

- `register(displayName, ownerSubject, agentClass, personaRef?, metadata?)`
- `setPersona(agent, personaRef)`
- `disable(agent)`
- `revoke(agent)`
- `get(agent)`
- `listByOwner(ownerSubject)`

Optional later actions:

- `updateMetadata`
- `rename`
- `transferOwnership`

### 6.3 Required Syncs

- `AgentRegistration/register -> Subject/register(kind: "agent")`
- `AgentRegistration/disable -> Subject/updateStatus`
- `AgentRegistration/revoke -> Subject/updateStatus`

### 6.4 Required Runtime Consumers

- `AgentSession` spawn path should resolve principal identity from `AgentRegistration`
- `Attribution` should reference the resulting subject, not the persona page
- admin views should browse agent principals independently of persona pages

## 7. `ContentReconciler` Specification Direction

### 7.1 Recommended Provider Contract

The concept should expose a provider-oriented contract around three operations:

- `project(liveRef) -> authoredModel | divergence`
- `diff(pageId, projectedModel) -> patch | conflict`
- `reconcile(pageId, liveRef) -> ok | conflict | lossy | requires_review`

These may be represented as three actions or as a slightly different action decomposition, but all three responsibilities must exist.

### 7.2 Recommended Outcomes

`ContentReconciler` should not pretend every reverse projection is clean.

The core outcomes are:

- `ok`
  Reverse projection is representable and yields a patch
- `conflict`
  The current authored page and projected live state cannot be merged safely
- `lossy`
  Projection is possible but drops or flattens information; explicit divergence annotation is required
- `requires_review`
  The system can explain the proposed change but should not rewrite authored content automatically

### 7.3 Provider Model

`ContentReconciler` should mirror `ContentCompiler` in one important way:

- dispatch by schema/provider through a registry

But its semantics differ:

- reverse support is optional per schema
- divergence is a first-class valid outcome
- not every compile provider must have a reconcile provider

### 7.4 Initial Targets

First target surfaces:

- `program.md` / `ProgramSpec`
- other content-native admin surfaces only if they already have live-state mutation paths worth reconciling

Not a required first target:

- every existing compilable schema in the repo

## 8. Deliverables

### 8.1 `MAG-958`

- `AgentRegistration` concept spec
- handler
- Subject syncs
- backfill/admin integration plan
- tests

### 8.2 `MAG-959`

- `ContentReconciler` concept spec
- provider contract and dispatch pattern
- initial `ProgramSpec` reconciliation design
- tests for clean, conflict, lossy, and review-required outcomes

## 9. Views, Widgets, Seeds, clef-base

### 9.1 Views

Potential immediate views:

- agent registrations list
- agent registration detail
- reconciliation preview for `program.md`

### 9.2 Widgets

Potential immediate widgets:

- agent principal summary card
- reconciliation diff panel
- divergence annotation panel

### 9.3 Seeds

Likely needed later, not necessarily in first implementation:

- admin view seeds for agent registrations
- `ProgramSpec`/`program.md` reverse-projection preview surfaces

## 10. clef-base Integration Checklist

- Can agents be listed and managed as principals without opening persona pages?
- Can a session spawn path resolve `subjectId` from `AgentRegistration` cleanly?
- Does Subject sync from `AgentRegistration` avoid making `Subject` a source-of-truth dependency?
- Can `program.md` show a proposed reconciliation diff instead of requiring a silent rewrite?
- Can reverse projection return divergence without being treated as a runtime failure?

## 11. Execution Notes

This PRD should not create another layer of ambiguity around the umbrella cards.

Execution rule:

- `MAG-952` remains the architecture/umbrella card for Subject unification
- `MAG-958` is the implementation slice for the agent principal concept under that umbrella
- `MAG-957` remains the architecture/umbrella card for program/governance flow
- `MAG-959` is the implementation slice for the reverse path under that umbrella

That keeps the board legible:

- umbrella cards explain the architecture
- child cards implement the concrete concepts

## 12. Recommendation

Implement `AgentRegistration` and `ContentReconciler` as real concepts next.

Do not:

- overload persona pages with identity semantics
- overload `AgentSession` with principal lifecycle
- overload `ContentCompiler` with reverse-projection semantics

Do:

- keep identity, authored behavior, runtime, forward compile, and reverse reconcile as separate concept boundaries
- connect them with syncs and provider dispatch rather than collapsing them into one giant concept
