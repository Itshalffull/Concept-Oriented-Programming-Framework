# Agent, LLM, Process, Pilot, and Bind Layering

**Version:** 0.2.0  
**Date:** 2026-04-17  
**Status:** Architecture synthesis

## Changelog

**v0.2.0 (2026-04-17)** — Substantive refactor based on critique pass:

- Reframed `Subject` as unification layer, not universal dependency
- Added explicit threat model and Subject-level protections
- Promoted `Attribution` to first-class concept separate from `AgenticDelegate`
- Corrected Pilot "for free" claim with explicit Subject-threading requirements
- Added policy epoch model with declared reconciliation strategies
- Added DAG-based concurrent amendment handling
- Added bootstrap governance layer and `program.md` authoring flow
- Resolved Constitution ownership under governance
- Added concern -> owning concept map
- Tightened ownership language throughout

---

## 1. Why This Split Exists

Clef does not model "the AI system" as one giant concept.

It splits the problem into independent layers:

- **Persona** defines long-lived authored identity and instructional shape.
- **Prompt** assembles concrete runtime model input.
- **LLM** talks to providers and normalizes responses.
- **Agent** owns session lifecycle, reasoning loops, tool use, and memory.
- **Process** owns explicit work structure, workflow state, approvals, and routing.
- **Surface** owns the running application UI.
- **Pilot** gives agents a semantic control plane over Surface.
- **Bind** projects concepts and derived surfaces into external interfaces.
- **Governance** is cross-cutting: it owns authority, delegation, constitutional constraints, policy mutation, and accountability consumed by the other layers.

The split matters because:

- personas are not execution engines
- prompts are not workflows
- LLM calls are not agents
- agents are not process graphs
- Pilot is not the UI itself
- Bind is not orchestration logic
- governance is not a duplicate of every other layer's "what"

Each layer owns one kind of problem and composes through syncs, derived concepts, shared invocation paths, and governed mutation flows.

---

## 2. Layer Map

```text
Persona page / content-native editor
        |
        v
PromptAssembly / prompt pipeline
        |
        v
LLMProvider / ModelRouter
        |
        +-----------------------------+
        |                             |
        v                             v
   LLMCall                       AgentLoop
                                     |
                                     v
                         ToolBinding / AgentMemory /
                         AgentRole / AgentTeam / Handoff
                                     |
                                     v
                     Process execution via ProcessSpec,
                     StepRun, ExecutionDispatch,
                     ProcessConversation
                                     |
                                     +----------------------+
                                     |                      |
                                     v                      v
                              Surface application        Pilot
                              (views, bindings,          (agent-facing
                               machines, shells)          control plane)
                                     |
                                     v
                                   Bind
                     (MCP, CLI, REST, GraphQL, skills)

Governance
    -> roles, offices, delegation, attribution, constitutions,
       proposal/amendment flow, rate limits, anomaly policy,
       exposure policy, reconciliation rules
    -> consumed by every layer above
```

---

## 3. What Each Layer Owns

### 3.1 Persona Layer

The persona layer is a content-native authoring and compilation layer, not the runtime actor.

It owns:

- persona pages and authored identity
- long-lived instructions
- structural prompt sections
- default behavioral framing

It answers:

- "What kind of agent should exist?"
- "What instructions define that identity?"

It does not own process routing, permissions, or live execution.

### 3.2 Prompt Layer

The prompt layer turns persona plus runtime context into concrete model input.

It owns:

- `PromptAssembly`
- token budgets
- section selection and truncation
- few-shot selection
- prompt assertions and optimization

It answers:

- "What exact messages should be sent now?"
- "What context fits in budget?"

### 3.3 LLM Layer

The LLM layer is the provider abstraction.

It owns:

- provider selection
- model routing
- request normalization
- retries and repair loops
- cost and token accounting

It answers:

- "Which provider/model handles this call?"
- "How do we normalize the result?"

### 3.4 Agent Layer

