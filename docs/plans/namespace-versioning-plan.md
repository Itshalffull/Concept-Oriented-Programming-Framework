# Namespace-Unified Versioning — Implementation Plan

**Version:** 1.0.0
**Date:** 2026-04-09
**Status:** Design-ready
**Problem:** VersionSpaces, revisions, and temporal queries each have their own resolution mechanism. They should all be addressable through Namespace, enabling consistent references, transclusion, and denormalization across branches and time.
**Modified concepts:** 3 (VersionSpace, Version, TemporalVersion)
**New syncs:** 3
**Depends on:** Relation Resolver PRD (for denormalization infrastructure)

---

## 0. The Insight

Clef Base has four ways to ask "which version?":

| Mechanism | Concept | Scope | Question |
|---|---|---|---|
| VersionSpace | `repertoire/concepts/multiverse/version-space.concept` | All entities | "Which branch?" |
| Version | `repertoire/concepts/content/version.concept` | One entity | "Which revision?" |
| TemporalVersion | `repertoire/concepts/versioning/temporal-version.concept` | One entity | "As of when?" |
| DAGHistory | `repertoire/concepts/versioning/dag-history.concept` | One entity | "Which node in the version graph?" |

All four answer the same fundamental question: **which state of this entity should I resolve?** They should all route through the same Namespace mechanism so that:

1. References like `[[draft-v2://article-1@v3]]` resolve consistently
2. Transclusion via `{{transclude article-1@2026-04-01}}` fetches historical content
3. Denormalized relation data can be pinned to a specific revision
4. Views can show "as of" snapshots without special-casing

---

## 1. Namespace Addressing Scheme

### 1.1 URI structure

```
[namespace://]entity-id[@qualifier]
```

| Part | Source | Examples |
|---|---|---|
| `namespace://` | VersionSpace (as Namespace provider) | `draft-v2://`, `draft-v2/experiment://` |
| `entity-id` | ContentNode | `article-1`, `person-42` |
| `@qualifier` | Version, TemporalVersion, or DAGHistory | `@v3`, `@2026-04-01`, `@sha256:abc` |

### 1.2 Resolution priority

```
1. Parse the URI into namespace, entity-id, qualifier
2. If namespace is present:
   → Resolve through VersionSpace overlay chain (Namespace/resolve → VersionSpace/resolve)
3. If qualifier is present:
   → Version qualifier (@v3): Version/rollback to get snapshot data
   → Temporal qualifier (@2026-04-01T...): TemporalVersion/asOf
   → Hash qualifier (@sha256:abc): DAGHistory node by contentRef
4. If both:
   → First scope to namespace (branch), then apply qualifier (revision within branch)
5. If neither:
   → Current state of entity in base (or active VersionContext)
```

### 1.3 Qualifier formats

| Format | Resolver | Example |
|---|---|---|
| `@v{N}` | Version/rollback(version: "v{N}") | `@v3` → third snapshot |
| `@{ISO-date}` | TemporalVersion/asOf(validTime: date) | `@2026-04-01` |
| `@{ISO-datetime}` | TemporalVersion/asOf(systemTime: datetime) | `@2026-04-01T14:30:00Z` |
| `@sha256:{hash}` | DAGHistory/get(contentRef: hash) | `@sha256:abc123` |
| `@latest` | Current (no-op, explicit) | `@latest` |
| `@previous` | Version/listVersions → second-to-last | `@previous` |

---

## 2. VersionSpace as Namespace Provider

### 2.1 Registration sync

```
sync VersionSpaceRegistersNamespace [eager]
when VersionSpace/fork completes ok
then Namespace/createNamespacedPage(
  node: space,
  path: parentPath/name
)
```

### 2.2 Sub-space nesting

VersionSpace parent/child hierarchy maps to Namespace parent/path:

```
main                                ← root (implicit)
├── draft-v2                        ← Namespace: draft-v2
│   ├── alice-experiment            ← Namespace: draft-v2/alice-experiment
│   └── bob-hotfix                  ← Namespace: draft-v2/bob-hotfix
└── staging                         ← Namespace: staging
```

`draft-v2/alice-experiment://article-1` resolves:
1. Namespace/resolve → finds VersionSpace "alice-experiment" under "draft-v2"
2. VersionSpace/resolve(space: alice-experiment, entity: article-1)
   → walks up: alice-experiment overrides → draft-v2 overrides → base

### 2.3 Lifecycle syncs

| Event | Namespace effect |
|---|---|
| VersionSpace/fork | Create child Namespace node |
| VersionSpace/archive | Mark Namespace node as archived (hidden from navigation) |
| VersionSpace/merge | Optionally remove Namespace node (merged branches disappear) |
| VersionSpace/promote_to_base | Replace root, rebase child Namespaces |

