# Clef Versioning & Collaboration Kit — Design Document

**Version:** 0.1.0 (2026-02-25)
**Status:** Draft / Proposal
**Scope:** New suites, concept/provider decompositions, migration plan for superseded concepts

---

## 1. Executive Summary

This document proposes adding **two new suites** to Clef — a **Versioning Kit** and a **Collaboration Kit** — containing **18 new concepts** that provide a universal substrate for version control, change tracking, concurrent editing, attribution, provenance, compliance, and document review across all data types. Three concepts use the **coordination + provider pattern** (Diff, Merge, ConflictResolution), where a coordination concept defines the interface and routing syncs dispatch to pluggable provider implementations via PluginRegistry. Ten provider concepts ship across four phases.

Six existing concepts are affected. Two are **superseded** (Version → TemporalVersion, SyncedContent → Replica + ConflictResolution). Two are **narrowed** in scope (Capture → retains CDC role but defers to ChangeStream for streaming; Provenance → retains W3C PROV graph but defers to Attribution for content-region binding). Two are **enhanced** (ActionLog gains CausalClock sync; FlowTrace gains CausalClock sync).

Implementation proceeds in **four phases** over an estimated 4 minor versions (0.19–0.22), ordered by dependency: immutable storage primitives first, then change representation, then collaboration, then migration of existing concepts.

---

## 2. Design Principles

These principles extend the existing Clef design rules (Section 2 of the reference doc) for the versioning domain:

**P1. The snapshot-patch duality is a composition, not a choice.** Some concepts store states (ContentHash, TemporalVersion); others store transformations (Patch, ChangeStream). Systems compose both. Neither is "more fundamental" — they are independent concepts that sync together.

**P2. Conflict detection and conflict resolution are always separate concepts.** Every system that couples them (SVN locking, naïve LWW) loses composability. Detection belongs to Merge/CausalClock; resolution belongs to ConflictResolution with pluggable strategies.

**P3. Causality is the universal ordering primitive.** CausalClock underlies OT delivery, CRDT consistency, DAG traversal, provenance chains, and temporal queries. It syncs with nearly everything.

**P4. Algorithms are providers, not hardcoded.** Diff algorithms (Myers, Patience, Histogram, Zhang-Shasha), merge strategies (three-way, recursive, pushout, lattice join), and conflict resolution policies (LWW, add-wins, manual) are all providers behind coordination concepts.

**P5. Mutable pointers over immutable data.** The only mutable state in versioning systems is naming (Ref, Branch). All content, history, patches, and events are immutable once created. This separation must be preserved in concept design.

---

## 3. Kit Architecture

### 3.1 Kit Overview

```
kits/
  versioning/              # New suite
    suite.yaml
    content-hash.concept
    ref.concept
    dag-history.concept
    patch.concept
    diff.concept           # Coordination concept
    merge.concept          # Coordination concept
    branch.concept
    temporal-version.concept
    schema-evolution.concept
    change-stream.concept
    retention-policy.concept
    providers/
      myers-diff.concept
      patience-diff.concept
      histogram-diff.concept
      tree-diff.concept
      three-way-merge.concept
      recursive-merge.concept
      lattice-merge.concept
      semantic-merge.concept
    syncs/
      required/
        content-hash-dag-history.sync
        ref-branch.sync
        merge-dag-history.sync
        patch-diff.sync
        temporal-version-content-hash.sync
      recommended/
        change-stream-dag-history.sync
        schema-evolution-change-stream.sync
        retention-policy-temporal-version.sync
        retention-policy-dag-history.sync
      integration/
        tree-diff-activation.sync
        semantic-merge-activation.sync

  collaboration/           # New suite
    suite.yaml
    causal-clock.concept
    replica.concept
    conflict-resolution.concept  # Coordination concept
    attribution.concept
    signature.concept
    inline-annotation.concept
    pessimistic-lock.concept
    providers/
      lww-resolution.concept
      add-wins-resolution.concept
      manual-resolution.concept
      multi-value-resolution.concept
    syncs/
      required/
        replica-causal-clock.sync
        replica-conflict-resolution.sync
        attribution-causal-clock.sync
        pessimistic-lock-conflict-resolution.sync
      recommended/
        signature-content-hash.sync
        attribution-dag-history.sync
        inline-annotation-attribution.sync
        inline-annotation-change-stream.sync
        pessimistic-lock-change-stream.sync
```

### 3.2 Concept/Provider Pattern Decisions

The concept test (Section 16.14) asks: does this thing have independent state, meaningful actions with domain-specific variants, and operational principles that compose via syncs? For algorithms and strategies, the answer is nuanced — the *coordination* concept passes the test, but individual algorithm implementations are better modeled as **providers** because:

- They share an identical action interface (same inputs/outputs)
- They differ only in internal behavior (algorithm choice)
- They are selected by configuration, not by domain logic
- Only one is active per deployment context (though different contexts may use different providers)

**Three coordination concepts use the provider pattern:**

| Coordination Concept | Provider Examples | Selection Basis |
|---|---|---|
| **Diff** | MyersDiff, PatienceDiff, HistogramDiff, TreeDiff | Content type + user preference |
| **Merge** | ThreeWayMerge, RecursiveMerge, LatticeMerge, SemanticMerge | Content type + strategy config |
| **ConflictResolution** | LWWResolution, AddWinsResolution, ManualResolution, MultiValueResolution | Data type + domain policy |

**Why not make CausalClock a coordination concept?** Although vector clocks, Lamport timestamps, and dotted version vectors are alternative implementations, they have *different state shapes and different action signatures* (vector clocks have a `merge` that Lamport timestamps lack; dotted version vectors have `dot` operations). This means they aren't interchangeable behind a single interface — they are genuinely different concepts that might exist in the same system simultaneously. If a future need arises, we can revisit.

**Why not make ContentHash a coordination concept?** Hash algorithms (SHA-256, BLAKE3, etc.) could be providers, but the concept test says no: the *purpose* of ContentHash is content-addressed identity, and the hash algorithm is a configuration parameter, not a separate concept with its own purpose. Hash algorithm selection belongs in `capabilities` or constructor config.

### 3.3 Coordination Concept Detail: Diff