The agent layer owns autonomous reasoning and tool-mediated execution.

Core concepts include:

- `AgentSession`
- `AgentLoop`
- `ToolBinding`
- `AgentMemory`
- `AgentRole`
- `AgentTeam`
- `AgentHandoff`
- `Blackboard`
- `Consensus`
- `StateGraph`

Agent sessions resolve a Constitution reference at spawn time. Constitution itself is governance-owned, not agent-owned.

The agent layer owns:

- session lifecycle
- reasoning loops
- tool use
- memory recall and writes
- delegation and handoff
- strategy selection

It answers:

- "Which live runtime is active?"
- "What should it do next?"
- "Should it call a tool, revise, delegate, or stop?"

Normative runtime rule:

- `AgentLoop` spec includes policy epoch validation boundaries at:
  - between loop iterations
  - before tool invocation
  - before action commit
- these are not implementer choices

### 3.4.1 Personas vs Agent Work

This distinction stays explicit:

- persona = authored definition
- agent session = running instantiation
- agent work = actual reasoning and tool-use performed by the session

### 3.5 Process Layer

The process layer owns explicit work structure and execution state.

Core concepts include:

- `ProcessSpec`
- `ProcessRun`
- `StepRun`
- `FlowToken`
- `ProcessVariable`
- `ProcessEvent`
- `ExecutionDispatch`
- `ProcessConversation`

It owns:

- step graphs
- workflow state
- branching and joins
- approvals and escalations
- assignment
- audit trails
- execution mode routing

It answers:

- "What work exists?"
- "What step is active?"
- "Which mode executes this step?"

It does not own final eligibility truth; it consumes authorization decisions.

### 3.6 Surface Layer

Surface owns the running application UI:

- shells
- hosts
- navigation
- machines
- bindings
- views
- mounted interactive state

It answers:

- "What page is mounted?"
- "What controls exist?"
- "What machine or binding receives this event?"

### 3.7 Pilot Layer

Pilot is a derived agent interface over a running Surface application.

It composes:

- `Navigator`
- `DestinationCatalog`
- `Host`
- `Shell`
- `Machine`
- `PageMap`
- `Binding`
- `View`
- `ViewEntity`

Pilot owns the stable semantic action vocabulary:

- `navigate`
- `back`
- `forward`
- `interact`
- `fill`
- `submit`
- `dismiss`
- `where`
- `destinations`
- `snapshot`
- `read`
- `viewInfo`
- `views`
- `overlays`

Pilot should inherit authorization from underlying gated systems wherever possible.

Normative requirement:

- `snapshot`, `destinations`, and view-level `read` MUST receive Subject context and apply per-element filtering using existing read gates
- other Pilot actions should resolve through already-gated underlying paths such as `Binding/invoke`, view metadata, `DestinationCatalog`, or machine handlers

Pilot-specific scope reduction belongs to governance-owned `PilotMode`, not to a parallel Pilot permission system.

### 3.8 Bind Layer

Bind is the projection layer.

It generates:

- REST
- GraphQL
- gRPC
- CLI
- MCP
- skills
- SDKs

It owns:

- projection
- interface generation
- target-specific emission

It does not own eligibility. External exposure is best modeled today as governance-authored metadata consumed by `Annotation` and `Projection`, with runtime enforcement through `Connection`, kernel auth, and target middleware.

### 3.9 Governance Layer

Governance is a cross-cutting layer that owns authority, accountability, constitutional constraint, policy mutation, and review.

It owns the answer to:

- who may do something
- on whose behalf
- under what conditions
- how actions are attributed
- how policy changes are proposed, reviewed, merged, and propagated
- how live sessions react to policy change

Representative governance concepts and concerns:

- `GovernanceOffice`
- `AgenticDelegate`
- `Attribution`
- `Constitution`
- `Proposal`
- `PilotMode`
- `RateLimitPolicy`
- `AnomalyPolicy`
- `EscalationPolicy`
- governance-authored exposure metadata consumed by Bind
- accountability policy
- non-repudiation policy

