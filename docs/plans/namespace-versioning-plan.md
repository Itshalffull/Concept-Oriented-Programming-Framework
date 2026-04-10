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

### 6.4 UI / UX — Full Specification

#### 6.4.1 Branch Indicator (global, always visible)

Shows the active VersionSpace in the app shell header. Always visible so users know which branch they're on.

```
┌──────────────────────────────────────────────────────────────┐
│  ◫ Clef Base          🌿 draft-v2 ▾           👤 Alice      │
│                       ├─ main                                │
│                       ├─ draft-v2  ← active                  │
│                       │  └─ alice-experiment                 │
│                       ├─ staging                             │
│                       └─ [+ New branch]                      │
└──────────────────────────────────────────────────────────────┘
```

- Dropdown shows full Namespace tree of VersionSpaces
- Switching branches = VersionSpace/enter + page refresh
- Sub-spaces shown nested
- "New branch" = VersionSpace/fork
- Badge color: green=active, gray=archived, blue=proposed

#### 6.4.2 Historical Mode Banner

When viewing an entity with a `@qualifier` (any revision/temporal reference), show a read-only banner:

```
┌──────────────────────────────────────────────────────────────┐
│  ⏱ Viewing revision v3 from March 15, 2026                  │
│  by Alice · 3 changes from v2          [View current] [Diff] │
└──────────────────────────────────────────────────────────────┘
│                                                              │
│  Title: My Article                                           │
│  Body: (read-only, historical content)                       │
│                                                              │
```

- All fields read-only (gray background, no edit affordances)
- "View current" button jumps to `@latest`
- "Diff" button shows diff between this revision and current
- Author + change count from Version metadata
- If revision was compacted: "Showing nearest available (March 12) — original March 10 was compacted"

#### 6.4.3 Version Timeline (entity sidebar)

On every entity detail page, a sidebar widget shows revision history:

```
┌─ History ──────────────────────┐
│  ● v7  Today, 2:30pm   Alice  │ ← current
│  ○ v6  Today, 11:00am  Bob    │
│  ○ v5  Yesterday        Alice  │
│  ○ v4  Apr 7            Alice  │
│  ○ v3  Apr 5            Bob    │ ← pinned by [[contract@v3]]
│  ○ v2  Mar 30           Alice  │
│  ○ v1  Mar 15           Alice  │ ← creation
│                                │
│  [Show all]  [Compare two ▾]  │
└────────────────────────────────┘
```

- Click any revision → opens entity in historical mode with banner
- Pin icon on revisions that are referenced (`[[...@v3]]`)
- "Compare two" → select two revisions → diff view
- Compacted revisions shown as dimmed: "○ ~Mar 20 (compacted)"
- Filter by author, date range

#### 6.4.4 Diff View

Compare any two addressable states — two revisions, two branches, or revision vs current:

```
┌─────────────────────────────────────────────────────────────┐
│  Diff: Article "My Article"                                  │
│  Left:  v3 (Mar 5, Bob)        Right: current (v7, Alice)   │
│  ──────────────────────────────────────────────────────────│
│  Title                                                       │
│  - My Draft Article                                          │
│  + My Article                                                │
│                                                              │
│  Body                                                        │
│  ... (unchanged lines collapsed) ...                         │
│  - This paragraph was removed.                               │
│  + This new paragraph was added by Alice.                    │
│                                                              │
│  Author                                                      │
│  (unchanged: Alice)                                          │
│                                                              │
│  [← Previous change]  [Next change →]  [Restore left]       │
└─────────────────────────────────────────────────────────────┘
```

- Side-by-side or inline diff mode toggle
- Field-level diffing (not character-level for non-text fields)
- Rich text body: block-level diff with added/removed/changed highlighting
- "Restore left" button: rollback to the left-side revision
- Cross-branch diff: `draft-v2://article-1` vs `staging://article-1`

#### 6.4.5 Reference Picker with Namespace + Qualifier

Updated reference picker for `[[` mentions and relation field pickers:

```
┌──────────────────────────────────────┐
│  Link to...                          │
│  ─────────────────────────────────  │
│  Branch: ▾ Current (draft-v2)       │
│          ○ main                      │
│          ○ draft-v2  ← active        │
│          ○ staging                   │
│  ─────────────────────────────────  │
│  🔍 Search entities...              │
│  ─────────────────────────────────  │
│  📄 My Article                       │
│  📄 Design Doc                       │
│  📄 API Reference                    │
│  ─────────────────────────────────  │
│  ☐ Pin to specific revision         │
│    ○ Latest (default)               │
│    ○ v3 — Mar 15 by Bob             │
│    ○ v2 — Mar 10 by Alice           │
│    ○ As of date: [________]         │
│  ─────────────────────────────────  │
│  Result: [[draft-v2://article-1@v3]] │
│                    [Insert link]     │
└──────────────────────────────────────┘
```

- Branch selector defaults to active VersionContext
- Entity search scoped to selected branch
- Revision pin is optional — collapsed by default
- Preview of the final URI at the bottom
- Same picker used for: `[[` mentions, relation field values, SyncedContent transclusion

#### 6.4.6 Branch Diff Dashboard

A dedicated view for comparing branches before merge/propose:

```
┌──────────────────────────────────────────────────────────────┐
│  Compare: draft-v2 → main                    [Propose merge] │
│  ──────────────────────────────────────────────────────────│
│  3 created · 7 modified · 1 deleted                          │
│                                                              │
│  Created:                                                    │
│    + 📄 New Landing Page                          [view]     │
│    + 📄 FAQ Section                               [view]     │
│    + 🖼 Hero Image                                [view]     │
│                                                              │
│  Modified:                                                   │
│    ~ 📄 About Page (3 field changes)              [diff]     │
│    ~ 📄 Pricing (1 field change)                  [diff]     │
│    ~ 📄 Homepage (body rewritten)                 [diff]     │
│    ...                                                       │
│                                                              │
│  Deleted:                                                    │
│    - 📄 Old Landing Page                          [restore]  │
│                                                              │
│  [Cherry-pick selected]  [Merge all]  [Discard branch]       │
└──────────────────────────────────────────────────────────────┘
```

- Shows VersionSpace/diff output as a structured changeset
- Click "diff" on modified → opens diff view
- Click "view" on created → opens entity in branch context
- Cherry-pick: select individual changes to merge
- Propose merge: VersionSpace/propose → review workflow
- Drives existing VersionSpace/merge, cherry_pick, diff actions

#### 6.4.7 Widgets Needed

| Widget | Purpose | Used In |
|---|---|---|
| `branch-indicator.widget` | Global branch dropdown in app shell header | AppShell |
| `historical-mode-banner.widget` | Read-only revision banner with actions | Entity detail (when @qualifier) |
| `version-timeline.widget` | Revision history sidebar with pin indicators | Entity detail sidebar |
| `diff-view.widget` | Side-by-side/inline diff for any two states | Diff page, merge review |
| `branch-diff-dashboard.widget` | Branch comparison changeset view | Branch compare page |
| Updated: `reference-picker` | Branch selector + revision pin qualifier | `[[` mentions, relation fields |

#### 6.4.8 Views + Destinations Needed