```
@version(1)
concept Diff [C] {

  purpose {
    Compute the minimal representation of differences between
    two content states, using a pluggable algorithm selected
    by content type and context.
  }

  state {
    providers: set P                          // registered diff providers
    provider_name: P -> String
    provider_content_types: P -> list String  // what each handles
    default_provider: option P
    cache: set E                              // cached results
    cache_key: E -> {
      hashA: String,
      hashB: String,
      provider: String
    }
    cache_result: E -> Bytes                  // serialized EditScript
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action registerProvider(name: String, contentTypes: list String) {
      -> ok(provider: P) {
        Registers a new diff algorithm provider for the given content types.
      }
      -> duplicate(message: String) {
        A provider with that name already exists.
      }
    }

    action diff(contentA: C, contentB: C, algorithm: option String) {
      -> identical() {
        Contents are byte-identical; no edit script needed.
      }
      -> diffed(editScript: Bytes, distance: Int) {
        Returns the minimal edit script transforming A into B
        and the edit distance. Provider selected by algorithm
        param, content type, or default.
      }
      -> noProvider(message: String) {
        No registered provider handles this content type.
      }
    }

    action patch(content: C, editScript: Bytes) {
      -> ok(result: C) {
        Applies edit script to content, producing transformed result.
      }
      -> incompatible(message: String) {
        Edit script does not apply cleanly to this content.
      }
    }
  }

  invariant {
    after diff(contentA: a, contentB: b, algorithm: _) -> diffed(editScript: es, distance: _)
    then patch(content: a, editScript: es) -> ok(result: b)
  }
}
```

Provider routing sync:

```
sync DiffProviderRouting [eager]
when {
  Diff/diff: [ contentA: ?a; contentB: ?b; algorithm: ?alg ]
    => [ diffed ]
}
where {
  // If algorithm specified, route to that provider
  // Otherwise, match by content type
  // Otherwise, use default
  PluginRegistry: { ?provider handles: ?alg }
}
then {
  // Dispatch to selected provider
  ?provider/compute: [ contentA: ?a; contentB: ?b ]
}
```

### 3.4 Coordination Concept Detail: Merge

```
@version(1)
concept Merge [C] {

  purpose {
    Combine two divergent versions of content that share a common
    ancestor, producing a unified result or identifying conflicts.
    Strategy is selected by content type and configuration.
  }

  state {
    strategies: set S
    strategy_name: S -> String
    strategy_content_types: S -> list String
    default_strategy: option S
    active_merges: set M
    merge_state: M -> {
      base: C,
      ours: C,
      theirs: C,
      conflicts: list {
        region: Bytes,
        ours_content: Bytes,
        theirs_content: Bytes,
        status: String    // "pending" | "resolved"
      },
      result: option C
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action registerStrategy(name: String, contentTypes: list String) {
      -> ok(strategy: S) {
        Registers a merge strategy provider.
      }
      -> duplicate(message: String) {
        Strategy name already registered.
      }
    }

    action merge(base: C, ours: C, theirs: C, strategy: option String) {
      -> clean(result: C) {
        All changes merged without conflicts.
      }
      -> conflicts(mergeId: M, conflictCount: Int) {
        Merge produced conflicts requiring resolution.
        Use resolveConflict to handle each, then finalize.
      }
      -> noStrategy(message: String) {
        No strategy registered for this content type.
      }
    }

    action resolveConflict(mergeId: M, conflictIndex: Int, resolution: Bytes) {
      -> ok(remaining: Int) {
        Conflict resolved. Returns count of remaining conflicts.
      }
      -> invalidIndex(message: String) {
        Conflict index out of range.
      }
      -> alreadyResolved(message: String) {
        This conflict was already resolved.
      }
    }

    action finalize(mergeId: M) {
      -> ok(result: C) {
        All conflicts resolved; returns merged content.
      }
      -> unresolvedConflicts(count: Int) {
        Cannot finalize — conflicts remain.
      }
    }
  }

  invariant {
    after merge(base: b, ours: o, theirs: t, strategy: _) -> clean(result: r)
    // r incorporates all changes from both o and t relative to b
    // where changes don't overlap
  }
}
```

### 3.5 Coordination Concept Detail: ConflictResolution

```
@version(1)
concept ConflictResolution [V] {

  purpose {
    Detect and resolve incompatible concurrent modifications
    using a pluggable strategy selected by data type and
    domain policy.
  }

  state {
    policies: set P
    policy_name: P -> String
    policy_priority: P -> Int             // lower = tried first
    pending: set C
    conflict_detail: C -> {
      base: option V,
      version1: V,
      version2: V,
      clock1: Bytes,                      // serialized causal clock
      clock2: Bytes,
      context: String                     // domain hint
    }
    conflict_resolution: C -> option V    // null until resolved
  }

  actions {
    action registerPolicy(name: String, priority: Int) {
      -> ok(policy: P) {
        Registers a resolution policy provider.
      }
      -> duplicate(message: String) {
        Policy name already exists.
      }
    }

    action detect(base: option V, version1: V, version2: V, context: String) {
      -> noConflict() {
        Versions are compatible; no conflict detected.
      }
      -> detected(conflictId: C, detail: Bytes) {
        Conflict detected. Detail describes the nature
        (overlapping regions, incompatible types, etc.)
      }
    }

    action resolve(conflictId: C, policyOverride: option String) {
      -> resolved(result: V) {
        Policy produced a resolution automatically.
      }
      -> requiresHuman(conflictId: C, options: list Bytes) {
        No automatic policy could resolve. Returns
        candidate resolutions for human selection.
      }
      -> noPolicy(message: String) {
        No policy registered for this conflict type.
      }
    }

    action manualResolve(conflictId: C, chosen: V) {
      -> ok(result: V) {
        Human-chosen resolution recorded.
      }
      -> notPending(message: String) {
        Conflict not found or already resolved.
      }
    }
  }

  invariant {
    after detect(base: _, version1: _, version2: _, context: _) -> noConflict()
    // version1 and version2 are compatible and can be composed
  }
}
```

---

## 4. Non-Provider Concepts: Specifications

This section covers the 12 concepts that are **not** coordination/provider patterns — they are standalone concepts with their own state and behavior.

### 4.1 ContentHash [C]

**Purpose:** Identify content by cryptographic digest, enabling deduplication, integrity verification, and immutable references.

**Key state:** `objects: HashDigest -> Bytes`, `metadata: HashDigest -> { size: Int, created: DateTime }`

**Key actions:** `store(content) -> ok(hash) | alreadyExists(hash)`, `retrieve(hash) -> ok(content) | notFound`, `verify(hash, content) -> valid | corrupt`

**Key invariant:** `store(c) -> ok(h)` then `retrieve(h) -> ok(c')` and `c = c'`

**Capabilities:** `requires persistent-storage`, `requires crypto`

**Provider pattern?** No. Hash algorithm is a config parameter, not a separate concept.