Threat model:

- any subject may operate at machine speed
- agents are specifically vulnerable to prompt injection and delegation chains
- the relevant protection axis is speed and behavior, not human-vs-agent identity

So governance also owns Subject-targeting protections:

- rate limiting
- anomaly detection
- automatic scope reduction
- accountable-principal requirements
- non-repudiation for irreversible actions

### 3.10 Concern -> Owning Concept Map

| Concern | Owning Concept |
|---|---|
| Role assignment | `Authorization` for executable roles, `GovernanceOffice` for organizational office |
| Permission grants | `Authorization` |
| Conditional grants | `Authorization` when extended |
| Delegation relationships | `AgenticDelegate` |
| Action attribution chain | `Attribution` |
| Delegation-scoped supervised actions | `ActionRequest` |
| Approval workflow | `ProcessSpec` + `Proposal` |
| Constitutional constraints | `Constitution` |
| Escalation policy | `EscalationPolicy` |
| Process step eligibility | `Authorization`, consumed by `ExecutionDispatch` |
| Pilot scope reduction | `PilotMode` |
| Bind exposure | governance-authored exposure metadata in `Annotation` / `Projection`, enforced through `Connection` and target middleware |
| Rate limits | `RateLimitPolicy` |
| Anomaly detection | `AnomalyPolicy` |
| Amendment workflow | `Proposal` plus process-driven review/merge flow |
| Live session reconciliation | policy bundle epoch plus reconciliation strategy declared on governance entities |

---

## 4. The Critical Interaction Boundaries

### 4.1 Persona -> Prompt

Persona pages compile into `PromptAssembly`.

### 4.2 Prompt -> LLM

`PromptAssembly` feeds `LLMProvider` or `LLMCall`.

### 4.3 LLM -> Agent

LLM is a single call boundary. Agent is the repeated reasoning boundary.

### 4.4 Agent -> Process

Process may dispatch a step to an agent loop. Process still owns official workflow completion.

### 4.5 Process -> Conversation

`ProcessConversation` binds workflow state to conversation state.

### 4.6 Process / Agent -> Surface

Processes and agents may either invoke domain concepts directly or operate the UI through Pilot.

### 4.7 Surface -> Pilot

Surface owns the UI. Pilot owns the semantic projection of that UI for agents.

### 4.8 Pilot -> Bind

Pilot is a derived concept, so Bind can expose it like any other surfaced interface.

### 4.9 Governance -> All Layers

Governance is not a sibling execution layer. It is the cross-cutting layer that constrains all others.

Examples:

- Governance -> Persona: `Constitution`, office bindings, and role constraints determine which personas may run in which scopes.
- Governance -> Prompt: constitutional or redaction clauses may inject required sections.
- Governance -> Agent: `AgenticDelegate`, `Attribution`, rate limits, anomaly policy, and constitutions constrain session behavior.
- Governance -> Process: `Authorization`, `GovernanceOffice`, `ActionRequest`, and `EscalationPolicy` determine step eligibility and review requirements.
- Governance -> Surface/Pilot: `PilotMode` and underlying subject-gated read/invoke paths determine visible and callable UI affordances.
- Governance -> Bind: governance-authored exposure metadata determines which projected interfaces are generated for which audiences, while runtime callability still resolves through `Connection`, kernel auth, and target middleware.

### 4.10 Authored Content -> Runtime Artifact -> Governed Execution

The unifying mental model is:

- authored content defines structured intent
- compilation turns content into runtime artifacts
- governance determines allowed use
- runtime systems execute
- traces correlate source, policy, and outcome

Examples:

- persona page -> `PromptAssembly`
- process page -> `ProcessSpec`
- `program.md` -> governance proposals

---

## 5. End-to-End Flows

### 5.1 Persona-Driven Agent Session

```text
agent-persona ContentNode
    -> persona compiler
    -> PromptAssembly
    -> AgentSession spawn
    -> AgentLoop run
```