| View | Path | Purpose |
|---|---|---|
| `branch-compare` | `/admin/branches/:a/compare/:b` | Branch diff dashboard |
| `entity-history` | Entity detail sidebar embed | Version timeline |
| Updated: `version-spaces-list` | `/admin/branches` | Add branch tree (Namespace hierarchy), status badges, merge/archive actions |

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
| **MAG-578** Namespace Concept Update: resolve + register + root | §10 | — | MAG-570 | high | |
| **MAG-570** VersionSpace as Namespace Provider + Lifecycle Syncs | §2 | MAG-578 | MAG-572, MAG-574 | high | `2c90bdc2` |
| **MAG-571** Reference/SyncedContent Qualifier Parsing (Framework) | §3, §7 | — | MAG-572, MAG-574 | high | |
| **MAG-572** Revision Resolution Syncs (Version, Temporal, DAGHistory) | §1, §3, §6 | MAG-570, MAG-571 | MAG-574 | high | |
| **MAG-573** Dependent Concept Sync Updates (Backlink, Search, Alias, Snippet) + Retention Pin Sync | §7.1–7.5, §10 | MAG-570 | MAG-574 | medium | |
| **MAG-574** DataSourceSpec {{namespace}}/{{qualifier}} + View Integration | §8 | MAG-570–573 | MAG-575 | medium | |
| **MAG-575** Widgets: branch-indicator, historical-mode-banner, version-timeline | §6.4.1–6.4.3, §6.4.7 | — | MAG-576 | medium | |
| **MAG-576** Widgets: diff-view, branch-diff-dashboard + Updated reference-picker | §6.4.4–6.4.6, §6.4.7 | MAG-575 | MAG-577 | medium | |
| **MAG-577** Views + Destinations + Seeds + Integration Tests | §6.4.8 | MAG-570–576 | — | medium | |

---

## 10. Namespace Concept Updates Required

The Namespace concept needs 3 changes to support resolution scoping (not just navigation). These are prerequisites for all the resolution syncs (MAG-572) to work.

### 10.1 Add `resolve` action

Currently missing. All resolution syncs call `Namespace/resolve(path)` but the action doesn't exist.

```
action resolve(path: String)
  -> ok(node: N, provider: String)   // provider: "VersionSpace", "Schema", etc.
  -> notfound(message: String)
```

Returns the node at the given path plus who registered it. The routing syncs dispatch based on provider.

### 10.2 Generalize `createNamespacedPage` → `register`

Current name is page-specific. Should be general-purpose scope registration.

```
action register(node: N, path: String, provider: String)
  -> ok()
  -> exists(message: String)
```

`provider` identifies what kind of scope this is — "VersionSpace", "Schema", "Kernel", etc. Kept as opaque metadata on the node, returned by `resolve`.

Keep `createNamespacedPage` as an alias for backward compatibility (calls register with provider: "page").

### 10.3 Root namespace from kernel instance UID

Boot-time sync creates the root:

```
sync KernelRegistersRootNamespace [eager]
when KernelBoot/boot completes ok(kernel: ?kernelId)
then Namespace/register(node: ?kernelId, path: "/", provider: "kernel")
```

The `kernelId` is the globally unique instance identifier from Connection. For local use, the root is implicit (references omit it). For cross-instance references:
- Local: `draft-v2://article-1` (root implied)
- Cross-instance: `clef://instance-abc/draft-v2://article-1` (full URI)

### 10.4 What does NOT need to change for VersionSpace branching

These are multi-tenant concerns, NOT VersionSpace branching concerns:

- EventBus namespace scoping → events are instance-global, branches share events
- PluginRegistry namespace → plugins are framework-wide
- API path segments → branches are scoped by VersionContext header, not URL path
- Cache namespace keys → branch-aware caching already works via version-aware-load (different branch = different storage reads = different cache entries via tag-based invalidation)
- ContentStorage namespace parameter → version-aware-load sync already scopes reads/writes via VersionContext interception. No concept change needed.

Multi-tenancy is a valid future use of Namespace but should be a separate PRD.

---

## 11. Open Questions

1. **Revision garbage collection (RESOLVED — RetentionPolicy + reference pins):**
   - ContentHash deduplication (already exists) eliminates noise from auto-saves and metadata-only updates
   - RetentionPolicy governs tiered compaction: last 30 days = every revision, 30–90 days = daily snapshots, 90+ days = weekly. Configurable per schema.
   - References pin revisions: `[[contract@v3]]` acts as a hold — RetentionPolicy/dispose checks for Reference/SyncedContent pins before cleanup
   - Broken references (compacted revision) resolve to nearest available: "Showing March 12 revision (March 10 original was compacted)" — graceful degradation, not error
   - New sync: `retention-checks-revision-references` — before dispose, scan for pins. No concept changes.