### 4.2 Ref [R]

**Purpose:** Provide mutable, human-readable names for immutable content-addressed objects.

**Key state:** `refs: Name -> HashDigest`, `reflog: list { name, oldHash, newHash, timestamp, agent }`

**Key actions:** `create(name, hash)`, `update(name, newHash, expectedOldHash)`, `delete(name)`, `resolve(name) -> ok(hash) | notFound`, `log(name) -> ok(entries)`

**Key invariant:** `update` uses compare-and-swap semantics — fails if current hash ≠ expectedOldHash.

**Provider pattern?** No. Single concept with clear purpose.

### 4.3 DAGHistory [N]

**Purpose:** Organize versions into a directed acyclic graph supporting branching, merging, and topological traversal.

**Key state:** `nodes: N -> { parents: set N, contentRef: String, metadata: Bytes }`, `roots: set N`

**Key actions:** `append(parents, contentRef, metadata) -> ok(nodeId)`, `ancestors(nodeId) -> ok(stream)`, `commonAncestor(a, b) -> found(nodeId) | none`, `descendants(nodeId) -> ok(stream)`, `between(a, b) -> ok(path)`

**Key invariant:** After `append(parents: {p1, p2}, ...)`, `ancestors(nodeId)` includes transitive closure of `ancestors(p1)` ∪ `ancestors(p2)`.

**Provider pattern?** No. The DAG is a data structure, not a strategy.

### 4.4 Patch [P]

**Purpose:** Represent a change as a first-class, invertible, composable object.

**Key state:** `patches: P -> { base: String, target: String, effect: Bytes, dependencies: set P }`

**Key actions:** `create(base, target) -> ok(patchId)`, `apply(patchId, content) -> ok(result) | incompatibleContext`, `invert(patchId) -> ok(inversePatchId)`, `compose(p1, p2) -> ok(composedId) | nonSequential`, `commute(p1, p2) -> ok(p1', p2') | cannotCommute`

**Key invariant:** `apply(p, base) -> ok(target)` and `apply(invert(p), target) -> ok(base)`.

**Provider pattern?** No. Patch has its own algebraic properties (invertibility, composition, commutation) that are part of its concept identity, not strategy choices.

### 4.5 Branch [B]

**Purpose:** Named parallel lines of development with lifecycle management.

**Key state:** `branches: B -> { head: String, protected: Bool, upstream: option B, created: DateTime }`, `archived: set B`

**Key actions:** `create(name, fromNode)`, `advance(name, newNode)`, `delete(name)`, `protect(name)`, `setUpstream(name, upstream)`, `divergencePoint(b1, b2) -> ok(nodeId) | noDivergence`

**Key invariant:** `advance` on a protected branch returns `-> protected(message)`.

**Provider pattern?** No.

### 4.6 TemporalVersion [V] — *supersedes Version*

**Purpose:** Track content versions with bitemporal semantics — when recorded (system time) and when valid (application time).

**Key state:** `versions: V -> { contentHash: String, systemTime: { from: DateTime, to: option DateTime }, validTime: { from: DateTime, to: option DateTime }, metadata: Bytes }`, `current: option V`

**Key actions:** `record(contentHash, validFrom?, validTo?) -> ok(versionId)`, `asOf(systemTime?, validTime?) -> ok(content) | notFound`, `between(start, end, dimension) -> ok(versions)`, `current() -> ok(content) | empty`

**Key invariant:** After `record(h, vf, vt)`, `asOf(now, vf)` returns content for hash `h`.

**Provider pattern?** No. Bitemporal semantics are the concept's identity.

### 4.7 SchemaEvolution [S]

**Purpose:** Manage versioned structural definitions with compatibility guarantees.

**Key state:** `schemas: S -> { subject: String, version: Int, schema: Bytes, compatibility: String }`, `subjects: String -> list S`

**Key actions:** `register(subject, schema, compatibility) -> ok(version) | incompatible(reasons)`, `check(old, new, mode) -> compatible | incompatible(reasons)`, `upcast(data, fromVersion, toVersion) -> ok(transformed) | noPath`, `resolve(readerSchema, writerSchema) -> ok(resolved) | incompatible`

**Key invariant:** `register` succeeds only if `check(latestSchema, newSchema, mode) -> compatible`.

**Provider pattern?** No. Compatibility checking is deterministic per mode, not a pluggable strategy.

### 4.8 ChangeStream [E] — *supersedes Capture*

**Purpose:** Ordered, resumable stream of atomic change events from a data source.

**Key state:** `events: E -> { type: String, before: option Bytes, after: option Bytes, source: String, timestamp: DateTime, offset: Int }`, `consumers: String -> Int` (offset tracking)

**Key actions:** `append(type, before?, after?, source) -> ok(offset)`, `subscribe(fromOffset?) -> ok(subscription)`, `acknowledge(consumer, offset)`, `replay(from, to?) -> ok(stream)`

**Key invariant:** Events are immutable once appended; `replay(from, to)` always returns the same events.

**Provider pattern?** No. The stream abstraction is uniform; source-specific capture adapters are pre-conceptual infrastructure (storage adapters per the concept test).

### 4.9 CausalClock [T]

**Purpose:** Track happens-before ordering between events across distributed participants.

**Key state:** `clocks: String -> list Int` (replica ID → vector clock), `events: T -> { clock: list Int, replicaId: String }`

**Key actions:** `tick(replicaId) -> ok(timestamp)`, `merge(local, remote) -> ok(merged)`, `compare(a, b) -> before | after | concurrent`, `dominates(a, b) -> ok(Bool)`

**Key invariant:** If `tick(r)` produces `t1` then later `tick(r)` produces `t2`, then `compare(t1, t2) -> before`.

**Provider pattern?** No (see Section 3.2 discussion).

### 4.10 Replica [R]

**Purpose:** Maintain an independent, locally-modifiable copy of shared state that synchronizes with peers.

**Key state:** `localState: Bytes`, `replicaId: String`, `pendingOps: list Bytes`, `peers: set String`, `syncState: String -> Bytes` (per-peer sync metadata)

**Key actions:** `localUpdate(op) -> ok(newState)`, `receiveRemote(op, fromReplica) -> ok(newState) | conflict(details)`, `sync(peer) -> ok | unreachable`, `getState() -> ok(state)`, `fork() -> ok(newReplicaId)`

**Key invariant:** After all replicas have received all updates (quiescence), all replicas return identical state from `getState()`.

**Annotations:** `@gate` — sync may complete after arbitrarily long delay.