### 5.2 Process Step Routed to Chat

```text
ProcessSpec step
    -> ExecutionDispatch/resolve
    -> chat
    -> Conversation
    -> ProcessConversation
```

### 5.3 Process Step Routed to Agent

```text
ProcessSpec step
    -> ExecutionDispatch/resolve
    -> agent_loop
    -> AgentLoop/run
    -> step output
    -> StepRun/complete
```

### 5.4 Agent Operating a Running App Through Pilot

```text
Pilot/navigate(destination)
    -> DestinationCatalog / Navigator

Pilot/interact(label, event)
    -> PageMap/find
    -> Machine/send

Pilot/fill(label, field, value)
    -> PageMap/find
    -> Binding/writeField

Pilot/submit(label)
    -> PageMap/find
    -> Binding/invoke
```

### 5.5 Bind Publishing the Same System Externally

```text
Concepts / derived concepts
    -> Bind projection
    -> target generation
    -> MCP / CLI / REST / GraphQL / skills
```

### 5.6 Agent-Initiated Governance Amendment

```text
running AgentSession
    -> emits Proposal
    -> Proposal enters governed process
    -> review / escalation / approval
    -> approved change becomes merge-eligible
    -> merge mutates canonical governance or access state
    -> affected sessions receive policy-change notification
    -> future sessions resolve against new policy
```

Every proposal carries its `Attribution`. Merged amendments record the attribution chain that authored them.

### 5.7 Concurrent Amendment Handling

Amendments build on the Versioning Kit DAG model.

Rules:

- each proposal opens a branch from current main
- branch metadata includes proposer subject, attribution chain, premise, intended effect, and optional dependencies
- approval is merge intent, not merge
- merge-time conflict detection handles:
  - structural conflicts
  - semantic conflicts detected by conformance/invariant checks against prospective merged state
- resolution is governed:
  - rebase
  - supersede
  - reconcile into new merged proposal
- dependencies are explicit edges
- cyclic dependency is rejected at proposal submission time with explicit error to the proposer
- premise invalidation triggers notification, not auto-rejection
- policy epochs increment only on merge to main

---

## 6. The Main Architectural Rule

When deciding where something belongs:

- authored identity and long-lived instructions -> Persona
- assembled messages and context -> Prompt
- provider call -> LLM
- multi-step reasoning, tool use, memory, delegation -> Agent
- workflow state, approvals, routing -> Process
- interactive app state -> Surface
- semantic agent control over UI -> Pilot
- external projection -> Bind
- authority, accountability, review, constitutional constraints, amendment -> Governance

---

## 7. Practical Mental Model

- Persona says who the agent is.
- Prompt says what gets sent now.
- LLM says which provider handles the call.
- AgentSession says which live runtime is active.
- Agent work says what that runtime does next.
- Process says what work exists and which step is active.
- Surface says what the app exposes.
- Pilot says how a subject can operate that app semantically.
- Bind says how the system becomes external tools and APIs.
- Governance says who may do what, on whose behalf, under what constraints, and how those constraints evolve.

---

## 8. What Is Still Missing for Seamless clef-base Integration

The missing pieces are mostly app-level coordination patterns, not raw concept invention.

### 8.1 Canonical Agent Work Runtime

clef-base still needs one reusable app-layer pattern binding:

- persona
- session
- process step
- conversation
- Pilot context
- attribution
- resolved authority
- interruption and resume behavior

### 8.2 Canonical ProcessStep -> AgentSession Bridge

clef-base still needs one default bridge for:

- selecting persona or agent role
- resolving subject and delegation
- spawning or reusing `AgentSession`
- writing outputs back into process state

### 8.3 Persona Routing Policy

The app still needs one standard rule for when persona selection comes from:

- explicit persona reference
- `AgentRole`
- process metadata
- workload-based routing

### 8.4 Unified Action Policy

Direct concept invocation and Pilot-driven UI invocation should share the same policy path:

- same subject identity
- same authorization checks
- same attribution requirements
- same escalation rules

Pilot mostly inherits those checks from underlying systems. The extra work is Subject threading for aggregate actions like `snapshot`, `destinations`, and view-level `read`.

### 8.5 Direct Domain Actions vs Pilot-Driven Actions

clef-base still needs a default preference order:

- prefer direct domain actions when available
- use Pilot when the task is properly a UI operation or when no domain API exists
- allow mixed flows only with shared audit and authorization

### 8.6 Unified Operational Surfaces

The app still benefits from one standard surface for:

- active sessions
- queued work
- blocked sessions
- waiting-for-human runs
- failures and retries
- costs and traces

### 8.7 End-to-End Correlated Observability

Operators should be able to move cleanly across:

- persona page
- compiled artifact
- subject
- session
- process run
- conversation
- Pilot actions
- resulting mutation

### 8.8 Stable Resume Contract

Resume semantics should explicitly define which state is durable:

- prompt snapshot
- memory
- conversation history
- process variables
- Pilot/UI snapshot
- effective policy snapshot

### 8.9 VersionSpace Integration

Branching agent work still needs a standard integration story across:

- persona revisions
- process state
- sessions
- user-visible rewinds
- amendment branches

### 8.10 Golden Path

The architecture needs one default clef-base product flow:

1. author persona
2. compile prompt artifact
3. bind role, office, or workflow step
4. resolve subject and delegation
5. spawn session
6. prefer direct concept actions, use Pilot as semantic UI fallback
7. write results back to process and domain state
8. surface trace and review state in one operations view

### 8.11 Summary of the Missing Piece

The main missing piece is:

**a canonical app-layer agent work runtime for clef-base that binds persona, session, process step, conversation, attribution, effective policy, observability, and Pilot context into one reusable pattern.**

---

## 9. What Must Be Built for Agents to Be First-Class Users

Agents become first-class users only when the system treats them as fully governed subjects rather than merely as runtime loops.

### 9.1 Subject as Unification Layer, Not Universal Dependency

`Subject` should be an optional unification layer, analogous to `ContentPool`.

Rules:

- identity-producing concepts such as `User`, `AgentRegistration`, and `ServiceAccount` sync into `Subject`
- those concepts do not depend on `Subject`
- cross-cutting consumers such as unified authorization, rate limiting, anomaly detection, and audit correlation may query `Subject`
- identity-type-specific flows may continue to operate directly on `User` or another source concept when they do not need unification

### 9.2 First-Class Agent Identity

Agents need stable subject identities with:

- stable subject ID
- lifecycle state
- role membership
- permission grants
- workspace/group membership
- attributable provenance

### 9.3 Attribution and Accountability Chain

`Attribution` is a first-class concept distinct from `AgenticDelegate`.

Separation:

- `AgenticDelegate` = standing delegation relationship
- `Attribution` = full execution-time chain for one action

Recommended structure:

- ordered list of `(subject_id, delegation_ref, role_at_time)` entries

Invariant:

- any action without complete attribution is rejected

Policies may read the chain to enforce:

- no revoked link anywhere in chain
- most restrictive scope wins
- every audit entry includes full chain
- irreversible actions require non-repudiation on every link

### 9.4 Agent Sessions Resolve Identity and Governance at Spawn

At session spawn, the runtime should resolve:

- acting subject
- accountable principal if any
- delegation scope
- effective policy snapshot
- constitution reference
- process/workspace scope
- initial attribution root

Effective policy snapshot shape:

- derived artifact, not a primary authored concept
- keyed by the acting subject plus relevant execution scope
- includes:
  - executable grants from `Authorization`
  - office-derived grants from `GovernanceOffice` syncs
  - active delegation constraints from `AgenticDelegate`
  - constitution references
  - `PilotMode` restrictions
  - protection policies relevant to the session
  - policy epoch

This snapshot is a resolved coordination artifact for runtime reads. It is not the source of truth for any of those layers.