2. **Branch + revision denormalization (RESOLVED — HEAD only, copy-on-write):**
   - Denormalize the HEAD of each branch. Historical revisions (any `@qualifier`) resolve at read time (join or lazy) — never denormalized.
   - Follows VersionSpace copy-on-write semantics: only denormalize in a branch if the branch has an override that affects the value. Two triggers:
     - Source entity overrides the relation field (Article on draft-v2 sets a different author)
     - Target entity is overridden (Person on draft-v2 changes name)
   - If neither source nor target is overridden on the branch, the base denormalized value is inherited — no copy stored.
   - compile-query rule: if qualifier present → skip denormalized data, use join/lazy. If no qualifier → use denormalized data.
   - Storage cost: O(overrides), not O(branches × entities). A branch with 3 overrides out of 10,000 entities stores 3 extra denormalized records.

3. **Merge conflict on revision-pinned references (RESOLVED — same as Q1):** References pin revisions. If the current entity is deleted but `contract@v1` is referenced, the v1 snapshot survives (RetentionPolicy hold). The reference resolves to the frozen snapshot with a banner: "This entity was deleted. Showing pinned revision v1."

---

## 12. Next Step: Multi-Tenancy via Namespace

Multi-tenancy uses the same Namespace infrastructure as VersionSpace branching. A tenant IS a namespace — registered with `Namespace/register(node: "acme", path: "/acme", provider: "tenant")`. Tenants nest with branches: `/acme/draft-v2/article-1`.

This section specifies exactly what needs to change for each component. The Namespace concept and resolution syncs from §10 and MAG-570–577 are prerequisites — multi-tenancy builds on them.

### 12.1 Tenant Namespace Provider

New sync: when a tenant is created, register as Namespace node:

```
sync TenantRegistersNamespace [eager]
when Tenant/create completes ok(tenant: ?tenantId)
then Namespace/register(node: ?tenantId, path: "/?tenantId", provider: "tenant")
```

Requires: a Tenant concept (or use an existing concept like Organization/Workspace). The provider string `"tenant"` lets the resolution chain scope data differently from VersionSpace providers.

### 12.2 ContentStorage: Add `namespace` parameter to all actions

Currently `version-aware-load` scopes reads via VersionContext interception. For multi-tenancy, the scoping needs to be explicit — VersionContext is per-user session, but tenant scoping is per-request and must be enforced.

**Concept changes to ContentStorage:**

```
action save(record: R, data: String, namespace: option String)
action load(record: R, namespace: option String)  
action list(prefix: String, namespace: option String)
action query(filter: String, namespace: option String)
```

When `namespace` is provided, the storage adapter prefixes all keys: `tenant:acme:node:article-1`. When absent, falls back to VersionContext (existing behavior). The parameter takes priority over VersionContext — explicit scoping overrides implicit.

**Handler change:** The storage adapter's `get`, `find`, `put`, `del` calls prepend the namespace prefix to the relation name. For the in-memory adapter, this means the relation `node` becomes `acme:node` within the `acme` namespace.

**Sync change:** A new `tenant-scoping-on-save.sync` stamps the active tenant namespace from the request context onto every save. Similar to `version-aware-save` but for tenants.

### 12.3 SearchIndex: Add `namespace` parameter

```
action indexItem(index: I, item: String, data: String, namespace: option String)
action search(index: I, query: String, namespace: option String)
```

When `namespace` is provided, index entries carry the namespace and search filters by it. Implemented as a field on the index entry, indexed via `ensureIndex('search-entries', 'namespace')`.

**Sync:** `search-index-with-tenant.sync` — on ContentStorage/save, read active tenant from request context, pass to SearchIndex/index.

### 12.4 Reference / Backlink: Add `namespace` metadata

Reference/addRef already has an `origin: option String` metadata field. Namespace goes here — no concept change needed. The sync `backlink-reindex-with-namespace.sync` (MAG-573) already passes namespace metadata through. For multi-tenancy, the tenant ID is included in the metadata alongside any VersionSpace qualifier.

No concept change. Just ensure the resolution syncs (MAG-572) check tenant namespace in addition to VersionSpace namespace when routing.