**Provider pattern?** No. The replica lifecycle is uniform; the data type's merge semantics come from ConflictResolution via sync.

### 4.11 Attribution [A]

**Purpose:** Bind agent identity to content regions, tracking who created or modified each piece.

**Key state:** `attributions: A -> { contentRef: String, region: Bytes, agent: String, timestamp: DateTime, changeRef: String }`, `ownership: String -> set { pattern: String, owners: list String }`

**Key actions:** `attribute(contentRef, region, agent, changeRef)`, `blame(contentRef) -> ok(map)`, `history(contentRef, region) -> ok(chain)`, `setOwnership(pattern, owners)`, `queryOwners(path) -> ok(owners)`

**Key invariant:** After `attribute(c, r, a, ch)`, `blame(c)` maps region `r` to agent `a`.

**Provider pattern?** No.

### 4.12 Signature [G]

**Purpose:** Cryptographic proof of authorship, integrity, and temporal existence.

**Key state:** `signatures: G -> { contentHash: String, signer: String, certificate: Bytes, timestamp: Bytes, valid: Bool }`, `trustedSigners: set String`

**Key actions:** `sign(contentHash, identity) -> ok(signature)`, `verify(contentHash, signature) -> valid(identity, time) | invalid | expired | untrustedSigner`, `timestamp(contentHash) -> ok(proof)`

**Key invariant:** `sign(h, id) -> ok(sig)` then `verify(h, sig) -> valid(id, _)`.

**Capabilities:** `requires crypto`, `requires network` (for timestamp authorities)

**Provider pattern?** No. Signing and verification are uniform; key management and timestamp services are pre-conceptual infrastructure.

### 4.13 InlineAnnotation [A]

**Purpose:** Embed change markers directly within content structure, enabling accept/reject review workflows where the document simultaneously holds both before and after states.

**Key state:** `annotations: A -> { contentRef: String, changeType: String, scope: Bytes, author: String, timestamp: DateTime, status: String }`, `tracking: String -> Bool` (per-document tracking enabled/disabled)

- `changeType`: `"insertion"`, `"deletion"`, `"formatting"`, `"move"`
- `status`: `"pending"`, `"accepted"`, `"rejected"`

**Key actions:**
- `annotate(contentRef, changeType, scope, author) -> ok(annotationId) | trackingDisabled`
- `accept(annotationId) -> ok(cleanContent) | notFound | alreadyResolved`
- `reject(annotationId) -> ok(cleanContent) | notFound | alreadyResolved`
- `acceptAll(contentRef) -> ok(cleanContent)`
- `rejectAll(contentRef) -> ok(cleanContent)`
- `toggleTracking(contentRef, enabled) -> ok`
- `listPending(contentRef) -> ok(annotations)`

**Key invariant:** After `annotate(c, "insertion", scope, a) -> ok(id)` then `accept(id)` removes the annotation wrapper and keeps the inserted content; `reject(id)` removes both the wrapper and the content.

**Design note:** This concept is content-type-aware — the `scope` field references positions/ranges within the content's internal structure (XML elements, block IDs, character offsets). The concept does not interpret content structure itself; it stores scope as opaque `Bytes` and relies on the content system to resolve scope references. This keeps InlineAnnotation independent of any specific content model (OOXML, Markdown, block-based, etc.)

**Provider pattern?** No. The accept/reject semantics are uniform across content types; content-type-specific scope resolution is a pre-conceptual adapter.

**Syncs:** Attribution (every annotation is attributed to an author), CausalClock (annotations are causally ordered for collaborative review), ChangeStream (accept/reject events feed the change stream).

### 4.14 PessimisticLock [L]

**Purpose:** Prevent conflicts by granting exclusive write access to a resource, serializing edits rather than reconciling them after the fact.

**Key state:** `locks: L -> { resource: String, holder: String, acquired: DateTime, expires: option DateTime, reason: option String }`, `queue: String -> list { requester: String, requested: DateTime }` (waiting queue per resource)

**Key actions:**
- `checkOut(resource, holder, duration?, reason?) -> ok(lockId) | alreadyLocked(holder, expires) | queued(position)`
- `checkIn(lockId) -> ok | notFound | notHolder(message)`
- `breakLock(lockId, breaker, reason) -> ok(previousHolder) | notFound | unauthorized`
- `renew(lockId, additionalDuration) -> ok(newExpires) | notFound | notHolder`
- `queryLocks(resource?) -> ok(locks)`
- `queryQueue(resource) -> ok(waiters)`

**Key invariant:** After `checkOut(r, h, ...) -> ok(l)`, all other `checkOut(r, h2, ...)` where `h2 ≠ h` return `-> alreadyLocked(h, ...)` until `checkIn(l)` or lock expiration.

**Annotations:** `@gate` — `checkOut` may complete after an arbitrarily long wait if the resource is locked and the requester is queued.

**Capabilities:** `requires persistent-storage`

**Design note:** PessimisticLock is a conflict *avoidance* strategy, complementary to ConflictResolution's conflict *resolution* strategies. A system might use PessimisticLock for binary files (where merging is impossible) and ConflictResolution for text files (where merging is feasible). The `breakLock` action with mandatory `reason` supports administrative override for abandoned locks — a common requirement in legal document management.

**Provider pattern?** No. Locking semantics are uniform; the concept is the strategy.

**Syncs:** ConflictResolution (PessimisticLock is wired as a pre-merge guard — if a lock exists, skip merge entirely), Attribution (lock holder is attributed as exclusive editor during lock period), ChangeStream (lock/unlock events feed the audit stream).

### 4.15 RetentionPolicy [R]

**Purpose:** Govern how long versions and records must be kept and when they may be disposed, including legal hold suspension of normal disposition.

**Key state:**
- `policies: R -> { recordType: String, retentionPeriod: Int, unit: String, dispositionAction: String }`
- `holds: set H`, `hold_detail: H -> { name: String, scope: String, reason: String, issuer: String, issued: DateTime, released: option DateTime }`
- `dispositionLog: list { record: String, policy: R, disposedAt: DateTime, disposedBy: String }`

- `dispositionAction`: `"delete"`, `"archive"`, `"anonymize"`

**Key actions:**
- `setRetention(recordType, period, unit, dispositionAction) -> ok(policyId) | alreadyExists`
- `applyHold(name, scope, reason, issuer) -> ok(holdId)`
- `releaseHold(holdId, releasedBy, reason) -> ok | notFound | alreadyReleased`
- `checkDisposition(record) -> disposable(policy) | retained(reason, until) | held(holdNames)`
- `dispose(record, disposedBy) -> ok | retained(reason) | held(holdNames)`
- `auditLog(record?) -> ok(entries)`