### 9.5 Authorization and AccessControl Have Different Jobs

The clean split is:

- `Authorization` owns grants, roles, assignments, and subject-facing permission queries
- `AccessControl` owns final request decisions over `(resource, action, context)`

Practical contract:

- `Authorization` answers "what executable grants does this subject hold?"
- `AccessControl` answers "may this request proceed under current grants, delegation, constitutional constraints, and scope?"

That means:

- `Authorization/checkPermission(subject, permission)` remains the simple grant query surface
- `AccessControl/check(resource, action, context)` is the final decision surface for runtime enforcement
- `ExecutionDispatch`, `Binding/invoke`, and other runtime gates should depend on `AccessControl` for final allow/deny
- `AccessControl` may consume `Authorization`, delegation constraints, office-derived grants, and governance restrictions, but it does not replace them as sources of truth

### 9.6 Delegation Scope Lives on AgenticDelegate, Not on Permission Grants

After deprecating governance `Permission`, delegation scope should be expressed directly on `AgenticDelegate`.

Recommended shape:

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

Enforcement contract:

- `Authorization` says whether the subject may do the action in principle
- `AgenticDelegate` says whether the delegate may do it on behalf of the delegator within scope
- `Attribution` records the execution chain
- `ActionRequest` owns cases that are permitted in principle but require supervision or approval at execution time

### 9.7 Process Dispatch Consumes Eligibility, It Does Not Own It

`ExecutionDispatch` chooses mode. It consumes eligibility facts from `Authorization`, office bindings, delegation, and constitutional constraints.

### 9.8 Pilot Authorization Is Mostly Inherited

Pilot should not invent a second permission system.

Precondition:

- underlying `DestinationCatalog`, view metadata, `Binding/invoke`, and machine handlers gate by Subject

Then:

- `navigate`, `fill`, `submit`, and most `interact` behavior inherit gating naturally
- `snapshot`, `destinations`, and view-level `read` require explicit Subject threading for filtering
- `PilotMode` handles governance-defined scope reductions such as read-only navigation mode

### 9.9 Policy Epochs and Live Session Reconciliation

Live session reconciliation uses a policy epoch model with declared reconciliation strategies per governance entity.

#### 9.7.1 Policy Epoch

Each effective governance bundle carries an epoch counter. When any constituent governance entity mutates on merge, the bundle epoch increments.

#### 9.7.2 Session Pinning

When an `AgentSession` spawns, it resolves `effectivePolicySnapshotRef = (bundle_id, epoch)`.

#### 9.7.3 Boundary Detection

Epoch validity is checked:

- between loop iterations
- before tool invocation
- before action commit
- not mid-LLM-call

#### 9.7.4 Subscription, Not Polling

Sessions subscribe to `PolicyChanged` events for the bundle they are pinned to.

#### 9.7.5 Declared Reconciliation Strategy

Each governance entity declares one of:

- `continue`
- `pause`
- `degrade`
- `require_reapproval`
- `terminate`

Migration default: existing entities default to `continue`.

#### 9.7.6 In-Flight Action Resolution

- tool call dispatched but not returned: complete call, discard result
- mutation pending commit: discard
- mutation already committed: keep, log "executed under epoch N"
- LLM call in flight: complete the call
  - if reconciliation is `terminate`, generated tokens are tagged with epoch-of-generation and not applied to session state
  - if reconciliation is `degrade` or `continue`, tokens apply normally and next boundary enforces new policy

Principle:

- do not roll back what was authorized when committed
- do not apply anything no longer authorized before commit

#### 9.7.7 Epoch Validation on Read

Every read through `effectivePolicySnapshotRef` validates pinned epoch against current bundle epoch. No stale read path should bypass detection.

### 9.10 Canonical Proposal-and-Amendment Path

Agents and humans should participate in governance through the same typed proposal flow:

1. emit `Proposal`
2. route into governed process
3. review and merge eligibility
4. merge canonical state
5. increment epoch and notify sessions