---

## 3. Revisions as Namespace Qualifiers

Revisions don't create Namespace NODES (they're not a tree — they're a timeline per entity). Instead, they're QUALIFIERS on entity references within a Namespace.

### 3.1 Reference resolver changes

The Reference concept's resolution logic needs to parse the `@qualifier` and route to the appropriate version concept:

```
Reference/resolve("draft-v2://article-1@v3"):
  1. namespace = "draft-v2" → scope to VersionSpace
  2. entity = "article-1"
  3. qualifier = "v3" → Version/rollback(version: "v3")
  4. Return: the article-1 data as it was at v3, within the draft-v2 branch
```

### 3.2 Version/snapshot auto-creation

The existing `version-aware-save` sync creates Version snapshots on ContentStorage/save. This means every save creates a referenceable revision. The version ID (`v1`, `v2`, ...) is the qualifier.

### 3.3 Temporal resolution

`article-1@2026-04-01` resolves to "the version of article-1 that was valid on April 1st." This uses TemporalVersion/asOf, which does bitemporal resolution:

- `@2026-04-01` (date only) → validTime query: what was true on that date?
- `@2026-04-01T14:30:00Z` (datetime) → systemTime query: what did the system know at that moment?

---

## 4. What This Enables

### 4.1 Reference to a specific revision

```
See the [[original draft|article-1@v1]] before Alice's edits.
```

The wikilink resolves to a read-only view of article-1 at revision 1. Clicking it opens the entity detail in historical mode (read-only, with a banner "Viewing revision v1 from 2026-03-15").

### 4.2 Transclude historical content

```
{{transclude article-1@2026-04-01}}
```

SyncedContent resolves the entity as of April 1st and renders it inline. Useful for audit trails, "as published" views, and legal snapshots.

### 4.3 Denormalize from a pinned revision

In a RelationSpec:
```json
{ "field": "contract", "include": ["terms"], "qualifier": "@v1" }
```

"Always show the contract terms from revision 1, even if the contract has been updated since." The denormalized `contract.terms` is pinned to v1, not the current version.

### 4.4 Views with "as of" filtering

A view could accept a temporal qualifier from the URL:
```
/admin/content?asOf=2026-04-01
```

The ViewRenderer passes the qualifier through to query execution. All reads resolve to the state as of that date. Useful for "what did the site look like last Tuesday?"

### 4.5 Diff between any two addressable states

```
diff(
  "draft-v2://article-1@v3",
  "staging://article-1@latest"
)
```

"Show me the differences between revision 3 on the draft branch and the current version on staging." Both sides resolve through Namespace + qualifier, then the Diff concept compares them.

---

## 5. Integration with Relation Resolver

Denormalized relation data can be:

**Branch-scoped:** `author.name` resolves through the active VersionSpace. On `draft-v2`, Person-42 might have `name: "Alicia"` while base has `name: "Alice"`.

**Revision-pinned:** If a RelationSpec path includes a qualifier, the denormalized data is pinned to that revision. This is useful for contracts, published snapshots, and audit records where you need the value at a specific point in time, not the current value.

**Propagation respects branches:** When Person-42's name changes on `draft-v2`, propagation only updates denormalized data within the `draft-v2` namespace — not base or other branches.

---

## 6. Concept Independence (Jackson's Rules)

**No concept knows about any other concept.** All cross-concept wiring goes through syncs. Here's how each piece stays independent:

### 6.1 Concepts stay independent

| Concept | What it knows | What it does NOT know |
|---|---|---|
| **Namespace** | Hierarchical paths, parent/child nodes | Nothing about VersionSpace, versions, or content |
| **VersionSpace** | Overlay branches, overrides, fork/merge | Nothing about Namespace, Reference, or UI |
| **Version** | Snapshots of opaque data, timestamps | Nothing about VersionSpace, Namespace, or entities |
| **TemporalVersion** | Bitemporal records, asOf queries | Nothing about VersionSpace, UI, or content |
| **Reference** | Source → target links with opaque metadata | Nothing about Namespace, versions, or resolution |
| **SyncedContent** | Transclusion of opaque content by ref | Nothing about versioning or namespace scoping |

Each concept operates on its own state. None imports or calls another directly.

### 6.2 Syncs wire everything together

**VersionSpace ↔ Namespace** (3 syncs):
```
VersionSpace/fork ok       → Namespace/createNamespacedPage
VersionSpace/archive ok    → Namespace/move (to archived path)
VersionSpace/merge ok      → Namespace removal
```

**Reference resolution with qualifiers** (2 syncs):
```
Reference/resolve ok       → if qualifier present:
  @v{N}:    Version/rollback
  @{date}:  TemporalVersion/asOf
  @sha256:  DAGHistory/get

Reference/resolve ok       → if namespace present:
  Namespace/resolve → VersionSpace/resolve
```