**Key invariant:** `dispose(r, _)` returns `-> ok` **only if** `checkDisposition(r) -> disposable(...)`. A record under active legal hold can NEVER be disposed regardless of retention period expiration. This is the critical compliance invariant — 21 CFR Part 11, HIPAA, SOX, and litigation hold requirements all reduce to this rule.

**Capabilities:** `requires persistent-storage`

**Design note:** RetentionPolicy syncs with Tombstone-like deletion in any concept. When any concept attempts to delete versioned data, the sync chain checks RetentionPolicy first. The hold mechanism is deliberately simple — scope is a string pattern (e.g., `"matter:12345/*"`, `"user:jane/*"`, `"*"` for global) matched against record identifiers. Complex hold logic belongs in domain-specific syncs, not in the concept itself.

**Provider pattern?** No. Retention and hold semantics are regulatory requirements, not pluggable strategies.

**Syncs:** TemporalVersion (retention governs when old versions can be purged), ChangeStream (disposition events feed the audit stream), DAGHistory (retention prevents pruning of history nodes within retention period), Signature (disposition records should be signed for compliance).

---

## 5. Superseded Concepts: Migration Plan

### 5.1 Version → TemporalVersion

**Current state of Version (content kit):** Tracks content versions with linear history — likely `create`, `get`, `list`, `revert` actions.

**What TemporalVersion adds:**
- Content-addressed identity (syncs with ContentHash)
- Bitemporal semantics (system time + valid time)
- DAG-compatible history (syncs with DAGHistory for branching)
- Time-travel queries (`asOf`, `between`)

**Migration strategy: Deprecate, wrap, then remove.**

1. **Phase 1 (v0.19):** Ship TemporalVersion. Add a **compatibility sync** that translates Version actions to TemporalVersion:

```
sync VersionCompatibility [eager]
when {
  Version/create: [ content: ?c ] => [ ok(version: ?v) ]
}
then {
  ContentHash/store: [ content: ?c ]
  TemporalVersion/record: [ contentHash: ?hash ]
}
```

2. **Phase 2 (v0.20):** Mark Version as `@deprecated`. Update all Version-dependent syncs in the Content Kit to use TemporalVersion instead. Verify no external kit references Version directly (syncs only go through TemporalVersion).

3. **Phase 3 (v0.21):** Remove Version from the Content Kit. TemporalVersion lives in the Versioning Kit; the Content Kit's `suite.yaml` adds a `uses` dependency on the Versioning Kit.

**Breaking change:** Yes — this is a MAJOR boundary for any application using Version directly. The compatibility sync provides a migration window. Announce in v0.19 release notes.

### 5.2 SyncedContent → Replica + ConflictResolution

**Current state of SyncedContent (content kit):** Likely couples sync transport, conflict detection, and conflict resolution into one concept.

**What Replica + ConflictResolution provide:**
- Clean separation: Replica handles sync lifecycle; ConflictResolution handles strategy
- Pluggable resolution (LWW, add-wins, manual, multi-value) instead of hardcoded behavior
- CausalClock integration for proper concurrency detection
- Fork/join semantics for offline-first workflows

**Migration strategy: Extract, redirect, then remove.**

1. **Phase 2 (v0.20):** Ship Replica and ConflictResolution. Create syncs that compose them to replicate SyncedContent's behavior. Add a **facade sync** that maps SyncedContent actions to Replica + ConflictResolution pairs.

2. **Phase 3 (v0.21):** Mark SyncedContent as `@deprecated`. Migrate Content Kit syncs.

3. **Phase 4 (v0.22):** Remove SyncedContent.

### 5.3 Capture → ChangeStream (partial supersession)

**Current state of Capture (data integration suite):** CDC-focused change capture.

**What changes:** Capture is **not fully removed** — it retains its role as the *source-specific adapter* that connects to databases, APIs, and filesystems to detect changes. ChangeStream becomes the *downstream consumer interface* that provides offset management, replay, and composability.

**Migration strategy: Narrow scope, add sync.**

1. **Phase 2 (v0.20):** Ship ChangeStream. Add a required sync:

```
sync CaptureToChangeStream [eager]
when {
  Capture/detected: [ change: ?c ] => [ ok(changeId: ?id) ]
}
then {
  ChangeStream/append: [
    type: ?c.type;
    before: ?c.before;
    after: ?c.after;
    source: ?c.source
  ]
}
```

2. **Phase 3 (v0.21):** Update Data Integration Kit's `suite.yaml` to clarify that Capture is the *source adapter* and ChangeStream is the *stream interface*. Consumers that currently subscribe to Capture events migrate to ChangeStream subscriptions.

Capture is NOT removed — it is narrowed. Its `suite.yaml` entry gets updated documentation.

### 5.4 Provenance → Provenance + Attribution (scope narrowing)

**Current state of Provenance (data integration suite):** Tracks data lineage, likely mixing entity-level derivation with content-level attribution.

**What changes:** Provenance retains W3C PROV-style entity → activity → agent chains for *data pipeline lineage*. Attribution (Collaboration Kit) handles *content-region-level authorship tracking* (blame, CODEOWNERS-style ownership).

**Migration strategy: Extract attribution concerns, add sync.**

1. **Phase 2 (v0.20):** Ship Attribution. Add an integration sync:

```
sync ProvenanceAttribution [eager]
when {
  Attribution/attribute: [ contentRef: ?c; agent: ?a; changeRef: ?ch ]
    => [ ok ]
}
then {
  Provenance/recordAttribution: [ entity: ?c; agent: ?a; activity: ?ch ]
}
```

2. No deprecation needed — Provenance keeps its identity. Review its actions and remove any that duplicate Attribution's granular tracking.

### 5.5 ActionLog and FlowTrace — Enhancement only

Both concepts remain in the Framework. New syncs connect them to the Collaboration Kit:

```
sync ActionLogCausality [eager]
when {
  ActionLog/append: [ invocation: ?inv ] => [ ok(entry: ?e) ]
}
then {
  CausalClock/tick: [ replicaId: ?inv.source ]
}
```

```
sync FlowTraceCausality [eager]
when {
  FlowTrace/addStep: [ flow: ?f; step: ?s ] => [ ok ]
}
then {
  CausalClock/tick: [ replicaId: ?s.executor ]
}
```

These are **recommended syncs** — loadable for distributed deployments, skippable for single-node.

---

## 6. Sync Tier Classification

### 6.1 Required Syncs (removing causes data corruption)