### 9.11 Audit and Correlation

Correlation keys:

- Subject ID
- Session ID
- Process Run ID
- Attribution chain root

Every audit entry carries all four. Queries may pivot on any of them.

### 9.12 Summary

Agents are first-class users only when identity, attribution, authorization, process dispatch, Pilot, Bind, and audit all resolve them as governed subjects.

---

## 10. A More Clef-Native Model

### 10.1 Core Principle

Do not build a special-purpose agent authority stack.

Instead:

- keep concepts independent
- make humans, agents, and services participate in common subject-facing access paths
- use syncs and projections to unify where needed

### 10.2 Subject as Unification Layer

`Subject` should be treated as a unification layer, not a hard dependency.

The preferred shape is:

- `User` -> sync -> `Subject(kind=human)`
- `AgentRegistration` -> sync -> `Subject(kind=agent)`
- `ServiceAccount` -> sync -> `Subject(kind=service)`

Consumers that need cross-cutting identity treatment query `Subject`. Concepts that do not need unification may ignore it entirely.

`AgentRegistration` should be the source-of-truth identity concept for agent principals:

- it belongs with identity, not persona content, governance, or runtime
- it owns durable agent-principal lifecycle
- it binds an agent principal to an optional persona reference

Clean separation:

- `AgentRegistration` = principal
- persona page = authored behavior
- `AgentSession` = runtime execution instance

### 10.3 What Agents Then Become

Under the Clef-native model:

- persona = authored content
- prompt = compiled artifact
- subject = acting principal
- agent session = runtime execution instance running as that subject

### 10.4 Pilot Gets Most Authorization "For Free"

The corrected claim is:

- Pilot inherits authorization through the same gates that already protect direct UI use, provided those underlying systems gate by Subject

Plumbing still required:

- Subject threading for `snapshot`
- Subject filtering for `destinations`
- per-element Subject filtering for view-level `read`

### 10.5 Process Owns Workflow, Not Authority Truth

Process should assign work to subjects, executable roles, or pools. Eligibility comes from authorization and governance constraints, not from dispatch internals.

### 10.6 Governance Owns Higher-Order Policy

Governance should own:

- constitutions
- offices
- delegation
- attribution requirements
- escalation
- amendment
- exposure intent and audience metadata
- protection policies

It should not duplicate generic executable RBAC.

### 10.7 Duplication Problem in the Current Repo

The repo currently duplicates executable authority across:

- `Authorization`
- governance `Role`
- governance `Permission`

The cleffy resolution is:

- keep executable access in `Authorization`
- use `AccessControl` as the final decision surface over grants plus governance constraints
- rename governance `Role` to `GovernanceOffice`
- narrow `AgenticDelegate`
- treat governance `Permission` as duplication to be deprecated and migrated into executable access

Audit conclusion:

- governance `Permission` is currently a shallow `who:where:what` grant store, not a distinct mature ABAC engine
- its optional `condition` field is not meaningfully enforced today
- live call sites already mix `Permission` and `Authorization` API shapes, which is a sign of architectural drift

So the preferred direction is:

- deprecate governance `Permission` as a general-purpose executable access model
- migrate executable checks into `Authorization`
- reserve governance concepts for office, delegation, attribution, constitution, escalation, and amendment
- extend `Authorization` or `AccessControl` later if true conditional policy is needed

### 10.8 Recommended Refactor Direction

1. Keep `Authorization` as canonical executable access layer.
2. Use `AccessControl` as the final decision surface over grants plus governance constraints.
3. Rename governance `Role` to `GovernanceOffice`.
4. Deprecate governance `Permission` as duplicate executable access.
5. Narrow `AgenticDelegate` to standing delegation only and put delegation scope directly on it.
6. Promote `Attribution` to first-class concept.
7. Make `AgentSession` run as subject with effective policy snapshot.
8. Harden `Authorization` before making it the sole authority path.
9. Keep persona authority-free.

Authorization hardening is part of the same refactor:

- remove implicit grants when a principal has no assigned role
- align handler behavior with concept variants
- keep the migration from user-targeting APIs to Subject-targeting APIs explicit

### 10.9 The Cleffy End-to-End Model

1. A human, agent, or service emits identity facts.
2. Syncs project them into `Subject`.
3. Access checks target `Subject` where unified treatment is needed.
4. Governance offices sync into executable grants where appropriate.
5. Persona compiles to prompt artifact.
6. `AgentSession` runs as subject with attribution and effective policy snapshot.
7. Direct concept actions and Pilot actions go through the same authorization model.
8. Process routes work but consumes eligibility facts.
9. Bind exposes governed surfaces externally using governance-authored exposure metadata plus runtime auth.
10. Content-native admin surfaces use a separate reverse-projection / reconciliation layer when live state must flow back into authored content.
11. Trace and audit correlate subject, session, process, and attribution.

Current recommendation for Bind exposure:

- keep exposure settings as governance-authored metadata in `Annotation` / `Projection`
- enforce runtime callability through `Connection`, kernel auth, and target middleware
- promote exposure policy to a standalone concept only if it later gains an independent lifecycle such as approval, publication state, revocation history, or audience-specific exception management

### 10.10 Bootstrap Governance and `program.md`

A fresh clef-base instance needs a small bootstrap governance layer that exists before any authored program.

Bootstrap rules:

- an Admin Subject is auto-created
- Admin has bootstrap rights to spawn subjects, delegate, and amend governance
- bootstrap rights cannot be amended through `program.md`
- changing bootstrap rights requires out-of-band instance configuration

Authoring flow:

```text
Fresh clef-base instance
    -> Admin Subject auto-created
    -> Admin spawns Setup Agent
    -> Admin + Setup Agent draft ProgramSpec
    -> ProgramCompiler emits governance proposals
    -> approval / merge workflow runs
    -> org governance becomes active
```

Forward compile:

- edits to `program.md` compile into proposals
- `ProgramCompiler` is a `ContentCompiler` provider for the `ProgramSpec` schema
- `ContentCompiler` owns authored-content -> compiled-artifact only

Reverse projection and reconciliation:

- direct edits to live governance do not round-trip through `ContentCompiler` automatically
- reverse projection back into `program.md` requires a separate `ContentReconciler` concept
- the reconciler must decide whether a live change is:
  - round-trippable into authored structure
  - representable only with explicit divergence annotations
  - or not safe to project without review
- both authored edits and reconciled live changes still route through the same amendment workflow

This is an important framework boundary: one-way `ContentCompiler` is not enough for serious content-native administration. But the clean fix is not to overload `ContentCompiler` with bidirectional semantics. The cleaner model is:

- `ContentCompiler` for forward compile
- `ContentReconciler` for live-state -> authored-content updates
- composition of the two for schemas that support true round-trip behavior

Recommended reconciler contract:

- `project(liveRef) -> authoredModel | divergence`
- `diff(authoredPage, projectedModel) -> patch | conflict`
- `reconcile(pageId, liveRef) -> ok | conflict | lossy | requires_review`

`ContentReconciler` should be provider-backed:

- same schema/provider dispatch pattern as `ContentCompiler`
- only schemas with declared reverse support participate
- divergence is a first-class outcome, not an implementation failure

`program.md` is a `ContentNode` composed from:

- persona definitions
- process definitions
- governance offices
- delegations
- constitutions
- protection policies
- reconciliation strategy declarations

The same limitation applies beyond `program.md`. Persona pages, workflow pages, and other content-native admin surfaces may need live-state projection back into authored content. That should be modeled as an explicit round-trip composition, not assumed to be a property of every `ContentCompiler` provider.

### 10.11 Short Version

If this is done right, agents do not get a parallel permission system.

They are:

- subjects in the identity/access model
- sessions in the agent runtime model
- delegates in governance when applicable
- workers in the process model
- UI operators through Pilot when needed