**SyncedContent with qualifiers** (1 sync):
```
SyncedContent/resolve ok   → same qualifier routing as Reference
```

**Denormalization with branches** (1 sync):
```
RelationResolver/resolve   → if VersionContext active:
  VersionSpace/resolve (scope all reads to branch)
```

### 6.3 The URI is just metadata on Reference

The Reference concept doesn't parse `draft-v2://article-1@v3`. It stores:

```
Reference: {
  source: "page-1",
  target: "article-1",
  metadata: '{ "namespace": "draft-v2", "qualifier": "v3" }'
}
```

The **parser** (framework-level, not a concept) extracts namespace and qualifier from `[[draft-v2://article-1@v3]]` and stores them as Reference metadata. The **resolution sync** reads the metadata and routes to the appropriate concepts. Reference itself just stores opaque links.

### 6.4 Namespace doesn't know about VersionSpace

Namespace provides hierarchical path resolution. It doesn't know that its nodes happen to be VersionSpaces. The sync creates the Namespace node when VersionSpace/fork fires — Namespace just sees "create a node at path X with parent Y."

When Reference resolution needs to scope to a namespace, the sync calls Namespace/resolve to get the node, then VersionSpace/resolve to get the entity's state within that scope. Neither concept calls the other.

### 6.5 Version concepts don't know about each other

Version, TemporalVersion, and DAGHistory are independent. The qualifier routing sync dispatches to the right one based on the qualifier format:
- `@v3` → Version/rollback
- `@2026-04-01` → TemporalVersion/asOf
- `@sha256:abc` → DAGHistory/get

Each returns opaque data. The sync delivers it back to the Reference resolution chain.

---

## 7. Parser Changes (Framework Level)

The Reference parser (not a concept — a framework-level text parser) needs to recognize the URI format:
```
[namespace://]entity-id[@qualifier]
```

Currently `[[article-1]]` creates a Reference with target: "article-1". Extended:
- `[[draft-v2://article-1]]` → target: "article-1", metadata: { namespace: "draft-v2" }
- `[[article-1@v3]]` → target: "article-1", metadata: { qualifier: "v3" }
- `[[draft-v2://article-1@v3]]` → target: "article-1", metadata: { namespace: "draft-v2", qualifier: "v3" }

The parser ONLY extracts and stores. It doesn't resolve. Resolution is sync-driven.

### 6.4 UI changes

**Entity detail page:** When viewing a qualified reference, show:
- Banner: "Viewing revision v3 from March 15, 2026" (read-only mode)
- Timeline slider or version list in sidebar
- "View current" button to jump to latest

**Reference picker:** Namespace scope selector + optional qualifier input:
```
┌──────────────────────────────────────┐
│  Link to...                          │
│  Scope:  ▾ Current (base)           │
│          ○ draft-v2                  │
│          ○ staging                   │
│  ─────────────────────────────────  │
│  🔍 Search entities...              │
│  ─────────────────────────────────  │
│  ☐ Pin to specific revision         │
│    Version: ▾ Latest                │
│             ○ v3 (Mar 15)           │
│             ○ v2 (Mar 10)           │
│             ○ v1 (Mar 1)            │
│             ○ As of date...         │
└──────────────────────────────────────┘
```

---

## 7. Dependent Concept Sync Updates

These concepts don't change — they stay independent. But the syncs that wire them need namespace/qualifier awareness.

### 7.1 Backlink reindex with namespace metadata

Current: `SaveReindexesBacklinks` fires Backlink/reindex on every save.

Update: The reindex sync passes namespace metadata from the Reference through to the Backlink record. Backlinks panel can then show "Referenced by Article-1 (on draft-v2)" vs "Referenced by Article-1 (base)."

```
sync BacklinkReindexWithNamespace [eventual]
when Reference/addRef ok
  where metadata contains namespace
then Backlink/reindex: [ source_id: ?source, metadata: ?metadata ]
```

Backlink concept doesn't change — `metadata` is already an opaque string it stores.

### 7.2 SyncedContent resolution with qualifiers

Current: SyncedContent/resolve fetches content by ref.

Update: Resolution sync checks for namespace/qualifier in the transclusion ref and routes through the resolution chain.

```
sync SyncedContentResolvesQualified [eager]
when SyncedContent/resolve
  where sourceRef contains "@" or "://"
then
  // Parse namespace + qualifier from sourceRef
  // Route: Namespace/resolve → VersionSpace/resolve → Version/rollback (if qualified)
  // Return resolved content to SyncedContent
```

SyncedContent concept doesn't change — it requests content by opaque ref.