| Sync | Connects | Rationale |
|---|---|---|
| `content-hash-dag-history` | ContentHash ↔ DAGHistory | Every DAG node must reference content-addressed data |
| `ref-branch` | Ref ↔ Branch | Branch heads are refs; ref updates must be atomic |
| `merge-dag-history` | Merge ↔ DAGHistory | Merge results must create merge nodes in the DAG |
| `patch-diff` | Patch ↔ Diff | Patches are produced from diffs; must round-trip |
| `temporal-version-content-hash` | TemporalVersion ↔ ContentHash | Versions reference content by hash |
| `replica-causal-clock` | Replica ↔ CausalClock | Every replica operation must advance the causal clock |
| `replica-conflict-resolution` | Replica ↔ ConflictResolution | Remote updates must go through resolution |
| `attribution-causal-clock` | Attribution ↔ CausalClock | Attributions must be causally ordered |
| `pessimistic-lock-conflict-resolution` | PessimisticLock ↔ ConflictResolution | Lock check before merge — if locked, skip merge and reject |
| `capture-change-stream` | Capture ↔ ChangeStream | Captured changes must enter the stream |

### 6.2 Recommended Syncs (useful defaults, can override)

| Sync | Connects | Rationale |
|---|---|---|
| `change-stream-dag-history` | ChangeStream ↔ DAGHistory | Stream events create version nodes |
| `schema-evolution-change-stream` | SchemaEvolution ↔ ChangeStream | Schema checks before stream append |
| `signature-content-hash` | Signature ↔ ContentHash | Sign content by hash |
| `attribution-dag-history` | Attribution ↔ DAGHistory | Blame walks DAG for line-level attribution |
| `action-log-causality` | ActionLog ↔ CausalClock | Causal ordering for distributed action logs |
| `flow-trace-causality` | FlowTrace ↔ CausalClock | Causal ordering for distributed traces |
| `provenance-attribution` | Provenance ↔ Attribution | Content attribution feeds provenance graph |
| `inline-annotation-attribution` | InlineAnnotation ↔ Attribution | Every annotation attributed to its author |
| `inline-annotation-change-stream` | InlineAnnotation ↔ ChangeStream | Accept/reject events feed audit stream |
| `pessimistic-lock-change-stream` | PessimisticLock ↔ ChangeStream | Lock/unlock events feed audit stream |
| `retention-policy-temporal-version` | RetentionPolicy ↔ TemporalVersion | Retention governs when old versions can be purged |
| `retention-policy-dag-history` | RetentionPolicy ↔ DAGHistory | Retention prevents pruning history nodes |

### 6.3 Integration Syncs (activate per loaded provider)

| Sync | Activates When | Purpose |
|---|---|---|
| `tree-diff-activation` | TreeDiff provider loaded | Route tree-structured content to structural differ |
| `semantic-merge-activation` | SemanticMerge provider loaded | Route code files to AST-aware merger |
| `lww-resolution-activation` | LWWResolution provider loaded | Default resolution for simple key-value stores |
| `add-wins-resolution-activation` | AddWinsResolution provider loaded | Default for set-like data (OR-Set semantics) |

---

## 7. Implementation Phases

### Phase 1: Immutable Storage Foundation (v0.19)

**Ships:** ContentHash, Ref, DAGHistory, Patch, Diff (coordination + MyersDiff provider), Branch

**Rationale:** These concepts have zero dependencies on existing Clef concepts and provide the foundation everything else builds on. ContentHash is the most fundamental — nearly every other concept references content by hash.

**Dependency graph:**
```
ContentHash ← (no deps)
Ref ← (no deps, syncs with ContentHash)
DAGHistory ← ContentHash (nodes reference hashes)
Patch ← ContentHash (base/target are hashes)
Diff ← ContentHash (inputs are hashes), PluginRegistry (provider routing)
Branch ← DAGHistory (heads are nodes), Ref (names are refs)
MyersDiff ← (provider, loaded by Diff)
```

**Testing strategy:**
- ContentHash: Round-trip property tests (store → retrieve = identity), collision resistance, concurrent store dedup
- DAGHistory: Graph property tests (ancestor transitivity, common ancestor correctness, topological order validity)
- Patch: Algebraic property tests (apply-invert round-trip, compose associativity, commute-preserves-result)
- Diff+MyersDiff: Diff-patch round-trip (`patch(a, diff(a, b)) = b`), distance symmetry

**Kit manifest (partial):**
```yaml
kit:
  name: versioning
  version: 0.1.0
  description: "Version control, change tracking, and history management"

concepts:
  ContentHash:
    spec: ./content-hash.concept
    params:
      C: { as: content, description: "Content being hashed" }
  Ref:
    spec: ./ref.concept
    params:
      R: { as: ref, description: "Reference entry" }
  DAGHistory:
    spec: ./dag-history.concept
    params:
      N: { as: node, description: "History node" }
  Patch:
    spec: ./patch.concept
    params:
      P: { as: patch, description: "Patch entry" }
  Diff:
    spec: ./diff.concept
    params:
      C: { as: content, description: "Content being diffed" }
  Branch:
    spec: ./branch.concept
    params:
      B: { as: branch, description: "Branch entry" }
  MyersDiff:
    spec: ./providers/myers-diff.concept
    optional: true

syncs:
  required:
    - content-hash-dag-history
    - ref-branch
    - patch-diff
  integration:
    - myers-diff-activation

uses: []
```

**Definition of done:**
- All concepts have `.concept` specs, generated handler skeletons, and conformance tests
- Required syncs are implemented and pass integration tests
- `clef check` validates all specs and syncs
- CLI can scaffold a Git-like VCS from these concepts

### Phase 2: Change Representation + Collaboration Foundation (v0.20)

**Ships:** TemporalVersion, ChangeStream, SchemaEvolution, CausalClock, Replica, ConflictResolution (coordination + LWWResolution + ManualResolution providers), Attribution

**Also ships:** Compatibility syncs for Version→TemporalVersion, SyncedContent facade, Capture→ChangeStream

**Rationale:** This is the largest phase. It introduces both the temporal/streaming concepts and the distributed collaboration concepts together because they sync heavily (CausalClock ↔ ChangeStream, Replica ↔ ConflictResolution). Splitting them would leave broken sync chains.

**Dependency graph:**
```
CausalClock ← (no deps)
TemporalVersion ← ContentHash (from Phase 1)
ChangeStream ← CausalClock (event ordering)
SchemaEvolution ← ChangeStream (schema checks before append)
Replica ← CausalClock, ConflictResolution
ConflictResolution ← PluginRegistry (provider routing)
Attribution ← CausalClock, ContentHash (from Phase 1), DAGHistory (from Phase 1)
LWWResolution ← (provider)
ManualResolution ← (provider)
```

