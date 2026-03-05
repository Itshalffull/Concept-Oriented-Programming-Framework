# Concept Library Reference

> Auto-generated from `repertoire/` by ConceptLibraryTarget

## Table of Contents

- [automation](#automation) — 4 concepts, 1 derived, 4 syncs
- [automation-providers](#automation-providers) — 4 concepts, 0 derived, 8 syncs
- [classification](#classification) — 4 concepts, 1 derived, 3 syncs
- [collaboration](#collaboration) — 13 concepts, 2 derived, 17 syncs
- [computation](#computation) — 3 concepts, 0 derived, 2 syncs
- [content](#content) — 6 concepts, 3 derived, 5 syncs
- [data-integration](#data-integration) — 10 concepts, 1 derived, 23 syncs
- [data-organization](#data-organization) — 2 concepts, 0 derived, 4 syncs
- [entity-reflection](#entity-reflection) — 0 concepts, 0 derived, 468 syncs
- [extension](#extension) — 17 concepts, 1 derived, 26 syncs
- [formal-verification](#formal-verification) — 6 concepts, 1 derived, 10 syncs
- [formal-verification-solvers](#formal-verification-solvers) — 0 concepts, 0 derived, 0 syncs
- [foundation](#foundation) — 8 concepts, 0 derived, 9 syncs
- [governance-decision](#governance-decision) — 18 concepts, 0 derived, 0 syncs
- [governance-execution](#governance-execution) — 9 concepts, 0 derived, 0 syncs
- [governance-identity](#governance-identity) — 10 concepts, 0 derived, 0 syncs
- [governance-resources](#governance-resources) — 10 concepts, 0 derived, 0 syncs
- [governance-rules](#governance-rules) — 8 concepts, 0 derived, 0 syncs
- [governance-structure](#governance-structure) — 10 concepts, 0 derived, 0 syncs
- [governance-transparency](#governance-transparency) — 2 concepts, 0 derived, 0 syncs
- [identity](#identity) — 4 concepts, 2 derived, 4 syncs
- [infrastructure](#infrastructure) — 6 concepts, 1 derived, 5 syncs
- [linking](#linking) — 4 concepts, 0 derived, 6 syncs
- [llm-agent](#llm-agent) — 16 concepts, 1 derived, 10 syncs
- [llm-conversation](#llm-conversation) — 1 concepts, 1 derived, 2 syncs
- [llm-core](#llm-core) — 2 concepts, 0 derived, 4 syncs
- [llm-prompt](#llm-prompt) — 5 concepts, 1 derived, 5 syncs
- [llm-rag](#llm-rag) — 3 concepts, 1 derived, 7 syncs
- [llm-safety](#llm-safety) — 3 concepts, 0 derived, 4 syncs
- [llm-training](#llm-training) — 3 concepts, 0 derived, 3 syncs
- [media](#media) — 2 concepts, 1 derived, 2 syncs
- [new-app](#new-app) — 4 concepts, 1 derived, 10 syncs
- [notification](#notification) — 1 concepts, 0 derived, 1 syncs
- [package](#package) — 13 concepts, 0 derived, 9 syncs
- [parse](#parse) — 0 concepts, 0 derived, 0 syncs
- [presentation](#presentation) — 4 concepts, 0 derived, 6 syncs
- [process-automation](#process-automation) — 3 concepts, 0 derived, 10 syncs
- [process-foundation](#process-foundation) — 6 concepts, 0 derived, 12 syncs
- [process-human](#process-human) — 3 concepts, 0 derived, 5 syncs
- [process-llm](#process-llm) — 3 concepts, 0 derived, 8 syncs
- [process-observability](#process-observability) — 2 concepts, 0 derived, 0 syncs
- [process-reliability](#process-reliability) — 3 concepts, 0 derived, 6 syncs
- [query-retrieval](#query-retrieval) — 3 concepts, 0 derived, 2 syncs
- [versioning](#versioning) — 19 concepts, 1 derived, 18 syncs
- [wasm](#wasm) — 0 concepts, 0 derived, 0 syncs
- [web3](#web3) — 3 concepts, 0 derived, 4 syncs

---

## automation
_v0.1.0_

> "Automated workflows — rules, state transitions, queued actions, and UI controls for event-driven automation."

### Concepts

#### AutomationRule [R]

> Define user-configurable event-condition-action rules that fire automatically when conditions are met. Condition evaluation is delegated to the sync engine via AutomationConditionEval sync; EventBus dispatches trigger AutomationRule.execute.

**State**:
- `rules`
- `trigger`
- `conditions`
- `actions`
- `enabled`

**Actions**:
- `define(rule, trigger, conditions, actions)` &rarr; ok
- `enable(rule)` &rarr; ok | notfound
- `disable(rule)` &rarr; ok | notfound
- `execute(rule, context)` &rarr; ok

##### ScheduledJob [T] _(derived)_

> Combine automation rules with job queuing and execution control to schedule, dispatch, and manage recurring or triggered jobs.

**Composes**: AutomationRule, Queue, Control
**Required syncs**: rule-queue-dispatch, queue-control-execution, job-lifecycle

**Surface**:
- `schedule` &rarr; AutomationRule/define
- `enqueue` &rarr; Queue/enqueue
- `execute` &rarr; AutomationRule/execute

#### Control [K]

> Bind interactive elements (buttons, sliders, toggles) to data values and actions, enabling direct manipulation in content.

**State**:
- `controls`
- `type`
- `value`
- `binding`
- `action`

**Actions**:
- `create(control, type, binding)` &rarr; ok | exists
- `interact(control, input)` &rarr; ok | notfound
- `getValue(control)` &rarr; ok | notfound
- `setValue(control, value)` &rarr; ok | notfound
- `triggerAction(control)` &rarr; ok

#### Queue [Q]

> Defer task processing via a managed queue with claim-process-release lifecycle and pluggable backends.

**State**:
- `queues`
- `items`
- `workers`
- `backend`

**Actions**:
- `enqueue(queue, item, priority)` &rarr; ok | notfound
- `claim(queue, worker)` &rarr; ok | empty
- `process(queue, itemId, result)` &rarr; ok | notfound
- `release(queue, itemId)` &rarr; ok | notfound
- `delete(queue, itemId)` &rarr; ok | notfound

#### Workflow [W]

> Model finite state machines with named states and guarded transitions for content lifecycle management.

**State**:
- `workflows`
- `states`
- `transitions`
- `currentState`
- `guards`

**Actions**:
- `defineState(workflow, name, flags)` &rarr; ok | exists
- `defineTransition(workflow, from, to, label, guard)` &rarr; ok | error
- `transition(workflow, entity, transition)` &rarr; ok | notfound | forbidden
- `getCurrentState(workflow, entity)` &rarr; ok | notfound

### Syncs

- **AutomationConditionEval** _(eager)_
  - When: EventBus/dispatch
  - Then: AutomationRule/execute
- **RuleTriggersWorkflow** _(eager)_
  - When: AutomationRule/execute
  - Then: Workflow/transition
- **QueueDeferredActions** _(eager)_
  - When: AutomationRule/evaluate
  - Then: Queue/enqueue
- **ControlTriggersAction** _(eager)_
  - When: Control/triggerAction
  - Then: AutomationRule/evaluate

---

## automation-providers
_v0.1.0_

> Pluggable automation backends for Clef concept actions. Provides a dispatch coordination layer, allowlist/denylist scope gating, a build-time manifest provider with schema validation, and a runtime user-defined sync provider. concepts: AutomationDispatch: spec: ./AutomationDispatch.concept params: AD: { as: dispatch-ref, description: "Reference to an automation dispatch record" } AutomationScope: spec: ./AutomationScope.concept params: AS: { as: scope-ref, description: "Reference to an automation scope gate" } ManifestAutomationProvider: spec: ./providers/ManifestAutomationProvider.concept params: MA: { as: manifest-entry-ref, description: "Reference to a manifest action entry" } optional: true SyncAutomationProvider: spec: ./providers/SyncAutomationProvider.concept params: SA: { as: user-sync-ref, description: "Reference to a user-defined sync" } optional: true syncs: required: - path: ./syncs/automation-dispatch-routing.sync description: "AutomationRule/execute -> AutomationDispatch/dispatch" - path: ./syncs/manifest-provider-registration.sync description: "ManifestAutomationProvider/register -> PluginRegistry/register" - path: ./syncs/sync-provider-registration.sync description: "SyncAutomationProvider/register -> PluginRegistry/register" recommended: - path: ./syncs/dispatch-to-manifest.sync name: DispatchToManifest description: "AutomationDispatch/dispatch provider:manifest -> ManifestAutomationProvider/execute" - path: ./syncs/dispatch-to-sync.sync name: DispatchToSync description: "AutomationDispatch/dispatch provider:sync -> SyncAutomationProvider/execute" - path: ./syncs/sync-validates-against-scope.sync name: SyncValidatesAgainstScope description: "SyncAutomationProvider/validate -> AutomationScope/check" - path: ./syncs/sync-activation-registers-engine.sync name: SyncActivationRegistersEngine description: "SyncAutomationProvider/activate -> SyncEngine/registerSync" - path: ./syncs/manifest-load-on-build.sync name: ManifestLoadOnBuild description: "AutomationTarget/generate -> ManifestAutomationProvider/load" uses: - suite: automation concepts: - name: AutomationRule - suite: infrastructure concepts: - name: PluginRegistry - suite: collaboration optional: true concepts: - name: SyncEngine

### Concepts

#### AutomationDispatch [AD]

> Coordination concept routing automation execution requests to registered provider backends. Reads the provider name from the AutomationRule's actions field and delegates to the matching provider via PluginRegistry lookup. Follows the same coordination pattern as SolverProvider in formal-verification.

**State**:
- `dispatches`
- `rule_ref`
- `provider_name`
- `status`
- `result`

**Actions**:
- `dispatch(rule_ref, provider_name, context)` &rarr; ok | no_provider | provider_error
- `list_providers()` &rarr; ok

#### AutomationScope [AS]

> Allowlist/denylist gate controlling which concept actions the SyncAutomationProvider may invoke at runtime. Each scope holds pattern rules (glob-style action references) grouped by category. Mode determines whether matched patterns are permitted or denied.

**State**:
- `scopes`
- `mode`
- `rules`
- `active`

**Actions**:
- `configure(scope, mode)` &rarr; ok | invalid_mode
- `add_rule(scope, action_pattern, category)` &rarr; ok | not_configured
- `remove_rule(scope, action_pattern)` &rarr; ok | notfound
- `check(scope, action_ref)` &rarr; permitted
- `list_rules(scope)` &rarr; ok

#### ManifestAutomationProvider [MA]

> Build-time automation provider backed by a generated action manifest. The manifest enumerates every concept action with input/output JSON schemas, enabling validated dispatch without runtime discovery. Loaded from automation-manifest.json produced by AutomationTarget.

**State**:
- `entries`
- `concept_action`
- `input_schema`
- `output_schema`
- `category`
- `manifest_version`

**Actions**:
- `register()` &rarr; ok
- `load(manifest_path)` &rarr; ok | parse_error
- `execute(action_ref, input)` &rarr; ok | validation_error | not_in_manifest
- `lookup(action_ref)` &rarr; ok

#### SyncAutomationProvider [SA]

> Runtime-dynamic automation provider allowing users to define custom syncs that invoke concept actions. User-authored syncs go through a validation and scope-check lifecycle before activation. Validated syncs are registered with SyncEngine for execution.

**State**:
- `user_syncs`
- `name`
- `source_text`
- `compiled`
- `status`
- `author`

**Actions**:
- `register()` &rarr; ok
- `define(name, source_text, author)` &rarr; ok | parse_error | exists
- `validate(sync_def)` &rarr; ok | scope_denied | compile_error
- `activate(sync_def)` &rarr; ok | not_validated
- `suspend(sync_def)` &rarr; ok
- `execute(action_ref, input)` &rarr; ok | notfound

### Syncs

- **AutomationDispatchRouting** _(eager)_
  - When: AutomationRule/execute
  - Then: AutomationDispatch/dispatch
- **DispatchToManifest** _(eager)_
  - When: AutomationDispatch/dispatch
  - Then: ManifestAutomationProvider/execute
- **DispatchToSync** _(eager)_
  - When: AutomationDispatch/dispatch
  - Then: SyncAutomationProvider/execute
- **ManifestLoadOnBuild** _(eager)_
  - When: AutomationTarget/generate
  - Then: ManifestAutomationProvider/load
- **RegisterManifestProvider** _(eager)_
  - When: ManifestAutomationProvider/register
  - Then: PluginRegistry/register
- **SyncActivationRegistersEngine** _(eager)_
  - When: SyncAutomationProvider/activate
  - Then: SyncEngine/registerSync
- **RegisterSyncProvider** _(eager)_
  - When: SyncAutomationProvider/register
  - Then: PluginRegistry/register
- **SyncValidatesAgainstScope** _(eager)_
  - When: SyncAutomationProvider/validate
  - Then: AutomationScope/check

### Dependencies

- **automation**
- **infrastructure**
- **collaboration**

---

## classification
_v0.1.0_

> "Organization and classification — tags, taxonomies, schemas, and namespaces for content structure."

### Concepts

#### Namespace [N]

> Organize entities into hierarchical overlays via path separators, enabling scoped naming and navigation.

**State**:
- `nodes`
- `separator`
- `parent`
- `path`

**Actions**:
- `createNamespacedPage(node, path)` &rarr; ok | exists
- `getChildren(node)` &rarr; ok | notfound
- `getHierarchy(node)` &rarr; ok | notfound
- `move(node, newPath)` &rarr; ok | notfound

#### Schema [S]

> Define named field sets that can be applied as type mixins to content entities, serving as a coordination hub for runtime concept definitions.

**State**:
- `schemas`
- `fields`
- `extends`
- `associations`

**Actions**:
- `defineSchema(schema, fields)` &rarr; ok | exists
- `addField(schema, field)` &rarr; ok | notfound
- `extendSchema(schema, parent)` &rarr; ok | notfound
- `applyTo(entity, schema)` &rarr; ok | notfound
- `removeFrom(entity, schema)` &rarr; ok | notfound
- `getAssociations(schema)` &rarr; ok | notfound
- `export(schema)` &rarr; ok | notfound

#### Tag [T]

> Apply lightweight, flat or optionally hierarchical labels to content for cross-cutting classification.

**State**:
- `tags`
- `tagIndex`
- `hierarchy`
- `name`

**Actions**:
- `addTag(entity, tag)` &rarr; ok | notfound
- `removeTag(entity, tag)` &rarr; ok | notfound
- `getByTag(tag)` &rarr; ok
- `getChildren(tag)` &rarr; ok | notfound
- `rename(tag, name)` &rarr; ok | notfound

##### TagHierarchy [T] _(derived)_

> Unify flat tags, hierarchical taxonomies, and scoped namespaces into a coherent classification structure with inheritance.

**Composes**: Tag, Taxonomy, Namespace
**Required syncs**: tag-taxonomy-bridge, taxonomy-namespace-scope, hierarchy-inheritance

**Surface**:
- `classify` &rarr; Tag/addTag
- `createTerm` &rarr; Taxonomy/addTerm
- `organize` &rarr; Namespace/createNamespacedPage

#### Taxonomy [V]

> Organize classification terms into hierarchical vocabularies with parent-child relationships.

**State**:
- `vocabularies`
- `terms`
- `termParent`
- `termIndex`

**Actions**:
- `createVocabulary(vocab, name)` &rarr; ok | exists
- `addTerm(vocab, term, parent)` &rarr; ok | notfound
- `setParent(vocab, term, parent)` &rarr; ok | notfound
- `tagEntity(entity, vocab, term)` &rarr; ok | notfound
- `untagEntity(entity, vocab, term)` &rarr; ok | notfound

### Syncs

- **NamespaceFromSchema** _(eager)_
  - When: Schema/defineSchema
  - Then: Namespace/createNamespacedPage
- **TaxonomyTermAsTag** _(eager)_
  - When: Taxonomy/tagEntity
  - Then: Tag/addTag
- **UntagRemovesFromTaxonomy** _(eager)_
  - When: Tag/removeTag
  - Then: Taxonomy/untagEntity

---

## collaboration
_v0.2.0_

> Real-time and asynchronous collaboration — distributed consistency, conflict resolution, attribution, signatures, inline review annotations, pessimistic locking, group membership, and flagging. Provides the full collaborative editing and versioning substrate for multi-user systems. concepts: # --- Existing concepts --- Flag: spec: ./flag.concept params: F: { as: flagging, description: "Flagging record" } Group: spec: ./group.concept params: G: { as: group, description: "Group entity" } # --- New concepts --- CausalClock: spec: ./causal-clock.concept params: T: { as: timestamp, description: "Causal timestamp entry" } Replica: spec: ./replica.concept params: R: { as: replica, description: "Replica instance" } ConflictResolution: spec: ./conflict-resolution.concept params: V: { as: value, description: "Value being reconciled" } Attribution: spec: ./attribution.concept params: A: { as: attribution, description: "Attribution record" } Signature: spec: ./signature.concept params: G: { as: signature, description: "Signature record" } InlineAnnotation: spec: ./inline-annotation.concept params: A: { as: annotation, description: "Inline annotation" } PessimisticLock: spec: ./pessimistic-lock.concept params: L: { as: lock, description: "Lock record" } # --- ConflictResolution providers --- LWWResolution: spec: ./providers/lww-resolution.concept params: V: { as: value, description: "Value being resolved" } optional: true AddWinsResolution: spec: ./providers/add-wins-resolution.concept params: V: { as: value, description: "Value being resolved" } optional: true ManualResolution: spec: ./providers/manual-resolution.concept params: V: { as: value, description: "Value being resolved" } optional: true MultiValueResolution: spec: ./providers/multi-value-resolution.concept params: V: { as: value, description: "Value being resolved" } optional: true syncs: required: - path: ./syncs/required/replica-causal-clock.sync description: "Every Replica operation advances the CausalClock" - path: ./syncs/required/replica-conflict-resolution.sync description: "Remote updates that conflict are routed through ConflictResolution" - path: ./syncs/required/attribution-causal-clock.sync description: "Every Attribution record is causally timestamped" - path: ./syncs/required/pessimistic-lock-conflict-resolution.sync description: "PessimisticLock checked before any ConflictResolution merge attempt" recommended: - path: ./syncs/group-access.sync description: "Group-scoped access check when flagging entities within a group" - path: ./syncs/recommended/signature-content-hash.sync description: "Signature/sign verifies the content hash exists in ContentHash" - path: ./syncs/recommended/attribution-dag-history.sync description: "Attribution/blame walks DAGHistory for line-level provenance" - path: ./syncs/recommended/inline-annotation-attribution.sync description: "Every InlineAnnotation is attributed to its author via Attribution" - path: ./syncs/recommended/inline-annotation-change-stream.sync description: "InlineAnnotation accept/reject events feed ChangeStream for audit" - path: ./syncs/recommended/pessimistic-lock-change-stream.sync description: "Lock/unlock events feed ChangeStream for audit trail" integration: - path: ./syncs/integration/lww-resolution-activation.sync description: "LWWResolution provider self-registers with PluginRegistry" - path: ./syncs/integration/add-wins-resolution-activation.sync description: "AddWinsResolution provider self-registers with PluginRegistry" - path: ./syncs/integration/manual-resolution-activation.sync description: "ManualResolution provider self-registers with PluginRegistry" - path: ./syncs/integration/multi-value-resolution-activation.sync description: "MultiValueResolution provider self-registers with PluginRegistry" uses: - suite: versioning concepts: - name: ContentHash - name: DAGHistory - name: ChangeStream - name: Merge - suite: infrastructure concepts: - name: PluginRegistry

### Concepts

#### AddWinsResolution [V]

> Add-Wins (OR-Set semantics) conflict resolution. When elements are concurrently added and removed, additions win. Suitable for set-like data structures such as tags, permissions, and collection membership.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `attemptResolve(base, v1, v2, context)` &rarr; resolved | cannotResolve

#### Attribution [A]

> Bind agent identity to content regions, tracking who created or modified each piece. Supports blame queries, per-region authorship history, and CODEOWNERS-style ownership patterns.

**State**:
- `attributions`
- `contentRef`
- `region`
- `agent`
- `timestamp`
- `changeRef`
- `ownership`

**Actions**:
- `attribute(contentRef, region, agent, changeRef)` &rarr; ok
- `blame(contentRef)` &rarr; ok
- `history(contentRef, region)` &rarr; ok | notFound
- `setOwnership(pattern, owners)` &rarr; ok
- `queryOwners(path)` &rarr; ok | noMatch

#### CausalClock [T]

> Track happens-before ordering between events across distributed participants. Vector clocks provide the universal ordering primitive for OT delivery, CRDT consistency, DAG traversal, provenance chains, and temporal queries.

**State**:
- `clocks`
- `events`
- `eventClock`
- `eventReplica`

**Actions**:
- `tick(replicaId)` &rarr; ok
- `merge(localClock, remoteClock)` &rarr; ok | incompatible
- `compare(a, b)` &rarr; before | after | concurrent
- `dominates(a, b)` &rarr; ok

#### ConflictResolution [V]

> Detect and resolve incompatible concurrent modifications using a pluggable strategy selected by data type and domain policy.

**State**:
- `policies`
- `policy_name`
- `policy_priority`
- `pending`
- `conflict_detail`
- `base`
- `version1`
- `version2`
- `clock1`
- `clock2`
- `context`
- `conflict_resolution`

**Actions**:
- `registerPolicy(name, priority)` &rarr; ok | duplicate
- `detect(base, version1, version2, context)` &rarr; noConflict | detected
- `resolve(conflictId, policyOverride)` &rarr; resolved | requiresHuman | noPolicy
- `manualResolve(conflictId, chosen)` &rarr; ok | notPending

#### Flag [F]

> Provide generalized user-entity toggle interactions (bookmarks, likes, follows, spam reports) with counts.

**State**:
- `flagTypes`
- `flaggings`
- `counts`
- `entityRef`
- `userRef`

**Actions**:
- `flag(flagging, flagType, entity, user)` &rarr; ok | exists
- `unflag(flagging)` &rarr; ok | notfound
- `isFlagged(flagType, entity, user)` &rarr; ok
- `getCount(flagType, entity)` &rarr; ok

#### Group [G]

> Create isolated content spaces with group-level role-based access control for multi-tenant collaboration.

**State**:
- `groups`
- `memberships`
- `groupRoles`
- `groupContent`
- `name`

**Actions**:
- `createGroup(group, name)` &rarr; ok | exists
- `addMember(group, user, role)` &rarr; ok | notfound
- `assignGroupRole(group, user, role)` &rarr; ok | notfound
- `addContent(group, content)` &rarr; ok | notfound
- `checkGroupAccess(group, user, permission)` &rarr; ok | notfound

#### InlineAnnotation [A]

> Embed change markers directly within content structure, enabling accept/reject review workflows where the document simultaneously holds both before and after states. Content-type-agnostic — scope is opaque bytes resolved by the content system.

**State**:
- `annotations`
- `contentRef`
- `changeType`
- `scope`
- `author`
- `timestamp`
- `status`
- `tracking`

**Actions**:
- `annotate(contentRef, changeType, scope, author)` &rarr; ok | trackingDisabled | invalidChangeType
- `accept(annotationId)` &rarr; ok | notFound | alreadyResolved
- `reject(annotationId)` &rarr; ok | notFound | alreadyResolved
- `acceptAll(contentRef)` &rarr; ok
- `rejectAll(contentRef)` &rarr; ok
- `toggleTracking(contentRef, enabled)` &rarr; ok
- `listPending(contentRef)` &rarr; ok

##### ReviewThread [T] _(derived)_

> Combine inline change annotations with threaded comments and approval flags to form a complete code or document review flow.

**Composes**: InlineAnnotation, Comment, Flag
**Required syncs**: annotation-comment-link, annotation-flag-resolution

**Surface**:
- `annotate` &rarr; InlineAnnotation/annotate
- `comment` &rarr; Comment/addComment
- `approve` &rarr; Flag/flag

#### LWWResolution [V]

> Last-Writer-Wins conflict resolution. Uses causal timestamps to select the most recent write. Default strategy for simple key-value stores and LWW registers.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `attemptResolve(base, v1, v2, context)` &rarr; resolved | cannotResolve

#### ManualResolution [V]

> Manual conflict resolution that escalates to a human reviewer. Returns candidate options rather than auto-resolving. Used as the last-resort policy when no automatic strategy can make a domain-safe decision.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `attemptResolve(base, v1, v2, context)` &rarr; cannotResolve

#### MultiValueResolution [V]

> Multi-value (keep-all) conflict resolution. Preserves both concurrent values rather than selecting one. Suitable for systems where all concurrent writes have equal validity, such as shopping cart contents or collaborative annotation lists.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `attemptResolve(base, v1, v2, context)` &rarr; resolved | cannotResolve

#### PessimisticLock [L] `@gate`

> Prevent conflicts by granting exclusive write access to a resource, serializing edits rather than reconciling them after the fact. Complementary to ConflictResolution — use locking for non-mergeable content (binary files, legal documents) and resolution for mergeable content (text, structured data). checkOut may complete after an arbitrarily long wait if the resource is locked and the requester is queued.

**Capabilities**: persistent-storage

**State**:
- `locks`
- `resource`
- `holder`
- `acquired`
- `expires`
- `reason`
- `queue`

**Actions**:
- `checkOut(resource, holder, duration, reason)` &rarr; ok | alreadyLocked | queued
- `checkIn(lockId)` &rarr; ok | notFound | notHolder
- `breakLock(lockId, breaker, reason)` &rarr; ok | notFound | unauthorized
- `renew(lockId, additionalDuration)` &rarr; ok | notFound | notHolder
- `queryLocks(resource)` &rarr; ok
- `queryQueue(resource)` &rarr; ok

#### Replica [R] `@gate`

> Maintain an independent, locally-modifiable copy of shared state that synchronizes with peers. Sync may complete after arbitrarily long delay due to network partitions or offline operation.

**Capabilities**: network, persistent-storage

**State**:
- `replicaId`
- `localState`
- `pendingOps`
- `peers`
- `syncState`

**Actions**:
- `localUpdate(op)` &rarr; ok | invalidOp
- `receiveRemote(op, fromReplica)` &rarr; ok | conflict | unknownReplica
- `sync(peer)` &rarr; ok | unreachable
- `getState()` &rarr; ok
- `fork()` &rarr; ok
- `addPeer(peerId)` &rarr; ok | alreadyKnown

##### RealtimeSync [T] _(derived)_

> Enable real-time collaborative editing with causal ordering, automatic conflict resolution, and change attribution.

**Composes**: Replica, CausalClock, ConflictResolution, Attribution
**Required syncs**: replica-clock-tick, clock-conflict-detect, conflict-attribution

**Surface**:
- `applyLocal` &rarr; Replica/localUpdate
- `receiveRemote` &rarr; Replica/receiveRemote
- `resolveConflict` &rarr; ConflictResolution/resolve

#### Signature [G]

> Cryptographic proof of authorship, integrity, and temporal existence. Provides signing, verification, and RFC 3161 timestamping against a set of trusted signer identities.

**Capabilities**: crypto, network

**State**:
- `signatures`
- `contentHash`
- `signer`
- `certificate`
- `timestamp`
- `valid`
- `trustedSigners`

**Actions**:
- `sign(contentHash, identity)` &rarr; ok | unknownIdentity | hashNotFound
- `verify(contentHash, signatureId)` &rarr; valid | invalid | expired | untrustedSigner
- `timestamp(contentHash)` &rarr; ok | unavailable
- `addTrustedSigner(identity)` &rarr; ok | alreadyTrusted

### Syncs

- **FlagWithinGroup** _(eager)_
  - When: Flag/flag
  - Then: Group/checkGroupAccess
- **RegisterAddWinsResolution** _(eager)_
  - When: AddWinsResolution/register
  - Then: PluginRegistry/register
- **RegisterLWWResolution** _(eager)_
  - When: LWWResolution/register
  - Then: PluginRegistry/register
- **RegisterManualResolution** _(eager)_
  - When: ManualResolution/register
  - Then: PluginRegistry/register
- **RegisterMultiValueResolution** _(eager)_
  - When: MultiValueResolution/register
  - Then: PluginRegistry/register
- **AttributionWalksDAG** _(eager)_
  - When: Attribution/blame
  - Then: DAGHistory/ancestors
- **AnnotationAttributedToAuthor** _(eager)_
  - When: InlineAnnotation/annotate
  - Then: Attribution/attribute
- **AnnotationAcceptedToStream** _(eager)_
  - When: InlineAnnotation/accept
  - Then: ChangeStream/append
- **AnnotationRejectedToStream** _(eager)_
  - When: InlineAnnotation/reject
  - Then: ChangeStream/append
- **LockAcquiredToStream** _(eager)_
  - When: PessimisticLock/checkOut
  - Then: ChangeStream/append
- **LockReleasedToStream** _(eager)_
  - When: PessimisticLock/checkIn
  - Then: ChangeStream/append
- **SignatureVerifiesHash** _(eager)_
  - When: Signature/sign
  - Then: ContentHash/retrieve
- **AttributionCausalTimestamp** _(eager)_
  - When: Attribution/attribute
  - Then: CausalClock/tick
- **LockBlocksMerge** _(eager)_
  - When: ConflictResolution/detect
  - Then: PessimisticLock/queryLocks
- **ReplicaLocalUpdateTick** _(eager)_
  - When: Replica/localUpdate
  - Then: CausalClock/tick
- **ReplicaReceiveRemoteMerge** _(eager)_
  - When: Replica/receiveRemote
  - Then: CausalClock/merge
- **ReplicaConflictToResolution** _(eager)_
  - When: Replica/receiveRemote
  - Then: ConflictResolution/detect

### Dependencies

- **versioning**
- **infrastructure**

---

## computation
_v0.1.0_

> "Dynamic computation — formulas, token replacement, and expression language parsing for evaluated content."

### Concepts

#### ExpressionLanguage [E]

> Parse and evaluate expressions in pluggable language grammars with typed functions, operators, and autocompletion.

**State**:
- `grammars`
- `functionRegistry`
- `operatorRegistry`
- `typeCoercions`
- `astCache`

**Actions**:
- `registerLanguage(name, grammar)` &rarr; ok | exists
- `registerFunction(name, implementation)` &rarr; ok | exists
- `registerOperator(name, implementation)` &rarr; ok | exists
- `parse(expression, text, language)` &rarr; ok | error
- `evaluate(expression)` &rarr; ok | notfound
- `typeCheck(expression)` &rarr; ok | notfound
- `getCompletions(expression, cursor)` &rarr; ok | notfound

#### Formula [F]

> Evaluate reactive computed values derived from properties and relations, with dependency tracking and automatic invalidation.

**State**:
- `formulas`
- `expression`
- `dependencies`
- `cachedResult`

**Actions**:
- `create(formula, expression)` &rarr; ok | exists
- `evaluate(formula)` &rarr; ok | notfound
- `getDependencies(formula)` &rarr; ok | notfound
- `invalidate(formula)` &rarr; ok | notfound
- `setExpression(formula, expression)` &rarr; ok | notfound

#### Token [T]

> Replace typed placeholders in text using chain-traversal patterns like [node:author:mail] for dynamic content substitution.

**State**:
- `tokenTypes`
- `patterns`
- `providers`

**Actions**:
- `replace(text, context)` &rarr; ok
- `getAvailableTokens(context)` &rarr; ok
- `scan(text)` &rarr; ok
- `registerProvider(token, provider)` &rarr; ok | exists

### Syncs

- **FormulaUsesExpressionLanguage** _(eager)_
  - When: Formula/create
  - Then: ExpressionLanguage/parse
- **TokenUsesExpressionLanguage** _(eager)_
  - When: Token/replace
  - Then: ExpressionLanguage/parse

---

## content
_v0.1.0_

> "Rich content authoring — daily notes, comments, synced content, templates, canvases, and version tracking."

### Concepts

#### Canvas [V]

> Arrange content cards in a free-form 2D spatial layout with grouping. Node connections are delegated to Graph via CanvasConnections sync. File embedding is delegated to FileManagement via CanvasFileEmbed sync.

**State**:
- `canvases`
- `nodes`
- `positions`

**Actions**:
- `addNode(canvas, node, x, y)` &rarr; ok | notfound
- `moveNode(canvas, node, x, y)` &rarr; ok | notfound
- `groupNodes(canvas, nodes, group)` &rarr; ok | notfound

#### Comment [C]

> Enable threaded discussion attached polymorphically to any content entity using materialized path threading.

**State**:
- `comments`
- `content`
- `author`
- `parent`
- `threadPath`
- `published`

**Actions**:
- `addComment(comment, entity, content, author)` &rarr; ok
- `reply(comment, parent, content, author)` &rarr; ok
- `publish(comment)` &rarr; ok | notfound
- `unpublish(comment)` &rarr; ok | notfound
- `delete(comment)` &rarr; ok | notfound

#### DailyNote [D]

> Provide time-indexed, frictionless capture by auto-creating a note for today's date.

**State**:
- `notes`
- `dateFormat`
- `templateId`
- `targetFolder`
- `date`

**Actions**:
- `getOrCreateToday(note)` &rarr; ok
- `navigateToDate(date)` &rarr; ok | notfound
- `listRecent(count)` &rarr; ok

#### SyncedContent [S]

> Maintain single-source-of-truth transclusion where editing the original automatically updates all references.

**State**:
- `originals`
- `references`
- `content`

**Actions**:
- `createReference(ref, original)` &rarr; ok | notfound
- `editOriginal(original, content)` &rarr; ok | notfound
- `deleteReference(ref)` &rarr; ok | notfound
- `convertToIndependent(ref)` &rarr; ok | notfound

#### Template [T]

> Define reusable content structures with dynamic variable substitution and conditional triggers for instantiation.

**State**:
- `templates`
- `variables`
- `triggers`
- `body`

**Actions**:
- `define(template, body, variables)` &rarr; ok | exists
- `instantiate(template, values)` &rarr; ok | notfound
- `registerTrigger(template, trigger)` &rarr; ok | notfound
- `mergeProperties(template, properties)` &rarr; ok | notfound

#### Version [H]

> Track content change history with snapshots enabling rollback, diff comparison, and audit trails.

**State**:
- `history`
- `entity`
- `snapshot`
- `timestamp`
- `author`

**Actions**:
- `snapshot(version, entity, data, author)` &rarr; ok
- `listVersions(entity)` &rarr; ok
- `rollback(version)` &rarr; ok | notfound
- `diff(versionA, versionB)` &rarr; ok | notfound

##### ContentHistory [T] _(derived)_

> Track content changes with versioned snapshots and threaded commentary, enabling review and rollback of document evolution.

**Composes**: Version, Comment
**Required syncs**: version-comment-link, version-snapshot

**Surface**:
- `saveVersion` &rarr; Version/snapshot
- `addNote` &rarr; Comment/addComment

### Derived Concepts

#### PublishWorkflow [T] _(derived)_

> Coordinate content publication through state-machine transitions, reviewer approval flags, and subscriber notifications.

**Composes**: Workflow, Notification, Flag
**Required syncs**: workflow-notification, workflow-flag-approval, publish-transition

**Surface**:
- `submit` &rarr; Workflow/transition
- `approve` &rarr; Flag/flag
- `notifySubscribers` &rarr; Notification/notify

#### WikiPage [T] _(derived)_

> Compose a full wiki page from structured content, bidirectional links, and full-text search indexing.

**Composes**: ContentNode, Reference, Backlink, SearchIndex
**Required syncs**: content-reference-extract, reference-backlink, content-search-index

**Surface**:
- `createPage` &rarr; ContentNode/create
- `updatePage` &rarr; ContentNode/update
- `addLink` &rarr; Reference/addRef

### Syncs

- **CanvasConnections** _(eager)_
  - When: Canvas/addNode
  - Then: Graph/addNode
- **CanvasFileEmbed** _(eager)_
  - When: Canvas/addNode
  - Then: FileManagement/attach
- **CommentNotifyOnReply** _(eager)_
  - When: Comment/reply
  - Then: Comment/publish
- **VersionOnEdit** _(eager)_
  - When: SyncedContent/editOriginal
  - Then: Version/snapshot
- **TemplateInstantiateCreatesVersion** _(eager)_
  - When: Template/instantiate
  - Then: Version/snapshot

---

## data-integration
_v0.2.0_

> "Data capture, integration, enrichment, and bidirectional sync — 10 concepts for connecting external systems, transforming data, enforcing quality, and tracking provenance."

### Concepts

#### Capture [C]

> Detect and ingest data from any source into the system — whether clipping a web page, importing a file, subscribing to a feed, or detecting changes in an external system — with source metadata. Capture is the entry point; syncs handle what happens next.

**State**:
- `inbox`
- `content`
- `sourceMetadata`
- `status`
- `subscriptions`
- `hashes`

**Actions**:
- `clip(url, mode, metadata)` &rarr; ok | error
- `import(file, options)` &rarr; ok | error
- `subscribe(sourceId, schedule, mode)` &rarr; ok | error
- `detectChanges(subscriptionId)` &rarr; ok | notfound | empty
- `markReady(itemId)` &rarr; ok | notfound

#### Connector [C]

> Abstract away protocol differences so that captures, federation storage, and sync operations interact with external data through a uniform interface regardless of the underlying protocol (REST, SQL, GraphQL, file, etc.).

**State**:
- `connectors`
- `sourceId`
- `protocolId`
- `config`
- `status`

**Actions**:
- `configure(sourceId, protocolId, config)` &rarr; ok | error
- `read(connectorId, query, options)` &rarr; ok | notfound | error
- `write(connectorId, data, options)` &rarr; ok | notfound | error
- `test(connectorId)` &rarr; ok | notfound | error
- `discover(connectorId)` &rarr; ok | notfound | error

##### DataPipeline [T] _(derived)_

> Orchestrate end-to-end data ingestion from source connectivity through capture, field mapping, transformation, and quality validation.

**Composes**: Connector, Capture, FieldMapping, Transform, DataQuality
**Required syncs**: capture-to-mapping, mapping-to-transform, transform-to-quality, connector-capture

**Surface**:
- `ingest` &rarr; Connector/read
- `mapFields` &rarr; FieldMapping/map
- `transform` &rarr; Transform/apply
- `validate` &rarr; DataQuality/validate

#### DataQuality [D]

> Gate data flow with configurable validation rules, quarantine invalid items for review, profile datasets for statistical understanding, and reconcile values against external knowledge bases. Rule evaluation delegates to Validator via DataQualityValidation sync. Deduplication extracted as a separate concern (DataDeduplication sync).

**State**:
- `rulesets`
- `rules`
- `appliesTo`
- `violations`
- `quarantine`
- `qualityScores`

**Actions**:
- `validate(item, rulesetId)` &rarr; ok | invalid | notfound
- `quarantine(itemId, violations)` &rarr; ok
- `release(itemId)` &rarr; ok | notfound
- `profile(datasetQuery)` &rarr; ok
- `reconcile(field, knowledgeBase)` &rarr; ok

#### DataSource [D]

> Register, authenticate, and monitor external data systems so that other concepts can reference them by name rather than embedding connection details.

**State**:
- `sources`
- `name`
- `uri`
- `credentials`
- `discoveredSchema`
- `status`
- `lastHealthCheck`
- `metadata`

**Actions**:
- `register(name, uri, credentials)` &rarr; ok | exists
- `connect(sourceId)` &rarr; ok | notfound | error
- `discover(sourceId)` &rarr; ok | notfound | error
- `healthCheck(sourceId)` &rarr; ok | notfound
- `deactivate(sourceId)` &rarr; ok | notfound

#### Enricher [E]

> Augment data with additional information from AI models, APIs, or reference data — attaching OCR text, captions, transcriptions, entity extractions, classifications, and summaries with confidence scores and human review status.

**State**:
- `enrichments`
- `itemId`
- `pluginId`
- `result`
- `confidence`
- `status`
- `generatedAt`
- `triggers`

**Actions**:
- `enrich(itemId, enricherId)` &rarr; ok | notfound | error
- `suggest(itemId)` &rarr; ok | notfound
- `accept(itemId, enrichmentId)` &rarr; ok | notfound
- `reject(itemId, enrichmentId)` &rarr; ok | notfound
- `refreshStale(olderThan)` &rarr; ok

#### FieldMapping [F]

> Translate field names, paths, and structures between an external source's data model and the destination schema so that data flows into the right properties on the right content types.

**State**:
- `mappings`
- `name`
- `sourceSchema`
- `destSchema`
- `rules`
- `unmapped`

**Actions**:
- `map(mappingId, sourceField, destField, transform)` &rarr; ok | notfound
- `apply(record, mappingId)` &rarr; ok | notfound | error
- `reverse(record, mappingId)` &rarr; ok | notfound
- `autoDiscover(sourceSchema, destSchema)` &rarr; ok
- `validate(mappingId)` &rarr; ok | notfound

#### ProgressiveSchema [P]

> Accept content at any formality level — raw text, lightly tagged, partially structured, fully typed — and help users incrementally formalize it by detecting implicit structure and suggesting schema promotions.

**State**:
- `items`
- `content`
- `formality`
- `detectedStructure`
- `schema`
- `promotionHistory`

**Actions**:
- `captureFreeform(content)` &rarr; ok
- `detectStructure(itemId)` &rarr; ok | notfound
- `acceptSuggestion(itemId, suggestionId)` &rarr; ok | notfound
- `rejectSuggestion(itemId, suggestionId)` &rarr; ok | notfound
- `promote(itemId, targetSchema)` &rarr; ok | notfound | incomplete
- `inferSchema(items)` &rarr; ok | error

#### Provenance [P]

> Track the complete lineage of every data item — where it came from, what happened to it, who initiated each operation — enabling trace-back to origin, audit, rollback, and reproduction.

**State**:
- `records`
- `entity`
- `activity`
- `agent`
- `inputs`
- `timestamp`
- `batchId`
- `mapTables`

**Actions**:
- `record(entity, activity, agent, inputs)` &rarr; ok
- `trace(entityId)` &rarr; ok | notfound
- `audit(batchId)` &rarr; ok | notfound
- `rollback(batchId)` &rarr; ok | notfound
- `diff(entityId, version1, version2)` &rarr; ok | notfound
- `reproduce(entityId)` &rarr; ok | notfound

#### SyncPair [S]

> Maintain bidirectional correspondence between records in two systems with configurable direction, conflict detection via version vectors, and pluggable conflict resolution.

**State**:
- `pairs`
- `name`
- `endpointA`
- `endpointB`
- `direction`
- `conflictPolicy`
- `mapping`
- `pairMap`
- `versionVectors`
- `changeLog`
- `status`

**Actions**:
- `link(pairId, idA, idB)` &rarr; ok | notfound
- `sync(pairId)` &rarr; ok | notfound | conflict
- `detectConflicts(pairId)` &rarr; ok | notfound
- `resolve(conflictId, resolution)` &rarr; ok | notfound | error
- `unlink(pairId, idA)` &rarr; ok | notfound
- `getChangeLog(pairId, since)` &rarr; ok | notfound

#### Transform [T]

> Convert, clean, format, split, merge, or otherwise transform individual field values as they flow through the sync chain, composable into chains where each transform's output feeds the next.

**State**:
- `transforms`
- `name`
- `pluginId`
- `config`
- `inputType`
- `outputType`

**Actions**:
- `apply(value, transformId)` &rarr; ok | notfound | error
- `chain(value, transformIds)` &rarr; ok | error
- `preview(value, transformId)` &rarr; ok | notfound

### Syncs

- **TrackCapture** _(eager)_
  - When: Capture/clip
  - Then: Provenance/record
- **TrackMapping** _(eager)_
  - When: FieldMapping/apply
  - Then: Provenance/record
- **TrackTransform** _(eager)_
  - When: Transform/chain
  - Then: Provenance/record
- **TrackEnrichment** _(eager)_
  - When: Enricher/enrich
  - Then: Provenance/record
- **TrackValidation** _(eager)_
  - When: DataQuality/validate
  - Then: Provenance/record
- **TrackStorage** _(eager)_
  - When: ContentStorage/save
  - Then: Provenance/record
- **CaptureEntersQueue** _(eager)_
  - When: Capture/clip
  - Then: Queue/enqueue
- **CaptureImportEntersQueue** _(eager)_
  - When: Capture/import
  - Then: Queue/enqueue
- **QueueDispatchesMapping** _(eager)_
  - When: Queue/claim
  - Then: FieldMapping/apply
- **CaptureTriggersDetection** _(eager)_
  - When: Capture/clip
  - Then: ProgressiveSchema/detectStructure
- **ImportTriggersDetection** _(eager)_
  - When: Capture/import
  - Then: ProgressiveSchema/detectStructure
- **DataQualityValidation** _(eager)_
  - When: DataQuality/validate
  - Then: Validator/validate
- **EnrichmentToValidation** _(eager)_
  - When: Enricher/suggest
  - Then: Queue/enqueue
- **QueueDispatchesValidation** _(eager)_
  - When: Queue/claim
  - Then: DataQuality/validate
- **MappingToTransform** _(eager)_
  - When: FieldMapping/apply
  - Then: Queue/enqueue
- **QueueDispatchesTransform** _(eager)_
  - When: Queue/claim
  - Then: Transform/chain
- **EnrichmentFeedsStructure** _(eager)_
  - When: Enricher/suggest
  - Then: ProgressiveSchema/detectStructure
- **SyncPairDetect** _(eager)_
  - When: SyncPair/sync
  - Then: Provenance/record
- **SyncPairConflictResolve** _(eager)_
  - When: SyncPair/detectConflicts
  - Then: SyncPair/resolve
- **TransformToEnrichment** _(eager)_
  - When: Transform/chain
  - Then: Queue/enqueue
- **QueueDispatchesEnrichment** _(eager)_
  - When: Queue/claim
  - Then: Enricher/suggest
- **ValidToStorage** _(eager)_
  - When: DataQuality/validate
  - Then: ContentStorage/save
- **InvalidToQuarantine** _(eager)_
  - When: DataQuality/validate
  - Then: DataQuality/quarantine

---

## data-organization
_v0.1.0_

> "Grouping and structuring data — collections and graphs for organizing entities and their relationships."

### Concepts

#### Collection [C]

> Organize content into concrete, manually curated sets. Virtual/computed collections are expressed as Query subscriptions via VirtualCollectionQuery sync.

**State**:
- `collections`
- `type`
- `schema`
- `members`
- `templates`

**Actions**:
- `create(collection, type, schema)` &rarr; ok | exists
- `addMember(collection, member)` &rarr; ok | notfound
- `removeMember(collection, member)` &rarr; ok | notfound
- `getMembers(collection)` &rarr; ok | notfound
- `setSchema(collection, schema)` &rarr; ok | notfound

#### Graph [G]

> Model entity networks as a pure data structure with depth-limited neighborhood exploration and filtering. Visualization layout is delegated via GraphVisualization sync.

**State**:
- `graphs`
- `nodes`
- `edges`

**Actions**:
- `addNode(graph, node)` &rarr; ok | notfound
- `removeNode(graph, node)` &rarr; ok | notfound
- `addEdge(graph, source, target)` &rarr; ok | notfound
- `removeEdge(graph, source, target)` &rarr; ok | notfound
- `getNeighbors(graph, node, depth)` &rarr; ok | notfound
- `filterNodes(graph, filter)` &rarr; ok | notfound

### Syncs

- **GraphFromCollection** _(eager)_
  - When: Collection/addMember
  - Then: Graph/addNode
- **RemoveFromGraph** _(eager)_
  - When: Collection/removeMember
  - Then: Graph/removeNode
- **GraphVisualization** _(eager)_
  - When: Graph/addEdge
  - Then: Layout/arrange
- **VirtualCollectionQuery** _(eager)_
  - When: Query/subscribe
  - Then: Collection/addMember

---

## entity-reflection
_v0.1.0_

> "Cross-suite entity reflection layer. Bridges Score, PluginRegistry, and all user/system concepts to the Drupal-inspired content/configuration entity model via ContentStorage, Relation, Reference, Tag, and Property."

### Syncs

- **AutomationDispatchAsConfigEntity** _(eager)_
  - When: AutomationDispatch/dispatch
  - Then: ContentStorage/save
- **AutomationDispatchTagBundle** _(eager)_
  - When: AutomationDispatch/dispatch
  - Then: Property/set
- **AutomationScopeAsConfigEntity** _(eager)_
  - When: AutomationScope/configure
  - Then: ContentStorage/save
- **AutomationScopeTagBundle** _(eager)_
  - When: AutomationScope/configure
  - Then: Property/set
- **ManifestAutomationProviderAsConfigEntity** _(eager)_
  - When: ManifestAutomationProvider/register
  - Then: ContentStorage/save
- **ManifestAutomationProviderTagBundle** _(eager)_
  - When: ManifestAutomationProvider/register
  - Then: Property/set
- **SyncAutomationProviderAsContentEntity** _(eager)_
  - When: SyncAutomationProvider/define
  - Then: ContentStorage/save
- **SyncAutomationProviderTagEntity** _(eager)_
  - When: SyncAutomationProvider/define
  - Then: Tag/addTag
- **SyncAutomationProviderAuthorRelation** _(eager)_
  - When: SyncAutomationProvider/define
  - Then: Relation/link
- **AliasAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **AliasEntityRelation** _(eager)_
  - Then: Relation/link
- **AttributionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **AttributionAgentRelation** _(eager)_
  - Then: Relation/link
- **ConflictResolutionAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ConflictResolutionPriorityProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **InlineAnnotationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **InlineAnnotationContentRelation** _(eager)_
  - Then: Relation/link
- **SignatureAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **SignatureContentRelation** _(eager)_
  - Then: Relation/link
- **ApiSurfaceAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ApiSurfaceTagBundle** _(eager)_
  - Then: Property/set
- **ChainMonitorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ConnectorToSymbol** _(eager)_
  - Then: Symbol/register
- **ConnectorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **DeployPlanAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **DeployPlanTagBundle** _(eager)_
  - Then: Property/set
- **ExtensionManifestAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExtensionManifestTagBundle** _(eager)_
  - Then: Property/set
- **FieldMappingAsScoreRelation** _(eager)_
  - Then: Relation/link
- **GuardrailAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **GuardrailTagBundle** _(eager)_
  - Then: Property/set
- **LLMProviderAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **LLMProviderTagBundle** _(eager)_
  - Then: Property/set
- **RuntimeAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **RuntimeTagBundle** _(eager)_
  - Then: Property/set
- **SchemaAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SchemaTagBundle** _(eager)_
  - Then: Property/set
- **TargetOutputAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **TargetInterfaceForRelation** _(eager)_
  - Then: Relation/link
- **ThemeAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ThemeActivationTagBundle** _(eager)_
  - Then: Property/set
- **ToolBindingAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ToolBindingPluginRelation** _(eager)_
  - Then: Relation/link
- **WidgetRegistrationAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **WidgetRendersForRelation** _(eager)_
  - Then: Relation/link
- **ConfigSyncExportCatalog** _(eager)_
  - Then: ContentStorage/save
- **ConfigSyncFileArtifactFromConcept** _(eager)_
  - Then: Relation/link
- **ConfigSyncFileArtifactFromSync** _(eager)_
  - Then: Relation/link
- **ConfigSyncOverrideRelation** _(eager)_
  - Then: Relation/link
- **ConfigSyncOverrideToChangeStream** _(eager)_
  - Then: ChangeStream/append
- **ConfigSyncProvenanceLink** _(eager)_
  - Then: Provenance/record
- **ConfigSyncTracksOrigin** _(eager)_
  - Then: Property/set
- **AgentMemoryAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **AgentMemoryTagType** _(eager)_
  - Then: Tag/addTag
- **AutomationRuleAsEntity** _(eager)_
  - Then: ContentStorage/save
- **AutomationRuleTagBundle** _(eager)_
  - Then: Tag/addTag
- **AutomationRuleTriggerRelation** _(eager)_
  - Then: Relation/link
- **ConversationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ConversationTagBundle** _(eager)_
  - Then: Tag/addTag
- **DailyNoteAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **DailyNoteTagBundle** _(eager)_
  - Then: Tag/addTag
- **FlagAsRelation** _(eager)_
  - Then: Relation/link
- **GroupAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **GroupTagBundle** _(eager)_
  - Then: Tag/addTag
- **GroupMembershipAsRelation** _(eager)_
  - Then: Relation/link
- **SavedQueryAsEntity** _(eager)_
  - Then: ContentStorage/save
- **SavedQueryTagBundle** _(eager)_
  - Then: Tag/addTag
- **TemplateAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **TemplateTagBundle** _(eager)_
  - Then: Tag/addTag
- **ViewAsEntity** _(eager)_
  - Then: ContentStorage/save
- **ViewTagBundle** _(eager)_
  - Then: Tag/addTag
- **ViewQueriesRelation** _(eager)_
  - Then: Relation/link
- **WorkflowDefinitionAsEntity** _(eager)_
  - Then: ContentStorage/save
- **WorkflowDefinitionTagBundle** _(eager)_
  - Then: Tag/addTag
- **WorkflowStateAsContentAttribute** _(eager)_
  - Then: Property/set
- **WorkflowTransitionToChangeStream** _(eager)_
  - Then: ChangeStream/append
- **BackgroundWorkerAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **BackgroundWorkerExtensionRelation** _(eager)_
  - Then: Relation/link
- **BrowserActionAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **BrowserActionPopupProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **ContentScriptAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ContentScriptUrlPatternsProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **ContributionPointAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ContributionPointTypeProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **ExtensionConfigAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExtensionConfigRelation** _(eager)_
  - Then: Relation/link
- **ExtensionHostAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExtensionHostTag** _(eager)_
  - Then: Tag/addTag
- **ExtensionMessagingAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExtensionMessagingSchemaProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **ExtensionPermissionAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExtensionPermissionRelation** _(eager)_
  - Then: Relation/link
- **ExtensionStorageAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExtensionStorageQuotaProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **ContractAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ContractTagBundle** _(eager)_
  - Then: Property/set
- **ContractTargetRelation** _(eager)_
  - Then: Relation/link
- **EvidenceAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **EvidenceTagEntity** _(eager)_
  - Then: Tag/addTag
- **EvidencePropertyRelation** _(eager)_
  - Then: Relation/link
- **FormalPropertyAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **FormalPropertyTagEntity** _(eager)_
  - Then: Tag/addTag
- **FormalPropertyTargetRelation** _(eager)_
  - Then: Relation/link
- **SolverProviderAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SolverProviderTagBundle** _(eager)_
  - Then: Property/set
- **SpecificationSchemaAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SpecificationSchemaTagBundle** _(eager)_
  - Then: Property/set
- **VerificationRunAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **VerificationRunTagEntity** _(eager)_
  - Then: Tag/addTag
- **VerificationRunTargetRelation** _(eager)_
  - Then: Relation/link
- **FlakyTestAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **FlakyTestTagBundle** _(eager)_
  - Then: Tag/addTag
- **KindSystemAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **KindSystemPropertyBundle** _(eager)_
  - Then: Property/set
- **ResourceAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ResourcePropertyBundle** _(eager)_
  - Then: Property/set
- **ApprovalCountingAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ApprovalCountingTagBundle** _(eager)_
  - Then: Property/set
- **BordaCountAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **BordaCountTagBundle** _(eager)_
  - Then: Property/set
- **CondorcetSchulzeAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **CondorcetSchulzeTagBundle** _(eager)_
  - Then: Property/set
- **ConsentProcessAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ConsentProcessTagBundle** _(eager)_
  - Then: Property/set
- **ConvictionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ConvictionTagEntity** _(eager)_
  - Then: Tag/addTag
- **CountingMethodAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **CountingMethodTagBundle** _(eager)_
  - Then: Property/set
- **DeliberationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **DeliberationTagEntity** _(eager)_
  - Then: Tag/addTag
- **DeliberationProposalRelation** _(eager)_
  - Then: Relation/link
- **MajorityAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **MajorityTagBundle** _(eager)_
  - Then: Property/set
- **MeetingAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **MeetingTagEntity** _(eager)_
  - Then: Tag/addTag
- **OptimisticApprovalAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **OptimisticApprovalTagEntity** _(eager)_
  - Then: Tag/addTag
- **PredictionMarketAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **PredictionMarketTagEntity** _(eager)_
  - Then: Tag/addTag
- **ProposalAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ProposalTagEntity** _(eager)_
  - Then: Tag/addTag
- **QuadraticVotingAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **QuadraticVotingTagBundle** _(eager)_
  - Then: Property/set
- **QuorumAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **QuorumTagBundle** _(eager)_
  - Then: Property/set
- **RankedChoiceAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **RankedChoiceTagBundle** _(eager)_
  - Then: Property/set
- **ScoreVotingAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ScoreVotingTagBundle** _(eager)_
  - Then: Property/set
- **SupermajorityAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SupermajorityTagBundle** _(eager)_
  - Then: Property/set
- **VoteAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **VoteTagEntity** _(eager)_
  - Then: Tag/addTag
- **VoteSessionRelation** _(eager)_
  - Then: Relation/link
- **BFTFinalityAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **BFTFinalityTagBundle** _(eager)_
  - Then: Property/set
- **ChainFinalityAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ChainFinalityTagBundle** _(eager)_
  - Then: Property/set
- **ExecutionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ExecutionTagEntity** _(eager)_
  - Then: Tag/addTag
- **ExecutionSourceRelation** _(eager)_
  - Then: Relation/link
- **FinalityGateAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **FinalityGateTagEntity** _(eager)_
  - Then: Tag/addTag
- **FinalityGateOperationRelation** _(eager)_
  - Then: Relation/link
- **GuardAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **GuardTagBundle** _(eager)_
  - Then: Property/set
- **ImmediateFinalityAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ImmediateFinalityTagBundle** _(eager)_
  - Then: Property/set
- **OptimisticOracleFinalityAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **OptimisticOracleFinalityTagBundle** _(eager)_
  - Then: Property/set
- **RageQuitAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **RageQuitTagEntity** _(eager)_
  - Then: Tag/addTag
- **TimelockAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **TimelockTagEntity** _(eager)_
  - Then: Tag/addTag
- **AgenticDelegateAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AgenticDelegateTagBundle** _(eager)_
  - Then: Property/set
- **AttestationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **AttestationTagEntity** _(eager)_
  - Then: Tag/addTag
- **AttestationRecipientRelation** _(eager)_
  - Then: Relation/link
- **AttestationSybilAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AttestationSybilTagBundle** _(eager)_
  - Then: Property/set
- **MembershipAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **MembershipTagEntity** _(eager)_
  - Then: Tag/addTag
- **PermissionAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PermissionTagBundle** _(eager)_
  - Then: Property/set
- **ProofOfPersonhoodAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ProofOfPersonhoodTagBundle** _(eager)_
  - Then: Property/set
- **RoleAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **RoleTagBundle** _(eager)_
  - Then: Property/set
- **SocialGraphVerificationAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SocialGraphVerificationTagBundle** _(eager)_
  - Then: Property/set
- **StakeThresholdAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **StakeThresholdTagBundle** _(eager)_
  - Then: Property/set
- **SybilResistanceAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **SybilResistanceTagEntity** _(eager)_
  - Then: Tag/addTag
- **BondingCurveAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **BondingCurveTagBundle** _(eager)_
  - Then: Property/set
- **EloRatingAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **EloRatingTagBundle** _(eager)_
  - Then: Property/set
- **GlickoRatingAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **GlickoRatingTagBundle** _(eager)_
  - Then: Property/set
- **MetricAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **MetricTagBundle** _(eager)_
  - Then: Property/set
- **ObjectiveAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ObjectiveTagEntity** _(eager)_
  - Then: Tag/addTag
- **PageRankReputationAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PageRankReputationTagBundle** _(eager)_
  - Then: Property/set
- **PageRankReputationAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PageRankReputationTagBundle** _(eager)_
  - Then: Property/set
- **PeerAllocationAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PeerAllocationTagBundle** _(eager)_
  - Then: Property/set
- **ReputationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ReputationTagEntity** _(eager)_
  - Then: Tag/addTag
- **SimpleAccumulatorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SimpleAccumulatorTagBundle** _(eager)_
  - Then: Property/set
- **TreasuryAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **TreasuryTagEntity** _(eager)_
  - Then: Tag/addTag
- **ADICOEvaluatorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ADICOEvaluatorTagBundle** _(eager)_
  - Then: Property/set
- **CedarEvaluatorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **CedarEvaluatorTagBundle** _(eager)_
  - Then: Property/set
- **CustomEvaluatorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **CustomEvaluatorTagBundle** _(eager)_
  - Then: Property/set
- **DisputeAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **DisputeTagEntity** _(eager)_
  - Then: Tag/addTag
- **DisputeSubjectRelation** _(eager)_
  - Then: Relation/link
- **MonitorAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **MonitorTagEntity** _(eager)_
  - Then: Tag/addTag
- **MonitorRuleRelation** _(eager)_
  - Then: Relation/link
- **PolicyAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PolicyTagBundle** _(eager)_
  - Then: Property/set
- **RegoEvaluatorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **RegoEvaluatorTagBundle** _(eager)_
  - Then: Property/set
- **SanctionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **SanctionTagEntity** _(eager)_
  - Then: Tag/addTag
- **CircleAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **CircleTagBundle** _(eager)_
  - Then: Property/set
- **DelegationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **DelegationTagEntity** _(eager)_
  - Then: Tag/addTag
- **DelegationDelegateRelation** _(eager)_
  - Then: Relation/link
- **EqualWeightAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **EqualWeightTagBundle** _(eager)_
  - Then: Property/set
- **PolityAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PolityTagBundle** _(eager)_
  - Then: Property/set
- **QuadraticWeightAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **QuadraticWeightTagBundle** _(eager)_
  - Then: Property/set
- **ReputationWeightAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ReputationWeightTagBundle** _(eager)_
  - Then: Property/set
- **StakeWeightAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **StakeWeightTagBundle** _(eager)_
  - Then: Property/set
- **TokenBalanceAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **TokenBalanceTagBundle** _(eager)_
  - Then: Property/set
- **VoteEscrowAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **VoteEscrowTagBundle** _(eager)_
  - Then: Property/set
- **WeightAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **WeightTagEntity** _(eager)_
  - Then: Tag/addTag
- **AuditTrailAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **AuditTrailTagEntity** _(eager)_
  - Then: Tag/addTag
- **DisclosurePolicyAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **DisclosurePolicyTagBundle** _(eager)_
  - Then: Property/set
- **AuthenticationAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AuthenticationProviderType** _(eager)_
  - Then: Property/set
- **AuthorizationAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AuthorizationTagBundle** _(eager)_
  - Then: Tag/addTag
- **SessionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **SessionTagBundle** _(eager)_
  - Then: Tag/addTag
- **SessionUserRelation** _(eager)_
  - Then: Relation/link
- **ContentSaveTracksProvenance** _(eager)_
  - Then: Provenance/record
- **ContentSaveTracksReferences** _(eager)_
  - Then: Reference/addRef
- **DAGHistoryNodeToSymbol** _(eager)_
  - Then: Symbol/register
- **DAGHistoryParentRelation** _(eager)_
  - Then: Relation/link
- **GenerationRunAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **GenerationRunTagBundle** _(eager)_
  - Then: Tag/addTag
- **InteractorEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **InteractorEntityTagBundle** _(eager)_
  - Then: Property/set
- **LLMTraceAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **LLMTraceTagBundle** _(eager)_
  - Then: Tag/addTag
- **ProvenanceToChangeStream** _(eager)_
  - Then: ChangeStream/append
- **WalletAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **WalletTagBundle** _(eager)_
  - Then: Tag/addTag
- **AdapterAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AdapterBaseModelRelation** _(eager)_
  - Then: Relation/link
- **AgentHandoffAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **AgentHandoffTargetRelation** _(eager)_
  - Then: Relation/link
- **AgentLoopAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **AgentLoopTagBundle** _(eager)_
  - Then: Tag/addTag
- **AgentRoleAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AgentRoleCapabilitiesProperty** _(eager)_
  - Then: Property/set
- **AgentTeamAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AgentTeamTagBundle** _(eager)_
  - Then: Tag/addTag
- **AssertionAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AssertionSeverityProperty** _(eager)_
  - Then: Property/set
- **BlackboardAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **BlackboardTagBundle** _(eager)_
  - Then: Tag/addTag
- **ConsensusAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ConsensusTagBundle** _(eager)_
  - Then: Tag/addTag
- **ConstitutionAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ConstitutionPrincipleCountProperty** _(eager)_
  - Then: Property/set
- **DocumentChunkAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **DocumentChunkParentRelation** _(eager)_
  - Then: Relation/link
- **EvaluationDatasetAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **EvaluationDatasetTagBundle** _(eager)_
  - Then: Tag/addTag
- **FewShotExamplePoolAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **FewShotExamplePoolTagBundle** _(eager)_
  - Then: Tag/addTag
- **LLMSignatureAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **LLMSignatureModuleTypeProperty** _(eager)_
  - Then: Property/set
- **ModelRouterAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ModelRouterRouteProperties** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **PromptAssemblyAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PromptAssemblyStrategyProperty** _(eager)_
  - Then: Property/set
- **PromptOptimizerAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **PromptOptimizerTagBundle** _(eager)_
  - Then: Tag/addTag
- **RetrieverAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **RetrieverTypeProperty** _(eager)_
  - Then: Property/set
- **SemanticRouterAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SemanticRouterThresholdProperty** _(eager)_
  - Then: Property/set
- **StateGraphAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **StateGraphSchemaProperty** _(eager)_
  - Then: Property/set
- **TrainingRunAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **TrainingRunBaseModelRelation** _(eager)_
  - Then: Relation/link
- **VectorIndexAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **VectorIndexDistanceMetricProperty** _(eager)_
  - Then: Property/set
- **NotificationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **NotificationTagBundle** _(eager)_
  - Then: Tag/addTag
- **NotificationChannelRelation** _(eager)_
  - Then: Relation/link
- **NotificationChannelAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **NotificationChannelType** _(eager)_
  - Then: Property/set
- **PluginProvidesForConcept** _(eager)_
  - Then: Relation/link
- **PluginRegistrationToSymbol** _(eager)_
  - Then: Symbol/register
- **PluginRegistrationToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PluginRegistrationTagBundle** _(eager)_
  - Then: Property/set
- **PluginTracksArtifact** _(eager)_
  - Then: Relation/link
- **ApprovalAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ApprovalStepRelation** _(eager)_
  - Then: Relation/link
- **CheckpointAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **CheckpointRunRelation** _(eager)_
  - Then: Relation/link
- **CompensationPlanAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **CompensationPlanStepRelation** _(eager)_
  - Then: Relation/link
- **ConnectorCallAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ConnectorCallStepRelation** _(eager)_
  - Then: Relation/link
- **EscalationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **EscalationRunRelation** _(eager)_
  - Then: Relation/link
- **LLMCallAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **LLMCallStepRelation** _(eager)_
  - Then: Relation/link
- **MilestoneAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **MilestoneRunRelation** _(eager)_
  - Then: Relation/link
- **ProcessEvaluationRunAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ProcessEvaluationRunStepRelation** _(eager)_
  - Then: Relation/link
- **ProcessRunAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ProcessRunSpecRelation** _(eager)_
  - Then: Relation/link
- **ProcessSpecAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ProcessSpecTagBundle** _(eager)_
  - Then: Tag/addTag
- **RetryPolicyAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **RetryPolicyMaxAttempts** _(eager)_
  - Then: Property/set
- **StepRunAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **StepRunParentRelation** _(eager)_
  - Then: Relation/link
- **ToolRegistryAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ToolRegistryToolType** _(eager)_
  - Then: Property/set
- **WebhookInboxAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **WebhookInboxEventType** _(eager)_
  - Then: Property/set
- **WorkItemAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **WorkItemStepRelation** _(eager)_
  - Then: Relation/link
- **ConceptBelongsToSuite** _(eager)_
  - Then: Relation/link
- **DerivedConceptComposesSource** _(eager)_
  - Then: Relation/link
- **SymbolRelationshipToRelation** _(eager)_
  - Then: Relation/link
- **SyncTriggeredByConcept** _(eager)_
  - Then: Relation/link
- **SyncInvokesConcept** _(eager)_
  - Then: Relation/link
- **CanvasAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **CanvasTagBundle** _(eager)_
  - Then: Tag/addTag
- **CollectionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **CollectionTagBundle** _(eager)_
  - Then: Tag/addTag
- **CommentAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **CommentRelation** _(eager)_
  - Then: Relation/link
- **ContentNodeAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ContentNodeTagBundle** _(eager)_
  - Then: Tag/addTag
- **ContentParserAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ContentParserPropertyBundle** _(eager)_
  - Then: Property/set
- **DataSourceAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **DataSourcePropertyBundle** _(eager)_
  - Then: Property/set
- **DisplayModeAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **DisplayModePropertyBundle** _(eager)_
  - Then: Property/set
- **EventBusAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **EventBusPropertyBundle** _(eager)_
  - Then: Property/set
- **ExposedFilterAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExposedFilterPropertyBundle** _(eager)_
  - Then: Property/set
- **ExpressionLanguageAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ExpressionLanguagePropertyBundle** _(eager)_
  - Then: Property/set
- **FormBuilderAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **FormBuilderPropertyBundle** _(eager)_
  - Then: Property/set
- **GraphAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **GraphTagBundle** _(eager)_
  - Then: Tag/addTag
- **IntentAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **IntentPropertyBundle** _(eager)_
  - Then: Property/set
- **MediaAssetAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **MediaAssetTagBundle** _(eager)_
  - Then: Tag/addTag
- **NamespaceAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **NamespaceTagBundle** _(eager)_
  - Then: Tag/addTag
- **OutlineAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **OutlineRelation** _(eager)_
  - Then: Relation/link
- **PageAsRecordAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **PageAsRecordTagBundle** _(eager)_
  - Then: Tag/addTag
- **PathautoAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **PathautoPropertyBundle** _(eager)_
  - Then: Property/set
- **SearchIndexAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SearchIndexPropertyBundle** _(eager)_
  - Then: Property/set
- **SyncedContentAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **SyncedContentRelation** _(eager)_
  - Then: Relation/link
- **TaxonomyAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **TaxonomyTagBundle** _(eager)_
  - Then: Tag/addTag
- **TypeSystemAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **TypeSystemPropertyBundle** _(eager)_
  - Then: Property/set
- **ValidatorAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ValidatorPropertyBundle** _(eager)_
  - Then: Property/set
- **VersionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **VersionRelation** _(eager)_
  - Then: Relation/link
- **ActionEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ActionEntityTagBundle** _(eager)_
  - Then: Property/set
- **ConceptEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ConceptEntityTagOrigin** _(eager)_
  - Then: Property/set
- **StateFieldToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **StateFieldTagBundle** _(eager)_
  - Then: Property/set
- **SyncEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SyncEntityTagBundle** _(eager)_
  - Then: Property/set
- **ThemeEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ThemeEntityTagBundle** _(eager)_
  - Then: Property/set
- **VariantEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **VariantEntityTagBundle** _(eager)_
  - Then: Property/set
- **WidgetEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **WidgetEntityTagBundle** _(eager)_
  - Then: Property/set
- **AnalysisRuleToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AnalysisRulePropertyBundle** _(eager)_
  - Then: Property/set
- **AnatomyPartEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **AnatomyPartEntityPropertyBundle** _(eager)_
  - Then: Property/set
- **ErrorCorrelationAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **ErrorCorrelationTagBundle** _(eager)_
  - Then: Tag/addTag
- **FileArtifactToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **FileArtifactPropertyBundle** _(eager)_
  - Then: Property/set
- **LanguageGrammarToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **LanguageGrammarPropertyBundle** _(eager)_
  - Then: Property/set
- **ScoreIndexToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **ScoreIndexPropertyBundle** _(eager)_
  - Then: Property/set
- **StructuralPatternToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **StructuralPatternPropertyBundle** _(eager)_
  - Then: Property/set
- **WidgetPropEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **WidgetPropEntityPropertyBundle** _(eager)_
  - Then: Property/set
- **WidgetStateEntityToConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **WidgetStateEntityPropertyBundle** _(eager)_
  - Then: Property/set
- **BinaryAssetToContentEntity** _(eager)_
  - Then: ContentStorage/save
- **BinaryAssetTagMimeType** _(eager)_
  - Then: Property/set
- **UnstructuredContentTracksReferences** _(eager)_
  - Then: Reference/addRef
- **UnstructuredContentTracksTags** _(eager)_
  - Then: Tag/addTag
- **UnstructuredToProgressiveSchema** _(eager)_
  - Then: ProgressiveSchema/observe
- **BranchAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **BranchOriginRelation** _(eager)_
  - Then: Relation/link
- **DiffProviderAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **DiffProviderContentTypesProperty** _(eager)_
  - Then: Property/set
- **MergeStrategyAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **MergeStrategyContentTypesProperty** _(eager)_
  - Then: Property/set
- **PatchAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **PatchBaseRelation** _(eager)_
  - Then: Relation/link
- **RefAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **RefTargetRelation** _(eager)_
  - Then: Relation/link
- **RetentionPolicyAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **RetentionPolicyPeriodProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **SchemaEvolutionAsConfigEntity** _(eager)_
  - Then: ContentStorage/save
- **SchemaEvolutionCompatibilityProperty** _(eager)_
  - Then: Property/set
  - Then: Property/set
- **TemporalVersionAsContentEntity** _(eager)_
  - Then: ContentStorage/save
- **TemporalVersionTimeProperties** _(eager)_
  - Then: Property/set
  - Then: Property/set

---

## extension
_v0.1.0_

> General-purpose extension and plugin support — lifecycle management, permissions, configuration, messaging, and contribution points. Host-agnostic coordination layer that routes to host-specific providers (browser, VSCode, Figma, etc.) via discriminator-based syncs. concepts: ExtensionManifest: spec: ./extension-manifest.concept params: M: { as: manifest, description: "Extension manifest declaration" } ExtensionHost: spec: ./extension-host.concept params: H: { as: extension, description: "Installed extension instance" } ContributionPoint: spec: ./contribution-point.concept params: C: { as: contribution-point, description: "Host contribution point" } ExtensionMessaging: spec: ./extension-messaging.concept params: E: { as: channel, description: "Messaging channel" } ExtensionPermission: spec: ./extension-permission.concept params: P: { as: permission, description: "Extension permission" } ExtensionStorage: spec: ./extension-storage.concept params: S: { as: store, description: "Per-extension storage instance" } ExtensionConfig: spec: ./extension-config.concept params: C: { as: config, description: "Per-extension configuration" } syncs: required: - path: ./syncs/required/host-register-on-install.sync description: "Extensions register with PluginRegistry on install" - path: ./syncs/required/permission-check-access.sync description: "Permission checks route through AccessControl for three-valued decisions" - path: ./syncs/required/manifest-validate.sync description: "Manifest registration triggers Validator schema validation" recommended: - path: ./syncs/recommended/config-cache-invalidate.sync description: "Config changes invalidate cached values in Cache" - path: ./syncs/recommended/host-lifecycle-event.sync description: "Lifecycle transitions dispatch events via EventBus" - path: ./syncs/recommended/host-unmount-on-deactivate.sync description: "Extension deactivation unmounts UI via Host" - path: ./syncs/recommended/contribution-widget-register.sync description: "Widget-type contributions route to Widget for rendering" - path: ./syncs/recommended/contribution-nav-register.sync description: "Navigation-type contributions route to Navigator for registration" - path: ./syncs/recommended/manifest-store-metadata.sync description: "Manifest metadata persisted to ContentStorage" - path: ./syncs/recommended/messaging-event-broadcast.sync description: "Message broadcasts dispatch through EventBus for observability" - path: ./syncs/recommended/permission-authorize.sync description: "Permission grants validated via Authorization role checks" - path: ./syncs/recommended/storage-persist.sync description: "ExtensionStorage writes persist to ContentStorage backend" - path: ./syncs/recommended/notification-on-install.sync description: "Extension install and update events trigger Notification" integration: - path: ./syncs/integration/route-host-to-browser.sync description: "Route ExtensionHost to BrowserExtensionHost when hostType is browser" - path: ./syncs/integration/route-permission-to-browser.sync description: "Route ExtensionPermission resolve to BrowserPermission when hostType is browser" - path: ./syncs/integration/route-manifest-export-browser.sync description: "Route ExtensionManifest export to BrowserManifestTarget when hostType is browser" uses: - suite: infrastructure concepts: - name: PluginRegistry - name: EventBus - name: Cache - name: Validator - suite: identity concepts: - name: Authorization - name: AccessControl - suite: foundation concepts: - name: ContentStorage - suite: notification concepts: - name: Notification - suite: surface-app concepts: - name: Host - name: Navigator - name: Widget

### Concepts

#### BackgroundWorker [W] `@gate`

> Service worker lifecycle for browser extensions. Gate concept because the browser can terminate and restart workers at any time — callers must handle the async resumption semantics. Manages alarm scheduling, idle state, and persistent state across worker restarts.

**Capabilities**: persistent-storage

**State**:
- `workers`
- `status`
- `alarms`
- `persistedState`
- `lastActive`

**Actions**:
- `register(extensionId, scriptUrl)` &rarr; ok | exists
- `start(worker)` &rarr; ok | notfound | error
- `stop(worker)` &rarr; ok | notfound
- `setAlarm(worker, name, delayMs, periodic)` &rarr; ok | notfound
- `clearAlarm(worker, name)` &rarr; ok | notfound
- `onAlarm(worker, name)` &rarr; ok | notfound
- `getStatus(worker)` &rarr; ok | notfound

#### BrowserAction [A]

> Toolbar button management for browser extensions. Controls per-tab badge text and color, icon, popup binding, enable/disable state, and context menu entries. Provides the primary user-facing touchpoint for browser extensions.

**State**:
- `actions`
- `extensionId`
- `badgeText`
- `badgeColor`
- `icon`
- `popupUrl`
- `enabled`
- `contextMenuEntries`

**Actions**:
- `configure(extensionId, icon, popupUrl)` &rarr; ok
- `setBadge(action, tabId, text, color)` &rarr; ok | notfound
- `setIcon(action, tabId, icon)` &rarr; ok | notfound
- `setPopup(action, popupUrl)` &rarr; ok | notfound
- `setEnabled(action, tabId, enabled)` &rarr; ok | notfound
- `addContextMenu(action, id, title, contexts)` &rarr; ok | notfound
- `removeContextMenu(action, id)` &rarr; ok | notfound
- `onClicked(action, tabId)` &rarr; ok | notfound

#### BrowserExtensionHost [B]

> Browser-specific provider for ExtensionHost. Manages service worker lifecycle, content script injection scheduling, tab URL matching, and browser event handling. Each browser vendor has slightly different lifecycle semantics; this concept normalizes them behind a single action surface.

**State**:
- `extensions`
- `status`
- `serviceWorkerState`
- `contentScripts`
- `tabMatches`

**Actions**:
- `activate(extension)` &rarr; ok | error
- `deactivate(extension)` &rarr; ok | notfound
- `injectContentScript(extension, tabId, scriptId)` &rarr; ok | notfound | forbidden
- `onTabUpdate(tabId, url, status)` &rarr; ok
- `onBrowserEvent(eventType, data)` &rarr; ok
- `getStatus(extension)` &rarr; ok | notfound

#### BrowserManifestTarget [T]

> Manifest.json generation coordination for browser extensions. Routes to per-browser providers (Chrome, Firefox, Safari, Edge) via the browser discriminator parameter. Handles common manifest fields and delegates vendor-specific sections to providers.

**State**:
- `targets`
- `browser`
- `manifestVersion`
- `output`

**Actions**:
- `generate(manifest, browser)` &rarr; ok | invalid | unsupported
- `validate(target)` &rarr; ok | notfound
- `diff(target, previousOutput)` &rarr; ok | notfound

#### BrowserPermission [B]

> Browser-specific provider for ExtensionPermission. Maps abstract permission identifiers to browser API permissions (tabs, storage, activeTab, scripting, etc.) with per-browser differences. Validates permission combinations and warns about store review implications.

**State**:
- `mappings`
- `abstractPermission`
- `browserPermissions`
- `browser`
- `storeWarnings`

**Actions**:
- `resolve(permission, browser)` &rarr; ok | unsupported
- `validate(permissions, browser)` &rarr; ok
- `listAvailable(browser)` &rarr; ok
- `getStoreWarnings(permissions, browser)` &rarr; ok

#### ChromeTarget [T]

> Chrome Manifest V3 manifest.json generation and Chrome Web Store packaging. Produces .crx and .zip artifacts for CWS submission. Handles Chrome-specific manifest fields (minimum_chrome_version, key, update_url) and Manifest V3 service worker declarations.

**State**:
- `targets`
- `manifestOutput`
- `packageOutput`

**Actions**:
- `generate(manifest, options)` &rarr; ok | invalid
- `package(target, format)` &rarr; ok | notfound | error
- `validate(target)` &rarr; ok | notfound

#### ContentScript [S]

> Content script management for browser extensions. Handles URL pattern matching, injection timing (document_idle, document_start, document_end), world isolation (MAIN vs ISOLATED), CSS injection, and bidirectional messaging between content scripts and the background worker.

**State**:
- `scripts`
- `urlPatterns`
- `runAt`
- `world`
- `cssFiles`
- `jsFiles`

**Actions**:
- `register(extensionId, urlPatterns, runAt, world, jsFiles, cssFiles)` &rarr; ok | invalid
- `inject(script, tabId)` &rarr; ok | notfound | forbidden
- `remove(script, tabId)` &rarr; ok | notfound
- `sendMessage(script, tabId, message)` &rarr; ok | notfound | timeout
- `listInjected(extensionId)` &rarr; ok

#### ContributionPoint [C]

> Extension points that a host exposes for extensions to contribute to: toolbar buttons, sidebar panels, commands, widgets, navigation destinations. Extensions register contributions; contributions route to downstream concepts via type-based syncs. Follows the coordination pattern — the host defines points, extensions contribute to them.

**State**:
- `points`
- `pointName`
- `pointType`
- `schema`
- `contributions`

**Actions**:
- `definePoint(name, pointType, schema)` &rarr; ok | exists
- `contribute(point, extensionId, data)` &rarr; ok | notfound | invalid
- `retract(point, extensionId)` &rarr; ok | notfound
- `listContributions(point)` &rarr; ok | notfound
- `listPoints(pointType)` &rarr; ok

#### EdgeTarget [T]

> Edge extension manifest generation and Edge Add-ons store packaging. Mostly Chrome-compatible with additional sideloading policy support and Edge-specific manifest fields. Handles enterprise sideloading configuration for managed deployments.

**State**:
- `targets`
- `manifestOutput`
- `packageOutput`
- `sideloadPolicy`

**Actions**:
- `generate(manifest, options)` &rarr; ok | invalid
- `package(target, format)` &rarr; ok | notfound | error
- `validate(target)` &rarr; ok | notfound

#### ExtensionConfig [C]

> Per-extension configuration with schema validation, defaults, and user overrides. Provides a typed configuration surface for extensions so hosts can render settings UI and validate changes. Independent of storage — persists via syncs to ExtensionStorage.

**State**:
- `configs`
- `extensionId`
- `schema`
- `defaults`
- `overrides`

**Actions**:
- `initialize(extensionId, schema, defaults)` &rarr; ok | exists | invalid
- `get(config, key)` &rarr; ok | notfound
- `set(config, key, value)` &rarr; ok | notfound | invalid
- `reset(config, key)` &rarr; ok | notfound
- `getSchema(config)` &rarr; ok | notfound
- `onChange(config, key, newValue, oldValue)` &rarr; ok | notfound
- `destroy(config)` &rarr; ok | notfound

#### ExtensionHost [H]

> Lifecycle coordination for extensions: install, activate, deactivate, uninstall, and error recovery. Routes to host-specific providers via the hostType discriminator, following the same coordination-provider pattern used by Runtime and PlatformAdapter.

**State**:
- `extensions`
- `status`
- `hostType`
- `activationConditions`
- `dependencies`
- `errorState`

**Actions**:
- `install(manifest, hostType)` &rarr; ok | exists | invalid
- `activate(extension)` &rarr; ok | notfound | error
- `deactivate(extension)` &rarr; ok | notfound
- `uninstall(extension)` &rarr; ok | notfound
- `getStatus(extension)` &rarr; ok | notfound
- `listInstalled(hostType)` &rarr; ok
- `handleError(extension, error)` &rarr; ok
- `determined(retry, deactivate, or uninstall depending on severity)` &rarr; notfound

##### PluginInstall [T] _(derived)_

> Coordinate extension installation by validating manifests, granting permissions, provisioning storage, and activating the host runtime.

**Composes**: ExtensionHost, ExtensionManifest, ExtensionPermission, ExtensionStorage
**Required syncs**: manifest-host-install, manifest-permission-declare, host-storage-provision, permission-activation-gate

**Surface**:
- `install` &rarr; ExtensionHost/install
- `activate` &rarr; ExtensionHost/activate
- `grantPermission` &rarr; ExtensionPermission/grant
- `uninstall` &rarr; ExtensionHost/uninstall

#### ExtensionManifest [M]

> Universal extension declaration: identity, entry points, required permissions, capabilities, contribution point registrations, and dependencies. Host-agnostic — the same manifest describes an extension regardless of deployment target. Export routes to host-specific targets via the hostType discriminator.

**State**:
- `manifests`
- `name`
- `version`
- `author`
- `entryPoints`
- `permissions`
- `capabilities`
- `contributions`
- `dependencies`

**Actions**:
- `register(name, version, author, entryPoints, permissions, capabilities)` &rarr; ok | exists
- `get(manifest)` &rarr; ok | notfound
- `update(manifest, fields)` &rarr; ok | notfound | invalid
- `export(manifest, hostType)` &rarr; ok | notfound | unsupported
- `listDependencies(manifest)` &rarr; ok | notfound
- `checkCompatibility(manifest, hostType)` &rarr; ok | notfound

#### ExtensionMessaging [E]

> Typed inter-extension and extension-to-host communication. Channels with schema validation support request/response, one-way, and broadcast patterns. Transport-independent — the messaging layer handles routing while transport adapters handle delivery.

**State**:
- `channels`
- `channelName`
- `schema`
- `subscribers`

**Actions**:
- `registerChannel(name, schema)` &rarr; ok | exists
- `send(channel, sender, payload)` &rarr; ok | notfound | invalid
- `request(channel, sender, payload)` &rarr; ok | notfound | timeout
- `respond(channel, requestId, payload)` &rarr; ok | notfound
- `broadcast(channel, sender, payload)` &rarr; ok | notfound
- `subscribe(channel, subscriber)` &rarr; ok | notfound | exists
- `unsubscribe(channel, subscriber)` &rarr; ok | notfound

#### ExtensionPermission [P]

> Declare and enforce extension permissions at runtime. Maps abstract permission identifiers to host-specific capabilities via provider routing. Delegates enforcement to Authorization and AccessControl via syncs. Follows the coordination-provider pattern — this concept coordinates, host-specific providers resolve.

**State**:
- `permissions`
- `name`
- `scope`
- `status`
- `extensionId`
- `grants`

**Actions**:
- `declare(extensionId, permission, scope)` &rarr; ok | exists
- `grant(permission)` &rarr; ok | notfound | forbidden
- `revoke(permission)` &rarr; ok | notfound
- `check(extensionId, permission)` &rarr; ok
- `resolve(permission, hostType)` &rarr; ok | notfound | unsupported
- `listGrants(extensionId)` &rarr; ok

#### ExtensionStorage [S]

> Per-extension isolated key-value store with quota management and optional cross-device sync. Distinguished from ContentStorage by scoping (per-extension isolation), quota enforcement, and sync semantics (extension data syncs with user profile, not content graph).

**Capabilities**: persistent-storage

**State**:
- `stores`
- `extensionId`
- `quotaUsed`
- `quotaLimit`
- `syncEnabled`

**Actions**:
- `provision(extensionId, quotaLimit, syncEnabled)` &rarr; ok | exists
- `set(store, key, value)` &rarr; ok | notfound | quotaExceeded
- `get(store, key)` &rarr; ok | notfound
- `remove(store, key)` &rarr; ok | notfound
- `clear(store)` &rarr; ok | notfound
- `getQuota(store)` &rarr; ok | notfound
- `sync(store)` &rarr; ok | notfound | disabled
- `destroy(store)` &rarr; ok | notfound

#### FirefoxTarget [T]

> Firefox-adapted manifest.json generation and AMO (addons.mozilla.org) packaging. Handles browser_specific_settings, gecko ID, browser.* namespace polyfill references, and .xpi artifact generation. Supports both Manifest V2 and V3 depending on Firefox version requirements.

**State**:
- `targets`
- `manifestOutput`
- `packageOutput`

**Actions**:
- `generate(manifest, options)` &rarr; ok | invalid
- `package(target, format)` &rarr; ok | notfound | error
- `validate(target)` &rarr; ok | notfound

#### SafariTarget [T]

> Safari Web Extension project generation. Produces an Xcode project wrapper with Info.plist, entitlements, and App Store packaging. Converts the universal manifest into Safari's web extension format and handles the native app container required by macOS/iOS.

**State**:
- `targets`
- `xcodeProject`
- `infoPlist`
- `entitlements`
- `packageOutput`

**Actions**:
- `generate(manifest, options)` &rarr; ok | invalid
- `package(target, format)` &rarr; ok | notfound | error
- `validate(target)` &rarr; ok | notfound

### Syncs

- **RouteManifestToChrome** _(eager)_
  - When: BrowserManifestTarget/generate
  - Then: ChromeTarget/generate
- **RouteManifestToEdge** _(eager)_
  - When: BrowserManifestTarget/generate
  - Then: EdgeTarget/generate
- **RouteManifestToFirefox** _(eager)_
  - When: BrowserManifestTarget/generate
  - Then: FirefoxTarget/generate
- **RouteManifestToSafari** _(eager)_
  - When: BrowserManifestTarget/generate
  - Then: SafariTarget/generate
- **CacheBadgeState** _(eager)_
  - When: BrowserAction/setBadge
  - Then: Cache/set
- **DispatchAlarmToWorker** _(eager)_
  - When: BackgroundWorker/setAlarm
  - Then: BackgroundWorker/onAlarm
- **CheckExtensionActiveBeforeInject** _(eager)_
  - When: ContentScript/inject
  - Then: BrowserExtensionHost/getStatus
- **RouteActivateToBrowser** _(eager)_
  - When: ExtensionHost/activate
  - Then: BrowserExtensionHost/activate
- **RouteDeactivateToBrowser** _(eager)_
  - When: ExtensionHost/deactivate
  - Then: BrowserExtensionHost/deactivate
- **RouteManifestExportToBrowser** _(eager)_
  - When: ExtensionManifest/export
  - Then: BrowserManifestTarget/generate
- **RoutePermissionResolveToBrowser** _(eager)_
  - When: ExtensionPermission/resolve
  - Then: BrowserPermission/resolve
- **InvalidateCacheOnConfigChange** _(eager)_
  - When: ExtensionConfig/set
  - Then: Cache/invalidate
- **RouteNavContribution** _(eager)_
  - When: ContributionPoint/contribute
  - Then: Navigator/register
- **RouteWidgetContribution** _(eager)_
  - When: ContributionPoint/contribute
  - Then: Widget/register
- **DispatchOnActivate** _(eager)_
  - When: ExtensionHost/activate
  - Then: EventBus/dispatch
- **DispatchOnDeactivate** _(eager)_
  - When: ExtensionHost/deactivate
  - Then: EventBus/dispatch
- **DispatchOnUninstall** _(eager)_
  - When: ExtensionHost/uninstall
  - Then: EventBus/dispatch
- **UnmountExtensionUIOnDeactivate** _(eager)_
  - When: ExtensionHost/deactivate
  - Then: Host/unmount
- **PersistManifestMetadata** _(eager)_
  - When: ExtensionManifest/register
  - Then: ContentStorage/save
- **BroadcastMessageToEventBus** _(eager)_
  - When: ExtensionMessaging/broadcast
  - Then: EventBus/dispatch
- **NotifyOnInstall** _(eager)_
  - When: ExtensionHost/install
  - Then: Notification/notify
- **AuthorizePermissionGrant** _(eager)_
  - When: ExtensionPermission/grant
  - Then: Authorization/checkPermission
- **PersistExtensionStorageWrite** _(eager)_
  - When: ExtensionStorage/set
  - Then: ContentStorage/save
- **ExtensionRegisterOnInstall** _(eager)_
  - When: ExtensionHost/install
  - Then: PluginRegistry/register
- **ValidateManifestOnRegister** _(eager)_
  - When: ExtensionManifest/register
  - Then: Validator/validate
- **PermissionCheckRouteToAccessControl** _(eager)_
  - When: ExtensionPermission/check
  - Then: AccessControl/check

### Dependencies

- **infrastructure**
- **identity**
- **foundation**
- **notification**
- **surface-app**

---

## formal-verification
_v0.1.0_

> Composable formal verification: properties, assume-guarantee contracts, proof evidence, verification runs, solver dispatch, and reusable specification templates. Publishes results to QualitySignal. concepts: FormalProperty: spec: ./formal-property.concept params: P: { as: property-id, description: "Formal property identifier" } Contract: spec: ./contract.concept params: C: { as: contract-id, description: "Assume-guarantee contract identifier" } Evidence: spec: ./evidence.concept params: E: { as: evidence-id, description: "Verification evidence identifier" } VerificationRun: spec: ./verification-run.concept params: V: { as: run-id, description: "Verification run identifier" } SolverProvider: spec: ./solver-provider.concept params: S: { as: solver-id, description: "Registered solver provider identifier" } SpecificationSchema: spec: ./specification-schema.concept params: SS: { as: schema-id, description: "Specification template identifier" } syncs: required: - path: ./syncs/verification-publishes-quality-signal.sync description: "VerificationRun/complete -> QualitySignal/record" - path: ./syncs/property-from-intent-principles.sync description: "Intent/define -> FormalProperty/synthesize" - path: ./syncs/solver-dispatch.sync description: "FormalProperty/check(solver: auto) -> SolverProvider/dispatch" - path: ./syncs/evidence-to-artifact.sync description: "Evidence/record -> Artifact/store" - path: ./syncs/run-records-evidence.sync description: "SolverProvider/dispatch -> Evidence/record + FormalProperty status" recommended: - path: ./syncs/contract-from-sync-definitions.sync name: ContractFromSyncDefinitions description: "SyncCompiler/compile -> Contract/define skeleton" - path: ./syncs/llm-synthesizes-property.sync name: LLMSynthesizesProperty description: "FormalProperty/synthesize -> AgentLoop/execute for remaining principles" - path: ./syncs/cegis-refinement-loop.sync name: CEGISRefinementLoop description: "FormalProperty/refute -> AgentLoop/execute for property refinement" - path: ./syncs/property-coverage-to-score.sync name: PropertyCoverageToScore description: "FormalProperty/coverage -> QualitySignal/record coverage info" - path: ./syncs/conformance-triggers-reverification.sync name: ConformanceTriggersReverification description: "Conformance/monitor specChanged -> FormalProperty/invalidate" uses: - suite: test concepts: - name: QualitySignal - suite: core concepts: - name: Intent - name: Schema - suite: infrastructure concepts: - name: PluginRegistry - name: Validator - suite: deploy optional: true concepts: - name: Artifact - suite: llm-agent optional: true concepts: - name: AgentLoop - suite: llm-core optional: true concepts: - name: LLMProvider widgets: - path: ./widgets/verification-status-badge.widget description: "Compact status indicator for verification outcomes (proved, refuted, unknown, timeout, running)" - path: ./widgets/formula-display.widget description: "Read-only renderer for formal logic expressions with syntax highlighting" - path: ./widgets/proof-session-tree.widget description: "Hierarchical tree view of verification run results by property" - path: ./widgets/trace-timeline-viewer.widget description: "Horizontal timeline visualization of verification trace data" - path: ./widgets/dag-viewer.widget description: "Directed acyclic graph viewer for property and contract dependencies" - path: ./widgets/status-grid.widget description: "Matrix grid displaying verification status across dimensions" - path: ./widgets/trace-step-controls.widget description: "Playback control toolbar for navigating trace steps" surface: entityAffordances: - concept: FormalProperty detail: formula-display inline: verification-status-badge - concept: VerificationRun detail: proof-session-tree inline: verification-status-badge - concept: Evidence detail: trace-timeline-viewer - concept: SolverProvider detail: status-grid - concept: Contract graph: dag-viewer

### Concepts

#### Contract [C]

> Assume-guarantee pair for compositional verification. Binds assumptions about environment concepts with guarantees of the subject concept. Enables modular reasoning: verify each concept against its contract independently, then compose via assumption discharge.

**State**:
- `contracts`
- `name`
- `source_concept`
- `target_concept`
- `assumptions`
- `guarantees`
- `compatibility_status`
- `composition_chain`

**Actions**:
- `define(name, source_concept, target_concept, assumptions, guarantees)` &rarr; ok | invalid
- `verify(contract)` &rarr; ok | incompatible
- `compose(contracts)` &rarr; ok | incompatible
- `discharge(contract, assumption_ref, evidence_ref)` &rarr; ok | notfound
- `list(source_concept, target_concept)` &rarr; ok

#### Evidence [E]

> Proof artifacts and verification results. Content-addressed for integrity. Stores proof certificates, counterexamples, model traces, coverage reports, and solver logs. Supports counterexample minimization.

**State**:
- `evidence`
- `artifact_type`
- `content_path`
- `content_hash`
- `solver_metadata`
- `solver_name`
- `solver_version`
- `theories_used`
- `resource_usage`
- `time_ms`
- `memory_mb`
- `solver_calls`
- `confidence_score`
- `property_ref`
- `created_at`

**Actions**:
- `record(artifact_type, content, solver_metadata, property_ref, confidence_score)` &rarr; ok | invalid
- `validate(evidence)` &rarr; ok | corrupted
- `retrieve(evidence)` &rarr; ok | notfound
- `compare(evidence1, evidence2)` &rarr; ok
- `minimize(evidence)` &rarr; ok | not_applicable
- `list(property_ref, artifact_type)` &rarr; ok

#### FormalProperty [P]

> Atomic formal claim about system behavior. Tracks proof status and links to Evidence artifacts. Kinds include invariant, precondition, postcondition, temporal, safety, and liveness. Properties target Clef symbols (concepts, actions, syncs).

**State**:
- `properties`
- `target_symbol`
- `kind`
- `property_text`
- `formal_language`
- `scope`
- `status`
- `ghost`
- `dependencies`
- `created_at`
- `updated_at`
- `author`
- `priority`

**Actions**:
- `define(target_symbol, kind, property_text, formal_language, scope, priority)` &rarr; ok | invalid
- `prove(property, evidence_ref)` &rarr; ok | notfound
- `refute(property, evidence_ref)` &rarr; ok | notfound
- `check(property, solver, timeout_ms)` &rarr; ok | timeout | unknown
- `synthesize(target_symbol, intent_ref)` &rarr; ok | invalid
- `coverage(target_symbol)` &rarr; ok
- `list(target_symbol, kind, status)` &rarr; ok
- `invalidate(property)` &rarr; ok | notfound

#### SolverProvider [S]

> Coordination concept dispatching verification requests to registered solver backends. Routes based on formal language, property kind, and solver capabilities. Follows the same coordination+provider pattern as ModelRouter in LLM kits.

**State**:
- `providers`
- `provider_id`
- `supported_languages`
- `supported_kinds`
- `capabilities`
- `status`
- `priority`

**Actions**:
- `register(provider_id, supported_languages, supported_kinds, capabilities, priority)` &rarr; ok | duplicate
- `dispatch(property_ref, formal_language, kind, timeout_ms)` &rarr; ok | no_provider
- `dispatch_batch(properties, timeout_ms)` &rarr; ok | partial
- `health_check(provider)` &rarr; ok | unavailable
- `list()` &rarr; ok
- `unregister(provider_id)` &rarr; ok | notfound

#### SpecificationSchema [SS]

> Reusable formal property templates following Dwyer specification patterns and domain-specific schemas. Enables property instantiation from parameterized templates, reducing the expertise barrier for writing formal specifications.

**State**:
- `schemas`
- `name`
- `category`
- `pattern_type`
- `template_text`
- `formal_language`
- `parameters`
- `name`
- `type`
- `description`
- `default_value`
- `examples`
- `parameter_values`
- `instantiated_text`

**Actions**:
- `define(name, category, pattern_type, template_text, formal_language, parameters)` &rarr; ok | invalid
- `instantiate(schema, parameter_values, target_symbol)` &rarr; ok | invalid
- `validate(schema, parameter_values)` &rarr; ok | invalid
- `list_by_category(category)` &rarr; ok
- `search(query)` &rarr; ok

#### VerificationRun [V] `@gate`

> Verification session lifecycle. Tracks which properties are checked, solver used, timeout budget, per-property results with evidence refs, and aggregate resource usage. Supports incremental verification and run comparison.

**State**:
- `runs`
- `target_symbol`
- `properties_checked`
- `solver_used`
- `timeout_ms`
- `status`
- `started_at`
- `ended_at`
- `results`
- `property_ref`
- `status`
- `evidence_ref`
- `duration_ms`
- `resource_usage`
- `total_time_ms`
- _(2 more fields)_

**Actions**:
- `start(target_symbol, properties, solver, timeout_ms)` &rarr; ok | invalid
- `complete(run, results, resource_usage)` &rarr; ok | notfound
- `timeout(run, partial_results)` &rarr; ok
- `cancel(run)` &rarr; ok
- `get_status(run)` &rarr; ok
- `compare(run1, run2)` &rarr; ok

### Derived Concepts

#### VerifiedConcept [T] _(derived)_

> Compose formal verification with concept implementation, ensuring all operational principles are formally verified before deployment. A VerifiedConcept is a concept whose Intent principles have been formalized as FormalProperties, bound by assume-guarantee Contracts at sync boundaries, and proved with solver-checked Evidence.

**Composes**: Schema, Intent, FormalProperty, Contract, Evidence, QualitySignal
**Required syncs**: property-from-intent-principles, verification-publishes-quality-signal, run-records-evidence

### Syncs

- **CegisRefinementLoop** _(eager)_
  - Then: AgentLoop/run
- **ConformanceTriggersReverification** _(lazy)_
  - Then: FormalProperty/invalidate
- **ContractFromSyncDefinitions** _(lazy)_
  - Then: Contract/define
- **EvidenceToArtifact** _(eager)_
  - Then: Artifact/store
- **LlmSynthesizesProperty** _(lazy)_
  - Then: AgentLoop/run
- **PropertyCoverageToScore** _(lazy)_
  - Then: QualitySignal/record
- **PropertyFromIntentPrinciples** _(eager)_
  - Then: FormalProperty/synthesize
- **RunRecordsEvidence** _(eager)_
  - Then: Evidence/record
- **SolverDispatch** _(eager)_
  - Then: SolverProvider/dispatch
- **VerificationPublishesQualitySignal** _(eager)_
  - Then: QualitySignal/record

### Dependencies

- **test**
- **core**
- **infrastructure**
- **deploy**
- **llm-agent**
- **llm-core**

---

## formal-verification-solvers
_v0.1.0_

> Solver provider implementations for the formal verification suite. Each provider registers with SolverProvider and handles translation to solver-specific input formats. providers: Z3Provider: spec: ./providers/z3-provider.provider optional: false CVC5Provider: spec: ./providers/cvc5-provider.provider optional: true AlloyProvider: spec: ./providers/alloy-provider.provider optional: false LeanProvider: spec: ./providers/lean-provider.provider optional: true DafnyProvider: spec: ./providers/dafny-provider.provider optional: true CertoraProvider: spec: ./providers/certora-provider.provider optional: true uses: - suite: formal-verification concepts: - name: SolverProvider - name: FormalProperty - name: Evidence - suite: infrastructure concepts: - name: PluginRegistry

### Dependencies

- **formal-verification**
- **infrastructure**

---

## foundation
_v0.1.0_

> "Universal primitives for all content systems — typed nodes, storage, outlines, properties, types, pages, parsing, and semantic intent."

### Concepts

#### ContentNode [N]

> Provide a universal typed, addressable unit of content. Every piece of data in the system is a ContentNode with a type, body, metadata, and timestamps.

**Capabilities**: persistent-storage

**State**:
- `nodes`
- `type`
- `content`
- `metadata`
- `createdAt`
- `updatedAt`
- `createdBy`

**Actions**:
- `create(node, type, content, createdBy)` &rarr; ok | exists
- `update(node, content)` &rarr; ok | notfound
- `delete(node)` &rarr; ok | notfound
- `get(node)` &rarr; ok | notfound
- `setMetadata(node, metadata)` &rarr; ok | notfound
- `changeType(node, type)` &rarr; ok | notfound

#### ContentParser [C]

> Parse text into structured data by extracting references, tags, properties, and embeds. Supports multiple formats and pluggable extractors for progressive formalization.

**State**:
- `formats`
- `extractors`
- `astCache`

**Actions**:
- `registerFormat(name, grammar)` &rarr; ok | exists
- `registerExtractor(name, pattern)` &rarr; ok | exists
- `parse(content, text, format)` &rarr; ok | error
- `extractRefs(content)` &rarr; ok | notfound
- `extractTags(content)` &rarr; ok | notfound
- `extractProperties(content)` &rarr; ok | notfound
- `serialize(content, format)` &rarr; ok | notfound

#### ContentStorage [R]

> Persist and retrieve content records via a pluggable backend. Abstracts storage from the content model, enabling backend portability across SQLite, PostgreSQL, file system, etc.

**Capabilities**: persistent-storage

**State**:
- `records`
- `data`
- `backend`
- `schemaMap`

**Actions**:
- `save(record, data)` &rarr; ok | error
- `load(record)` &rarr; ok | notfound
- `delete(record)` &rarr; ok | notfound
- `query(filter)` &rarr; ok
- `generateSchema(record)` &rarr; ok | notfound

#### Intent [I]

> Capture the semantic purpose, operational principles, and testable assertions for runtime-defined concepts. Enables AI-assisted concept discovery and documentation.

**State**:
- `intents`
- `purpose`
- `operationalPrinciple`
- `assertions`
- `target`

**Actions**:
- `define(intent, target, purpose, operationalPrinciple)` &rarr; ok | exists
- `update(intent, purpose, operationalPrinciple)` &rarr; ok | notfound
- `verify(intent)` &rarr; ok | notfound
- `discover(query)` &rarr; ok
- `suggestFromDescription(description)` &rarr; ok

#### Outline [O]

> Organize content into hierarchical trees with indentation, collapsing, and zooming. Enables outliner-style navigation where any node can become the root of a focused view.

**State**:
- `nodes`
- `parentOf`
- `childrenOf`
- `isCollapsed`
- `order`

**Actions**:
- `create(node, parent)` &rarr; ok | exists
- `indent(node)` &rarr; ok | notfound | invalid
- `outdent(node)` &rarr; ok | notfound | invalid
- `moveUp(node)` &rarr; ok | notfound
- `moveDown(node)` &rarr; ok | notfound
- `collapse(node)` &rarr; ok | notfound
- `expand(node)` &rarr; ok | notfound
- `reparent(node, newParent)` &rarr; ok | notfound
- `getChildren(node)` &rarr; ok | notfound

#### PageAsRecord [P]

> Bridge structured properties and unstructured body content within a single entity. A page has a schema defining typed fields plus a free-form body for rich content.

**Capabilities**: persistent-storage

**State**:
- `pages`
- `schema`
- `schemaProperties`
- `body`
- `collections`

**Actions**:
- `create(page, schema)` &rarr; ok | exists
- `setProperty(page, key, value)` &rarr; ok | notfound | invalid
- `getProperty(page, key)` &rarr; ok | notfound
- `appendToBody(page, content)` &rarr; ok | notfound
- `attachToSchema(page, schema)` &rarr; ok | notfound
- `convertFromFreeform(page, schema)` &rarr; ok | notfound

#### Property [P]

> Attach typed key-value metadata to content entities. Type definitions are managed by TypeSystem; Property queries TypeSystem for type info via PropertyTypeResolution sync.

**State**:
- `properties`
- `closedValues`

**Actions**:
- `set(entity, key, value)` &rarr; ok | invalid
- `get(entity, key)` &rarr; ok | notfound
- `delete(entity, key)` &rarr; ok | notfound
- `listAll(entity)` &rarr; ok

#### TypeSystem [T]

> Define self-describing type hierarchies with introspection and serialization. Types compose into complex structures with constraints. Validation is delegated to Validator via TypeConstraintRegistration sync.

**State**:
- `typeDefinitions`
- `schema`
- `constraints`
- `parent`

**Actions**:
- `registerType(type, schema, constraints)` &rarr; ok | exists
- `resolve(type)` &rarr; ok | notfound
- `navigate(type, path)` &rarr; ok | notfound
- `serialize(type, value)` &rarr; ok | notfound

### Syncs

- **PersistContentNode** _(eager)_
  - When: ContentNode/create
  - Then: ContentStorage/save
- **ParseOnCreate** _(eager)_
  - When: ContentNode/create
  - Then: ContentParser/parse
- **UpdateStorage** _(eager)_
  - When: ContentNode/update
  - Then: ContentStorage/save
- **DeleteFromStorage** _(eager)_
  - When: ContentNode/delete
  - Then: ContentStorage/delete
- **IntentFromSchema** _(eager)_
  - When: TypeSystem/registerType
  - Then: Intent/define
- **PropertyTypeResolution** _(eager)_
  - When: Property/set
  - Then: Validator/validate
- **ApplySchemaToPage** _(eager)_
  - When: PageAsRecord/create
  - Then: TypeSystem/validate
- **PropertyTypeCheck** _(eager)_
  - When: Property/set
  - Then: TypeSystem/validate
- **TypeConstraintRegistration** _(eager)_
  - When: TypeSystem/registerType
  - Then: Validator/registerConstraint

---

## governance-decision
_v0.1.0_

> "Proposal lifecycle, voting, and alternative decision mechanisms"

### Concepts

#### ApprovalCounting [AC]

> Allow each voter to approve any number of candidates, selecting the candidate with the most total approvals as the winner.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `maxApprovals`
- `winnerCount`

**Actions**:
- `configure(maxApprovals, winnerCount)` &rarr; configured
- `count(config, approvalSets, weights)` &rarr; winners | tie

#### BordaCount [BD]

> Assign points based on rank position in each voter's preference ordering, awarding N-1 points to the first choice, N-2 to the second, and so on, where N is the number of candidates.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `pointScheme`

**Actions**:
- `configure(pointScheme)` &rarr; configured
- `count(config, rankedBallots, weights)` &rarr; winner | tie

#### CondorcetSchulze [CS]

> Find the candidate who would win every pairwise comparison, using the Schulze method to resolve cycles in the pairwise preference graph.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `pairwiseMatrix`
- `strongestPaths`
- `smithSet`

**Actions**:
- `configure()` &rarr; configured
- `count(config, rankedBallots, weights)` &rarr; condorcet_winner | schulze_winner | unresolvable
- `getPairwiseMatrix(config)` &rarr; matrix

#### ConsentProcess [CP]

> Determine whether a proposal proceeds based on the absence of reasoned objections rather than affirmative majority support, following sociocratic consent-based decision making.

**Capabilities**: persistent-storage

**State**:
- `processes`
- `proposalRef`
- `status`
- `objections`
- `objector`
- `reason`
- `isParamount`
- `integrated`
- `amendments`

**Actions**:
- `initiate(proposalRef)` &rarr; initiated
- `advancePhase(process)` &rarr; advanced
- `raiseObjection(process, objector, reason, isParamount)` &rarr; objection_raised | wrong_phase
- `integrateObjection(process, objectionIndex, amendment)` &rarr; integrated
- `resolve(process)` &rarr; consented | blocked

#### Conviction [K] `@gate`

> Accumulate continuous support for proposals over time through token staking, replacing discrete voting with a continuous signal.

**Capabilities**: persistent-storage

**State**:
- `proposals`
- `proposalRef`
- `conviction`
- `threshold`
- `requestedFunds`
- `status`
- `stakes`
- `stakeProposal`
- `staker`
- `amount`
- `stakedAt`
- `halfLife`
- `minStake`

**Actions**:
- `registerProposal(proposalRef, requestedFunds, totalFunds)` &rarr; registered
- `stake(proposal, staker, amount)` &rarr; staked | below_minimum
- `unstake(proposal, staker)` &rarr; unstaked
- `updateConviction(proposal)` &rarr; accumulating | triggered

#### CountingMethod [C]

> Define how individual votes are aggregated into a collective outcome. Routes to pluggable provider implementations.

**Capabilities**: persistent-storage

**State**:
- `methods`
- `name`
- `provider`
- `parameters`
- `description`

**Actions**:
- `register(name, provider, parameters)` &rarr; registered | already_registered
- `aggregate(method, ballots, weights)` &rarr; winner | tie | no_quorum | provider_error
- `deregister(method)` &rarr; deregistered

#### Deliberation [DL]

> Structure asynchronous collective discussion with threaded conversation, argument mapping, and consensus signals.

**Capabilities**: persistent-storage

**State**:
- `threads`
- `proposalRef`
- `status`
- `entries`
- `author`
- `content`
- `timestamp`
- `parentEntry`
- `entryType`
- `signals`
- `signaller`
- `signal`
- `timestamp`

**Actions**:
- `open(proposalRef)` &rarr; opened
- `addEntry(thread, author, content, entryType, parentEntry)` &rarr; added | closed
- `signal(thread, signaller, signal)` &rarr; signalled
- `close(thread)` &rarr; closed

#### Majority [MJ]

> Determine a winner by simple majority of weighted votes, the unique anonymous, neutral, and monotone rule for binary decisions per May's theorem.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `threshold`
- `binaryOnly`
- `tieBreaker`

**Actions**:
- `configure(threshold, binaryOnly, tieBreaker)` &rarr; configured
- `count(config, ballots, weights)` &rarr; winner | tie | no_majority

#### Meeting [MT]

> Structure synchronous collective discussion with formal procedure, agenda management, and motion handling.

**Capabilities**: persistent-storage

**State**:
- `meetings`
- `title`
- `agenda`
- `itemTitle`
- `itemType`
- `presenter`
- `attendees`
- `phase`
- `motionStack`
- `motionText`
- `motionType`
- `mover`
- `seconder`
- `motionStatus`
- `minutes`
- _(2 more fields)_

**Actions**:
- `schedule(title, agenda)` &rarr; scheduled
- `callToOrder(meeting, chair)` &rarr; called
- `makeMotion(meeting, mover, motionType, text)` &rarr; moved | out_of_order
- `secondMotion(meeting, seconder, motionIndex)` &rarr; seconded
- `callQuestion(meeting)` &rarr; question_called
- `recordMinute(meeting, record)` &rarr; recorded
- `adjourn(meeting)` &rarr; adjourned

#### OptimisticApproval [O] `@gate`

> Assume decisions are approved unless challenged within a dispute window, enabling efficient governance with safety guarantees.

**Capabilities**: persistent-storage

**State**:
- `assertions`
- `asserter`
- `payload`
- `bond`
- `challengePeriod`
- `createdAt`
- `expiresAt`
- `status`
- `challenger`
- `challengerBond`

**Actions**:
- `assert(asserter, payload, bond, challengePeriodHours)` &rarr; asserted
- `challenge(assertion, challenger, bond, evidence)` &rarr; challenged | expired | already_challenged
- `finalize(assertion)` &rarr; approved | still_pending | is_challenged
- `resolve(assertion, outcome)` &rarr; approved | rejected

#### PredictionMarket [PM] `@gate`

> Aggregate information about expected outcomes through speculative trading, enabling belief-based governance decisions.

**Capabilities**: persistent-storage

**State**:
- `markets`
- `question`
- `outcomes`
- `status`
- `createdAt`
- `deadline`
- `resolvedOutcome`
- `positions`
- `posMarket`
- `trader`
- `outcome`
- `shares`
- `prices`
- `priceMarket`
- `priceOutcome`
- _(1 more fields)_

**Actions**:
- `createMarket(question, outcomes, deadline)` &rarr; created
- `trade(market, trader, outcome, amount)` &rarr; traded | market_closed | invalid_outcome
- `resolve(market, outcome)` &rarr; resolved | already_resolved
- `claimPayout(market, trader)` &rarr; payout | no_winnings | not_resolved

#### Proposal [P]

> Formalize a request for collective decision and track it through a governance lifecycle.

**Capabilities**: persistent-storage

**State**:
- `proposals`
- `proposer`
- `title`
- `description`
- `actions`
- `status`
- `sponsor`
- `createdAt`
- `updatedAt`
- `metadata`

**Actions**:
- `create(proposer, title, description, actions)` &rarr; created | invalid
- `sponsor(proposal, sponsorId)` &rarr; sponsored | not_pending
- `activate(proposal)` &rarr; activated
- `advance(proposal, newStatus)` &rarr; advanced | invalid_transition
- `cancel(proposal, canceller)` &rarr; cancelled | unauthorized | not_cancellable

#### QuadraticVoting [QV]

> Allow participants to express intensity of preference by purchasing votes at quadratic cost, so casting N votes on an issue costs N² credits from a finite budget.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `creditBudget`
- `balances`
- `voter`
- `remaining`
- `spent`
- `issue`
- `votesCast`
- `creditsSpent`

**Actions**:
- `configure(creditBudget)` &rarr; configured
- `allocateCredits(config, voter)` &rarr; allocated | already_allocated
- `castVotes(config, voter, issue, numberOfVotes)` &rarr; cast | insufficient_credits | no_allocation
- `count(config, issue)` &rarr; winner | tie

#### Quorum [Q]

> Ensure minimum participation before a governance decision is valid.

**Capabilities**: persistent-storage

**State**:
- `rules`
- `thresholdType`
- `thresholdValue`
- `totalEligible`

**Actions**:
- `setThreshold(thresholdType, value)` &rarr; set
- `check(totalVotes, totalEligible)` &rarr; met | not_met
- `updateThreshold(rule, newType, newValue)` &rarr; updated | not_found

#### RankedChoice [RC]

> Elect a winner through iterative elimination of the candidate with fewest first-preference votes, transferring those votes to the next preference on each ballot.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `eliminationMethod`
- `seats`
- `rounds`
- `roundNumber`
- `eliminated`
- `voteCounts`
- `transfers`

**Actions**:
- `configure(eliminationMethod, seats)` &rarr; configured
- `count(config, rankedBallots, weights)` &rarr; winner | exhausted
- `getRoundDetail(config, roundNumber)` &rarr; detail | not_found

#### ScoreVoting [SV]

> Allow voters to assign a numeric score to each candidate within a defined range, selecting the candidate with the highest average or total weighted score.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `minScore`
- `maxScore`
- `aggregation`

**Actions**:
- `configure(minScore, maxScore, aggregation)` &rarr; configured | invalid_range
- `count(config, scoreBallots, weights)` &rarr; winner | tie

#### Supermajority [SM]

> Require a heightened threshold of support beyond simple majority, typically used for constitutional amendments, irreversible actions, or high-stakes governance decisions.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `threshold`
- `roundingMode`
- `abstentionsCount`

**Actions**:
- `configure(threshold, roundingMode, abstentionsCount)` &rarr; configured | invalid_threshold
- `count(config, ballots, weights)` &rarr; winner | insufficient

#### Vote [V]

> Collect individual preferences on a proposal within a time window and determine an outcome.

**Capabilities**: persistent-storage

**State**:
- `votes`
- `proposalRef`
- `voter`
- `choice`
- `weight`
- `castAt`
- `sessions`
- `sessionProposal`
- `deadline`
- `status`
- `snapshotRef`
- `outcome`

**Actions**:
- `openSession(proposalRef, deadline, snapshotRef)` &rarr; opened
- `castVote(session, voter, choice, weight)` &rarr; recorded | already_voted | session_closed | not_eligible
- `close(session)` &rarr; closed | already_closed
- `tally(session)` &rarr; result | not_closed

---

## governance-execution
_v0.1.0_

> "Decision execution, safety delays, guards, finality, and minority exit"

### Concepts

#### BFTFinality [BF] `@gate`

> Achieve deterministic finality through Byzantine Fault Tolerant committee consensus, providing immediate irreversibility once a quorum of validators agrees.

**Capabilities**: persistent-storage, network

**State**:
- `committees`
- `validators`
- `faultTolerance`
- `protocol`
- `rounds`
- `roundNumber`
- `proposer`
- `status`
- `votes`
- `finalized`
- `operationRef`
- `round`
- `finalizedAt`

**Actions**:
- `configureCommittee(validators, faultTolerance, protocol)` &rarr; configured
- `proposeFinality(committee, operationRef, proposer)` &rarr; proposed
- `vote(committee, roundNumber, validator, approve)` &rarr; voted | not_validator
- `checkConsensus(committee, roundNumber)` &rarr; finalized | insufficient | byzantine_detected

#### ChainFinality [CF] `@gate`

> Track block-level finality on a blockchain, confirming governance operations only when the underlying transaction achieves irreversible consensus.

**Capabilities**: persistent-storage, network

**State**:
- `tracked`
- `operationRef`
- `txHash`
- `chainId`
- `submittedBlock`
- `finalizedBlock`
- `status`
- `requiredConfirmations`

**Actions**:
- `track(operationRef, txHash, chainId, requiredConfirmations)` &rarr; tracking
- `checkFinality(entry)` &rarr; pending

#### Execution [EX]

> Carry out approved governance decisions by performing authorized actions atomically.

**Capabilities**: persistent-storage

**State**:
- `executions`
- `sourceRef`
- `actions`
- `target`
- `operation`
- `params`
- `executor`
- `status`
- `executedAt`
- `result`

**Actions**:
- `schedule(sourceRef, actions, executor)` &rarr; scheduled
- `execute(execution)` &rarr; completed | failed | unauthorized
- `rollback(execution)` &rarr; rolled_back | not_reversible

#### FinalityGate [FG] `@gate`

> Wrap external finality signals as concept state, allowing downstream governance sync chains to branch on finalization status.

**Capabilities**: persistent-storage

**State**:
- `gates`
- `operationRef`
- `provider`
- `status`
- `submittedAt`
- `finalizedAt`
- `metadata`

**Actions**:
- `submit(operationRef, provider)` &rarr; submitted
- `confirm(gate)` &rarr; finalized | reorged | disputed | timeout

#### Guard [GD]

> Apply pre-execution and post-execution checks to governance actions, providing safety constraints without modifying action logic.

**Capabilities**: persistent-storage

**State**:
- `guards`
- `name`
- `checkType`
- `condition`
- `targetAction`
- `enabled`

**Actions**:
- `register(name, checkType, condition, targetAction)` &rarr; registered
- `checkPre(guard, context)` &rarr; passed | blocked
- `checkPost(guard, context, result)` &rarr; passed | revert
- `enable(guard)` &rarr; enabled
- `disable(guard)` &rarr; disabled

#### ImmediateFinality [IF]

> Provide instant finality confirmation for governance operations in centralized or trusted environments where no external consensus is required.

**State**:
- `confirmations`
- `operationRef`
- `confirmedAt`

**Actions**:
- `confirm(operationRef)` &rarr; finalized

#### OptimisticOracleFinality [OO] `@gate`

> Achieve finality through optimistic assertion with a dispute window, where operations are considered final unless successfully challenged within a defined period.

**Capabilities**: persistent-storage

**State**:
- `assertions`
- `operationRef`
- `asserter`
- `bond`
- `challengeWindowHours`
- `assertedAt`
- `expiresAt`
- `status`
- `disputeRef`

**Actions**:
- `assertFinality(operationRef, asserter, bond, challengeWindowHours)` &rarr; asserted
- `challenge(assertion, challenger, bond, evidence)` &rarr; challenged | expired
- `resolve(assertion, validAssertion)` &rarr; finalized | rejected
- `checkExpiry(assertion)` &rarr; finalized | still_pending

#### RageQuit [RQ]

> Allow dissenting participants to withdraw proportional assets and exit before a contested decision executes.

**Capabilities**: persistent-storage

**State**:
- `exits`
- `member`
- `sharesToBurn`
- `totalShares`
- `claims`
- `token`
- `amount`
- `status`
- `initiatedAt`

**Actions**:
- `initiate(member, sharesToBurn)` &rarr; initiated | insufficient_shares | window_closed
- `calculateClaim(exit, treasuryBalances)` &rarr; calculated
- `claim(exit)` &rarr; claimed | not_calculated

#### Timelock [TL] `@gate`

> Enforce a delay between governance decision and execution so stakeholders can react.

**Capabilities**: persistent-storage

**State**:
- `locks`
- `operationHash`
- `payload`
- `eta`
- `gracePeriod`
- `status`
- `queuedAt`

**Actions**:
- `schedule(operationHash, payload, delayHours, gracePeriodHours)` &rarr; queued
- `execute(lock)` &rarr; executed | too_early | expired | already_executed
- `cancel(lock)` &rarr; cancelled | not_cancellable

---

## governance-identity
_v0.1.0_

> "Identity, access control, and participant management for governance systems"

### Concepts

#### AgenticDelegate [D]

> Represent an LLM or autonomous agent as a governance participant with defined boundaries, capabilities, and accountability.

**Capabilities**: persistent-storage

**State**:
- `delegates`
- `agentType`
- `systemPrompt`
- `boundaries`
- `activeRoles`
- `principal`
- `autonomyLevel`
- `actionLog`
- `action`
- `timestamp`
- `outcome`

**Actions**:
- `register(agentType, principal, systemPrompt, boundaries)` &rarr; registered
- `assumeRole(delegate, roleId)` &rarr; role_assumed | boundary_violation | not_found
- `releaseRole(delegate, roleId)` &rarr; role_released
- `proposeAction(delegate, action, justification)` &rarr; proposed
- `escalate(delegate, reason)` &rarr; escalated
- `updateAutonomy(delegate, level)` &rarr; updated | unauthorized

#### Attestation [A]

> Make verifiable claims about participants' attributes, credentials, or identity.

**Capabilities**: persistent-storage, crypto

**State**:
- `attestations`
- `schema`
- `attester`
- `recipient`
- `data`
- `createdAt`
- `expiry`
- `revoked`

**Actions**:
- `attest(schema, attester, recipient, data, expiry)` &rarr; created
- `revoke(attestation, revoker)` &rarr; revoked | not_found | unauthorized
- `verify(attestation)` &rarr; valid | expired | revoked_status | not_found

#### AttestationSybil [AS]

> Verify participant uniqueness through credentials issued by trusted attesters, bridging external identity systems into governance.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `requiredSchemas`
- `trustedAttesters`
- `verificationCache`
- `participant`
- `attestationRef`
- `verifiedAt`

**Actions**:
- `configure(requiredSchemas, trustedAttesters)` &rarr; configured
- `checkParticipant(config, participant, attestationRef)` &rarr; verified | untrusted_attester | wrong_schema | invalid_attestation

#### Membership [M]

> Track who belongs to a governance body and enforce entry/exit rules.

**Capabilities**: persistent-storage, re-evaluation

**State**:
- `members`
- `status`
- `joinedAt`
- `joinRules`
- `exitRules`
- `evidence`
- `metadata`
- `displayName`
- `identityRef`

**Actions**:
- `join(candidate, evidence)` &rarr; accepted | rejected | already_member
- `leave(member)` &rarr; left | not_member
- `suspend(member, reason)` &rarr; suspended | not_member
- `reinstate(member)` &rarr; reinstated | not_suspended
- `kick(member, reason)` &rarr; removed | not_member
- `updateRules(joinRules, exitRules)` &rarr; updated

#### Permission [P]

> Control which identities can perform which actions on which targets, with optional conditions.

**Capabilities**: persistent-storage

**State**:
- `grants`
- `who`
- `where`
- `what`
- `condition`
- `granted`
- `grantedAt`
- `grantedBy`

**Actions**:
- `grant(who, where, what, condition, grantedBy)` &rarr; granted | already_granted
- `revoke(permission)` &rarr; revoked | not_found
- `check(who, where, what)` &rarr; allowed | denied

#### ProofOfPersonhood [PP]

> Verify that a governance participant represents a unique biological human through biometric, physical, or ceremony-based proof.

**Capabilities**: persistent-storage, crypto

**State**:
- `verifications`
- `participant`
- `method`
- `verifiedAt`
- `expiresAt`
- `verifier`
- `proofHash`

**Actions**:
- `verify(participant, method, proofHash, verifier, expiryDays)` &rarr; verified | invalid_proof | already_verified
- `checkStatus(participant)` &rarr; valid | expired | not_verified
- `revoke(participant, reason)` &rarr; revoked

#### Role [R]

> Assign named capacities with defined permissions to participants.

**Capabilities**: persistent-storage

**State**:
- `roles`
- `name`
- `purpose`
- `permissions`
- `holders`
- `hierarchy`
- `termExpiry`
- `maxHolders`

**Actions**:
- `create(role, name, purpose, permissions)` &rarr; created | already_exists
- `assign(role, holder)` &rarr; assigned | not_found | full
- `revoke(role, holder)` &rarr; revoked | not_assigned
- `check(holder, permission)` &rarr; allowed | denied
- `dissolve(role)` &rarr; dissolved | not_found

#### SocialGraphVerification [SG]

> Detect sybil identities by analyzing the vouching graph between participants, identifying clusters that are weakly connected to the trusted core.

**Capabilities**: persistent-storage

**State**:
- `vouches`
- `voucher`
- `vouchee`
- `vouchedAt`
- `minVouches`
- `trustAnchors`
- `clusterThreshold`

**Actions**:
- `configure(minVouches, trustAnchors, clusterThreshold)` &rarr; configured
- `vouch(voucher, vouchee)` &rarr; vouched | self_vouch | already_vouched
- `analyze(participant)` &rarr; trusted | suspicious | insufficient_vouches
- `revokeVouch(voucher, vouchee)` &rarr; revoked

#### StakeThreshold [ST]

> Deter sybil attacks by requiring a minimum capital deposit to participate in governance, making identity duplication costly.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `minimumStake`
- `slashOnViolation`
- `deposits`
- `participant`
- `amount`
- `depositedAt`

**Actions**:
- `configure(minimumStake, slashOnViolation)` &rarr; configured
- `deposit(config, participant, amount)` &rarr; deposited | insufficient
- `checkEligibility(config, participant)` &rarr; eligible | ineligible
- `slash(config, participant, reason)` &rarr; slashed | slashing_disabled

#### SybilResistance [S]

> Ensure each real participant has at most one governance identity.

**Capabilities**: persistent-storage

**State**:
- `verified`
- `method`
- `verifiedAt`
- `challenges`
- `challengeTarget`
- `challengeStatus`
- `challenger`

**Actions**:
- `verify(candidate, method, evidence)` &rarr; verified | rejected | already_verified
- `challenge(targetId, challenger, evidence)` &rarr; challenge_opened | invalid_target
- `resolveChallenge(challengeId, outcome)` &rarr; upheld | overturned | not_found

---

## governance-resources
_v0.1.0_

> "Treasury management, reputation, metrics, objectives, and token economics"

### Concepts

#### BondingCurve [BC]

> Manage automated token pricing and continuous funding through a programmatic supply-price relationship.

**Capabilities**: persistent-storage, crypto

**State**:
- `curves`
- `name`
- `curveType`
- `parameters`
- `currentSupply`
- `reserveBalance`
- `reserveToken`
- `frictionFee`

**Actions**:
- `create(name, curveType, parameters, reserveToken, frictionFee)` &rarr; created
- `buy(curve, buyer, reserveAmount)` &rarr; minted
- `sell(curve, seller, tokenAmount)` &rarr; burned | insufficient_tokens
- `getPrice(curve)` &rarr; price

#### EloRating [EL]

> Maintain pairwise comparison-based skill ratings for governance participants, updating ratings after interactions based on expected versus actual outcomes.

**Capabilities**: persistent-storage

**State**:
- `ratings`
- `participant`
- `rating`
- `gamesPlayed`
- `kFactor`
- `initialRating`
- `kFactorDecay`

**Actions**:
- `configure(kFactor, initialRating, kFactorDecay)` &rarr; configured
- `recordOutcome(config, winner, loser)` &rarr; updated
- `recordDraw(config, participantA, participantB)` &rarr; updated
- `getRating(config, participant)` &rarr; rating | unrated

#### GlickoRating [GL]

> Extend Elo with a rating deviation (uncertainty) dimension that increases during inactivity and decreases with activity, enabling governance systems to discount influence from inactive participants.

**Capabilities**: persistent-storage

**State**:
- `ratings`
- `participant`
- `rating`
- `deviation`
- `volatility`
- `lastActive`
- `initialRating`
- `initialDeviation`
- `initialVolatility`
- `inactivityGrowthRate`

**Actions**:
- `configure(initialRating, initialDeviation, initialVolatility, inactivityGrowthRate)` &rarr; configured
- `recordOutcome(config, participant, opponent, outcome)` &rarr; updated
- `applyInactivityDecay(config, participant, daysSinceActive)` &rarr; decayed
- `getReliableWeight(config, participant)` &rarr; weight

#### Metric [ME]

> Track measurable values with thresholds, enabling KPI-based governance triggers and performance monitoring.

**Capabilities**: persistent-storage

**State**:
- `metrics`
- `name`
- `value`
- `unit`
- `source`
- `thresholds`
- `level`
- `operator`
- `value`
- `history`
- `value`
- `timestamp`
- `updatedAt`

**Actions**:
- `define(name, unit, source)` &rarr; defined
- `update(metric, value)` &rarr; updated | threshold_crossed
- `setThreshold(metric, level, operator, value)` &rarr; threshold_set
- `evaluate(metric)` &rarr; within_bounds | threshold_breached

#### Objective [OB]

> Define organizational goals linked to measurable metrics, enabling OKR/Balanced-Scorecard governance patterns.

**Capabilities**: persistent-storage

**State**:
- `objectives`
- `title`
- `description`
- `owner`
- `metricRefs`
- `targetValues`
- `metricRef`
- `target`
- `deadline`
- `status`
- `progress`

**Actions**:
- `create(title, description, owner, targets)` &rarr; created
- `updateProgress(objective, metricRef, currentValue)` &rarr; progressed | achieved
- `evaluate(objective)` &rarr; on_track | at_risk | missed
- `cancel(objective)` &rarr; cancelled

#### PageRankReputation [PR]

> Compute reputation by applying PageRank to a directed contribution graph, where endorsements and interactions propagate trust through the network.

**Capabilities**: persistent-storage

**State**:
- `graphs`
- `edges`
- `source`
- `target`
- `weight`
- `scores`
- `participant`
- `score`
- `dampingFactor`
- `maxIterations`
- `convergenceThreshold`
- `preTrusted`

**Actions**:
- `configure(dampingFactor, maxIterations, convergenceThreshold, preTrusted)` &rarr; configured
- `addEdge(graph, source, target, weight)` &rarr; added
- `removeEdge(graph, source, target)` &rarr; removed
- `compute(graph)` &rarr; computed
- `getScore(graph, participant)` &rarr; score | not_in_graph

#### PeerAllocation [PA]

> Compute reputation through periodic peer-to-peer allocation rounds where participants distribute a limited budget of recognition tokens to colleagues based on perceived value.

**Capabilities**: persistent-storage

**State**:
- `rounds`
- `roundStatus`
- `deadline`
- `budget`
- `allocations`
- `allocator`
- `recipient`
- `amount`
- `note`
- `results`
- `participant`
- `received`
- `givers`

**Actions**:
- `openRound(budget, deadlineDays)` &rarr; opened
- `allocate(round, allocator, recipient, amount, note)` &rarr; allocated | budget_exceeded | self_allocation | round_closed
- `finalize(round)` &rarr; finalized

#### Reputation [RP]

> Track accumulated standing based on contributions and behavior, with pluggable algorithms for score computation.

**Capabilities**: persistent-storage

**State**:
- `scores`
- `participant`
- `score`
- `algorithm`
- `history`
- `action`
- `delta`
- `reason`
- `timestamp`
- `decayRate`
- `lastDecay`

**Actions**:
- `earn(participant, amount, reason)` &rarr; earned
- `burn(participant, amount, reason)` &rarr; burned | insufficient
- `decay()` &rarr; decayed | no_decay_configured
- `getScore(participant)` &rarr; score | not_found
- `recalculate(participant)` &rarr; recalculated

#### SimpleAccumulator [SA]

> Compute reputation as a running sum of earned and burned increments, with optional time-based exponential decay.

**State**:
- `configurations`
- `decayHalfLifeDays`
- `initialScore`
- `minScore`
- `maxScore`

**Actions**:
- `configure(decayHalfLifeDays, initialScore, minScore, maxScore)` &rarr; configured
- `compute(config, currentScore, delta, daysSinceLastUpdate)` &rarr; score

#### Treasury [TR]

> Manage collective assets and resource allocation, ensuring withdrawals are authorized through governance actions.

**Capabilities**: persistent-storage

**State**:
- `vaults`
- `name`
- `balances`
- `token`
- `amount`
- `allocations`
- `proposalRef`
- `token`
- `amount`
- `status`

**Actions**:
- `deposit(vault, token, amount, depositor)` &rarr; deposited
- `withdraw(vault, token, amount, recipient, sourceRef)` &rarr; withdrawn
- `allocate(vault, proposalRef, token, amount)` &rarr; allocated | insufficient_funds
- `releaseAllocation(vault, proposalRef)` &rarr; released

---

## governance-rules
_v0.1.0_

> "Policy encoding, compliance monitoring, sanctions, and dispute resolution"

### Concepts

#### ADICOEvaluator [AE]

> Evaluate governance policies encoded in ADICO institutional grammar, parsing Attributes-Deontic-aIm-Conditions-OrElse statements into executable compliance checks.

**Capabilities**: persistent-storage

**State**:
- `parsedRules`
- `sourceText`
- `parsedAttributes`
- `parsedDeontic`
- `parsedAim`
- `parsedConditions`
- `parsedOrElse`
- `parseErrors`

**Actions**:
- `parse(ruleText)` &rarr; parsed | parse_error
- `evaluate(rule, context)` &rarr; permitted | required | forbidden | not_applicable

#### CedarEvaluator [CE]

> Evaluate governance policies written in Cedar (AWS) with formal verification support, enabling provable properties about permit/forbid compositions before deployment.

**Capabilities**: persistent-storage

**State**:
- `policyStores`
- `policies`
- `policyId`
- `effect`
- `principal`
- `action`
- `resource`
- `conditions`
- `schema`
- `verificationResults`

**Actions**:
- `loadPolicies(policies, schema)` &rarr; loaded | validation_error
- `authorize(store, principal, action, resource, context)` &rarr; allow | deny
- `verify(store, property)` &rarr; verified | counterexample

#### CustomEvaluator [CU]

> Evaluate governance policies defined as user-authored predicate functions, providing maximum flexibility for domain-specific governance rules.

**Capabilities**: persistent-storage

**State**:
- `functions`
- `name`
- `source`
- `language`
- `sandbox`
- `lastEvaluation`

**Actions**:
- `register(name, source, language, sandbox)` &rarr; registered | syntax_error
- `evaluate(evaluator, context)` &rarr; result | runtime_error | timeout
- `deregister(evaluator)` &rarr; deregistered

#### Dispute [DS] `@gate`

> Provide a process for challenging governance decisions and resolving conflicts through structured arbitration.

**Capabilities**: persistent-storage

**State**:
- `disputes`
- `challenger`
- `respondent`
- `subject`
- `status`
- `evidence`
- `submitter`
- `content`
- `timestamp`
- `resolution`
- `bond`
- `createdAt`

**Actions**:
- `open(challenger, respondent, subject, evidence, bond)` &rarr; opened
- `submitEvidence(dispute, submitter, content)` &rarr; submitted | not_open
- `arbitrate(dispute, arbiter, resolution)` &rarr; resolved
- `appeal(dispute, appellant, reason)` &rarr; appealed | not_resolved | appeal_limit_reached

#### Monitor [MN]

> Observe participant behavior and system state, producing compliance assessments against governance policies.

**Capabilities**: persistent-storage

**State**:
- `observers`
- `subject`
- `ruleRef`
- `status`
- `observations`
- `behavior`
- `timestamp`
- `assessment`

**Actions**:
- `watch(subject, ruleRef)` &rarr; watching
- `observe(observer, behavior)` &rarr; compliant | violation
- `resolve(observer)` &rarr; resolved

#### Policy [PL]

> Define declarative governance rules using ADICO-style institutional grammar, specifying who may/must/must-not do what, under which conditions, with what consequences.

**Capabilities**: persistent-storage

**State**:
- `policies`
- `attributes`
- `deontic`
- `aim`
- `conditions`
- `orElse`
- `domain`
- `status`
- `evaluator`
- `createdAt`

**Actions**:
- `create(attributes, deontic, aim, conditions, orElse, domain)` &rarr; created
- `evaluate(policy, context)` &rarr; permitted
- `suspend(policy)` &rarr; suspended
- `repeal(policy)` &rarr; repealed
- `modify(policy, field, newValue)` &rarr; modified | not_found

#### RegoEvaluator [RE]

> Evaluate governance policies written in Rego (Open Policy Agent), enabling general-purpose policy-as-code with data/policy separation and composable rule sets.

**Capabilities**: persistent-storage

**State**:
- `bundles`
- `policySource`
- `dataSource`
- `compiledAt`
- `packageName`

**Actions**:
- `loadBundle(policySource, dataSource, packageName)` &rarr; loaded | compile_error
- `evaluate(bundle, input)` &rarr; result | undefined | runtime_error
- `updateData(bundle, newData)` &rarr; updated

#### Sanction [SN]

> Impose graduated consequences for rule violations and distribute rewards for positive contributions.

**Capabilities**: persistent-storage

**State**:
- `records`
- `subject`
- `severity`
- `consequence`
- `reason`
- `issuedAt`
- `appealed`
- `levels`
- `severity`
- `consequence`
- `escalatesTo`
- `rewards`
- `recipient`
- `rewardType`
- `amount`

**Actions**:
- `impose(subject, severity, consequence, reason)` &rarr; imposed
- `escalate(sanction)` &rarr; escalated | max_severity
- `appeal(sanction)` &rarr; appeal_opened
- `pardon(sanction)` &rarr; pardoned
- `reward(recipient, rewardType, amount, reason)` &rarr; rewarded

---

## governance-structure
_v0.1.0_

> "Governance domains, organizational structure, delegation, and participant weighting"

### Concepts

#### Circle [C]

> Organize governance into semi-autonomous nested groups with defined jurisdictions and subsidiarity.

**Capabilities**: persistent-storage

**State**:
- `circles`
- `name`
- `parent`
- `children`
- `members`
- `domain`
- `policies`
- `repLink`
- `leadLink`

**Actions**:
- `create(name, domain, parent)` &rarr; created
- `assignMember(circle, member)` &rarr; assigned | not_found
- `removeMember(circle, member)` &rarr; removed
- `setLinks(circle, repLink, leadLink)` &rarr; links_set
- `dissolve(circle)` &rarr; dissolved | not_found
- `checkJurisdiction(circle, action)` &rarr; in_scope

#### Delegation [E]

> Transfer decision-making power to a representative, with support for transitivity, domain scoping, and instant revocability.

**Capabilities**: persistent-storage

**State**:
- `delegations`
- `delegator`
- `delegatee`
- `domain`
- `transitive`
- `createdAt`
- `effectiveWeight`

**Actions**:
- `delegate(from, to, domain, transitive)` &rarr; delegated | self_delegation | cycle_detected
- `undelegate(delegation)` &rarr; revoked | not_found
- `getEffectiveWeight(participant, domain)` &rarr; weight

#### EqualWeight [EW]

> Assign identical governance weight to every eligible participant regardless of holdings, reputation, or stake — one person, one vote.

**State**:
- `configurations`
- `weightValue`

**Actions**:
- `configure(weightValue)` &rarr; configured
- `getWeight(config, participant)` &rarr; weight

#### Polity [G]

> Define a governance domain with its foundational purpose, values, scope of authority, and constitutional layer configuration.

**Capabilities**: persistent-storage

**State**:
- `polities`
- `name`
- `purpose`
- `values`
- `scope`
- `constitutionalRules`
- `operationalLayer`
- `policyLayer`
- `constitutionalLayer`
- `createdAt`
- `amendedAt`

**Actions**:
- `establish(name, purpose, values, scope)` &rarr; established
- `amend(polity, field, newValue)` &rarr; amended | not_found | protected
- `dissolve(polity)` &rarr; dissolved | not_found

#### QuadraticWeight [QW]

> Derive governance weight as the square root of a participant's token balance, reducing concentration of power while still recognizing larger stakeholders.

**State**:
- `configurations`
- `tokenSource`
- `scalingFactor`

**Actions**:
- `configure(tokenSource, scalingFactor)` &rarr; configured
- `computeWeight(config, balance)` &rarr; weight | zero_balance

#### ReputationWeight [RW]

> Derive governance weight from a participant's reputation score, decoupling influence from financial holdings.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `scalingFunction`
- `cap`
- `floor`

**Actions**:
- `configure(scalingFunction, cap, floor)` &rarr; configured
- `computeWeight(config, reputationScore)` &rarr; weight | no_reputation

#### StakeWeight [SW]

> Derive governance weight from tokens locked in a staking vault, requiring participants to commit capital as a signal of alignment.

**Capabilities**: persistent-storage

**State**:
- `vaults`
- `stakes`
- `participant`
- `amount`
- `lockedAt`
- `lockDuration`
- `unlockAt`
- `minimumStake`
- `cooldownPeriod`

**Actions**:
- `configure(minimumStake, cooldownPeriod)` &rarr; configured
- `stake(vault, participant, amount, lockDurationHours)` &rarr; staked | below_minimum
- `unstake(vault, participant)` &rarr; unstaking | still_locked
- `getWeight(vault, participant)` &rarr; weight | not_staked

#### TokenBalance [TB]

> Derive governance weight from a participant's balance of a specific token at a point in time, the standard model for token-weighted governance.

**Capabilities**: persistent-storage

**State**:
- `configurations`
- `tokenAddress`
- `snapshotBlock`
- `balanceCache`
- `participant`
- `balance`
- `cachedAt`

**Actions**:
- `configure(tokenAddress)` &rarr; configured
- `snapshot(config, blockRef)` &rarr; snapshotted
- `getWeight(config, participant)` &rarr; weight | zero_balance

#### VoteEscrow [VE]

> Derive governance weight from time-locked token positions, where weight is proportional to both amount locked and remaining lock duration, incentivizing long-term commitment.

**Capabilities**: persistent-storage

**State**:
- `locks`
- `participant`
- `amount`
- `lockEnd`
- `maxLockDuration`
- `checkpoints`
- `timestamp`
- `weight`

**Actions**:
- `configure(maxLockDurationDays)` &rarr; configured
- `lock(participant, amount, lockDurationDays)` &rarr; locked | exceeds_max
- `extendLock(lock, additionalDays)` &rarr; extended
- `getWeight(lock)` &rarr; weight | expired
- `withdraw(lock)` &rarr; withdrawn | still_locked

#### Weight [W]

> Determine a participant's quantitative influence in governance decisions, with pluggable weight sources and historical snapshots.

**Capabilities**: persistent-storage

**State**:
- `weights`
- `participant`
- `source`
- `value`
- `snapshots`
- `snapshotTime`
- `snapshotWeights`

**Actions**:
- `updateWeight(participant, source, value)` &rarr; updated
- `snapshot(time)` &rarr; snapshotted
- `getWeight(participant, atTime)` &rarr; weight | not_found
- `getWeightFromSnapshot(snapshotId, participant)` &rarr; weight | snapshot_not_found

---

## governance-transparency
_v0.1.0_

> "Audit trails and disclosure policies for governance legitimacy"

### Concepts

#### AuditTrail [AT]

> Maintain an append-only record of all governance actions, decisions, and state changes for accountability and legitimacy.

**Capabilities**: persistent-storage

**State**:
- `entries`
- `eventType`
- `actor`
- `action`
- `details`
- `timestamp`
- `sourceRef`
- `hash`

**Actions**:
- `record(eventType, actor, action, details, sourceRef)` &rarr; recorded
- `query(eventType, actor, fromTime, toTime)` &rarr; results | no_results
- `verifyIntegrity(entry)` &rarr; valid | tampered

#### DisclosurePolicy [DP]

> Define transparency requirements specifying what governance information must be disclosed, when, and to whom.

**Capabilities**: persistent-storage

**State**:
- `policies`
- `subject`
- `audience`
- `timing`
- `delayPeriod`
- `scope`
- `status`

**Actions**:
- `define(subject, audience, timing, scope)` &rarr; defined
- `evaluate(subject, requester)` &rarr; disclose | delayed | restricted
- `suspend(policy)` &rarr; suspended

---

## identity
_v0.1.0_

> "User identity and permission management — authentication, authorization, access control, and session lifecycle."

### Concepts

#### AccessControl [A]

> Evaluate three-valued access decisions (allowed/forbidden/neutral) with cacheable results. Forbidden overrides all allowed. Policies are composable via logical OR and AND combinators, enabling layered access evaluation across multiple policy sources.

**State**:
- `policies`
- `result`
- `tags`
- `maxAge`

**Actions**:
- `check(resource, action, context)` &rarr; ok
- `orIf(left, right)` &rarr; ok
- `andIf(left, right)` &rarr; ok

##### PermissionGate [T] _(derived)_

> Unify role-based authorization with policy-driven access control to gate operations behind declarative permission checks.

**Composes**: AccessControl, Authorization
**Required syncs**: role-policy-sync, permission-check

**Surface**:
- `grantAccess` &rarr; Authorization/grantPermission
- `revokeAccess` &rarr; Authorization/revokePermission

#### Authentication [U]

> Verify user identity via pluggable authentication providers. Supports multiple provider backends per user, token-based session authentication, and credential reset flows.

**State**:
- `accounts`
- `providers`
- `credentials`
- `activeProvider`

**Actions**:
- `register(user, provider, credentials)` &rarr; ok | exists
- `login(user, credentials)` &rarr; ok | invalid
- `logout(user)` &rarr; ok | notfound
- `authenticate(token)` &rarr; ok | invalid
- `resetPassword(user, newCredentials)` &rarr; ok | notfound

##### LoginSession [U] _(derived)_

> Combine authentication credentials with session lifecycle to provide a unified login experience with automatic session management.

**Composes**: Authentication, Session
**Required syncs**: auth-session, session-refresh

**Surface**:
- `login` &rarr; Authentication/login
- `logout` &rarr; Session/destroy

#### Authorization [U]

> Manage roles, permissions, and permission-checking for users. Roles group permissions into reusable bundles. Users are assigned roles, and permission checks resolve transitively through the role-permission mapping.

**State**:
- `roles`
- `permissions`
- `userRoles`
- `rolePermissions`

**Actions**:
- `grantPermission(role, permission)` &rarr; ok | notfound
- `revokePermission(role, permission)` &rarr; ok | notfound
- `assignRole(user, role)` &rarr; ok | notfound
- `checkPermission(user, permission)` &rarr; ok

#### Session [S]

> Manage authenticated session lifecycle including creation, validation, refresh, and device tracking. Each session binds a user identity to a specific device and carries an opaque token with a bounded lifetime.

**State**:
- `sessions`
- `userId`
- `token`
- `device`
- `expiresAt`
- `isValid`

**Actions**:
- `create(session, userId, device)` &rarr; ok | error
- `validate(session)` &rarr; ok | notfound
- `refresh(session)` &rarr; ok | notfound | expired
- `destroy(session)` &rarr; ok | notfound
- `destroyAll(userId)` &rarr; ok
- `getContext(session)` &rarr; ok | notfound

### Syncs

- **CreateSessionOnLogin** _(eager)_
  - When: Authentication/login
  - Then: Session/create
- **DestroySessionOnLogout** _(eager)_
  - When: Authentication/logout
  - Then: Session/destroyAll
- **ValidateSessionOnAuth** _(eager)_
  - When: Authentication/authenticate
  - Then: Session/validate
- **CheckAccessViaRoles** _(eager)_
  - When: AccessControl/check
  - Then: Authorization/checkPermission

---

## infrastructure
_v0.1.0_

> "System infrastructure — caching, configuration sync, path aliases, plugin discovery, event dispatching, and validation."

### Concepts

#### Cache [C]

> Provide tag-based cache invalidation with 3D metadata (contexts, tags, max-age) enabling precise, efficient cache busting.

**State**:
- `bins`
- `tags`
- `data`
- `maxAge`
- `contexts`

**Actions**:
- `set(bin, key, data, tags, maxAge)` &rarr; ok
- `get(bin, key)` &rarr; ok | miss
- `invalidate(bin, key)` &rarr; ok | notfound
- `invalidateByTags(tags)` &rarr; ok

#### ConfigSync [C]

> Manage configuration as code with export, import, environment overrides, and diff comparison.

**State**:
- `activeConfig`
- `syncDirectory`
- `overrideLayers`
- `data`

**Actions**:
- `export(config)` &rarr; ok | notfound
- `import(config, data)` &rarr; ok | error
- `override(config, layer, values)` &rarr; ok | notfound
- `diff(configA, configB)` &rarr; ok | notfound

##### FeatureFlag [T] _(derived)_

> Manage feature flags with synchronized configuration, event-driven propagation, and cached evaluation for low-latency flag checks.

**Composes**: ConfigSync, EventBus, Cache
**Required syncs**: config-event-propagate, config-cache-sync, flag-evaluation

**Surface**:
- `setFlag` &rarr; ConfigSync/override
- `propagate` &rarr; EventBus/dispatch
- `evaluate` &rarr; Cache/get

#### EventBus [E]

> Dispatch events to priority-ordered subscribers with async support, history tracking, and dead-letter handling.

**State**:
- `eventTypes`
- `listeners`
- `history`
- `deadLetterQueue`

**Actions**:
- `registerEventType(name, schema)` &rarr; ok | exists
- `subscribe(event, handler, priority)` &rarr; ok
- `unsubscribe(subscriptionId)` &rarr; ok | notfound
- `dispatch(event, data)` &rarr; ok | error
- `dispatchAsync(event, data)` &rarr; ok | error
- `getHistory(event, limit)` &rarr; ok

#### Pathauto [P]

> Generate URL-friendly slugs from content using configurable template patterns with token substitution.

**State**:
- `patterns`
- `aliases`
- `template`
- `cleanRules`

**Actions**:
- `generateAlias(pattern, entity)` &rarr; ok | notfound
- `bulkGenerate(pattern, entities)` &rarr; ok | notfound
- `cleanString(input)` &rarr; ok

#### PluginRegistry [P]

> Discover, register, and manage extensible functionality units with attribute-based discovery and plugin derivatives.

**State**:
- `pluginTypes`
- `definitions`
- `cache`
- `metadata`

**Actions**:
- `register(type, name, metadata)` &rarr; ok | exists
- `discover(type)` &rarr; ok
- `createInstance(plugin, config)` &rarr; ok | notfound
- `getDefinitions(type)` &rarr; ok
- `alterDefinitions(type, alterations)` &rarr; ok
- `derivePlugins(plugin, config)` &rarr; ok | notfound

#### Validator [V]

> Enforce runtime constraints at write time by validating data against schema rules, field rules, and custom validators. Coercion is delegated to Transform via CoercionFallback sync.

**State**:
- `constraints`
- `schemaRules`
- `fieldRules`
- `customValidators`

**Actions**:
- `registerConstraint(validator, constraint)` &rarr; ok | exists
- `addRule(validator, field, rule)` &rarr; ok | notfound
- `validate(validator, data)` &rarr; ok
- `validateField(validator, field, value)` &rarr; ok
- `addCustomValidator(validator, name, implementation)` &rarr; ok | exists

### Syncs

- **CoercionFallback** _(eager)_
  - When: Validator/validate
  - Then: Transform/apply
- **ValidateOnDispatch** _(eager)_
  - When: EventBus/dispatch
  - Then: Validator/validate
- **CacheInvalidateOnConfig** _(eager)_
  - When: ConfigSync/import
  - Then: Cache/invalidateByTags
- **PluginDiscovery** _(eager)_
  - When: PluginRegistry/discover
  - Then: EventBus/dispatch
- **PathautoOnCreate** _(eager)_
  - When: Pathauto/generateAlias
  - Then: Cache/set

---

## linking
_v0.1.0_

> "Content connection patterns — forward references, reverse backlinks, typed relations, and entity aliases."

### Concepts

#### Alias [A]

> Allow multiple names for the same entity, enabling name polymorphism and flexible referencing.

**State**:
- `aliases`
- `entities`

**Actions**:
- `addAlias(entity, name)` &rarr; ok | exists
- `removeAlias(entity, name)` &rarr; ok | notfound
- `resolve(name)` &rarr; ok | notfound

#### Backlink [B]

> Maintain a reverse index enabling bidirectional association discovery from target back to sources.

**State**:
- `backlinks`
- `mentions`

**Actions**:
- `getBacklinks(entity)` &rarr; ok
- `getUnlinkedMentions(entity)` &rarr; ok
- `reindex()` &rarr; ok

#### Reference [R]

> Track forward associations from source to target entities, forming the primary link graph that backlinks and alias resolution build upon.

**State**:
- `refs`
- `sources`

**Actions**:
- `addRef(source, target)` &rarr; ok | exists
- `removeRef(source, target)` &rarr; ok | notfound
- `getRefs(source)` &rarr; ok | notfound
- `resolveTarget(target)` &rarr; ok

#### Relation [R]

> Define typed, labeled, bidirectional connections between entities with cardinality constraints. Rollup aggregation is delegated to Formula via RelationRollupComputation sync.

**State**:
- `relations`
- `links`
- `definition`

**Actions**:
- `defineRelation(relation, schema)` &rarr; ok | exists
- `link(relation, source, target)` &rarr; ok | invalid
- `unlink(relation, source, target)` &rarr; ok | notfound
- `getRelated(relation, entity)` &rarr; ok | notfound

### Syncs

- **ResolveAliasOnRef** _(eager)_
  - When: Reference/addRef
  - Then: Alias/resolve
- **UpdateBacklinksOnRef** _(eager)_
  - When: Reference/addRef
  - Then: Backlink/reindex
- **RemoveBacklinksOnUnref** _(eager)_
  - When: Reference/removeRef
  - Then: Backlink/reindex
- **MirrorRelationToReference** _(eager)_
  - Then: Reference/addRef
- **MirrorRelationUnlinkToReference** _(eager)_
  - Then: Reference/removeRef
- **RelationRollupComputation** _(eager)_
  - When: Relation/link
  - Then: Formula/compute

---

## llm-agent
_v0.1.0_

> Autonomous LLM agent reasoning, multi-agent coordination, memory, tool use, and alignment. AgentLoop is a coordination concept — strategy providers register via PluginRegistry. concepts: StateGraph: spec: ./state-graph.concept params: H: { as: graph-id, description: "Execution graph identifier" } AgentMemory: spec: ./agent-memory.concept params: E: { as: memory-id, description: "Memory entry identifier" } ToolBinding: spec: ./tool-binding.concept params: T: { as: tool-id, description: "Tool definition identifier" } AgentTeam: spec: ./agent-team.concept params: M: { as: team-id, description: "Agent team identifier" } AgentRole: spec: ./agent-role.concept params: K: { as: role-id, description: "Agent role identifier" } Blackboard: spec: ./blackboard.concept params: B: { as: board-id, description: "Blackboard identifier" } AgentHandoff: spec: ./agent-handoff.concept params: D: { as: handoff-id, description: "Handoff identifier" } Consensus: spec: ./consensus.concept params: N: { as: consensus-id, description: "Consensus session identifier" } Constitution: spec: ./constitution.concept params: W: { as: constitution-id, description: "Constitution identifier" } AgentLoop: spec: ./agent-loop.concept params: L: { as: agent-id, description: "Agent instance identifier" } ReactStrategy: spec: ./strategies/react.concept optional: true PlanAndExecuteStrategy: spec: ./strategies/plan-and-execute.concept optional: true TreeOfThoughtStrategy: spec: ./strategies/tree-of-thought.concept optional: true ReflectionStrategy: spec: ./strategies/reflection.concept optional: true CodeActStrategy: spec: ./strategies/code-act.concept optional: true ReWOOStrategy: spec: ./strategies/rewoo.concept optional: true syncs: required: - path: ./syncs/agent-invokes-tool.sync description: "AgentLoop action_request triggers ToolBinding/invoke" - path: ./syncs/agent-remembers-step.sync description: "AgentLoop reasoning steps stored in AgentMemory" - path: ./syncs/tool-result-feeds-agent.sync description: "ToolBinding/invoke result feeds back to AgentLoop/observe" - path: ./syncs/agent-loop-dispatches-to-strategy.sync description: "AgentLoop/run resolves strategy via PluginRegistry" recommended: - path: ./syncs/agent-recalls-memory.sync description: "AgentLoop/run triggers AgentMemory recall for context" - path: ./syncs/constitution-critiques-output.sync description: "AgentLoop results pass through Constitution critique-revision" - path: ./syncs/team-delegates-via-role.sync description: "AgentTeam delegation triggers AgentRole matching" - path: ./syncs/blackboard-notifies-subscribers.sync description: "Blackboard posts notify subscribed agents" - path: ./syncs/consensus-resolves-conflict.sync description: "AgentTeam conflict resolution triggers Consensus tally" - path: ./syncs/handoff-packages-context.sync description: "AgentHandoff context package feeds into AgentLoop/run" - path: ./syncs/episodic-memory-archive.sync description: "LLMTrace spans archived as episodic memories" - path: ./syncs/procedural-memory-update.sync description: "Efficient agent runs stored as procedural memory" - path: ./syncs/memory-consolidation.sync description: "New memories trigger background consolidation" integration: - path: ./syncs/agent-workflow-provider.sync description: "Agent phases map to Workflow states" - path: ./syncs/hitl-notification.sync description: "Tool approval requests trigger HITL notifications" - path: ./syncs/multi-agent-message-passing.sync description: "Agent results append to shared Conversation" - path: ./syncs/react-routes.sync description: "PluginRegistry resolves 'react' to ReactStrategy" - path: ./syncs/plan-execute-routes.sync description: "PluginRegistry resolves 'plan_and_execute' to PlanAndExecuteStrategy" - path: ./syncs/tree-of-thought-routes.sync description: "PluginRegistry resolves 'tree_of_thought' to TreeOfThoughtStrategy" - path: ./syncs/reflection-routes.sync description: "PluginRegistry resolves 'reflection' to ReflectionStrategy" - path: ./syncs/code-act-routes.sync description: "PluginRegistry resolves 'code_act' to CodeActStrategy" - path: ./syncs/rewoo-routes.sync description: "PluginRegistry resolves 'rewoo' to ReWOOStrategy" widgets: - path: ./widgets/tool-invocation.widget description: "Collapsible card displaying an LLM tool call execution" - path: ./widgets/reasoning-block.widget description: "Collapsible display for chain-of-thought reasoning content" - path: ./widgets/trace-tree.widget description: "Hierarchical execution trace viewer for agent loops and verification runs" - path: ./widgets/agent-timeline.widget description: "Multi-agent communication timeline with delegation indicators" - path: ./widgets/task-plan-list.widget description: "Hierarchical task plan with status indicators and drag reordering" - path: ./widgets/hitl-interrupt.widget description: "Human-in-the-loop interrupt banner for agent approval flows" - path: ./widgets/memory-inspector.widget description: "Inspector panel for viewing and managing agent memory state" surface: entityAffordances: - concept: ToolBinding detail: tool-invocation - concept: AgentLoop detail: trace-tree - concept: AgentMemory detail: memory-inspector uses: - suite: llm-core concepts: - name: LLMProvider - name: ModelRouter - suite: llm-conversation concepts: - name: Conversation - suite: llm-safety optional: true concepts: - name: Guardrail - suite: infrastructure concepts: - name: PluginRegistry - suite: automation optional: true concepts: - name: Workflow - suite: notification optional: true concepts: - name: Notification

### Concepts

#### AgentHandoff [D]

> Structured transfer of control between agents with context packaging. Different from message passing (appending to conversation) because handoff involves context summarization, tool state transfer, responsibility transfer, and acceptance/rejection protocol.

**Capabilities**: persistent-storage, coding

**State**:
- `handoffs`
- `source_agent`
- `target_agent`
- `context_summary`
- `transferred_tools`
- `transferred_state`
- `reason`
- `status`

**Actions**:
- `prepare(source, target, reason)` &rarr; ok | error
- `execute(handoff)` &rarr; ok | rejected
- `escalate(source, reason)` &rarr; ok | no_target
- `getHistory(task_id)` &rarr; ok | empty

#### AgentLoop [L] `@gate`

> Coordination concept for agent reasoning cycles. Defines the interface contract for agent execution: create, run, step, observe, interrupt, resume. Strategy providers (React, PlanAndExecute, etc.) register themselves with PluginRegistry independently. AgentLoop has zero awareness of which providers exist — routing syncs resolve a strategy string to the correct provider at call time via PluginRegistry.

**Capabilities**: persistent-storage

**State**:
- `agents`
- `available_tools`
- `max_iterations`
- `current_step`
- `status`
- `goal`

**Actions**:
- `create(available_tools, max_iterations)` &rarr; ok | invalid
- `run(agent, goal, context, strategy)` &rarr; ok | max_iterations | error | waiting_for_human
- `step(agent)` &rarr; thought | action_request | final_answer | error
- `observe(agent, observation)` &rarr; ok | notfound
- `interrupt(agent)` &rarr; ok | notfound
- `resume(agent, human_input)` &rarr; ok | notfound

##### SafeAgent [T] _(derived)_

> Wrap an agent execution loop with tool safety guardrails and observability tracing to ensure controlled, auditable agent behavior.

**Composes**: AgentLoop, ToolBinding, Guardrail, LLMTrace
**Required syncs**: agent-tool-binding, agent-guardrail-check, agent-trace-span

**Surface**:
- `run` &rarr; AgentLoop/run
- `invoke` &rarr; ToolBinding/invoke
- `checkSafety` &rarr; Guardrail/check

#### AgentMemory [E]

> Persistent, multi-tier memory modeled after cognitive science. Four tiers: working memory (always in context, like CPU registers), episodic (timestamped interactions, answers "what happened?"), semantic (facts as embeddings, answers "what do I know?"), procedural (learned skills, answers "how do I do this?"). The agent actively manages its own memory via tool calls — self-editing memory, not passive storage.

**Capabilities**: persistent-storage

**State**:
- `entries`
- `memory_type`
- `content`
- `embedding`
- `timestamp`
- `metadata`
- `working_memory`
- `consolidation_queue`

**Actions**:
- `remember(content, memory_type, metadata)` &rarr; ok | invalid
- `recall(query, memory_type, k)` &rarr; ok | empty
- `editWorkingMemory(label, new_content)` &rarr; ok | notfound
- `forget(entry)` &rarr; ok | notfound
- `consolidate()` &rarr; ok | empty
- `search(query, filters, after, before)` &rarr; ok | empty
- `getWorkingMemory()` &rarr; ok

#### AgentRole [K]

> Capability declaration for agents enabling task-agent matching in multi-agent systems. Agents declare what they can do so orchestrators and Contract Net protocols can match tasks to capable agents. Tracks performance history per task type for weighted delegation.

**Capabilities**: persistent-storage

**State**:
- `roles`
- `name`
- `capabilities`
- `constraints`
- `max_concurrent`
- `required_tools`
- `expertise_domains`
- `current_load`
- `performance`
- `avg_latency_ms`
- `total_tasks`

**Actions**:
- `define(name, capabilities, proficiency, constraints, required_tools, expertise_domains)` &rarr; ok | invalid
- `bid(role, task_description, task_type)` &rarr; ok | decline
- `match(task_type)` &rarr; ok | no_match
- `recordOutcome(role, task_type, success, latency_ms, cost)` &rarr; ok | notfound
- `getAvailability(role)` &rarr; ok | notfound

#### AgentTeam [M] `@gate`

> Multi-agent group coordination. Manages topology selection, task delegation, result synthesis, and conflict escalation. Five topologies: hierarchical (supervisor delegates to specialists), pipeline (sequential processing chain), peer_to_peer (decentralized), hub_and_spoke (router without authority), blackboard (shared knowledge board). Delegates task-agent matching to AgentRole and conflict resolution to Consensus.

**Capabilities**: persistent-storage

**State**:
- `teams`
- `name`
- `members`
- `topology`
- `protocol`
- `task_queue`
- `assigned_to`
- `results`

**Actions**:
- `assemble(name, members, role_id, topology, protocol)` &rarr; ok | invalid
- `delegate(team, task)` &rarr; ok | no_capable_agent
- `synthesize(team, task_id)` &rarr; ok | incomplete
- `resolveConflict(team, task_id)` &rarr; ok | deadlock
- `addMember(team, agent_id, role_id)` &rarr; ok | notfound
- `removeMember(team, agent_id)` &rarr; ok | notfound
- `getStatus(team)` &rarr; ok

#### Blackboard [B]

> Shared knowledge repository for asynchronous multi-agent collaboration. Agents communicate exclusively by reading from and writing to the board. Eliminates redundant message passing — all agents share one context. Agents subscribe to entry types and get notified when relevant data appears. Exceptional token efficiency compared to message-passing topologies. Includes conflict resolution for contradictory posts.

**Capabilities**: persistent-storage

**State**:
- `boards`
- `entries`
- `content`
- `timestamp`
- `entry_schema`
- `subscriptions`
- `condition`
- `access_log`
- `entry_id`

**Actions**:
- `create(entry_schema, schema)` &rarr; ok | invalid
- `post(board, agent_id, entry_type, content, confidence)` &rarr; ok | schema_violation
- `query(board, entry_type, filters)` &rarr; ok | empty
- `subscribe(board, agent_id, entry_types, condition)` &rarr; ok | notfound
- `challenge(board, entry_id, challenger_agent_id, counter_evidence)` &rarr; ok | notfound
- `resolve(board, entry_ids, strategy)` &rarr; ok | unresolvable
- `snapshot(board)` &rarr; ok

#### CodeActStrategy [S]

> CodeAct strategy provider. Agent generates executable code to solve problems, runs it in a sandbox, observes output, iterates. Useful for computational tasks, data analysis, and tool composition via code. Registers under strategy_id "code_act".

**State**:
- `sessions`
- `code_history`
- `error`
- `runtime_env`
- `sandbox_config`
- `agent_ref`

**Actions**:
- `execute(agent_ref, goal, context, available_tools, max_iterations)` &rarr; ok | max_iterations | sandbox_error
- `generateCode(session, goal, previous_error)` &rarr; ok
- `executeCode(session, code)` &rarr; ok | error | timeout
- `getState(session)` &rarr; ok

#### Consensus [N] `@gate`

> Multi-agent decision-making when agents produce contradictory results or propose incompatible strategies. Supports voting (simple majority, weighted, unanimous), confidence-based resolution (with overconfidence discounting), and iterative refinement (agents debate until convergence).

**Capabilities**: persistent-storage

**State**:
- `sessions`
- `proposal`
- `votes`
- `confidence`
- `method`
- `max_rounds`
- `current_round`
- `agent_weights`
- `outcome`

**Actions**:
- `create(proposal, method, max_rounds)` &rarr; ok | invalid
- `vote(session, agent_id, position, confidence, reasoning)` &rarr; ok | already_voted
- `tally(session)` &rarr; ok | deadlock
- `challenge(session, agent_id, counter_argument)` &rarr; ok | max_rounds_exceeded
- `resolve(session)` &rarr; ok | unresolvable
- `setWeight(session, agent_id, weight)` &rarr; ok | notfound

#### Constitution [W]

> Formalized list of ethical, stylistic, or business-logic axioms used during Critique-Revision loops to align model behavior. Enables Constitutional AI (CAI) and RLAIF. Model critiques its own output against principles, then revises. Transparent, scalable rule sets replacing subjective human ratings.

**Capabilities**: persistent-storage

**State**:
- `constitutions`
- `name`
- `principles`
- `priority`
- `revision_config`
- `critique_model`

**Actions**:
- `create(name, principles, category, priority)` &rarr; ok | invalid
- `critique(constitution, response, prompt)` &rarr; ok | compliant
- `revise(constitution, response, critique)` &rarr; ok | error
- `critiqueAndRevise(constitution, response, prompt)` &rarr; ok | max_revisions
- `addPrinciple(constitution, text, category, priority)` &rarr; ok | notfound
- `removePrinciple(constitution, principle_id)` &rarr; ok | notfound

#### PlanAndExecuteStrategy [S]

> Plan-and-Execute strategy provider. Generates an upfront multi-step plan, then executes each step (potentially with a cheaper model), replanning after each step if needed. More robust than ReAct for complex multi-step tasks. Registers under strategy_id "plan_and_execute".

**State**:
- `sessions`
- `plan`
- `result`
- `executor_model`
- `agent_ref`

**Actions**:
- `execute(agent_ref, goal, context, available_tools, max_iterations)` &rarr; ok | max_iterations | error
- `plan(session, goal)` &rarr; ok
- `replan(session, completed, remaining)` &rarr; ok | no_change
- `getState(session)` &rarr; ok

#### ReactStrategy [S]

> ReAct (Reasoning + Acting) strategy provider for AgentLoop. Implements the greedy think-act-observe cycle with an interleaved scratchpad. Good for simple tasks requiring sequential tool use. Registers itself with PluginRegistry under strategy_id "react".

**State**:
- `sessions`
- `scratchpad`
- `agent_ref`

**Actions**:
- `execute(agent_ref, goal, context, available_tools, max_iterations)` &rarr; ok | max_iterations | error
- `stepOnce(session)` &rarr; thought
- `addObservation(session, observation)` &rarr; ok
- `getState(session)` &rarr; ok

#### ReflectionStrategy [S]

> Reflection strategy provider. Iterative self-critique and revision: generate a draft, critique it, revise, repeat until satisfactory or max rounds. Improves output quality at the cost of latency. Registers under strategy_id "reflection".

**State**:
- `sessions`
- `draft_history`
- `max_rounds`
- `agent_ref`

**Actions**:
- `execute(agent_ref, goal, context, available_tools, max_iterations)` &rarr; ok | max_rounds
- `critique(session, draft)` &rarr; ok
- `revise(session, draft, critique)` &rarr; ok
- `getState(session)` &rarr; ok

#### ReWOOStrategy [S]

> ReWOO (Reasoning Without Observation) strategy provider. Plans ALL tool calls upfront before executing any, then batch-executes and synthesizes. Avoids interleaving reasoning with tool results, reducing total LLM calls. Good for predictable multi-tool tasks where tool results don't influence which tools to call next. Registers under strategy_id "rewoo".

**State**:
- `sessions`
- `planned_calls`
- `arguments`
- `execution_results`
- `agent_ref`

**Actions**:
- `execute(agent_ref, goal, context, available_tools, max_iterations)` &rarr; ok | error
- `planCalls(session, goal, available_tools)` &rarr; ok
- `executeBatch(session)` &rarr; ok | partial
- `synthesize(session, goal)` &rarr; ok
- `getState(session)` &rarr; ok

#### StateGraph [H] `@gate`

> Graph-based orchestration with typed state flowing through nodes, conditional edges evaluated by LLMs, first-class cycles, durable checkpoints, and time-travel. The industry standard for agent workflow orchestration. Fundamentally different from Workflow (which is an acyclic state machine): StateGraph has typed flowing state mutated by each node, LLM-evaluated conditional edges, explicit support for cycles, state reducers for concurrent merging, and subgraph nesting.

**Capabilities**: persistent-storage

**State**:
- `graphs`
- `nodes`
- `edges`
- `state_schema`
- `entry_point`
- `finish_points`
- `execution_state`
- `checkpoints`
- `node_id`
- `reducers`
- `subgraphs`

**Actions**:
- `create(state_schema)` &rarr; ok | invalid
- `addNode(graph, id, type, handler)` &rarr; ok | duplicate
- `addEdge(graph, source, target)` &rarr; ok | notfound
- `addConditionalEdge(graph, source, targets, target)` &rarr; ok | notfound
- `setEntryPoint(graph, node_id)` &rarr; ok | notfound
- `setFinishPoint(graph, node_ids)` &rarr; ok | notfound
- `addReducer(graph, field, reducer)` &rarr; ok | invalid
- `addSubgraph(graph, node_id, subgraph)` &rarr; ok | notfound
- `compile(graph)` &rarr; ok | invalid
- `execute(graph, initial_state)` &rarr; ok | error | waiting_for_human
- `checkpoint(graph)` &rarr; ok | not_executing
- `restore(graph, checkpoint_id)` &rarr; ok | notfound
- `timeTravel(graph, checkpoint_id)` &rarr; ok | notfound
- `fork(graph, checkpoint_id)` &rarr; ok | notfound

#### ToolBinding [T]

> Callable tools/functions that LLMs can invoke. Unifies OpenAI function calling, Anthropic tool use, and MCP tool primitive. Full lifecycle: schema definition, provider format translation, argument validation, execution, result formatting, error handling. Supports dynamic tool selection for large tool sets and safety annotations per MCP spec.

**Capabilities**: persistent-storage

**State**:
- `tools`
- `name`
- `description`
- `input_schema`
- `output_schema`
- `handler`
- `annotations`
- `audience`
- `destructive`
- `idempotent`
- `open_world`
- `timeout_ms`
- `retry_policy`
- `requires_approval`

**Actions**:
- `define(name, description, input_schema, output_schema, handler, annotations, destructive, idempotent, open_world, timeout_ms, requires_approval)` &rarr; ok | invalid
- `invoke(tool, arguments)` &rarr; ok | validation_error | timeout | execution_error | approval_required
- `toProviderFormat(tool, provider)` &rarr; ok | notfound
- `discover(filter, destructive)` &rarr; ok
- `search(query, k)` &rarr; ok | empty

#### TreeOfThoughtStrategy [S]

> Tree-of-Thought strategy provider. Explores multiple reasoning paths in parallel, evaluates each branch, prunes unpromising paths, and selects the best. Good for problems requiring exploration and backtracking. Registers under strategy_id "tree_of_thought".

**State**:
- `sessions`
- `thought_tree`
- `thought`
- `status`
- `beam_width`
- `evaluation_prompt`
- `agent_ref`

**Actions**:
- `execute(agent_ref, goal, context, available_tools, max_iterations)` &rarr; ok | max_iterations | error
- `branch(session, parent_id, num_candidates)` &rarr; ok
- `evaluate(session, node_ids)` &rarr; ok
- `prune(session)` &rarr; ok
- `getState(session)` &rarr; ok

### Syncs

- **AgentInvokesTool** _(eager)_
  - When: AgentLoop/step
  - Then: ToolBinding/invoke
- **AgentLoopDispatchesToStrategy** _(eager)_
  - When: AgentLoop/run
  - Then: PluginRegistry/resolve
- **AgentWorkflowProvider** _(eager)_
  - When: AgentLoop/run
  - Then: Workflow/complete
- **BlackboardNotifiesSubscribers** _(eager)_
  - When: Blackboard/post
  - Then: Blackboard/query
- **ConsensusResolvesConflict** _(eager)_
  - When: AgentTeam/resolveConflict
  - Then: Consensus/tally
- **HandoffPackagesContext** _(eager)_
  - When: AgentHandoff/prepare
  - Then: AgentLoop/run
- **HITLNotification** _(eager)_
  - When: ToolBinding/invoke
  - Then: Notification/send
- **MultiAgentMessagePassing** _(eager)_
  - When: AgentLoop/run
  - Then: Conversation/append
- **TeamDelegatesViaRole** _(eager)_
  - When: AgentTeam/delegate
  - Then: AgentRole/match
- **ToolResultFeedsAgent** _(eager)_
  - When: ToolBinding/invoke
  - Then: AgentLoop/observe

### Dependencies

- **llm-core**
- **llm-conversation**
- **llm-safety**
- **infrastructure**
- **automation**
- **notification**

---

## llm-conversation
_v0.1.0_

> Multi-turn LLM dialogue management with multiversal branching, context window strategies, and automatic summarization. concepts: Conversation: spec: ./conversation.concept params: C: { as: conversation-id, description: "Conversation thread identifier" } syncs: required: - path: ./syncs/conversation-counts-tokens.sync description: "Conversation append triggers token counting via LLMProvider" recommended: - path: ./syncs/conversation-auto-summarize.sync description: "Truncated conversation history triggers automatic summarization" integration: - path: ./syncs/conversation-collection-provider.sync description: "Conversation sets register with Collection for search and filtering" widgets: - path: ./widgets/chat-message.widget description: "Role-differentiated message container for LLM conversations" - path: ./widgets/stream-text.widget description: "Token-by-token streaming text renderer with cursor animation" - path: ./widgets/prompt-input.widget description: "Auto-expanding textarea for composing LLM prompts" - path: ./widgets/message-branch-nav.widget description: "Branch navigation control for multiversal conversations" - path: ./widgets/conversation-sidebar.widget description: "Sidebar listing conversation history with search and grouping" - path: ./widgets/inline-citation.widget description: "Numbered inline citation with hover preview for RAG responses" - path: ./widgets/artifact-panel.widget description: "Side panel for generated artifacts with version history" surface: entityAffordances: - concept: Conversation detail: chat-message editor: prompt-input uses: - suite: llm-core concepts: - name: LLMProvider - suite: foundation optional: true concepts: - name: ContentNode

### Concepts

#### Conversation [C]

> Persistent, branching sequence of messages representing a dialogue thread. Manages appending, forking for exploration (Loom/multiversal branching), truncating to fit context windows, and summarizing old context. The session manager for LLM interactions. Tree/DAG structure eliminates context pollution by scoping each branch to its own lineage.

**Capabilities**: persistent-storage

**State**:
- `conversations`
- `messages`
- `parts`
- `tool_calls`
- `function_name`
- `metadata`
- `cost`
- `timestamp`
- `branches`
- `message_ids`
- `active_branch`
- `context_strategy`
- `summary`
- `node_metadata`
- `model_params`
- _(6 more fields)_

**Actions**:
- `create(context_strategy)` &rarr; ok | invalid
- `append(conversation, role, content, parts, data, tool_calls, function_name, arguments, metadata, tokens, cost, finish_reason)` &rarr; ok | notfound
- `fork(conversation, from_message_id)` &rarr; ok | notfound
- `switchBranch(conversation, branch_id)` &rarr; ok | notfound
- `merge(conversation, branch_ids, strategy)` &rarr; ok | conflict
- `prune(conversation, branch_id)` &rarr; ok | notfound
- `getContextWindow(conversation, max_tokens)` &rarr; ok | empty
- `summarize(conversation, message_ids)` &rarr; ok | notfound
- `getLineage(conversation, message_id)` &rarr; ok | notfound
- `serialize(conversation, format)` &rarr; ok | notfound

### Derived Concepts

#### ConversationalRAG [T] _(derived)_

> Combine retrieval-augmented generation with multi-turn conversation management and prompt engineering to enable context-aware dialogue grounded in retrieved documents.

**Composes**: RAGPipeline _(derived)_, Conversation, PromptPipeline _(derived)_
**Required syncs**: conversation-retrieval, retrieval-prompt-inject, conversation-context-window

**Surface**:
- `respond` &rarr; Conversation/append

### Syncs

- **ConversationCollectionProvider** _(eager)_
  - When: Conversation/create
  - Then: Collection/add
- **ConversationCountsTokens** _(eager)_
  - When: Conversation/append
  - Then: LLMProvider/countTokens

### Dependencies

- **llm-core**
- **foundation**

---

## llm-core
_v0.1.0_

> Foundation primitives for LLM model interaction: provider abstraction and intelligent model routing. concepts: LLMProvider: spec: ./llm-provider.concept params: P: { as: provider-id, description: "Provider instance identifier" } ModelRouter: spec: ./model-router.concept params: R: { as: route-id, description: "Route definition identifier" } syncs: required: - path: ./syncs/router-selects-provider.sync description: "ModelRouter/route resolves to LLMProvider/generate" - path: ./syncs/generation-records-usage.sync description: "LLMProvider/generate completion creates LLMTrace span" recommended: - path: ./syncs/router-circuit-breaker.sync description: "LLMProvider unavailable triggers ModelRouter fallback" - path: ./syncs/cost-threshold-alert.sync description: "Cost exceeding threshold triggers AutomationRule" integration: - path: ./syncs/provider-registers-in-plugin-registry.sync description: "LLMProvider registers itself with PluginRegistry" - path: ./syncs/provider-health-to-eventbus.sync description: "LLMProvider health changes publish to EventBus" widgets: - path: ./widgets/generation-indicator.widget description: "Animated status indicator for LLM generation in progress" surface: entityAffordances: - concept: LLMProvider inline: generation-indicator uses: - suite: infrastructure optional: true concepts: - name: PluginRegistry - name: EventBus - name: Cache - name: Queue - suite: automation optional: true concepts: - name: AutomationRule

### Concepts

#### LLMProvider [P]

> Atomic gateway to any large language model. Wraps provider-specific APIs behind a uniform interface for completion, streaming, embedding, and token counting. Stateless per-call: holds configuration and credentials but no conversation history.

**Capabilities**: persistent-storage, network

**State**:
- `providers`
- `provider_id`
- `model_id`
- `api_credentials`
- `default_config`
- `temperature`
- `top_p`
- `max_tokens`
- `stop_sequences`
- `capabilities`
- `pricing`
- `input_cost_per_token`
- `output_cost_per_token`
- `cached_cost_per_token`
- `rate_limits`
- _(3 more fields)_

**Actions**:
- `register(provider_id, model_id, credentials, config, top_p, max_tokens, stop_sequences, capabilities)` &rarr; ok | invalid
- `generate(provider, messages, content, config, top_p, max_tokens)` &rarr; ok | rate_limited | context_overflow | auth_failure | content_filtered | unavailable
- `stream(provider, messages, content, config, top_p, max_tokens)` &rarr; ok | rate_limited | unavailable
- `embed(provider, texts)` &rarr; ok | error
- `countTokens(provider, content)` &rarr; ok | error
- `healthCheck(provider)` &rarr; ok | degraded | unavailable
- `updateConfig(provider, config, top_p, max_tokens, stop_sequences)` &rarr; ok | notfound

#### ModelRouter [R]

> Decides which LLM handles each request based on quality requirements, cost constraints, latency needs, and current availability. Separates model selection from model invocation. Supports rule-based, semantic, classifier, and cascade routing. Tracks per-model performance and manages circuit breakers for failing models.

**Capabilities**: persistent-storage

**State**:
- `routes`
- `route_name`
- `model_id`
- `conditions`
- `task_types`
- `complexity_threshold`
- `max_cost_per_call`
- `max_latency_ms`
- `priority`
- `weight`
- `fallback_chain`
- `routing_strategy`
- `performance_log`
- `success_rate`
- `avg_latency_ms`
- _(6 more fields)_

**Actions**:
- `addRoute(name, model_id, conditions, complexity_threshold, max_cost_per_call, max_latency_ms, priority, weight)` &rarr; ok | duplicate
- `route(task_type, complexity, cost_limit, latency_limit)` &rarr; ok | no_route
- `fallback(failed_model_id, error_type)` &rarr; ok | exhausted
- `recordOutcome(route, success, latency_ms, tokens, cost)` &rarr; ok | notfound
- `getHealth()` &rarr; ok

### Syncs

- **GenerationRecordsUsage** _(eager)_
  - When: LLMProvider/generate
  - Then: LLMTrace/endSpan
- **ProviderHealthToEventBus** _(eager)_
  - When: LLMProvider/healthCheck
  - Then: EventBus/publish
- **ProviderRegistersInPluginRegistry** _(eager)_
  - When: LLMProvider/register
  - Then: PluginRegistry/register
- **RouterSelectsProvider** _(eager)_
  - When: ModelRouter/route
  - Then: LLMProvider/generate

### Dependencies

- **infrastructure**
- **automation**

---

## llm-prompt
_v0.1.0_

> Prompt construction, declarative I/O signatures, dynamic few-shot selection, automatic prompt optimization, and computational constraints. concepts: Signature: spec: ./signature.concept params: G: { as: signature-id, description: "Signature definition identifier" } PromptAssembly: spec: ./prompt-assembly.concept params: P: { as: assembly-id, description: "Prompt assembly identifier" } FewShotExample: spec: ./few-shot-example.concept params: F: { as: example-id, description: "Example pool identifier" } PromptOptimizer: spec: ./prompt-optimizer.concept params: O: { as: optimizer-id, description: "Optimizer run identifier" } Assertion: spec: ./assertion.concept params: T: { as: assertion-id, description: "Assertion rule identifier" } syncs: required: - path: ./syncs/assembly-checks-budget.sync description: "PromptAssembly truncates lowest-priority sections when over budget" - path: ./syncs/assembly-selects-examples.sync description: "PromptAssembly assembly triggers FewShotExample selection" - path: ./syncs/signature-compiles-to-assembly.sync description: "Signature compilation output feeds into PromptAssembly section" recommended: - path: ./syncs/optimizer-evaluates-via-trace.sync description: "PromptOptimizer evaluates candidates using LLMTrace metrics" - path: ./syncs/assertion-triggers-retry.sync description: "Assertion failure triggers LLMProvider re-generation with retry prompt" integration: - path: ./syncs/prompt-version-tracking.sync description: "Prompt changes tracked via Version concept" widgets: - path: ./widgets/prompt-template-editor.widget description: "Multi-message prompt template editor with variable syntax highlighting" surface: entityAffordances: - concept: Signature editor: prompt-template-editor uses: - suite: llm-core concepts: - name: LLMProvider - suite: content optional: true concepts: - name: Template

### Concepts

#### Assertion [T]

> Computational constraints embedded in the LLM execution lifecycle. On violation, triggers automatic backtracking: failing output and error message are injected into the prompt for self-refinement retry. Hard assertions halt the pipeline on max retries. Soft suggestions log and continue. Also covers output schema validation via retry (replaces StructuredOutput's repair loop).

**Capabilities**: persistent-storage

**State**:
- `assertions`
- `name`
- `constraint`
- `severity`
- `error_message`
- `max_retries`
- `retry_count`
- `attached_to`

**Actions**:
- `define(name, constraint, severity, error_message, max_retries)` &rarr; ok | invalid
- `attach(assertion, target)` &rarr; ok | notfound
- `evaluate(assertion, output)` &rarr; pass | fail | halt | warn
- `reset(assertion)` &rarr; ok | notfound

#### FewShotExample [F]

> Manages pools of input-output examples and selects the most effective subset for each prompt at runtime. Supports semantic similarity, maximal marginal relevance, bootstrapped, and length-based selection. 2-5 examples is optimal; beyond 5 returns diminish. Last example weighted most heavily due to recency bias.

**Capabilities**: persistent-storage

**State**:
- `pools`
- `examples`
- `metadata`
- `selection_strategy`
- `k`
- `diversity_weight`
- `quality_scores`

**Actions**:
- `createPool(strategy, k, diversity_weight)` &rarr; ok | invalid
- `add(pool, input, output, metadata)` &rarr; ok | notfound
- `select(pool, input, k)` &rarr; ok | empty
- `optimize(pool, metric, training_set, expected)` &rarr; ok | error
- `embed(pool, model_id)` &rarr; ok | error
- `remove(pool, example_id)` &rarr; ok | notfound

#### PromptAssembly [P]

> Composes a complete LLM prompt from independent sections: system instructions, persona directives, few-shot examples, retrieved context, user input, and output format directives. The layout manager — handles structural semantics, section ordering, token allocation per section, priority-based truncation under budget pressure, and the rendering pipeline. Absorbs token budget management: each section has a max_tokens allocation and priority; when total exceeds the context window, lowest-priority sections are truncated first.

**Capabilities**: persistent-storage

**State**:
- `assemblies`
- `sections`
- `template_ref`
- `max_tokens`
- `content`
- `assembly_strategy`
- `format`
- `variables`
- `output_directive`
- `tokenizer_id`
- `context_window`

**Actions**:
- `create(strategy, format, tokenizer_id, context_window)` &rarr; ok | invalid
- `addSection(assembly, name, role, priority, max_tokens, required, content, template_ref)` &rarr; ok | notfound
- `setVariable(assembly, name, value)` &rarr; ok | notfound
- `assemble(assembly)` &rarr; ok | over_budget
- `toMessages(assembly)` &rarr; ok | over_budget
- `estimateTokens(assembly)` &rarr; ok | notfound
- `removeSection(assembly, name)` &rarr; ok | notfound

##### PromptPipeline [T] _(derived)_

> Compose prompt assembly, few-shot example selection, optimization, and LLM provider routing into a complete prompt engineering pipeline.

**Composes**: PromptAssembly, FewShotExample, PromptOptimizer, LLMProvider
**Required syncs**: assembly-examples, assembly-optimizer, assembly-provider

**Surface**:
- `assemble` &rarr; PromptAssembly/assemble
- `selectExamples` &rarr; FewShotExample/select
- `optimize` &rarr; PromptOptimizer/optimize
- `generate` &rarr; LLMProvider/generate

#### PromptOptimizer [O]

> Automatically improves prompts using LLM-driven optimization, treating prompt text as a learnable parameter. DSPy paradigm: programming, not prompting. Supports BootstrapFewShot, MIPROv2, COPRO, OPRO, and evolutionary strategies.

**Capabilities**: persistent-storage, network

**State**:
- `runs`
- `target_program`
- `metric`
- `training_set`
- `strategy`
- `history`
- `best_candidate`
- `budget`

**Actions**:
- `create(target, metric, training_set, expected, strategy, max_llm_calls)` &rarr; ok | invalid
- `optimize(optimizer)` &rarr; ok | budget_exceeded | error
- `evaluate(optimizer, program, dataset, expected)` &rarr; ok | error
- `compare(optimizer, programs, dataset, expected)` &rarr; ok | error
- `rollback(optimizer, iteration)` &rarr; ok | notfound

#### Signature [G]

> Declarative definition of an input-output transformation schema for LLM calls. Replaces raw string prompts as the foundational unit of model instruction. Developer specifies WHAT (input/output fields, optional instruction); the compilation engine discovers the optimal prompt formulation for the target model. Recompile for model portability.

**Capabilities**: persistent-storage

**State**:
- `signatures`
- `name`
- `input_fields`
- `description`
- `output_fields`
- `description`
- `instruction`
- `module_type`
- `compiled_prompts`

**Actions**:
- `define(name, input_fields, type, description, output_fields, type, description, instruction, module_type)` &rarr; ok | invalid
- `compile(signature, model_id, examples, output)` &rarr; ok | error
- `execute(signature, model_id, inputs, value)` &rarr; ok | validation_error | not_compiled
- `recompile(signature, target_model)` &rarr; ok | error

### Syncs

- **AssemblyChecksBudget** _(eager)_
  - When: PromptAssembly/assemble
  - Then: PromptAssembly/removeSection
- **AssemblySelectsExamples** _(eager)_
  - When: PromptAssembly/assemble
  - Then: FewShotExample/select
- **AssertionTriggersRetry** _(eager)_
  - When: Assertion/evaluate
  - Then: LLMProvider/generate
- **PromptVersionTracking** _(eager)_
  - When: PromptAssembly/assemble
  - Then: Version/snapshot
- **SignatureCompilesToAssembly** _(eager)_
  - When: Signature/compile
  - Then: PromptAssembly/addSection

### Dependencies

- **llm-core**
- **content**

---

## llm-rag
_v0.1.0_

> Retrieval-augmented generation: vector storage and search, multi-stage retrieval with reranking, and intelligent document chunking. concepts: VectorIndex: spec: ./vector-index.concept params: X: { as: index-id, description: "Vector index identifier" } Retriever: spec: ./retriever.concept params: R: { as: retriever-id, description: "Retriever instance identifier" } DocumentChunk: spec: ./document-chunk.concept params: D: { as: chunk-id, description: "Document chunk identifier" } syncs: required: - path: ./syncs/retriever-embeds-query.sync description: "Retriever/retrieve triggers VectorIndex/embed for query embedding" - path: ./syncs/retriever-searches-index.sync description: "Embedded query vector triggers VectorIndex/search" - path: ./syncs/chunk-embeds-and-indexes.sync description: "DocumentChunk/split triggers VectorIndex/embedBatch" recommended: - path: ./syncs/retriever-reranks-results.sync description: "VectorIndex search results are reranked by Retriever" - path: ./syncs/retriever-injects-into-assembly.sync description: "Retrieved documents inject into PromptAssembly as context" integration: - path: ./syncs/vector-store-provider.sync description: "VectorIndex registers with ContentStorage providers" - path: ./syncs/knowledge-graph-provider.sync description: "GraphRAG entity extraction feeds into Graph concept" - path: ./syncs/embedded-chunks-index.sync description: "Embedded chunk vectors are added to VectorIndex in batch" uses: - suite: llm-core concepts: - name: LLMProvider - suite: llm-prompt optional: true concepts: - name: PromptAssembly - suite: foundation optional: true concepts: - name: ContentNode - suite: data-organization optional: true concepts: - name: Graph

### Concepts

#### DocumentChunk [D]

> Segment of a larger document with metadata, embeddings, and relationship links. Bridge between raw content and vector search. Encapsulates chunking strategies central to RAG quality: recursive, semantic, sentence, fixed-size, structural, agentic.

**Capabilities**: persistent-storage

**State**:
- `chunks`
- `text`
- `metadata`
- `page_number`
- `embedding`
- `relationships`
- `parent_document_id`
- `prev_chunk_id`
- `next_chunk_id`
- `child_chunk_ids`
- `chunk_strategy`
- `token_count`

**Actions**:
- `split(document_id, content, strategy, config, chunk_overlap)` &rarr; ok | error
- `enrich(chunk, extractors)` &rarr; ok | notfound
- `getContext(chunk, window_size)` &rarr; ok | notfound
- `getParent(chunk)` &rarr; ok | notfound

##### RAGPipeline [T] _(derived)_

> Compose document chunking, vector indexing, and retrieval into a complete retrieval-augmented generation pipeline.

**Composes**: DocumentChunk, VectorIndex, Retriever
**Required syncs**: chunk-to-embed, embed-to-index, index-to-retriever

**Surface**:
- `indexDocument` &rarr; DocumentChunk/split
- `search` &rarr; VectorIndex/search
- `retrieve` &rarr; Retriever/retrieve

#### Retriever [R]

> RAG orchestration layer. Takes natural-language query, finds relevant content, prepares for LLM consumption. Multi-stage pipeline: first-stage retrieval (fast, high-recall) then re-ranking (accurate) then compression. Supports multi-query expansion, self-query metadata filtering, contextual compression, and hierarchical retrieval.

**Capabilities**: persistent-storage

**State**:
- `retrievers`
- `retriever_type`
- `source_ids`
- `top_k`
- `reranker_config`
- `filters`
- `score_threshold`

**Actions**:
- `create(retriever_type, source_ids, top_k, score_threshold)` &rarr; ok | invalid
- `retrieve(retriever, query)` &rarr; ok | empty
- `multiQueryRetrieve(retriever, query)` &rarr; ok | empty
- `selfQueryRetrieve(retriever, query)` &rarr; ok | empty
- `rerank(retriever, query, documents, content)` &rarr; ok | error
- `compress(retriever, query, documents, content)` &rarr; ok | error
- `setReranker(retriever, model, top_n)` &rarr; ok | invalid

#### VectorIndex [X]

> Stores embedding vectors with metadata and provides similarity search. The database of the RAG stack. Abstracts over backends from in-process FAISS to managed Pinecone to pgvector. Supports hybrid search combining vector similarity with keyword search via reciprocal rank fusion. Manages its own embedding configuration (model, dimensions) since Embedding was absorbed here.

**Capabilities**: persistent-storage

**State**:
- `indexes`
- `dimensions`
- `distance_metric`
- `index_type`
- `backend`
- `embedding_model`
- `collections`
- `document_count`
- `index_config`

**Actions**:
- `create(dimensions, distance_metric, index_type, backend, embedding_model)` &rarr; ok | invalid
- `embed(index, text)` &rarr; ok | error
- `embedBatch(index, texts)` &rarr; ok | partial
- `add(index, id, vector, metadata)` &rarr; ok | dimension_mismatch
- `addBatch(index, items, vector, metadata)` &rarr; ok | partial
- `search(index, query_vector, k, filters)` &rarr; ok | empty
- `hybridSearch(index, query_vector, keyword_query, vector_weight, k)` &rarr; ok | empty
- `mmrSearch(index, query_vector, k, diversity)` &rarr; ok | empty
- `delete(index, ids)` &rarr; ok | notfound

### Syncs

- **ChunkEmbedsAndIndexes** _(eager)_
  - When: DocumentChunk/split
  - Then: VectorIndex/embedBatch
- **EmbeddedChunksIndex** _(eager)_
  - When: VectorIndex/embedBatch
  - Then: VectorIndex/addBatch
- **KnowledgeGraphProvider** _(eager)_
  - When: DocumentChunk/enrich
  - Then: Graph/addNode
- **RetrieverEmbedsQuery** _(eager)_
  - When: Retriever/retrieve
  - Then: VectorIndex/embed
- **RetrieverInjectsIntoAssembly** _(eager)_
  - When: Retriever/retrieve
  - Then: PromptAssembly/addSection
- **RetrieverSearchesIndex** _(eager)_
  - When: VectorIndex/embed
  - Then: VectorIndex/search
- **VectorStoreProvider** _(eager)_
  - When: VectorIndex/create
  - Then: ContentStorage/register

### Dependencies

- **llm-core**
- **llm-prompt**
- **foundation**
- **data-organization**

---

## llm-safety
_v0.1.0_

> Safety enforcement, execution tracing with cost tracking, and semantic intent routing. concepts: Guardrail: spec: ./guardrail.concept params: G: { as: guardrail-id, description: "Guardrail rule identifier" } LLMTrace: spec: ./llm-trace.concept params: Z: { as: trace-id, description: "Trace identifier" } SemanticRouter: spec: ./semantic-router.concept params: S: { as: route-id, description: "Semantic route identifier" } syncs: required: - path: ./syncs/generation-creates-trace-span.sync description: "LLMProvider/generate completion creates an LLMTrace span" - path: ./syncs/guardrail-checks-input.sync description: "User messages are checked by Guardrail before LLM processing" - path: ./syncs/guardrail-checks-output.sync description: "LLM responses are checked by Guardrail before delivery" recommended: - path: ./syncs/trace-records-cost.sync description: "LLMTrace records per-call cost from generation metadata" - path: ./syncs/guardrail-escalates-to-notification.sync description: "Guardrail violations trigger Notification alerts" - path: ./syncs/router-selects-pipeline.sync description: "SemanticRouter matches intent to processing pipeline" integration: - path: ./syncs/trace-exports-opentelemetry.sync description: "LLMTrace spans export to OpenTelemetry-compatible backends" widgets: - path: ./widgets/execution-metrics-panel.widget description: "Dashboard panel displaying LLM execution metrics (tokens, cost, latency)" - path: ./widgets/tool-call-detail.widget description: "Detailed view of a single tool call in an LLM execution trace" - path: ./widgets/guardrail-config.widget description: "Configuration panel for safety guardrails with rule toggles and test input" surface: entityAffordances: - concept: Guardrail detail: execution-metrics-panel editor: guardrail-config uses: - suite: llm-core concepts: - name: LLMProvider - suite: notification optional: true concepts: - name: Notification - suite: infrastructure optional: true concepts: - name: EventBus

### Concepts

#### Guardrail [G]

> Safety enforcement layer that validates LLM inputs and outputs against configurable rules. Supports content filtering (toxicity, PII, prompt injection), topic restrictions, format validation, and custom predicate checks. Runs both pre-generation (input guardrails) and post-generation (output guardrails). Actions are idempotent safety checks that never modify the content — they only pass, flag, or block.

**Capabilities**: persistent-storage

**State**:
- `guardrails`
- `name`
- `guardrail_type`
- `config`
- `threshold`
- `action_on_violation`
- `categories`
- `rules`
- `violation_log`
- `rule_id`
- `action_taken`

**Actions**:
- `create(name, guardrail_type, config, action_on_violation, categories)` &rarr; ok | invalid
- `addRule(guardrail, pattern, severity)` &rarr; ok | notfound
- `checkInput(guardrail, message)` &rarr; pass | violation
- `checkOutput(guardrail, response)` &rarr; pass | violation
- `check(guardrail, content, direction)` &rarr; pass | blocked | flagged
- `getViolations(guardrail, filters, severity)` &rarr; ok | empty
- `removeRule(guardrail, rule_id)` &rarr; ok | notfound

#### LLMTrace [Z]

> Observability for LLM execution pipelines. Captures hierarchical trace spans covering every LLM call, tool invocation, retrieval operation, and agent step. Tracks latency, token usage, cost, and quality metrics. Enables debugging, cost analysis, and performance optimization. Compatible with OpenTelemetry export.

**Capabilities**: persistent-storage

**State**:
- `traces`
- `name`
- `spans`
- `operation`
- `end_time`
- `metadata`
- `metrics`
- `tags`
- `total_cost`
- `total_tokens`

**Actions**:
- `startTrace(name, tags, value)` &rarr; ok | error
- `startSpan(trace, operation, parent_span_id)` &rarr; ok | notfound
- `endSpan(trace, span_id, status, metrics, cost, latency_ms)` &rarr; ok | notfound
- `addMetric(trace, span_id, key, value)` &rarr; ok | notfound
- `getCost(trace)` &rarr; ok | notfound
- `getTrace(trace)` &rarr; ok | notfound
- `export(trace, format)` &rarr; ok | notfound

#### SemanticRouter [S]

> Routes user messages to appropriate processing pipelines based on semantic intent rather than keyword matching. Uses embedding similarity to match incoming messages against predefined route exemplars. Enables topic-specific handling, guardrail selection, and pipeline branching without explicit classification models.

**Capabilities**: persistent-storage

**State**:
- `routes`
- `name`
- `exemplars`
- `target_pipeline`
- `threshold`
- `fallback_route`

**Actions**:
- `define(name, exemplars, target_pipeline, threshold)` &rarr; ok | invalid
- `route(message)` &rarr; ok | no_match | fallback
- `addExemplar(route, text)` &rarr; ok | notfound
- `setFallback(pipeline)` &rarr; ok
- `getRoutes()` &rarr; ok
- `removeRoute(route)` &rarr; ok | notfound

### Syncs

- **GenerationCreatesTraceSpan** _(eager)_
  - When: LLMProvider/generate
  - Then: LLMTrace/endSpan
- **GuardrailChecksInput** _(eager)_
  - When: Conversation/append
  - Then: Guardrail/checkInput
- **GuardrailChecksOutput** _(eager)_
  - When: LLMProvider/generate
  - Then: Guardrail/checkOutput
- **TraceExportsOpenTelemetry** _(eager)_
  - When: LLMTrace/export
  - Then: EventBus/publish

### Dependencies

- **llm-core**
- **notification**
- **infrastructure**

---

## llm-training
_v0.1.0_

> Fine-tuning lifecycle management, parameter-efficient adaptation (LoRA/QLoRA), and golden evaluation datasets for continuous behavioral testing. concepts: TrainingRun: spec: ./training-run.concept params: J: { as: run-id, description: "Training run identifier" } Adapter: spec: ./adapter.concept params: A: { as: adapter-id, description: "LoRA adapter identifier" } EvaluationDataset: spec: ./evaluation-dataset.concept params: V: { as: dataset-id, description: "Evaluation dataset identifier" } syncs: required: - path: ./syncs/training-evaluates-on-dataset.sync description: "TrainingRun evaluation triggers EvaluationDataset scoring" - path: ./syncs/adapter-attaches-to-provider.sync description: "Merged adapter registers as new LLMProvider" recommended: - path: ./syncs/training-tracks-cost.sync description: "TrainingRun start creates LLMTrace for cost tracking" - path: ./syncs/dataset-detects-drift.sync description: "Drift detection above threshold triggers Notification alert" integration: - path: ./syncs/adapter-registers-with-router.sync description: "Active adapter swap registers with ModelRouter" uses: - suite: llm-core concepts: - name: LLMProvider - name: ModelRouter - suite: llm-safety optional: true concepts: - name: LLMTrace

### Concepts

#### Adapter [A]

> LoRA/QLoRA weight management for parameter-efficient fine-tuning. Injects trainable low-rank decomposition matrices into frozen base model layers. Supports training (typically <0.2% of total parameters), merging into base weights (zero inference latency), hot-swapping at inference time, and composing multiple adapters.

**Capabilities**: persistent-storage

**State**:
- `adapters`
- `name`
- `base_model_id`
- `rank`
- `target_modules`
- `quantization`
- `weights`
- `training_status`
- `merged`

**Actions**:
- `create(name, base_model_id, rank, target_modules, quantization)` &rarr; ok | invalid
- `train(adapter, dataset_ref, config, epochs, batch_size)` &rarr; ok | error
- `merge(adapter)` &rarr; ok | not_trained
- `swap(adapter, active)` &rarr; ok | not_trained
- `compose(adapter_a, adapter_b)` &rarr; ok | incompatible
- `export(adapter, format)` &rarr; ok | not_trained

#### EvaluationDataset [V]

> Golden datasets for continuous behavioral testing of LLM systems. Curated collections of reference inputs and expected outcomes. Detects prompt drift (silent degradation when models update). Supports LLM-as-judge evaluation, semantic scoring, and statistical comparison between versions.

**Capabilities**: persistent-storage

**State**:
- `datasets`
- `name`
- `examples`
- `rubric`
- `version`
- `evaluation_history`
- `program`
- `score`
- `drift_baseline`
- `scores`

**Actions**:
- `create(name, examples, expected, rubric, tags)` &rarr; ok | invalid
- `addExample(dataset, input, expected, rubric, tags)` &rarr; ok | notfound
- `evaluate(dataset, program, metrics)` &rarr; ok | error
- `detectDrift(dataset, current_program)` &rarr; ok | no_baseline
- `setBaseline(dataset, program)` &rarr; ok | notfound
- `compare(dataset, program_a, program_b)` &rarr; ok | error
- `curate(dataset, filter_tags)` &rarr; ok | empty

#### TrainingRun [J] `@gate`

> Manages fine-tuning job lifecycle: dataset preparation, hyperparameter configuration, training execution, checkpoint management, evaluation, and model export. Supports both full fine-tuning and parameter-efficient methods (via sync to Adapter). Tracks cost and resource usage.

**Capabilities**: persistent-storage, network

**State**:
- `runs`
- `name`
- `base_model`
- `dataset_ref`
- `hyperparameters`
- `learning_rate`
- `epochs`
- `batch_size`
- `warmup_steps`
- `status`
- `checkpoints`
- `timestamp`
- `evaluation_scores`
- `cost`
- `duration_ms`

**Actions**:
- `create(name, base_model, dataset_ref, hyperparameters, epochs, batch_size, warmup_steps)` &rarr; ok | invalid
- `start(run)` &rarr; ok
- `pause(run)` &rarr; ok | not_running
- `resume(run)` &rarr; ok | not_paused
- `evaluate(run, dataset_ref)` &rarr; ok | not_ready
- `export(run, format)` &rarr; ok | not_complete
- `cancel(run)` &rarr; ok | not_running
- `getStatus(run)` &rarr; ok | notfound

### Syncs

- **AdapterAttachesToProvider** _(eager)_
  - When: Adapter/merge
  - Then: LLMProvider/register
- **AdapterRegistersWithRouter** _(eager)_
  - When: Adapter/swap
  - Then: ModelRouter/addRoute
- **TrainingEvaluatesOnDataset** _(eager)_
  - When: TrainingRun/evaluate
  - Then: EvaluationDataset/evaluate

### Dependencies

- **llm-core**
- **llm-safety**

---

## media
_v0.1.0_

> "Media and file handling — file uploads, media asset creation, metadata extraction, and usage tracking."

### Concepts

#### FileManagement [F]

> Manage file lifecycle with reference counting and garbage collection to prevent orphaned files.

**State**:
- `files`
- `usageRecords`
- `streamWrappers`
- `data`
- `mimeType`

**Actions**:
- `upload(file, data, mimeType)` &rarr; ok | error
- `addUsage(file, entity)` &rarr; ok | notfound
- `removeUsage(file, entity)` &rarr; ok | notfound
- `garbageCollect()` &rarr; ok
- `getFile(file)` &rarr; ok | notfound

#### MediaAsset [M]

> Provide a source-abstracted asset facade wrapping heterogeneous file types with metadata extraction and thumbnail generation.

**State**:
- `mediaEntities`
- `sourcePlugin`
- `metadata`
- `thumbnail`
- `originalFile`

**Actions**:
- `createMedia(asset, source, file)` &rarr; ok | error
- `extractMetadata(asset)` &rarr; ok | notfound
- `generateThumbnail(asset)` &rarr; ok | notfound
- `getMedia(asset)` &rarr; ok | notfound

##### MediaLibrary [T] _(derived)_

> Manage a media library with asset ingestion, file storage, tag-based organization, and curated collections.

**Composes**: MediaAsset, FileManagement, Tag, Collection
**Required syncs**: asset-file-link, asset-tag-classify, asset-collection-membership, file-thumbnail

**Surface**:
- `upload` &rarr; MediaAsset/createMedia
- `tag` &rarr; Tag/addTag
- `addToCollection` &rarr; Collection/addMember

### Syncs

- **ExtractMetadataOnUpload** _(eager)_
  - When: FileManagement/upload
  - Then: MediaAsset/createMedia
- **TrackUsageOnCreate** _(eager)_
  - When: MediaAsset/createMedia
  - Then: FileManagement/addUsage

---

## new-app
_v0.1.0_

> End-to-end new project creation workflow. Combines template browsing, target profiling, module selection, project scaffolding, and the package management pipeline into a coordinated flow that produces a runnable Clef project from a single command. concepts: AppTemplate: spec: ./app-template.concept params: T: { as: template, description: "App template definition" } TargetProfile: spec: ./target-profile.concept params: P: { as: profile, description: "Target profile configuration" } ModuleSelection: spec: ./module-selection.concept params: S: { as: selection, description: "Module selection session" } ProjectInit: spec: ./project-init.concept params: J: { as: init, description: "Project initialization record" } syncs: required: - path: ./syncs/required/template-to-selection.sync description: "Template customization seeds a module selection session" - path: ./syncs/required/profile-to-selection.sync description: "Validated target profile derives infrastructure modules" - path: ./syncs/required/selection-to-init.sync description: "Finalized module selection creates a project initialization" - path: ./syncs/required/init-scaffold-chain.sync description: "Project creation triggers sequential manifest and scaffold writes" - path: ./syncs/required/init-to-package-chain.sync description: "Manifest write triggers dependency installation via the package suite" - path: ./syncs/required/install-to-generate.sync description: "Installer activation triggers code generation" - path: ./syncs/required/generate-to-complete.sync description: "Successful code generation finalizes the project initialization" uses: - suite: package concepts: - name: Manifest - name: Resolver - name: Lockfile - name: Fetcher - name: ContentStore - name: Installer - suite: generation concepts: - name: Emitter - suite: framework concepts: - name: SchemaGen - suite: scaffolding concepts: - name: ProjectScaffold - suite: foundation concepts: - name: ContentNode - name: ContentStorage - name: Outline - name: Property - name: TypeSystem - name: PageAsRecord - name: ContentParser - name: Intent - suite: content concepts: - name: Comment - name: Template - name: Canvas - name: Version - name: DailyNote - name: SyncedContent - suite: data-integration concepts: - name: DataSource - name: Connector - name: Capture - name: FieldMapping - name: Transform - name: Enricher - name: SyncPair - name: DataQuality - name: Provenance - name: ProgressiveSchema - suite: data-organization concepts: - name: Collection - name: Graph

### Concepts

#### AppTemplate [T]

> Curated starting configurations that bundle related concepts, syncs, derived concepts, and feature defaults into named templates. Templates compose data and content primitives from the Repertoire's Foundation, Content, Data-Integration, and Data-Organization suites, giving each new project structured storage, content modeling, and data pipeline capabilities out of the box. Enables rapid project bootstrapping by category while allowing customization of the included module set.

**State**:
- `templates`
- `name`
- `description`
- `category`
- `included_modules`
- `module_id`
- `kind`
- `required`
- `rationale`
- `included_syncs`
- `suggested_derived`
- `name`
- `composes`
- `default_features`
- `module_id`
- _(4 more fields)_

**Actions**:
- `list(category)` &rarr; ok
- `detail(name)` &rarr; ok | notfound
- `customize(template, add, remove, features)` &rarr; ok | invalid
- `register(name, description, category, modules, syncs)` &rarr; ok | duplicate

##### NewApp [T] _(derived)_

> End-to-end orchestration of new project creation. Apps are built from data and content primitives drawn from the Repertoire's Foundation, Content, Data-Integration, and Data-Organization suites, ensuring every project starts with structured storage, content modeling, and data pipeline capabilities. Composes template browsing, target profiling, module selection, project scaffolding, and the full package management pipeline (resolve, fetch, install) into a single coordinated workflow that takes a user from "I want a social app" to a runnable project on disk.

**Composes**: AppTemplate, TargetProfile, ModuleSelection, ProjectInit, Manifest, Resolver, Lockfile, Fetcher, ContentStore, Installer, ContentNode, ContentStorage, Outline, Property, TypeSystem, PageAsRecord, ContentParser, Intent, Comment, Template, Canvas, Version, DailyNote, SyncedContent, DataSource, Connector, Capture, FieldMapping, Transform, Enricher, SyncPair, DataQuality, Provenance, ProgressiveSchema, Collection, Graph
**Required syncs**: template-to-selection, profile-to-selection, selection-to-init, init-scaffold-chain, init-to-package-chain, install-to-generate, generate-to-complete

**Surface**:
- `createFromTemplate` &rarr; AppTemplate/customize
- `createCustom` &rarr; ModuleSelection/begin
- `browseTemplates` &rarr; AppTemplate/list
- `configureTargets` &rarr; TargetProfile/validate
- `previewProject` &rarr; ModuleSelection/preview

#### ModuleSelection [S]

> Compute the complete set of modules needed for a new project by combining template defaults, target profile requirements, and manual selections. Tracks concepts, syncs, handlers, widgets, themes, bind targets, SDK providers, deploy providers, and derived concepts, then flattens everything into a final module list for installation.

**State**:
- `selections`
- `template_name`
- `profile_name`
- `selected_concepts`
- `module_id`
- `source`
- `selected_syncs`
- `module_id`
- `source`
- `selected_handlers`
- `concept_module`
- `handler_module`
- `language`
- `selected_widgets`
- `module_id`
- _(14 more fields)_

**Actions**:
- `begin(template_name, profile_name)` &rarr; ok | template_notfound | profile_notfound
- `addConcept(selection, module_id, features)` &rarr; already_selected
- `removeConcept(selection, module_id)` &rarr; required | has_dependents
- `chooseHandler(selection, concept_module, handler_module)` &rarr; incompatible | language_mismatch
- `addWidget(selection, module_id)` &rarr; ok
- `selectTheme(selection, theme_module)` &rarr; ok
- `addDerived(selection, name, composes)` &rarr; missing_concepts
- `finalize(selection)` &rarr; ok | incomplete
- `preview(selection)` &rarr; ok

#### ProjectInit [J]

> Create the physical project structure on disk from a finalized module selection. Orchestrates manifest writing, interface and deploy manifest generation, derived concept scaffolding, dependency installation, and code generation, tracking status through each stage.

**State**:
- `inits`
- `project_name`
- `project_path`
- `module_list`
- `module_id`
- `kind`
- `version_range`
- `features`
- `profile`
- `backend_languages`
- `frontend_frameworks`
- `api_interfaces`
- `deploy_targets`
- `derived_concepts`
- `name`
- _(4 more fields)_

**Actions**:
- `create(project_name, project_path, module_list, profile, derived_concepts)` &rarr; ok | already_exists | invalid_path
- `writeManifest(init)` &rarr; error
- `writeInterfaceManifests(init)` &rarr; ok
- `writeDeployManifests(init)` &rarr; ok
- `writeDerivedConcepts(init)` &rarr; ok
- `triggerInstall(init)` &rarr; error
- `triggerGenerate(init)` &rarr; error
- `complete(init)` &rarr; ok

#### TargetProfile [P]

> Specify the deployment target dimensions for a new project including backend languages, frontend frameworks, API interfaces, SDK languages, deploy targets, and storage/transport adapters. Validates compatibility across dimensions and derives the required module set from the combined selections.

**State**:
- `profiles`
- `name`
- `backend_languages`
- `frontend_frameworks`
- `api_interfaces`
- `sdk_languages`
- `deploy_targets`
- `storage_adapters`
- `transport_adapters`

**Actions**:
- `create(name)` &rarr; ok
- `setBackendLanguages(profile, languages)` &rarr; invalid
- `setFrontendFrameworks(profile, frameworks)` &rarr; invalid
- `setApiInterfaces(profile, interfaces)` &rarr; invalid
- `setSdkLanguages(profile, languages)` &rarr; ok
- `setDeployTargets(profile, targets)` &rarr; incompatible
- `setStorageAdapters(profile, adapters)` &rarr; ok
- `setTransportAdapters(profile, adapters)` &rarr; ok
- `validate(profile)` &rarr; incomplete | incompatible
- `deriveModules(profile)` &rarr; ok
- `listOptions()` &rarr; ok

### Syncs

- **GenerateToComplete** _(eager)_
  - When: ProjectInit/triggerGenerate
  - Then: ProjectInit/complete
- **InitScaffoldChain** _(eager)_
  - When: ProjectInit/create
  - Then: ProjectInit/writeManifest
- **ScaffoldWriteInterfaces** _(eager)_
  - When: ProjectInit/writeManifest
  - Then: ProjectInit/writeInterfaceManifests
- **ScaffoldWriteDeploy** _(eager)_
  - When: ProjectInit/writeInterfaceManifests
  - Then: ProjectInit/writeDeployManifests
- **ScaffoldWriteDerived** _(eager)_
  - When: ProjectInit/writeDeployManifests
  - Then: ProjectInit/writeDerivedConcepts
- **InitToPackageChain** _(eager)_
  - When: ProjectInit/writeManifest
  - Then: ProjectInit/triggerInstall
- **InstallToGenerate** _(eager)_
  - When: Installer/activate
  - Then: ProjectInit/triggerGenerate
- **ProfileToSelection** _(eager)_
  - When: TargetProfile/validate
  - Then: TargetProfile/deriveModules
- **SelectionToInit** _(eager)_
  - When: ModuleSelection/finalize
  - Then: ProjectInit/create
- **TemplateToSelection** _(eager)_
  - When: AppTemplate/customize
  - Then: ModuleSelection/begin

### Dependencies

- **package**
- **generation**
- **framework**
- **scaffolding**
- **foundation**
- **content**
- **data-integration**
- **data-organization**

---

## notification
_v0.1.0_

> "User notifications — delivery, read tracking, and automatic status management for notification channels."

### Concepts

#### Notification [N]

> Deliver user-facing alerts across multiple channels with subscription management, templating, and inbox tracking.

**State**:
- `channels`
- `templates`
- `subscriptions`
- `inbox`
- `deliveryLog`
- `read`

**Actions**:
- `registerChannel(name, config)` &rarr; ok | exists
- `defineTemplate(notification, template)` &rarr; ok | exists
- `subscribe(user, eventType, channel)` &rarr; ok | exists
- `unsubscribe(user, eventType, channel)` &rarr; ok | notfound
- `notify(notification, user, template, data)` &rarr; ok | error
- `markRead(notification)` &rarr; ok | notfound
- `getUnread(user)` &rarr; ok

### Syncs

- **AutoReadOnView** _(eager)_
  - When: Notification/getUnread
  - Then: Notification/markRead

---

## package
_v0.1.0_

> Package management — dependency resolution, lockfile serialization, artifact fetching, transactional installation, registry indexing, content-addressed storage, feature flags, vulnerability auditing, and publication with provenance attestation. Provides the full dependency lifecycle from manifest authoring through installation and publishing. concepts: # --- Core concepts --- Manifest: spec: ./core/manifest.concept params: P: { as: project, description: "Project manifest" } Resolver: spec: ./core/resolver.concept params: R: { as: resolution, description: "Dependency resolution" } Lockfile: spec: ./core/lockfile.concept params: L: { as: lockfile, description: "Serialized resolution graph" } Registry: spec: ./core/registry.concept params: M: { as: module, description: "Published module record" } FeatureFlag: spec: ./core/feature-flag.concept params: F: { as: flag, description: "Compile-time feature toggle" } ComponentManifest: spec: ./core/component-manifest.concept params: C: { as: component, description: "Module capability manifest" } # --- Distribution concepts --- Fetcher: spec: ./distribution/fetcher.concept params: D: { as: download, description: "Artifact download" } Installer: spec: ./distribution/installer.concept params: I: { as: installation, description: "Installation generation" } ContentStore: spec: ./distribution/content-store.concept params: B: { as: blob, description: "Content-addressed blob" } Publisher: spec: ./distribution/publisher.concept params: U: { as: publication, description: "Publication record" } Auditor: spec: ./distribution/auditor.concept params: A: { as: audit, description: "Vulnerability audit" } Download: spec: ./distribution/download.concept params: D: { as: download, description: "Platform artifact distribution" } SelfUpdate: spec: ./distribution/self-update.concept params: U: { as: update, description: "Binary self-update lifecycle" } syncs: required: - path: ./syncs/required/manifest-to-resolution.sync description: "Validated manifest triggers dependency resolution via Resolver" - path: ./syncs/required/resolution-to-lockfile.sync description: "Successful resolution is persisted as a lockfile" - path: ./syncs/required/lockfile-to-fetch.sync description: "Written lockfile triggers batch artifact download" - path: ./syncs/required/fetch-to-install.sync description: "Fetched artifacts are staged into a new installation generation" - path: ./syncs/required/stage-to-activate.sync description: "Staged installation is atomically activated" - path: ./syncs/required/publish-to-registry.sync description: "Uploaded publication is indexed in the Registry" - path: ./syncs/required/integrity-check-on-fetch.sync description: "Every fetched artifact is verified against the ContentStore" - path: ./syncs/required/feature-unification.sync description: "Feature flags are unified across the dependency graph after resolution" recommended: - path: ./syncs/recommended/auto-audit-on-install.sync description: "Activated installation triggers eventual vulnerability audit" - path: ./syncs/recommended/provenance-on-publish.sync description: "Packaged artifact receives attestation, SBOM, and signature before upload" integration: - path: ./syncs/integration/garbage-collect-on-clean.sync description: "Cleaned installation generations trigger ContentStore garbage collection" widgets: - path: ./widgets/dependency-tree.widget description: "Interactive dependency tree viewer for package manifests" - path: ./widgets/audit-report.widget description: "Security audit report panel with severity breakdown and remediation" - path: ./widgets/registry-search.widget description: "Search interface for the package registry with type-ahead suggestions" surface: entityAffordances: - concept: Manifest detail: dependency-tree - concept: Auditor detail: audit-report - concept: Registry card: registry-search uses: - suite: infrastructure concepts: - name: PluginRegistry - suite: generation concepts: - name: Emitter optional: true

### Concepts

#### Auditor [A]

> Vulnerability scanning and policy enforcement for package dependencies. Checks resolved lockfile entries against advisory databases and organizational policies for license compliance and namespace restrictions.

**State**:
- `audits`
- `lockfile_hash`
- `advisories`
- `module_id`
- `version`
- `severity`
- `cve`
- `description`
- `fix_version`
- `policy_violations`
- `module_id`
- `rule`
- `message`
- `audit_at`

**Actions**:
- `audit(lockfile_entries, version)` &rarr; ok | error
- `checkPolicy(lockfile_entries, version, policy, denied_namespaces, max_severity)` &rarr; ok | violations
- `diff(old_audit, new_audit)` &rarr; ok

#### ComponentManifest [C]

> Describes what a published module exposes: concept specs, syncs, derived compositions, widgets, and handlers. Allows the registry to index module capabilities for search and dependency analysis, and enables tooling to understand module structure without downloading the full package.

**State**:
- `components`
- `module_id`
- `version`
- `concepts`
- `name`
- `spec_path`
- `type_params`
- `syncs`
- `name`
- `path`
- `annotation`
- `derived`
- `name`
- `path`
- `composes`
- _(11 more fields)_

**Actions**:
- `register(module_id, version, concepts, spec_path, type_params, syncs, path, annotation, derived, path, composes, widgets, path, concept, provider, handlers, path, language, concept)` &rarr; ok | invalid
- `lookup(module_id, version)` &rarr; ok | notfound
- `search(capability)` &rarr; ok | empty

#### ContentStore [B]

> Content-addressed blob storage for package artifacts. Deduplicates identical content via cryptographic hashing, tracks reference counts, and supports garbage collection of unreferenced blobs.

**State**:
- `blobs`
- `hash`
- `size`
- `media_type`
- `stored_at`
- `storage_path`
- `reference_count`

**Actions**:
- `store(data, media_type)` &rarr; ok | error
- `retrieve(hash)` &rarr; ok | notfound
- `verify(hash)` &rarr; ok | corrupted
- `gc(lockfile_hashes)` &rarr; ok
- `stats()` &rarr; ok

#### Download [D]

> Per-platform binary artifact distribution. Tracks downloadable artifacts by platform and version, maintains download counts, and supports yanking artifacts from distribution while preserving existing installations.

**State**:
- `downloads`
- `artifact_id`
- `platform`
- `version`
- `content_hash`
- `artifact_url`
- `size_bytes`
- `download_count`
- `yanked`
- `registered_at`

**Actions**:
- `register(artifact_id, platform, version, content_hash, artifact_url, size_bytes)` &rarr; ok | exists | invalid
- `resolve(artifact_id, platform, version_range)` &rarr; ok | notfound | yanked
- `yank(download)` &rarr; ok | notfound | already_yanked
- `stats(artifact_id)` &rarr; ok | notfound

#### FeatureFlag [F]

> Additive compile-time feature toggles for modules. Each feature flag gates additional dependencies and capabilities that are only included when the feature is enabled. Features are unified across the dependency graph using set union, with optional mutual-exclusion constraints to prevent incompatible feature combinations.

**Capabilities**: feature, feature

**State**:
- `flags`
- `module_id`
- `name`
- `default`
- `additional_deps`
- `mutually_exclusive_with`
- `enabled`

**Actions**:
- `enable(flag)` &rarr; ok | conflict | notfound
- `disable(flag)` &rarr; ok | notfound
- `unify(flags)` &rarr; ok | conflict

#### Fetcher [D]

> Download package artifacts from registries and caches. Manages individual and batch downloads with integrity verification, progress tracking, and cancellation support.

**State**:
- `downloads`
- `module_id`
- `version`
- `source_url`
- `expected_hash`
- `status`
- `bytes_downloaded`
- `bytes_total`
- `error`
- `started_at`
- `completed_at`

**Actions**:
- `fetch(module_id, version, source_url, expected_hash)` &rarr; ok | cached | integrity_failure | network_error
- `fetchBatch(items, version, source_url, expected_hash)` &rarr; ok | partial
- `cancel(download)` &rarr; ok

#### Installer [I]

> Staged transactional installation of resolved packages. Each installation is an immutable generation that can be atomically activated or rolled back. Supports generational cleanup to reclaim disk space.

**State**:
- `installations`
- `generation`
- `lockfile_hash`
- `staged_modules`
- `module_id`
- `version`
- `content_hash`
- `target_path`
- `kind`
- `active`
- `previous_generation`
- `installed_at`

**Actions**:
- `stage(lockfile_entries, version, content_hash, target_path, kind, project_root)` &rarr; ok | error
- `activate(installation)` &rarr; ok | error
- `rollback(installation)` &rarr; ok | no_previous
- `clean(keep_generations)` &rarr; ok

#### Lockfile [L]

> Serialized resolved dependency graph. Captures the exact module versions, content hashes, artifact URLs, and enabled features from a successful resolution, ensuring deterministic and reproducible installations across environments. Supports integrity verification and diffing between versions.

**State**:
- `lockfiles`
- `project_hash`
- `entries`
- `module_id`
- `version`
- `content_hash`
- `artifact_url`
- `integrity`
- `features_enabled`
- `dependencies`
- `metadata`
- `resolver_version`
- `resolved_at`
- `registry_snapshot`

**Actions**:
- `write(project_hash, entries, version, content_hash, artifact_url, integrity, features_enabled, dependencies, metadata, resolved_at, registry_snapshot)` &rarr; ok | error
- `read(lockfile)` &rarr; ok | notfound | corrupt
- `verify(lockfile)` &rarr; ok | stale | tampered
- `diff(old_lockfile, new_lockfile)` &rarr; ok | error

#### Manifest [P]

> Declarative project configuration file. Describes a project's identity, dependency requirements with version ranges and feature selections, registry sources, dependency overrides, patches, and target platform constraints. Serves as the human-authored input to the Resolver.

**State**:
- `projects`
- `name`
- `version`
- `dependencies`
- `module_id`
- `version_range`
- `edge_type`
- `environment`
- `features`
- `optional`
- `overrides`
- `module_id`
- `replacement_id`
- `replacement_source`
- `version_pin`
- _(15 more fields)_

**Actions**:
- `add(project, module_id, version_range, edge_type, environment, features, optional)` &rarr; ok | exists | invalid
- `remove(project, module_id)` &rarr; ok | notfound
- `override(project, module_id, replacement_id, replacement_source, version_pin)` &rarr; ok | invalid
- `disable(project, module_id)` &rarr; ok | notfound
- `enable(project, module_id)` &rarr; ok | notfound
- `merge(base, overlay)` &rarr; ok | conflict
- `validate(project)` &rarr; ok | invalid

#### Publisher [U]

> Package and upload modules to a registry. Manages the full publication lifecycle: artifact packaging, cryptographic signing, provenance attestation, SBOM generation, and registry upload.

**State**:
- `publications`
- `module_id`
- `version`
- `artifact_hash`
- `signature`
- `provenance`
- `builder`
- `source_repo`
- `source_commit`
- `build_timestamp`
- `slsa_level`
- `sbom`
- `status`

**Actions**:
- `package(source_path, kind, manifest, version, dependencies)` &rarr; ok | invalid
- `sign(publication)` &rarr; ok | error
- `attest(publication, builder, source_repo, source_commit)` &rarr; ok
- `generateSbom(publication)` &rarr; ok
- `upload(publication, registry_url)` &rarr; ok | duplicate | unauthorized | error

#### Registry [M]

> Index of available module metadata. Stores published module records with versioned artifacts, dependency edges, capability declarations, and compile-time feature definitions. Supports lookup by name/namespace/version range, capability-based discovery, and full-text search.

**State**:
- `modules`
- `name`
- `namespace`
- `version`
- `kind`
- `spec_version`
- `compatible_spec`
- `dependencies`
- `module_id`
- `version_range`
- `edge_type`
- `environment`
- `capabilities_provided`
- `capabilities_required`
- `features`
- _(13 more fields)_

**Actions**:
- `publish(name, namespace, version, kind, artifact_hash, dependencies, version_range, edge_type, environment, metadata, license, repository, authors, keywords)` &rarr; ok | duplicate | invalid
- `yank(module)` &rarr; ok | notfound
- `lookup(name, namespace, version_range)` &rarr; ok | notfound
- `search(query, kind, namespace)` &rarr; ok
- `listVersions(name, namespace)` &rarr; ok | notfound
- `resolveCapability(capability)` &rarr; ok | notfound

#### Resolver [R]

> PubGrub-based conflict-driven dependency solver. Accepts a set of input constraints and a resolution policy, then produces a fully resolved module graph with exact versions, content hashes, and enabled features. Provides human-readable conflict explanations when resolution is unsolvable.

**State**:
- `resolutions`
- `input_constraints`
- `module_id`
- `version_range`
- `edge_type`
- `environment`
- `features`
- `resolved_modules`
- `module_id`
- `resolved_version`
- `content_hash`
- `features_enabled`
- `resolution_policy`
- `unification_strategy`
- `feature_unification`
- _(4 more fields)_

**Actions**:
- `resolve(constraints, version_range, edge_type, environment, features, policy, feature_unification, prefer_locked, allowed_updates, locked_versions, version, content_hash)` &rarr; ok | unsolvable | error
- `update(resolution, targets, policy, feature_unification, prefer_locked, allowed_updates)` &rarr; ok | unsolvable
- `explain(resolution, module_id)` &rarr; ok | notfound

#### SelfUpdate [U]

> Binary self-update lifecycle. Checks for newer versions of a running binary, downloads and atomically swaps the executable, and supports rollback to the previous version on failure. Manages a state machine from idle through checking, downloading, swapping, to done or failed.

**State**:
- `updates`
- `current_version`
- `platform`
- `latest_version`
- `download_url`
- `content_hash`
- `binary_path`
- `previous_binary_path`
- `status`
- `error_message`
- `checked_at`

**Actions**:
- `check(current_version, platform)` &rarr; available | current | error
- `apply(update, binary_path)` &rarr; ok | hash_mismatch | permission_denied | error
- `rollback(update)` &rarr; ok | no_backup | error
- `dismiss(update)` &rarr; ok | notfound

### Syncs

- **ProvenanceOnPublish** _(eager)_
  - When: Publisher/package
  - Then: Publisher/attest
- **FeatureUnification** _(eager)_
  - When: Resolver/resolve
  - Then: FeatureFlag/unify
- **FetchToInstall** _(eager)_
  - When: Fetcher/fetchBatch
  - Then: Installer/stage
- **IntegrityCheckOnFetch** _(eager)_
  - When: Fetcher/fetch
  - Then: ContentStore/verify
- **LockfileToFetch** _(eager)_
  - When: Lockfile/write
  - Then: Fetcher/fetchBatch
- **ManifestToResolution** _(eager)_
  - When: Manifest/validate
  - Then: Resolver/resolve
- **PublishToRegistry** _(eager)_
  - When: Publisher/upload
  - Then: Registry/publish
- **ResolutionToLockfile** _(eager)_
  - When: Resolver/resolve
  - Then: Lockfile/write
- **StageToActivate** _(eager)_
  - When: Installer/stage
  - Then: Installer/activate

### Dependencies

- **infrastructure**
- **generation**

---

## parse
_v0.1.0_

---

## presentation
_v0.1.0_

> "View rendering and display — views, display modes, form building, and renderers for presenting content to users."

### Concepts

#### DisplayMode [D]

> Define named presentation profiles that control how each field renders in different contexts (view mode, edit mode, teaser mode).

**State**:
- `modes`
- `fieldDisplayConfigs`
- `fieldFormConfigs`
- `name`

**Actions**:
- `defineMode(mode, name)` &rarr; ok | exists
- `configureFieldDisplay(mode, field, config)` &rarr; ok | notfound
- `configureFieldForm(mode, field, config)` &rarr; ok | notfound
- `renderInMode(mode, entity)` &rarr; ok | notfound

#### FormBuilder [F]

> Generate form structure from schema definitions. Delegates validation to Validator (via FormSubmitValidation sync), widget management to PluginRegistry (via WidgetDiscovery sync), and field display to DisplayMode (via FormFieldDisplay sync).

**State**:
- `formDefinitions`
- `schema`

**Actions**:
- `buildForm(form, schema)` &rarr; ok | error

#### Renderer [R]

> Compose nested content into final output through a cache-aware rendering pipeline with placeholder support and streaming.

**State**:
- `renderers`
- `renderTree`
- `placeholders`
- `cacheability`

**Actions**:
- `render(renderer, tree)` &rarr; ok | error
- `autoPlaceholder(renderer, name)` &rarr; ok
- `stream(renderer, tree)` &rarr; ok | error
- `mergeCacheability(renderer, tags)` &rarr; ok

#### View [V]

> Provide multiple visual representations (table, board, calendar, gallery, list) of the same underlying dataset with independent filter/sort/group configuration.

**State**:
- `views`
- `dataSource`
- `layout`
- `filters`
- `sorts`
- `groups`
- `visibleFields`
- `formatting`

**Actions**:
- `create(view, dataSource, layout)` &rarr; ok | error
- `setFilter(view, filter)` &rarr; ok | notfound
- `setSort(view, sort)` &rarr; ok | notfound
- `setGroup(view, group)` &rarr; ok | notfound
- `setVisibleFields(view, fields)` &rarr; ok | notfound
- `changeLayout(view, layout)` &rarr; ok | notfound
- `duplicate(view)` &rarr; ok | notfound
- `embed(view)` &rarr; ok | notfound

### Syncs

- **FormFieldDisplay** _(eager)_
  - When: FormBuilder/buildForm
  - Then: DisplayMode/configureFieldForm
- **FormSubmitValidation** _(eager)_
  - When: FormBuilder/buildForm
  - Then: Validator/registerConstraint
- **RenderView** _(eager)_
  - When: View/create
  - Then: Renderer/render
- **FormFromView** _(eager)_
  - When: View/changeLayout
  - Then: DisplayMode/renderInMode
- **BuildFormFromSchema** _(eager)_
  - When: DisplayMode/configureFieldForm
  - Then: FormBuilder/registerWidget
- **WidgetDiscovery** _(eager)_
  - When: FormBuilder/buildForm
  - Then: PluginRegistry/discover

---

## process-automation
_v0.1.0_

> "External system integration: connector calls, webhook inbox, timers"

### Concepts

#### ConnectorCall [C] `@gate`

> Track a single outbound call to an external system within a process step, with idempotency keys and status lifecycle. Actual I/O is delegated to providers.

**Capabilities**: persistent-storage, network

**State**:
- `calls`
- `step_ref`
- `connector_type`
- `operation`
- `input`
- `output`
- `status`
- `idempotency_key`
- `error`
- `invoked_at`
- `completed_at`

**Actions**:
- `invoke(step_ref, connector_type, operation, input, idempotency_key)` &rarr; ok | duplicate
- `mark_success(call, output)` &rarr; ok | not_invoking
- `mark_failure(call, error)` &rarr; error | not_invoking
- `get_result(call)` &rarr; ok | not_found

#### Timer [T] `@gate`

> Introduce time-based triggers into process execution: absolute dates, relative durations, and recurring cycles.

**Capabilities**: persistent-storage

**State**:
- `timers`
- `run_ref`
- `purpose_tag`
- `timer_type`
- `specification`
- `status`
- `fire_count`
- `next_fire_at`
- `context_ref`

**Actions**:
- `set_timer(run_ref, timer_type, specification, purpose_tag, context_ref)` &rarr; ok | invalid_spec
- `fire(timer)` &rarr; ok | not_active
- `cancel(timer)` &rarr; ok | not_active
- `reset(timer, specification)` &rarr; ok

#### WebhookInbox [H] `@gate`

> Receive and correlate inbound events from external systems to waiting process instances using correlation keys.

**Capabilities**: persistent-storage

**State**:
- `hooks`
- `run_ref`
- `step_ref`
- `event_type`
- `correlation_key`
- `status`
- `payload`
- `registered_at`
- `received_at`

**Actions**:
- `register(run_ref, step_ref, event_type, correlation_key)` &rarr; ok
- `receive(correlation_key, event_type, payload)` &rarr; ok | no_match
- `expire(hook)` &rarr; ok | not_waiting
- `ack(hook)` &rarr; ok | not_received

### Syncs

- **AutomationStepDispatch** _(eager)_
  - When: StepRun/start
  - Then: ConnectorCall/invoke
- **ConnectorFailure** _(eager)_
  - When: ConnectorCall/mark_failure
  - Then: StepRun/fail
- **ConnectorProviderDispatch** _(eager)_
  - When: ConnectorCall/invoke
  - Then: provider/execute
- **ConnectorSuccess** _(eager)_
  - When: ConnectorCall/mark_success
  - Then: StepRun/complete
- **StepTimeoutCancel** _(eager)_
  - When: Timer/fire
  - Then: StepRun/cancel
- **StepTimeoutCreate** _(eager)_
  - When: StepRun/start
  - Then: Timer/set_timer
- **StepTimeoutEscalate** _(eager)_
  - When: Timer/fire
  - Then: Escalation/escalate
- **StepTimeoutFail** _(eager)_
  - When: Timer/fire
  - Then: StepRun/fail
- **WebhookReceived** _(eager)_
  - When: WebhookInbox/receive
  - Then: StepRun/complete
- **WebhookStepDispatch** _(eager)_
  - When: StepRun/start
  - Then: WebhookInbox/register

---

## process-foundation
_v0.1.0_

> "Process execution kernel: specs, runs, steps, flow tokens, variables, event log"

### Concepts

#### FlowToken [K]

> Track active control-flow positions within a process run to enable parallel branching (fork), synchronization (join), and dead-path elimination.

**Capabilities**: persistent-storage

**State**:
- `tokens`
- `run_ref`
- `position`
- `status`
- `branch_id`
- `created_at`

**Actions**:
- `emit(run_ref, position, branch_id)` &rarr; ok
- `consume(token)` &rarr; ok | not_active
- `kill(token)` &rarr; ok | not_active
- `count_active(run_ref, position)` &rarr; ok
- `list_active(run_ref)` &rarr; ok

#### ProcessEvent [E]

> Append-only event stream recording everything that happens in a process run. Serves as the source of truth for audit trails, process mining, replay, and observability.

**Capabilities**: persistent-storage

**State**:
- `events`
- `run_ref`
- `event_type`
- `step_ref`
- `actor_ref`
- `payload`
- `timestamp`
- `sequence_num`

**Actions**:
- `append(run_ref, event_type, payload)` &rarr; ok
- `query(run_ref, after_seq, limit)` &rarr; ok
- `query_by_type(run_ref, event_type, limit)` &rarr; ok
- `get_cursor(run_ref)` &rarr; ok

#### ProcessRun [R] `@gate`

> Track the lifecycle of a running process instance from start to completion, failure, or cancellation, including parent-child relationships for subprocess nesting.

**Capabilities**: persistent-storage

**State**:
- `runs`
- `spec_ref`
- `spec_version`
- `status`
- `parent_run`
- `started_at`
- `ended_at`
- `input`
- `output`
- `error`

**Actions**:
- `start(spec_ref, spec_version, input)` &rarr; ok | invalid_spec
- `start_child(spec_ref, spec_version, parent_run, input)` &rarr; ok | invalid_spec
- `complete(run, output)` &rarr; ok | not_running
- `fail(run, error)` &rarr; ok | not_running
- `cancel(run)` &rarr; ok | not_cancellable
- `suspend(run)` &rarr; ok | not_running
- `resume(run)` &rarr; ok | not_suspended
- `get_status(run)` &rarr; ok | not_found

#### ProcessSpec [P]

> Store versioned, publishable process template definitions consisting of step definitions and routing edges.

**Capabilities**: persistent-storage

**State**:
- `specs`
- `name`
- `version`
- `status`
- `description`
- `steps`
- `key`
- `step_type`
- `config`
- `edges`
- `from_step`
- `to_step`
- `on_variant`
- `condition_expr`
- `priority`
- _(1 more fields)_

**Actions**:
- `create(name, steps, edges)` &rarr; ok | invalid
- `publish(spec)` &rarr; ok | not_found | already_active
- `deprecate(spec)` &rarr; ok | not_found
- `update(spec, steps, edges)` &rarr; ok | not_draft | invalid
- `get(spec)` &rarr; ok | not_found

#### ProcessVariable [V]

> Store typed, scoped data within process runs that steps can read and write. Supports explicit merge strategies for parallel branch convergence.

**Capabilities**: persistent-storage

**State**:
- `variables`
- `run_ref`
- `name`
- `value`
- `value_type`
- `scope`
- `merge_strategy`

**Actions**:
- `set(run_ref, name, value, value_type, scope)` &rarr; ok
- `get(run_ref, name)` &rarr; ok | not_found
- `merge(run_ref, name, update, strategy)` &rarr; ok | not_found | merge_error
- `delete(run_ref, name)` &rarr; ok | not_found
- `list(run_ref)` &rarr; ok
- `snapshot(run_ref)` &rarr; ok

#### StepRun [S] `@gate`

> Track per-step execution state within a process run, including step type dispatch, attempt counting, and input/output capture.

**Capabilities**: persistent-storage

**State**:
- `steps`
- `run_ref`
- `step_key`
- `step_type`
- `status`
- `attempt`
- `input`
- `output`
- `error`
- `started_at`
- `ended_at`

**Actions**:
- `start(run_ref, step_key, step_type, input)` &rarr; ok | already_active
- `complete(step, output)` &rarr; ok | not_active
- `fail(step, error)` &rarr; error | not_active
- `cancel(step)` &rarr; ok | not_cancellable
- `skip(step)` &rarr; ok | not_pending
- `get(step)` &rarr; ok | not_found

### Syncs

- **CancelRunPropagation** _(eager)_
  - When: ProcessRun/cancel
  - Then: StepRun/cancel
- **CancelStepTimers** _(eager)_
  - When: StepRun/complete
  - Then: Timer/cancel
- **ChildRunCompletes** _(eager)_
  - When: ProcessRun/complete
  - Then: StepRun/complete
- **ChildRunFails** _(eager)_
  - When: ProcessRun/fail
  - Then: StepRun/fail
- **DataRoute** _(eager)_
  - When: StepRun/complete
  - Then: FlowToken/emit
- **OutputToVariable** _(eager)_
  - When: StepRun/complete
  - Then: ProcessVariable/set
- **ParallelFork** _(eager)_
  - When: StepRun/complete
  - Then: FlowToken/emit
- **ParallelJoin** _(eager)_
  - When: FlowToken/consume
  - Then: StepRun/start
- **RunCompletion** _(eager)_
  - When: StepRun/complete
  - Then: ProcessRun/complete
- **RunStartedEvent** _(eager)_
  - When: ProcessRun/start
  - Then: ProcessEvent/append
- **SubprocessStepDispatch** _(eager)_
  - When: StepRun/start
  - Then: ProcessRun/start_child
- **TokenActivatesStep** _(eager)_
  - When: FlowToken/emit
  - Then: StepRun/start

---

## process-human
_v0.1.0_

> "Human task lifecycle: work items, multi-party approvals, escalation chains"

### Concepts

#### Approval [A] `@gate`

> Gate process progression on explicit multi-party authorization decisions with configurable approval policies (one-of, all-of, n-of-m).

**Capabilities**: persistent-storage

**State**:
- `approvals`
- `step_ref`
- `status`
- `kind`
- `required_count`
- `roles`
- `decisions`
- `actor`
- `decision`
- `comment`
- `decided_at`
- `requested_at`
- `resolved_at`

**Actions**:
- `request(step_ref, policy_kind, required_count, roles)` &rarr; ok
- `approve(approval, actor, comment)` &rarr; ok | already_resolved | not_authorized | pending
- `deny(approval, actor, reason)` &rarr; ok | already_resolved | not_authorized
- `request_changes(approval, actor, feedback)` &rarr; ok | already_resolved
- `timeout(approval)` &rarr; ok | already_resolved
- `get_status(approval)` &rarr; ok | not_found

#### Escalation [L]

> Redirect work or raise attention when normal handling is insufficient, tracking escalation chains with levels and resolution.

**Capabilities**: persistent-storage

**State**:
- `escalations`
- `source_ref`
- `run_ref`
- `status`
- `trigger_type`
- `target`
- `level`
- `reason`
- `created_at`
- `resolved_at`

**Actions**:
- `escalate(source_ref, run_ref, trigger_type, reason, level)` &rarr; ok
- `accept(escalation, acceptor)` &rarr; ok | not_escalated
- `resolve(escalation, resolution)` &rarr; ok | not_accepted
- `re_escalate(escalation, new_level, reason)` &rarr; ok

#### WorkItem [W] `@gate`

> Manage the lifecycle of human tasks: offering to candidate pools, claiming by individuals, completing with form data, delegating, and releasing.

**Capabilities**: persistent-storage

**State**:
- `items`
- `step_ref`
- `status`
- `assignee`
- `candidate_pool`
- `form_schema`
- `form_data`
- `priority`
- `due_at`
- `claimed_at`
- `completed_at`

**Actions**:
- `create(step_ref, candidate_pool, form_schema, priority)` &rarr; ok
- `claim(item, assignee)` &rarr; ok | not_offered | not_authorized
- `start(item)` &rarr; ok | not_claimed
- `complete(item, form_data)` &rarr; ok | not_active | validation_failed
- `reject(item, reason)` &rarr; ok | not_active
- `delegate(item, new_assignee)` &rarr; ok | not_claimed
- `release(item)` &rarr; ok | not_claimed

### Syncs

- **ApprovalDenied** _(eager)_
  - When: Approval/deny
  - Then: StepRun/complete
- **ApprovalGranted** _(eager)_
  - When: Approval/approve
  - Then: StepRun/complete
- **ApprovalStepDispatch** _(eager)_
  - When: StepRun/start
  - Then: Approval/request
- **HumanStepDispatch** _(eager)_
  - When: StepRun/start
  - Then: WorkItem/create
- **WorkItemCompletes** _(eager)_
  - When: WorkItem/complete
  - Then: StepRun/complete

---

## process-llm
_v0.1.0_

> "LLM task execution: prompt management, tool calling, validation, evaluation"

### Concepts

#### EvaluationRun [N]

> Execute quality evaluations against step outputs and track metrics. Actual evaluation logic is delegated to evaluator providers.

**Capabilities**: persistent-storage

**State**:
- `runs`
- `step_ref`
- `evaluator_type`
- `status`
- `input`
- `score`
- `threshold`
- `metrics`
- `name`
- `value`
- `feedback`
- `evaluated_at`

**Actions**:
- `run_eval(step_ref, evaluator_type, input, threshold)` &rarr; ok
- `log_metric(eval, metric_name, metric_value)` &rarr; ok
- `pass(eval, score, feedback)` &rarr; ok
- `fail(eval, score, feedback)` &rarr; failed
- `get_result(eval)` &rarr; ok | not_found

#### LLMCall [M] `@gate`

> Manage LLM prompt execution with structured output validation, tool calling, and repair loops. Actual model invocation is delegated to providers.

**Capabilities**: persistent-storage, network

**State**:
- `calls`
- `step_ref`
- `model`
- `system_prompt`
- `user_prompt`
- `tools`
- `output_schema`
- `status`
- `raw_output`
- `validated_output`
- `validation_errors`
- `attempt_count`
- `max_attempts`
- `input_tokens`
- `output_tokens`

**Actions**:
- `request(step_ref, model, prompt, output_schema, max_attempts)` &rarr; ok
- `record_response(call, raw_output, input_tokens, output_tokens)` &rarr; ok | provider_error
- `validate(call)` &rarr; valid | invalid
- `repair(call, errors)` &rarr; ok | max_attempts_reached
- `accept(call)` &rarr; ok
- `reject(call, reason)` &rarr; ok

#### ToolRegistry [G]

> Register, version, and authorize tool schemas for LLM function/tool calling.

**Capabilities**: persistent-storage

**State**:
- `tools`
- `name`
- `version`
- `description`
- `schema`
- `status`
- `allowed_models`
- `allowed_processes`

**Actions**:
- `register(name, description, schema)` &rarr; ok | invalid_schema
- `deprecate(tool)` &rarr; ok
- `disable(tool)` &rarr; ok
- `authorize(tool, model, process_ref)` &rarr; ok
- `check_access(tool, model, process_ref)` &rarr; allowed | denied
- `list_active(process_ref)` &rarr; ok

### Syncs

- **EvalProviderDispatch** _(eager)_
  - When: EvaluationRun/run_eval
  - Then: provider/evaluate
- **LLMProviderDispatch** _(eager)_
  - When: LLMCall/request
  - Then: provider/execute
- **LLMRepairExhausted** _(eager)_
  - When: LLMCall/repair
  - Then: StepRun/fail
- **LLMRepair** _(eager)_
  - When: LLMCall/validate
  - Then: LLMCall/repair
- **LLMResponseValidation** _(eager)_
  - When: LLMCall/record_response
  - Then: LLMCall/validate
- **LLMStepDispatch** _(eager)_
  - When: StepRun/start
  - Then: LLMCall/request
- **LLMValid** _(eager)_
  - When: LLMCall/validate
  - Then: StepRun/complete
- **ToolAuthorization** _(eager)_
  - When: LLMCall/request
  - Then: ToolRegistry/check_access

---

## process-observability
_v0.1.0_

> "Process monitoring: goal milestones, performance metrics, SLA tracking"

### Concepts

#### Milestone [I]

> Track achievement of significant process goals declaratively, without prescribing which specific steps cause achievement.

**Capabilities**: persistent-storage

**State**:
- `milestones`
- `run_ref`
- `name`
- `status`
- `condition_expr`
- `achieved_at`

**Actions**:
- `define(run_ref, name, condition_expr)` &rarr; ok
- `evaluate(milestone, context)` &rarr; achieved | not_yet | already_achieved
- `revoke(milestone)` &rarr; ok

#### ProcessMetric [Q]

> Aggregate and expose process-level performance metrics for dashboards, SLA monitoring, and process mining.

**Capabilities**: persistent-storage

**State**:
- `metrics`
- `spec_ref`
- `run_ref`
- `metric_name`
- `metric_value`
- `dimensions`
- `key`
- `value`
- `recorded_at`

**Actions**:
- `record(metric_name, metric_value, dimensions)` &rarr; ok
- `query(metric_name, from, to)` &rarr; ok
- `aggregate(metric_name, aggregation, from, to)` &rarr; ok

---

## process-reliability
_v0.1.0_

> "Fault tolerance: retry policies, saga compensation, state checkpointing"

### Concepts

#### Checkpoint [Z]

> Capture and restore complete process state snapshots for recovery, time-travel debugging, and audit. Storage is delegated to providers.

**Capabilities**: persistent-storage

**State**:
- `checkpoints`
- `run_ref`
- `timestamp`
- `run_state`
- `variables_snapshot`
- `token_snapshot`
- `event_cursor`
- `label`

**Actions**:
- `capture(run_ref, run_state, variables_snapshot, token_snapshot, event_cursor)` &rarr; ok
- `restore(checkpoint)` &rarr; ok | not_found
- `find_latest(run_ref)` &rarr; ok | none
- `prune(run_ref, keep_count)` &rarr; ok

#### CompensationPlan [X]

> Track compensating actions for saga-style rollback. As forward steps complete, their undo actions are registered. On failure, compensations execute in reverse order.

**Capabilities**: persistent-storage

**State**:
- `plans`
- `run_ref`
- `status`
- `compensations`
- `step_key`
- `action_descriptor`
- `registered_at`
- `current_index`

**Actions**:
- `register(run_ref, step_key, action_descriptor)` &rarr; ok
- `trigger(run_ref)` &rarr; ok | empty | already_triggered
- `execute_next(plan)` &rarr; ok | all_done
- `mark_compensation_failed(plan, step_key, error)` &rarr; ok

#### RetryPolicy [Y]

> Define retry/backoff rules for failed steps and track attempt state.

**Capabilities**: persistent-storage

**State**:
- `policies`
- `step_ref`
- `run_ref`
- `max_attempts`
- `initial_interval_ms`
- `backoff_coefficient`
- `max_interval_ms`
- `non_retryable_errors`
- `attempt_count`
- `last_error`
- `next_retry_at`
- `status`

**Actions**:
- `create(step_ref, run_ref, max_attempts, initial_interval_ms, backoff_coefficient, max_interval_ms)` &rarr; ok
- `should_retry(policy, error)` &rarr; retry | exhausted
- `record_attempt(policy, error)` &rarr; ok
- `mark_succeeded(policy)` &rarr; ok

### Syncs

- **CheckpointProviderDispatch** _(eager)_
  - When: Checkpoint/capture
  - Then: provider/store
- **CompensationOnRunFailure** _(eager)_
  - When: ProcessRun/fail
  - Then: CompensationPlan/trigger
- **CompensationRegistration** _(eager)_
  - When: StepRun/complete
  - Then: CompensationPlan/register
- **RetryOnFailure** _(eager)_
  - When: StepRun/fail
  - Then: RetryPolicy/should_retry
- **RetrySchedule** _(eager)_
  - When: RetryPolicy/should_retry
  - Then: Timer/set_timer
- **RetryTimerFired** _(eager)_
  - When: Timer/fire
  - Then: StepRun/start

---

## query-retrieval
_v0.1.0_

> "Structured data retrieval — queries, search indexes, and exposed filters for building search pipelines."

### Concepts

#### ExposedFilter [F]

> Expose interactive filter and sort controls to end users, allowing them to modify query parameters through the UI.

**State**:
- `exposedFilters`
- `userInputs`
- `defaultValues`
- `boundQuery`

**Actions**:
- `expose(filter, fieldName, operator, defaultValue)` &rarr; ok | exists
- `collectInput(filter, value)` &rarr; ok | notfound
- `applyToQuery(filter)` &rarr; ok | notfound
- `resetToDefaults(filter)` &rarr; ok | notfound

#### Query [Q]

> Execute structured retrieval over content with filtering, sorting, grouping, and aggregation. Supports live subscriptions for reactive updates.

**State**:
- `queries`
- `expression`
- `resultSet`
- `isLive`
- `scope`

**Actions**:
- `parse(query, expression)` &rarr; ok | error
- `execute(query)` &rarr; ok | notfound
- `subscribe(query)` &rarr; ok | notfound
- `addFilter(query, filter)` &rarr; ok | notfound
- `addSort(query, sort)` &rarr; ok | notfound
- `setScope(query, scope)` &rarr; ok | notfound

#### SearchIndex [I]

> Build and maintain full-text and faceted search indexes with a pluggable processor pipeline.

**State**:
- `indexes`
- `processors`
- `backends`
- `trackedItems`

**Actions**:
- `createIndex(index, config)` &rarr; ok | exists
- `indexItem(index, item, data)` &rarr; ok | notfound
- `removeItem(index, item)` &rarr; ok | notfound
- `search(index, query)` &rarr; ok | notfound
- `addProcessor(index, processor)` &rarr; ok | notfound
- `reindex(index)` &rarr; ok | notfound

### Syncs

- **IndexOnQuery** _(eager)_
  - When: Query/execute
  - Then: SearchIndex/search
- **FilterModifiesQuery** _(eager)_
  - When: ExposedFilter/applyToQuery
  - Then: Query/addFilter

---

## versioning
_v0.1.0_

> Version control, change tracking, and history management. Provides content-addressed storage, DAG-based history, pluggable diff and merge algorithms, bitemporal versioning, ordered change streams, schema evolution, and retention policy enforcement. concepts: ContentHash: spec: ./content-hash.concept params: C: { as: content, description: "Content being stored and hashed" } Ref: spec: ./ref.concept params: R: { as: ref-entry, description: "Mutable reference entry" } DAGHistory: spec: ./dag-history.concept params: N: { as: node, description: "History DAG node" } Patch: spec: ./patch.concept params: P: { as: patch, description: "Patch object" } Diff: spec: ./diff.concept params: C: { as: content, description: "Content being diffed" } Merge: spec: ./merge.concept params: C: { as: content, description: "Content being merged" } Branch: spec: ./branch.concept params: B: { as: branch, description: "Branch entry" } TemporalVersion: spec: ./temporal-version.concept params: V: { as: version, description: "Version record" } SchemaEvolution: spec: ./schema-evolution.concept params: S: { as: schema-version, description: "Schema version entry" } ChangeStream: spec: ./change-stream.concept params: E: { as: event, description: "Change event" } RetentionPolicy: spec: ./retention-policy.concept params: R: { as: policy, description: "Retention policy entry" } # --- Diff providers --- MyersDiff: spec: ./providers/myers-diff.concept params: C: { as: content, description: "Content being diffed" } optional: true PatienceDiff: spec: ./providers/patience-diff.concept params: C: { as: content, description: "Content being diffed" } optional: true HistogramDiff: spec: ./providers/histogram-diff.concept params: C: { as: content, description: "Content being diffed" } optional: true TreeDiff: spec: ./providers/tree-diff.concept params: C: { as: content, description: "Content being diffed" } optional: true # --- Merge providers --- ThreeWayMerge: spec: ./providers/three-way-merge.concept params: C: { as: content, description: "Content being merged" } optional: true RecursiveMerge: spec: ./providers/recursive-merge.concept params: C: { as: content, description: "Content being merged" } optional: true LatticeMerge: spec: ./providers/lattice-merge.concept params: C: { as: content, description: "Content being merged" } optional: true SemanticMerge: spec: ./providers/semantic-merge.concept params: C: { as: content, description: "Content being merged" } optional: true syncs: required: - path: ./syncs/required/content-hash-dag-history.sync description: "ContentHash/store creates a DAGHistory node with content reference" - path: ./syncs/required/ref-branch.sync description: "Branch create/advance atomically updates the corresponding Ref" - path: ./syncs/required/merge-dag-history.sync description: "Merge/finalize creates a merge node in DAGHistory with both parents" - path: ./syncs/required/patch-diff.sync description: "Patch/create invokes Diff/diff to produce the edit script" - path: ./syncs/required/temporal-version-content-hash.sync description: "TemporalVersion/record verifies the referenced content hash exists" recommended: - path: ./syncs/recommended/change-stream-dag-history.sync description: "ChangeStream/append creates a DAGHistory node for stream events" - path: ./syncs/recommended/schema-evolution-change-stream.sync description: "SchemaEvolution/register appends a schema-change event to ChangeStream" - path: ./syncs/recommended/retention-policy-temporal-version.sync description: "TemporalVersion deletion blocked by RetentionPolicy/checkDisposition" - path: ./syncs/recommended/retention-policy-dag-history.sync description: "DAGHistory pruning blocked by RetentionPolicy/checkDisposition" integration: - path: ./syncs/integration/myers-diff-activation.sync description: "MyersDiff provider self-registers with PluginRegistry" - path: ./syncs/integration/patience-diff-activation.sync description: "PatienceDiff provider self-registers with PluginRegistry" - path: ./syncs/integration/histogram-diff-activation.sync description: "HistogramDiff provider self-registers with PluginRegistry" - path: ./syncs/integration/tree-diff-activation.sync description: "TreeDiff provider self-registers with PluginRegistry" - path: ./syncs/integration/three-way-merge-activation.sync description: "ThreeWayMerge provider self-registers with PluginRegistry" - path: ./syncs/integration/recursive-merge-activation.sync description: "RecursiveMerge provider self-registers with PluginRegistry" - path: ./syncs/integration/lattice-merge-activation.sync description: "LatticeMerge provider self-registers with PluginRegistry" - path: ./syncs/integration/semantic-merge-activation.sync description: "SemanticMerge provider self-registers with PluginRegistry" uses: - suite: infrastructure concepts: - name: PluginRegistry

### Concepts

#### Branch [B]

> Named parallel lines of development with lifecycle management. Branches are mutable pointers over immutable DAG history — advancing the head, protecting against direct writes, and tracking upstream relationships.

**State**:
- `branches`
- `name`
- `head`
- `protected`
- `upstream`
- `created`
- `archived`

**Actions**:
- `create(name, fromNode)` &rarr; ok | exists | unknownNode
- `advance(branch, newNode)` &rarr; ok | notFound | protected | unknownNode
- `delete(branch)` &rarr; ok | notFound | protected
- `protect(branch)` &rarr; ok | notFound
- `setUpstream(branch, upstream)` &rarr; ok | notFound
- `divergencePoint(b1, b2)` &rarr; ok | noDivergence | notFound
- `archive(branch)` &rarr; ok | notFound

##### PullRequest [T] _(derived)_

> Compose branch management, diff computation, and merge operations into a pull request workflow for collaborative version control.

**Composes**: Branch, Diff, Merge
**Required syncs**: branch-diff-compute, diff-merge-apply, branch-merge-target

**Surface**:
- `createBranch` &rarr; Branch/create
- `computeDiff` &rarr; Diff/diff
- `merge` &rarr; Merge/merge
- `finalize` &rarr; Merge/finalize

#### ChangeStream [E]

> Ordered, resumable stream of atomic change events from a data source. Events are immutable once appended. Consumers track their position independently via acknowledged offsets, enabling replay and exactly-once processing.

**Capabilities**: persistent-storage

**State**:
- `events`
- `eventType`
- `before`
- `after`
- `source`
- `timestamp`
- `offset`
- `consumers`

**Actions**:
- `append(type, before, after, source)` &rarr; ok | invalidType
- `subscribe(fromOffset)` &rarr; ok
- `read(subscriptionId, maxCount)` &rarr; ok | notFound | endOfStream
- `acknowledge(consumer, offset)` &rarr; ok | notFound
- `replay(from, to)` &rarr; ok | invalidRange

#### ContentHash [C]

> Identify content by cryptographic digest, enabling deduplication, integrity verification, and immutable references. All versioned content is stored once and referenced by hash.

**Capabilities**: persistent-storage, crypto

**State**:
- `objects`
- `digest`
- `size`
- `created`
- `algorithm`

**Actions**:
- `store(content)` &rarr; ok | alreadyExists
- `retrieve(hash)` &rarr; ok | notFound
- `verify(hash, content)` &rarr; valid | corrupt | notFound
- `delete(hash)` &rarr; ok | notFound | referenced

#### DAGHistory [N]

> Organize versions into a directed acyclic graph supporting branching, merging, and topological traversal. Nodes reference content by hash and track parent relationships for full history reconstruction.

**Capabilities**: persistent-storage

**State**:
- `nodes`
- `parents`
- `contentRef`
- `metadata`
- `created`
- `roots`

**Actions**:
- `append(parents, contentRef, metadata)` &rarr; ok | unknownParent
- `ancestors(nodeId)` &rarr; ok | notFound
- `commonAncestor(a, b)` &rarr; found | none | notFound
- `descendants(nodeId)` &rarr; ok | notFound
- `between(from, to)` &rarr; ok | noPath | notFound
- `getNode(nodeId)` &rarr; ok | notFound

#### Diff [C]

> Compute the minimal representation of differences between two content states, using a pluggable algorithm selected by content type and context.

**Capabilities**: persistent-storage

**State**:
- `providers`
- `provider_name`
- `provider_content_types`
- `default_provider`
- `cache`
- `cache_key`
- `cache_result`

**Actions**:
- `registerProvider(name, contentTypes)` &rarr; ok | duplicate
- `diff(contentA, contentB, algorithm)` &rarr; identical | diffed | noProvider
- `patch(content, editScript)` &rarr; ok | incompatible

#### HistogramDiff [C]

> Compute diffs using the Histogram diff algorithm. A variant of Patience diff that uses frequency histograms. Generally superior for source code with common boilerplate lines.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `compute(contentA, contentB)` &rarr; ok | unsupportedContent

#### LatticeMerge [C]

> Merge CRDT-based content using lattice join semantics. Always produces a clean result — lattice joins are conflict-free by construction. Suitable for OR-Sets, G-Counters, LWW registers, and similar convergent data types.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `execute(base, ours, theirs)` &rarr; clean | unsupportedContent

#### Merge [C]

> Combine two divergent versions of content that share a common ancestor, producing a unified result or identifying conflicts. Strategy is selected by content type and configuration.

**Capabilities**: persistent-storage

**State**:
- `strategies`
- `strategy_name`
- `strategy_content_types`
- `default_strategy`
- `active_merges`
- `merge_state`
- `base`
- `ours`
- `theirs`
- `conflicts`
- `region`
- `ours_content`
- `theirs_content`
- `status`
- `result`

**Actions**:
- `registerStrategy(name, contentTypes)` &rarr; ok | duplicate
- `merge(base, ours, theirs, strategy)` &rarr; clean | conflicts | noStrategy
- `resolveConflict(mergeId, conflictIndex, resolution)` &rarr; ok | invalidIndex | alreadyResolved
- `finalize(mergeId)` &rarr; ok | unresolvedConflicts

#### MyersDiff [C]

> Compute line-level diffs using Myers' O(ND) algorithm. Optimal for text files — minimizes edit distance by preferring deletions before insertions. The default diff provider for general text.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `compute(contentA, contentB)` &rarr; ok | unsupportedContent

#### Patch [P]

> Represent a change as a first-class, invertible, composable object. Patches have algebraic properties — they can be applied, inverted, composed sequentially, and commuted when independent.

**Capabilities**: persistent-storage

**State**:
- `patches`
- `base`
- `target`
- `effect`
- `dependencies`
- `created`

**Actions**:
- `create(base, target, effect)` &rarr; ok | invalidEffect
- `apply(patchId, content)` &rarr; ok | incompatibleContext | notFound
- `invert(patchId)` &rarr; ok | notFound
- `compose(first, second)` &rarr; ok | nonSequential | notFound
- `commute(p1, p2)` &rarr; ok | cannotCommute | notFound

#### PatienceDiff [C]

> Compute diffs using the Patience diff algorithm. Produces more human-readable diffs by aligning unique lines first. Better than Myers for refactored or moved code blocks.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `compute(contentA, contentB)` &rarr; ok | unsupportedContent

#### RecursiveMerge [C]

> Merge using Git's recursive strategy — repeatedly finding virtual common ancestors for criss-cross merge scenarios. Produces better results than three-way merge for complex branch histories.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `execute(base, ours, theirs)` &rarr; clean | conflicts | unsupportedContent

#### Ref [R]

> Provide mutable, human-readable names for immutable content-addressed objects. The only mutable state in the versioning system is naming — all content and history are immutable once created.

**State**:
- `refs`
- `name`
- `target`
- `reflog`

**Actions**:
- `create(name, hash)` &rarr; ok | exists | invalidHash
- `update(name, newHash, expectedOldHash)` &rarr; ok | notFound | conflict
- `delete(name)` &rarr; ok | notFound | protected
- `resolve(name)` &rarr; ok | notFound
- `log(name)` &rarr; ok | notFound

#### RetentionPolicy [R]

> Govern how long versions and records must be kept and when they may be disposed, including legal hold suspension of normal disposition. A record under active legal hold can never be disposed regardless of retention period expiration.

**Capabilities**: persistent-storage

**State**:
- `policies`
- `recordType`
- `retentionPeriod`
- `unit`
- `dispositionAction`
- `holds`
- `hold_name`
- `hold_scope`
- `hold_reason`
- `hold_issuer`
- `hold_issued`
- `hold_released`
- `dispositionLog`

**Actions**:
- `setRetention(recordType, period, unit, dispositionAction)` &rarr; ok | alreadyExists
- `applyHold(name, scope, reason, issuer)` &rarr; ok
- `releaseHold(holdId, releasedBy, reason)` &rarr; ok | notFound | alreadyReleased
- `checkDisposition(record)` &rarr; disposable | retained | held
- `dispose(record, disposedBy)` &rarr; ok | retained | held
- `auditLog(record)` &rarr; ok

#### SchemaEvolution [S]

> Manage versioned structural definitions with compatibility guarantees. Supports backward, forward, and full compatibility modes with upcast transformations between schema versions.

**Capabilities**: persistent-storage

**State**:
- `schemas`
- `subject`
- `version`
- `schema`
- `compatibility`
- `subjects`

**Actions**:
- `register(subject, schema, compatibility)` &rarr; ok | incompatible | invalidCompatibility
- `check(oldSchema, newSchema, mode)` &rarr; compatible | incompatible
- `upcast(data, fromVersion, toVersion, subject)` &rarr; ok | noPath | notFound
- `resolve(readerSchema, writerSchema)` &rarr; ok | incompatible
- `getSchema(subject, version)` &rarr; ok | notFound

#### SemanticMerge [C]

> Merge source code files using AST-level understanding. Resolves conflicts that are semantically non-conflicting at the text level, such as independently added imports or reordered function definitions.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `execute(base, ours, theirs)` &rarr; clean | conflicts | unsupportedContent

#### TemporalVersion [V]

> Track content versions with bitemporal semantics — when recorded (system time) and when valid (application time). Enables time-travel queries across both dimensions independently.

**Capabilities**: persistent-storage

**State**:
- `versions`
- `contentHash`
- `systemFrom`
- `systemTo`
- `validFrom`
- `validTo`
- `metadata`
- `current`

**Actions**:
- `record(contentHash, validFrom, validTo, metadata)` &rarr; ok | invalidHash
- `asOf(systemTime, validTime)` &rarr; ok | notFound
- `between(start, end, dimension)` &rarr; ok | invalidDimension
- `current()` &rarr; ok | empty
- `supersede(versionId, contentHash)` &rarr; ok | notFound

#### ThreeWayMerge [C]

> Merge two divergent text files relative to a common base using classic three-way merge. Standard algorithm used in Git, POSIX merge, and most version control systems.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `execute(base, ours, theirs)` &rarr; clean | conflicts | unsupportedContent

#### TreeDiff [C]

> Compute structure-aware diffs for tree-shaped content such as XML, JSON, and ASTs. Uses Zhang-Shasha tree edit distance to preserve structural relationships lost by line-oriented diffs.

**State**:
- `cache`

**Actions**:
- `register()` &rarr; ok
- `compute(contentA, contentB)` &rarr; ok | unsupportedContent

### Syncs

- **RegisterHistogramDiff** _(eager)_
  - When: HistogramDiff/register
  - Then: PluginRegistry/register
- **RegisterLatticeMerge** _(eager)_
  - When: LatticeMerge/register
  - Then: PluginRegistry/register
- **RegisterMyersDiff** _(eager)_
  - When: MyersDiff/register
  - Then: PluginRegistry/register
- **RegisterPatienceDiff** _(eager)_
  - When: PatienceDiff/register
  - Then: PluginRegistry/register
- **RegisterRecursiveMerge** _(eager)_
  - When: RecursiveMerge/register
  - Then: PluginRegistry/register
- **RegisterSemanticMerge** _(eager)_
  - When: SemanticMerge/register
  - Then: PluginRegistry/register
- **RegisterThreeWayMerge** _(eager)_
  - When: ThreeWayMerge/register
  - Then: PluginRegistry/register
- **RegisterTreeDiff** _(eager)_
  - When: TreeDiff/register
  - Then: PluginRegistry/register
- **ChangeStreamEventCreatesNode** _(eager)_
  - When: ChangeStream/append
  - Then: DAGHistory/append
- **RetentionBlocksHistoryPruning** _(eager)_
  - When: DAGHistory/getNode
  - Then: RetentionPolicy/checkDisposition
- **RetentionBlocksVersionDeletion** _(eager)_
  - When: TemporalVersion/supersede
  - Then: RetentionPolicy/checkDisposition
- **SchemaRegistrationAppendsEvent** _(eager)_
  - When: SchemaEvolution/register
  - Then: ChangeStream/append
- **ContentHashCreatesDAGNode** _(eager)_
  - When: ContentHash/store
  - Then: DAGHistory/append
- **MergeResultCreatesDAGNode** _(eager)_
  - When: Merge/finalize
  - Then: DAGHistory/append
- **PatchCreateInvokesDiff** _(eager)_
  - When: Patch/create
  - Then: Diff/diff
- **BranchCreatesMirrorRef** _(eager)_
  - When: Branch/create
  - Then: Ref/create
- **BranchAdvanceUpdatesRef** _(eager)_
  - When: Branch/advance
  - Then: Ref/update
- **TemporalVersionVerifiesHash** _(eager)_
  - When: TemporalVersion/record
  - Then: ContentHash/retrieve

### Dependencies

- **infrastructure**

---

## wasm
_v0.1.0_

---

## web3
_v0.1.0_

> Blockchain integration for Clef. Chain monitoring with finality-aware gating, IPFS content storage with pinning, and wallet-based authentication via signature verification. All domain logic in concepts + syncs — zero engine extensions. concepts: ChainMonitor: spec: ./chain-monitor.concept params: B: { as: block-ref, description: "Reference to a tracked block" } Content: spec: ./content.concept params: C: { as: content-ref, description: "Reference to stored content (CID)" } Wallet: spec: ./wallet.concept params: W: { as: wallet-ref, description: "Reference to a wallet/address" } syncs: required: - path: ./syncs/finality-gate.sync description: > Pattern sync for finality-aware gating. When a chain action completes, route through ChainMonitor/awaitFinality before triggering downstream cross-chain actions. Without this, reorgs cause permanent state inconsistency across chains. recommended: - path: ./syncs/reorg-compensation.sync name: ReorgCompensation description: > When ChainMonitor detects a reorg, flag downstream actions triggered by the reorged completion. Override with app-specific compensation logic (rollback, retry, alert). - path: ./syncs/content-pinning.sync name: ContentPinning description: > When Content/store completes, automatically pin the CID via the configured pinning service. Disable if managing pinning manually or using a dedicated pinning cron. integrations: - suite: auth syncs: - path: ./syncs/wallet-auth.sync description: > Wire Wallet/verify into the auth suite's JWT flow. Wallet signature verification as an auth method. infrastructure: transports: - name: evm path: ./infrastructure/transports/evm-transport.ts description: > EVM JSON-RPC transport adapter. Maps concept invoke() to contract calls via ethers.js/viem, query() to storage reads. Handles gas estimation, nonce management, receipt polling. Works for all EVM chains (Ethereum, Arbitrum, Optimism, Base, Polygon) — different RPC endpoints, same adapter. - name: starknet path: ./infrastructure/transports/starknet-transport.ts description: > StarkNet transport adapter for Cairo VM chains. Uses starknet.js for transaction submission and storage reads. storage: - name: ipfs path: ./infrastructure/storage/ipfs-storage.ts description: > IPFS content-addressed storage adapter. Maintains a mutable index (key → CID) on top of immutable content storage. Supports Pinata, web3.storage, and self-hosted IPFS nodes. deployTemplates: - path: ./infrastructure/deploy-templates/ethereum-mainnet.deploy.yaml - path: ./infrastructure/deploy-templates/arbitrum.deploy.yaml - path: ./infrastructure/deploy-templates/multi-chain.deploy.yaml chainConfigs: ethereum: chainId: 1 finality: type: confirmations threshold: 12 arbitrum: chainId: 42161 finality: type: l1-batch softFinality: sequencer optimism: chainId: 10 finality: type: l1-batch softFinality: sequencer base: chainId: 8453 finality: type: l1-batch softFinality: sequencer starknet: chainId: "SN_MAIN" finality: type: validity-proof transport: starknet dependencies: []

### Concepts

#### ChainMonitor [B] `@gate`

> Monitor blockchain state for finality, reorgs, and confirmation tracking. Async gate concept: awaitFinality holds invocations and completes them when the chain-specific finality condition is met (confirmations, L1 batch, validity proof). Replaces engine-level confirmation annotations.

**State**:
- `subscriptions`
- `blockHeight`
- `confirmations`
- `chainConfig`
- `chainId`
- `finalityType`
- `threshold`

**Actions**:
- `awaitFinality(txHash, level)` &rarr; ok
- `subscribe(chainId, rpcUrl)` &rarr; ok | error
- `onBlock(chainId, blockNumber, blockHash)` &rarr; ok | reorg

#### Content [C]

> Manage content stored on IPFS with CID tracking, pinning, and resolution. Each content item is identified by its content-addressed hash (CID). The unavailable variant enables reactive sync chains for retry, fallback, or alerting.

**State**:
- `items`
- `cid`
- `metadata`
- `pinned`

**Actions**:
- `store(data, name, contentType)` &rarr; ok | error
- `pin(cid)` &rarr; ok | error
- `unpin(cid)` &rarr; ok | error
- `resolve(cid)` &rarr; ok | notFound | unavailable

#### Wallet [W]

> Verify wallet signatures and manage wallet addresses. Wraps ecrecover and EIP-712 typed data verification. Same auth pattern as JWT — syncs check Wallet/verify → ok before protected actions. Integrates with auth kit via integration sync.

**State**:
- `addresses`
- `nonces`
- `labels`

**Actions**:
- `verify(address, message, signature)` &rarr; ok | invalid | error
- `verifyTypedData(address, domain, types, value, signature)` &rarr; ok | invalid | error
- `getNonce(address)` &rarr; ok | notFound
- `incrementNonce(address)` &rarr; ok

### Syncs

- **WaitForFinality** _(eager)_
  - Then: ChainMonitor/awaitFinality
- **ProceedAfterFinality** _(eager)_
  - Then: Contract/execute
- **HandleReorg** _(eager)_
  - Then: Contract/flagReorged
- **WalletAuth** _(eager)_
  - Then: JWT/generate

### Dependencies

- **auth**

---

## Cross-Suite Concept Index

| Concept | Suite | Type |
|---------|-------|------|
| AccessControl | identity | base |
| Adapter | llm-training | base |
| AddWinsResolution | collaboration | base |
| ADICOEvaluator | governance-rules | base |
| AgentHandoff | llm-agent | base |
| AgenticDelegate | governance-identity | base |
| AgentLoop | llm-agent | base |
| AgentMemory | llm-agent | base |
| AgentRole | llm-agent | base |
| AgentTeam | llm-agent | base |
| Alias | linking | base |
| Approval | process-human | base |
| ApprovalCounting | governance-decision | base |
| AppTemplate | new-app | base |
| Assertion | llm-prompt | base |
| Attestation | governance-identity | base |
| AttestationSybil | governance-identity | base |
| Attribution | collaboration | base |
| Auditor | package | base |
| AuditTrail | governance-transparency | base |
| Authentication | identity | base |
| Authorization | identity | base |
| AutomationDispatch | automation-providers | base |
| AutomationRule | automation | base |
| AutomationScope | automation-providers | base |
| BackgroundWorker | extension | base |
| Backlink | linking | base |
| BFTFinality | governance-execution | base |
| Blackboard | llm-agent | base |
| BondingCurve | governance-resources | base |
| BordaCount | governance-decision | base |
| Branch | versioning | base |
| BrowserAction | extension | base |
| BrowserExtensionHost | extension | base |
| BrowserManifestTarget | extension | base |
| BrowserPermission | extension | base |
| Cache | infrastructure | base |
| Canvas | content | base |
| Capture | data-integration | base |
| CausalClock | collaboration | base |
| CedarEvaluator | governance-rules | base |
| ChainFinality | governance-execution | base |
| ChainMonitor | web3 | base |
| ChangeStream | versioning | base |
| Checkpoint | process-reliability | base |
| ChromeTarget | extension | base |
| Circle | governance-structure | base |
| CodeActStrategy | llm-agent | base |
| Collection | data-organization | base |
| Comment | content | base |
| CompensationPlan | process-reliability | base |
| ComponentManifest | package | base |
| CondorcetSchulze | governance-decision | base |
| ConfigSync | infrastructure | base |
| ConflictResolution | collaboration | base |
| Connector | data-integration | base |
| ConnectorCall | process-automation | base |
| Consensus | llm-agent | base |
| ConsentProcess | governance-decision | base |
| Constitution | llm-agent | base |
| Content | web3 | base |
| ContentHash | versioning | base |
| ContentHistory | content | derived |
| ContentNode | foundation | base |
| ContentParser | foundation | base |
| ContentScript | extension | base |
| ContentStorage | foundation | base |
| ContentStore | package | base |
| Contract | formal-verification | base |
| ContributionPoint | extension | base |
| Control | automation | base |
| Conversation | llm-conversation | base |
| ConversationalRAG | llm-conversation | derived |
| Conviction | governance-decision | base |
| CountingMethod | governance-decision | base |
| CustomEvaluator | governance-rules | base |
| DAGHistory | versioning | base |
| DailyNote | content | base |
| DataPipeline | data-integration | derived |
| DataQuality | data-integration | base |
| DataSource | data-integration | base |
| Delegation | governance-structure | base |
| Deliberation | governance-decision | base |
| Diff | versioning | base |
| DisclosurePolicy | governance-transparency | base |
| DisplayMode | presentation | base |
| Dispute | governance-rules | base |
| DocumentChunk | llm-rag | base |
| Download | package | base |
| EdgeTarget | extension | base |
| EloRating | governance-resources | base |
| Enricher | data-integration | base |
| EqualWeight | governance-structure | base |
| Escalation | process-human | base |
| EvaluationDataset | llm-training | base |
| EvaluationRun | process-llm | base |
| EventBus | infrastructure | base |
| Evidence | formal-verification | base |
| Execution | governance-execution | base |
| ExposedFilter | query-retrieval | base |
| ExpressionLanguage | computation | base |
| ExtensionConfig | extension | base |
| ExtensionHost | extension | base |
| ExtensionManifest | extension | base |
| ExtensionMessaging | extension | base |
| ExtensionPermission | extension | base |
| ExtensionStorage | extension | base |
| FeatureFlag | infrastructure | derived |
| FeatureFlag | package | base |
| Fetcher | package | base |
| FewShotExample | llm-prompt | base |
| FieldMapping | data-integration | base |
| FileManagement | media | base |
| FinalityGate | governance-execution | base |
| FirefoxTarget | extension | base |
| Flag | collaboration | base |
| FlowToken | process-foundation | base |
| FormalProperty | formal-verification | base |
| FormBuilder | presentation | base |
| Formula | computation | base |
| GlickoRating | governance-resources | base |
| Graph | data-organization | base |
| Group | collaboration | base |
| Guard | governance-execution | base |
| Guardrail | llm-safety | base |
| HistogramDiff | versioning | base |
| ImmediateFinality | governance-execution | base |
| InlineAnnotation | collaboration | base |
| Installer | package | base |
| Intent | foundation | base |
| LatticeMerge | versioning | base |
| LLMCall | process-llm | base |
| LLMProvider | llm-core | base |
| LLMTrace | llm-safety | base |
| Lockfile | package | base |
| LoginSession | identity | derived |
| LWWResolution | collaboration | base |
| Majority | governance-decision | base |
| Manifest | package | base |
| ManifestAutomationProvider | automation-providers | base |
| ManualResolution | collaboration | base |
| MediaAsset | media | base |
| MediaLibrary | media | derived |
| Meeting | governance-decision | base |
| Membership | governance-identity | base |
| Merge | versioning | base |
| Metric | governance-resources | base |
| Milestone | process-observability | base |
| ModelRouter | llm-core | base |
| ModuleSelection | new-app | base |
| Monitor | governance-rules | base |
| MultiValueResolution | collaboration | base |
| MyersDiff | versioning | base |
| Namespace | classification | base |
| NewApp | new-app | derived |
| Notification | notification | base |
| Objective | governance-resources | base |
| OptimisticApproval | governance-decision | base |
| OptimisticOracleFinality | governance-execution | base |
| Outline | foundation | base |
| PageAsRecord | foundation | base |
| PageRankReputation | governance-resources | base |
| Patch | versioning | base |
| Pathauto | infrastructure | base |
| PatienceDiff | versioning | base |
| PeerAllocation | governance-resources | base |
| Permission | governance-identity | base |
| PermissionGate | identity | derived |
| PessimisticLock | collaboration | base |
| PlanAndExecuteStrategy | llm-agent | base |
| PluginInstall | extension | derived |
| PluginRegistry | infrastructure | base |
| Policy | governance-rules | base |
| Polity | governance-structure | base |
| PredictionMarket | governance-decision | base |
| ProcessEvent | process-foundation | base |
| ProcessMetric | process-observability | base |
| ProcessRun | process-foundation | base |
| ProcessSpec | process-foundation | base |
| ProcessVariable | process-foundation | base |
| ProgressiveSchema | data-integration | base |
| ProjectInit | new-app | base |
| PromptAssembly | llm-prompt | base |
| PromptOptimizer | llm-prompt | base |
| PromptPipeline | llm-prompt | derived |
| ProofOfPersonhood | governance-identity | base |
| Property | foundation | base |
| Proposal | governance-decision | base |
| Provenance | data-integration | base |
| Publisher | package | base |
| PublishWorkflow | content | derived |
| PullRequest | versioning | derived |
| QuadraticVoting | governance-decision | base |
| QuadraticWeight | governance-structure | base |
| Query | query-retrieval | base |
| Queue | automation | base |
| Quorum | governance-decision | base |
| RageQuit | governance-execution | base |
| RAGPipeline | llm-rag | derived |
| RankedChoice | governance-decision | base |
| ReactStrategy | llm-agent | base |
| RealtimeSync | collaboration | derived |
| RecursiveMerge | versioning | base |
| Ref | versioning | base |
| Reference | linking | base |
| ReflectionStrategy | llm-agent | base |
| Registry | package | base |
| RegoEvaluator | governance-rules | base |
| Relation | linking | base |
| Renderer | presentation | base |
| Replica | collaboration | base |
| Reputation | governance-resources | base |
| ReputationWeight | governance-structure | base |
| Resolver | package | base |
| RetentionPolicy | versioning | base |
| Retriever | llm-rag | base |
| RetryPolicy | process-reliability | base |
| ReviewThread | collaboration | derived |
| ReWOOStrategy | llm-agent | base |
| Role | governance-identity | base |
| SafariTarget | extension | base |
| SafeAgent | llm-agent | derived |
| Sanction | governance-rules | base |
| ScheduledJob | automation | derived |
| Schema | classification | base |
| SchemaEvolution | versioning | base |
| ScoreVoting | governance-decision | base |
| SearchIndex | query-retrieval | base |
| SelfUpdate | package | base |
| SemanticMerge | versioning | base |
| SemanticRouter | llm-safety | base |
| Session | identity | base |
| Signature | collaboration | base |
| Signature | llm-prompt | base |
| SimpleAccumulator | governance-resources | base |
| SocialGraphVerification | governance-identity | base |
| SolverProvider | formal-verification | base |
| SpecificationSchema | formal-verification | base |
| StakeThreshold | governance-identity | base |
| StakeWeight | governance-structure | base |
| StateGraph | llm-agent | base |
| StepRun | process-foundation | base |
| Supermajority | governance-decision | base |
| SybilResistance | governance-identity | base |
| SyncAutomationProvider | automation-providers | base |
| SyncedContent | content | base |
| SyncPair | data-integration | base |
| Tag | classification | base |
| TagHierarchy | classification | derived |
| TargetProfile | new-app | base |
| Taxonomy | classification | base |
| Template | content | base |
| TemporalVersion | versioning | base |
| ThreeWayMerge | versioning | base |
| Timelock | governance-execution | base |
| Timer | process-automation | base |
| Token | computation | base |
| TokenBalance | governance-structure | base |
| ToolBinding | llm-agent | base |
| ToolRegistry | process-llm | base |
| TrainingRun | llm-training | base |
| Transform | data-integration | base |
| Treasury | governance-resources | base |
| TreeDiff | versioning | base |
| TreeOfThoughtStrategy | llm-agent | base |
| TypeSystem | foundation | base |
| Validator | infrastructure | base |
| VectorIndex | llm-rag | base |
| VerificationRun | formal-verification | base |
| VerifiedConcept | formal-verification | derived |
| Version | content | base |
| View | presentation | base |
| Vote | governance-decision | base |
| VoteEscrow | governance-structure | base |
| Wallet | web3 | base |
| WebhookInbox | process-automation | base |
| Weight | governance-structure | base |
| WikiPage | content | derived |
| Workflow | automation | base |
| WorkItem | process-human | base |