### 7.3 SearchIndex scoped by namespace

Current: SearchIndex/index indexes entity content globally.

Update: Index entries carry namespace metadata. Search queries can filter by namespace.

```
sync SearchIndexWithNamespace [eventual]
when ContentStorage/save ok
  where VersionContext active
then SearchIndex/index: [ entity: ?id, namespace: ?activeNamespace ]
```

SearchIndex concept doesn't change — namespace is just another indexed field.

### 7.4 Alias resolution scoped by namespace

Current: Alias/resolve returns entity ID globally.

Update: Resolution sync checks active namespace and scopes alias lookup.

```
sync AliasResolvesInNamespace [eager]
when Alias/resolve
  where VersionContext active
then
  // Look up alias within namespace first, fall back to global
  Alias/resolve: [ alias: ?alias, scope: ?activeNamespace ]
```

Alias concept doesn't change — `scope` is just a filter parameter on the existing resolve action.

### 7.5 Snippet anchoring with namespace

Current: Snippet stores source ref + text selection.

Update: Source ref carries namespace/qualifier metadata. When resolving the snippet's anchor, the sync routes through the namespace chain.

```
sync SnippetResolvesQualified [eager]
when Snippet/resolve
  where sourceRef contains namespace or qualifier metadata
then
  // Resolve source entity through namespace/qualifier chain
  // Verify text anchor still exists at the resolved version
  // Return snippet with resolution status
```

Snippet concept doesn't change — source ref is opaque.

---

## 8. Views Get Namespace for Free

Views don't need a NamespaceSpec. The active VersionContext scopes all storage reads automatically via the `version-aware-load` sync.

### Default behavior (90% of views)

The user has `enter`ed a VersionSpace → VersionContext stack is active → all `find` and `get` calls resolve through the active namespace. Views don't do anything special.

### Explicit namespace scoping (cross-branch views)

DataSourceSpec already supports template variables (`{{schemaId}}`, `{{entityId}}`). Add `{{namespace}}` and `{{qualifier}}`:

```json
{
  "concept": "ContentNode",
  "action": "listBySchema",
  "params": {
    "schema": "Article",
    "namespace": "{{namespace}}",
    "qualifier": "{{qualifier}}"
  }
}
```

- `{{namespace}}` defaults to the active VersionContext (free behavior)
- Override: `"namespace": "draft-v2"` pins to a specific branch
- `{{qualifier}}` defaults to `@latest`
- Override: `"qualifier": "@2026-04-01"` shows historical data

**Compare branches:** Two views side-by-side, one with `"namespace": "main"`, other with `"namespace": "draft-v2"`. Same view definition, different namespace params.

**Historical view:** URL parameter `/admin/content?asOf=2026-04-01` sets `{{qualifier}}` for the entire page.

No new ViewShell feature. No NamespaceSpec concept. Just template variables on DataSourceSpec that the version-aware storage layer honors.

---

## 9. Kanban Cards

| Card | PRD Sections | Blocked By | Blocks | Priority | Commit |
|---|---|---|---|---|---|
| **MAG-570** VersionSpace as Namespace Provider + Lifecycle Syncs | §2 | — | MAG-572, MAG-574 | high | |
| **MAG-571** Reference/SyncedContent Qualifier Parsing (Framework) | §3, §7 | — | MAG-572, MAG-574 | high | |
| **MAG-572** Revision Resolution Syncs (Version, Temporal, DAGHistory) | §1, §3, §6 | MAG-570, MAG-571 | MAG-574 | high | |
| **MAG-573** Dependent Concept Sync Updates (Backlink, Search, Alias, Snippet) | §7.1–7.5 | MAG-570 | MAG-574 | medium | |
| **MAG-574** DataSourceSpec {{namespace}}/{{qualifier}} + View Integration | §8 | MAG-570–573 | MAG-575 | medium | |
| **MAG-575** UI: Historical Mode Banner + Reference Picker Qualifier + Timeline | §7 (UI) | MAG-570–574 | — | medium | |

---

## 10. Open Questions

1. **Revision garbage collection** — If every save creates a Version snapshot and every snapshot is referenceable, storage grows unboundedly. RetentionPolicy concept exists — should it govern revision cleanup? What happens to references that point at cleaned-up revisions?

2. **Branch + revision denormalization** — If `author.name` is denormalized per-branch AND revisions are addressable, do we denormalize per-branch-per-revision? That's O(branches × revisions × entities) storage. Probably not — revision-qualified reads should resolve at query time (join or lazy), not denormalize.

3. **Merge conflict on revision-pinned references** — If a view pins `contract.terms@v1` and the contract entity is deleted, what happens? The reference should resolve to the last known snapshot, not fail. RetentionPolicy should prevent deletion of entities with pinned references.