**Supersession actions this phase:**
- Ship Version → TemporalVersion compatibility sync
- Ship SyncedContent → Replica + ConflictResolution facade sync
- Ship Capture → ChangeStream required sync
- Ship Provenance ↔ Attribution integration sync
- Mark nothing as deprecated yet — give users one version to migrate

**Testing strategy:**
- CausalClock: Partial order property tests, vector clock merge correctness, concurrency detection
- Replica: Convergence tests (all replicas reach same state), partition tolerance, fork/join
- ConflictResolution: Strategy dispatch, LWW timestamp ordering, manual resolution workflow
- Attribution: Blame correctness against known DAG histories

### Phase 3: Deprecation + Additional Providers + New Concepts (v0.21)

**Ships:** Signature, InlineAnnotation, PessimisticLock, RetentionPolicy, PatienceDiff, HistogramDiff, ThreeWayMerge, RecursiveMerge, AddWinsResolution, MultiValueResolution

**Also ships:** `@deprecated` annotations on Version, SyncedContent

**Rationale:** With compatibility syncs proven in v0.20, we can now deprecate the old concepts. The three new concepts (InlineAnnotation, PessimisticLock, RetentionPolicy) depend on Phase 2 concepts (Attribution, ConflictResolution, TemporalVersion) and represent domain-specific extensions rather than core primitives — shipping them here keeps Phase 2 focused on the foundational collaboration stack. Additional providers expand the strategy space.

**Dependency graph for new concepts:**
```
InlineAnnotation ← Attribution (Phase 2), CausalClock (Phase 2), ChangeStream (Phase 2)
PessimisticLock ← ConflictResolution (Phase 2), Attribution (Phase 2), ChangeStream (Phase 2)
RetentionPolicy ← TemporalVersion (Phase 2), DAGHistory (Phase 1), ChangeStream (Phase 2), Signature (this phase)
```

**Supersession actions this phase:**
- Add `@deprecated` to Version (content kit)
- Add `@deprecated` to SyncedContent (content kit)
- Update Content Kit `suite.yaml` to add `uses: [versioning, collaboration]`
- Update Data Integration Kit to clarify Capture's narrowed scope
- Migrate all internal syncs that reference Version to reference TemporalVersion
- Migrate all internal syncs that reference SyncedContent to reference Replica + ConflictResolution
- Wire InlineAnnotation ↔ Attribution ↔ ChangeStream recommended syncs
- Wire PessimisticLock ↔ ConflictResolution required sync and PessimisticLock ↔ ChangeStream recommended sync
- Wire RetentionPolicy ↔ TemporalVersion and RetentionPolicy ↔ DAGHistory recommended syncs

**Signature ships here** (not earlier) because it depends on ContentHash (Phase 1) and Attribution (Phase 2) and has lower urgency than core versioning/collaboration. **RetentionPolicy depends on Signature** for compliance-grade disposition logging, so both ship together.

**InlineAnnotation ships here** rather than Phase 2 because it is a content-type-specific extension, not a core collaboration primitive. Phase 2's Replica + ConflictResolution handle the universal concurrency problem; InlineAnnotation adds the document-review workflow pattern on top.

**PessimisticLock ships here** as a complement to ConflictResolution (Phase 2). Systems choose between them per resource type: PessimisticLock for binary files and legal documents where merging is impossible; ConflictResolution for text and structured data where merging is feasible.

### Phase 4: Cleanup + Advanced Providers (v0.22)

**Ships:** TreeDiff, SemanticMerge, LatticeMerge providers

**Also ships:** Removal of Version, SyncedContent from their respective kits

**Rationale:** Advanced providers (tree diffing, semantic merge, lattice-based CRDT merge) require the full concept stack to be stable. LatticeMerge ships as a **Merge provider** (per Decision D1) — it takes (base, ours, theirs), computes the lattice join, and always returns `-> clean(result)`, never `-> conflicts(...)`. TreeDiff enables structured diffing for XML, JSON, and AST data. SemanticMerge enables language-aware code merging that understands refactoring. Removing deprecated concepts provides a clean API surface.

**Supersession actions this phase:**
- Remove Version from Content Kit
- Remove SyncedContent from Content Kit
- Final `suite.yaml` cleanup — Content Kit depends on Versioning Kit and Collaboration Kit via `uses`

---

## 8. Cross-Kit Dependency Map

After all phases complete, the dependency graph between suites is:

```
                    ┌─────────────┐
                    │ Foundation  │
                    │    Kit      │
                    └──────┬──────┘
                           │ (TypeSystem, Intent, Schema, etc.)
                    ┌──────┴──────┐
              ┌─────┤ Versioning  ├─────┐
              │     │    Kit      │     │
              │     └──────┬──────┘     │
              │            │            │
     ┌────────┴───┐  ┌────┴─────┐  ┌───┴──────────┐
     │   Content  │  │Collabor- │  │    Data       │
     │    Kit     │  │ation Kit │  │ Integration   │
     │            │  │          │  │    Kit        │
     └────────────┘  └──────────┘  └───────────────┘
         uses:          uses:           uses:
         versioning     versioning      versioning
                                        (ChangeStream,
                                         SchemaEvolution)
```

**Versioning Kit** has no suite-level dependencies (it uses PluginRegistry from Infrastructure Kit for provider routing, declared in `uses`).

**Collaboration Kit** depends on Versioning Kit (Attribution syncs with ContentHash and DAGHistory; ConflictResolution syncs with Merge).

**Content Kit** depends on both (TemporalVersion replaces Version; Replica + ConflictResolution replace SyncedContent).

**Data Integration Kit** depends on Versioning Kit (ChangeStream replaces stream-oriented parts of Capture; SchemaEvolution handles data evolution; Provenance syncs with Attribution).

---

## 9. PluginRegistry Integration

The three coordination concepts (Diff, Merge, ConflictResolution) use PluginRegistry from the Infrastructure Kit for provider discovery and routing. The pattern:

### 9.1 Provider Registration

Each provider concept, on load, registers itself with PluginRegistry:

```
sync DiffProviderRegistration [eager]
when {
  MyersDiff/init: [] => [ ok(provider: ?p) ]
}
then {
  PluginRegistry/register: [
    category: "diff";
    name: "myers";
    provider: ?p;
    metadata: { contentTypes: ["text/*", "application/octet-stream"] }
  ]
}
```