### 12.5 Alias: Add `scope` parameter to `resolve`

```
action resolve(name: String, scope: option String)
  -> ok(entity: A)
  -> notfound(message: String)
```

When `scope` is provided, look up alias within that namespace first, fall back to global. The `alias-resolves-in-namespace.sync` (MAG-573) already does this — it just needs the Alias concept to accept the `scope` parameter.

**Concept change:** Add `scope: option String` to `resolve` action signature.

### 12.6 SyncedContent: namespace-qualify source

```
action createReference(ref: S, original: S, sourceNamespace: option String)
```

When `sourceNamespace` is set, the transclusion resolves the original within that namespace. The `synced-content-resolves-qualified.sync` (MAG-573) already routes qualified sources. For multi-tenancy, cross-tenant transclusion would carry the tenant namespace.

**Concept change:** Add `sourceNamespace: option String` to `createReference`.

### 12.7 EventBus: namespace-scoped dispatch

```
action dispatch(event: E, data: String, namespace: option String)
action subscribe(event: String, handler: String, priority: Int, namespace: option String)
```

When `namespace` is provided on dispatch, only subscribers with matching namespace (or no namespace filter) receive the event. This prevents tenant A's event handlers from seeing tenant B's events.

**Concept change:** Add `namespace: option String` to `dispatch` and `subscribe`.

### 12.8 Cache: namespace-prefixed keys

No concept change. The `save-invalidates-cache.sync` already uses tag-based invalidation with schema names as tags. For multi-tenancy, add the tenant namespace as an additional tag:

```
Cache/set(bin, key: "tenant:acme:" + key, data, tags: schema + ",tenant:acme", maxAge)
```

**Sync change:** `cache-namespace-prefix.sync` — wraps cache keys with active tenant namespace prefix. Tag-based invalidation automatically scopes by tenant tag.

### 12.9 API Layer (Bind): namespace in requests

Three options for passing namespace in API requests:

1. **Header:** `X-Namespace: tenant:acme` — cleanest, doesn't pollute URLs
2. **Path segment:** `/api/tenants/acme/content/...` — explicit, bookmarkable
3. **Query param:** `?namespace=tenant:acme` — simplest to implement

Recommendation: **Header for default tenant scope** (set by auth middleware from credentials), **path segment for explicit cross-tenant access** (admin APIs). The interface manifest declares which strategy each target uses.

**Manifest change:** Add `namespaceStrategy: header | path | query` to each target config. The Bind generator reads this and generates the appropriate parameter handling.

### 12.10 Pilot / PageMap: namespace in agent context

```
action navigate(destination: String, params: option String, namespace: option String)
```

When an agent operates within a tenant namespace, all Pilot actions are scoped. The Connection concept already carries the active namespace context — Pilot reads it from there.

**Concept change:** Add `namespace: option String` to Pilot surface actions. Default: read from Connection's active namespace.

### 12.11 Implementation order

| Phase | What | Concept changes | Syncs |
|---|---|---|---|
| **Already done** | Namespace resolve/register + VersionSpace provider | Namespace (§10) | MAG-570 |
| **Phase 1** | ContentStorage scoping + tenant provider | ContentStorage | tenant-scoping-on-save |
| **Phase 2** | Search + Reference + Alias scoping | SearchIndex, Alias | search-index-with-tenant |
| **Phase 3** | SyncedContent + EventBus + Cache | SyncedContent, EventBus | cache-namespace-prefix |
| **Phase 4** | API layer + Pilot | Bind config, Pilot | — |

Each phase is independently deployable. Phase 1 is the critical path — without ContentStorage scoping, nothing else matters.

### 12.12 What does NOT change

- **PluginRegistry** — plugins are framework-wide, not tenant-scoped
- **TypeSystem / Validator** — types and validation rules are global
- **FormBuilder / FieldPlacement / ComponentMapping** — UI configuration is typically global (tenants share the same editor experience). Per-tenant UI customization would be a separate feature.
- **Outline / Diff / Patch / Merge** — content operations are namespace-transparent; scoping happens at the storage layer