### 9.2 Provider Resolution

When the coordination concept needs to dispatch, it queries PluginRegistry:

```
sync DiffDispatch [eager]
when {
  Diff/diff: [ contentA: ?a; contentB: ?b; algorithm: ?alg ]
    // pending dispatch
}
where {
  PluginRegistry: { ?provider category: "diff"; name: ?alg }
  // or if alg is empty, match by content type
}
then {
  ?provider/compute: [ contentA: ?a; contentB: ?b ]
}
```

### 9.3 Provider Interface Contract

All providers in a category must implement the same action signatures. For Diff providers:

```
actions {
  action compute(contentA: C, contentB: C) {
    -> ok(editScript: Bytes, distance: Int) { ... }
    -> unsupportedContent(message: String) { ... }
  }
}
```

For Merge providers:

```
actions {
  action execute(base: C, ours: C, theirs: C) {
    -> clean(result: C) { ... }
    -> conflicts(regions: list Bytes) { ... }
    -> unsupportedContent(message: String) { ... }
  }
}
```

For ConflictResolution providers:

```
actions {
  action attemptResolve(base: option V, v1: V, v2: V, context: String) {
    -> resolved(result: V) { ... }
    -> cannotResolve(reason: String) { ... }
  }
}
```

---

## 10. Resolved Design Decisions

**D1. LatticeMerge is a Merge provider.**
CRDT lattice joins take (base, ours, theirs) and produce a result — matching the Merge interface. The fact that lattice joins never produce conflicts is a *property* of the provider, not a different interface shape. ConflictResolution is downstream — it handles cases where other Merge providers *do* produce conflicts. If a LatticeMerge provider is active, ConflictResolution simply never fires for that content type. This keeps the coordination/provider boundary clean.

**D2. EventGraph = DAGHistory (single concept).**
The research identified EventGraph (causal DAG of editing operations, Eg-walker style) and DAGHistory (version DAG) as structurally identical. Both are append-only DAGs with causal ordering and common-ancestor queries. The difference is granularity: Git commits contain whole-tree snapshots; CRDT event graphs contain single-character operations. DAGHistory handles both by making node content type-parameterized — a node can contain a commit-sized snapshot or a single operation. The `metadata` field on each node distinguishes granularity levels. No separate EventGraph concept is needed.

**D3. InlineAnnotation is included (Collaboration Kit, Phase 3).**
Document review workflows (Word track changes, Google Docs suggestions, legal redlining) are a major versioning use case outside of code. InlineAnnotation captures the unique concept of a document simultaneously holding both before and after states with per-annotation accept/reject semantics. This is genuinely independent from Merge (which produces a single resolved output) and from Diff (which produces an edit script, not an annotated document). The concept is content-type-agnostic — scope is opaque Bytes, and content-specific resolution is a pre-conceptual adapter.

**D4. PessimisticLock and RetentionPolicy are included.**
PessimisticLock (Collaboration Kit, Phase 3) is the conflict *avoidance* complement to ConflictResolution's conflict *resolution*. Every multi-user system needs both — merge-based resolution for mergeable content, exclusive locking for non-mergeable content (binary files, legal contracts during negotiation, database schema definitions). RetentionPolicy (Versioning Kit, Phase 3) addresses compliance requirements (21 CFR Part 11, HIPAA, SOX, litigation holds) that govern the lifecycle of versioned data. Its core invariant — a record under legal hold can never be disposed — is a hard regulatory constraint that multiple domains need. Both concepts pass the concept test with clear independent state, meaningful actions, and operational principles.

**D5. Architecture doc version bumps per phase.**
Phase 1 (v0.19) ships the Versioning Kit foundation → architecture doc bumps to 0.19.0. Phase 2 (v0.20) ships collaboration + temporal → 0.20.0. Phase 3 (v0.21) ships deprecations + new concepts + providers → 0.21.0. Phase 4 (v0.22) ships cleanup + advanced providers → 0.22.0. Concept library version also bumps: current v0.4.0 with 54 concepts across 15 suites → v0.5.0 (Phase 1, +6 concepts, +1 kit), v0.6.0 (Phase 2, +7 concepts, +1 kit), v0.7.0 (Phase 3, +4 concepts, +6 providers, −0), v0.8.0 (Phase 4, +4 providers, −2 concepts).

---

## 11. Appendix: Concept Count Summary

| Category | Count | Names |
|---|---|---|
| **New standalone concepts** | 15 | ContentHash, Ref, DAGHistory, Patch, Branch, TemporalVersion, SchemaEvolution, ChangeStream, RetentionPolicy, CausalClock, Replica, Attribution, Signature, InlineAnnotation, PessimisticLock |
| **New coordination concepts** | 3 | Diff, Merge, ConflictResolution |
| **New provider concepts** | 10 | MyersDiff, PatienceDiff, HistogramDiff, TreeDiff, ThreeWayMerge, RecursiveMerge, LatticeMerge, SemanticMerge, LWWResolution, AddWinsResolution, ManualResolution, MultiValueResolution |
| **Superseded (removed)** | 2 | Version, SyncedContent |
| **Narrowed (kept, reduced scope)** | 2 | Capture, Provenance |
| **Enhanced (kept, new syncs)** | 2 | ActionLog, FlowTrace |

**Net change to concept library:** +28 concepts (18 new + 10 providers), −2 removed = **+26 net** (54 → 80 concepts, 15 → 17 suites)

### Phase-by-phase concept count

| Phase | Version | New Concepts | New Providers | Deprecated | Removed | Running Total |
|---|---|---|---|---|---|---|
| Current | 0.18 | — | — | — | — | 54 concepts, 15 suites |
| Phase 1 | 0.19 | ContentHash, Ref, DAGHistory, Patch, Diff, Branch | MyersDiff | — | — | 61 concepts, 16 suites |
| Phase 2 | 0.20 | TemporalVersion, ChangeStream, SchemaEvolution, CausalClock, Replica, ConflictResolution, Attribution | LWWResolution, ManualResolution | — | — | 70 concepts, 17 suites |
| Phase 3 | 0.21 | Signature, InlineAnnotation, PessimisticLock, RetentionPolicy | PatienceDiff, HistogramDiff, ThreeWayMerge, RecursiveMerge, AddWinsResolution, MultiValueResolution | Version, SyncedContent | — | 80 concepts, 17 suites |
| Phase 4 | 0.22 | — | TreeDiff, SemanticMerge, LatticeMerge | — | Version, SyncedContent | 80 concepts, 17 suites |
