# PRD: Cross-Boundary Entity References — Origin Concept

## Status: Draft
## Date: 2026-04-03
## Epic: `0c149129` — Epic: Cross-Boundary Entity References (Origin)

---

## Card Index

| PRD Section | Card ID | Title |
|------------|---------|-------|
| 2.1 Concept | `df603e84` | Concept: Origin spec |
| 2 Handler | `64a2a3b0` | Handler: Origin |
| 3.1 Reference | `146e7123` | Reference: add optional origin to addRef |
| 3.2 VersionPin | `254c2009` | VersionPin: add optional origin field |
| 3.5 space-origin-resolves | `c459b89e` | Sync: space-origin-resolves |
| 3.4 kernel-origin-resolves | `82fe4680` | Sync: kernel-origin-resolves |
| 3.6 external-origin-resolves | `7799707f` | Sync: external-origin-resolves |
| 8 enter-space-registers | `0450c409` | Sync: enter-space-registers-origin |
| 8 connect-kernel-registers | `2b973785` | Sync: connect-kernel-registers-origin |
| 8 import-registers | `5f38e26a` | Sync: import-registers-origin |
| 8 block-embed-via-origin | `c73cfb13` | Sync: block-embed-resolves-via-origin |
| 8 snippet/clip/region-via-origin | `b7b0a6d4` | Sync: snippet/clip/region-embed-via-origin |
| 4 OriginBadge | `e58eb5a9` | Widget: OriginBadge |
| 5 SpaceIndicatorBar | `a66f0edf` | Widget: SpaceIndicatorBar |
| 4.2 embed renderers | `99eacf98` | Update embed renderers for OriginBadge |
| 8 useOrigin | `9bb1ab2b` | Hook: useOrigin |
| 8 useActiveSpace | `e50d3d63` | Hook: useActiveSpace |
| 8 migration | `570578ac` | Migration: existing refs get origin null |
| clef-base kernel | `a9938e38` | clef-base: register Origin + VersionPin |
| clef-base AppShell | `5c5cf2ea` | clef-base: SpaceIndicatorBar in AppShell |

---

## 1. Problem Statement

Clef entities can live in four different "places," but the reference and embedding system assumes everything is local:

| Boundary | What lives there | How to resolve | Current support |
|----------|-----------------|----------------|-----------------|
| **Local base** | Entities in the current kernel, base reality | Direct storage read | Full support |
| **Version space** | Copy-on-write overlays of entities | `VersionSpace/resolve` | Concept exists, but References/Embeds don't use it |
| **Remote kernel** | Entities in another Clef instance | `Connection/invoke` | Connection exists, but References/Embeds don't use it |
| **External system** | Entities in GitHub, Jira, Notion, etc. | `ExternalHandlerGen` / API import | Handler gen exists, but no reference provenance |

Today:
- `Reference/addRef("page-1", "doc-1")` — no way to say doc-1 is in the "redesign" version space
- `BlockEmbed` of entity X — no way to say X lives in a remote kernel
- `SnippetEmbed` of a span — no way to say the span's entity is from an external system
- `VersionPin` tracks content version but not *which reality* the version is from
- No UI shows "this reference comes from somewhere else"

Every concept that references entities (Reference, VersionPin, BlockEmbed, SnippetEmbed, Clip, Region, TextSpan) would need to independently handle cross-boundary resolution. That's the same independent behavior duplicated across concepts — a concept waiting to be extracted.

---

## 2. The Independent Concept: Origin

**Origin** qualifies where an entity reference comes from and how to resolve it. It composes with any concept that references entities — Reference, VersionPin, all embed types — via syncs.

### 2.1 Concept Spec

```
concept Origin [O] {

  purpose {
    Qualify where an entity reference comes from — local base, a version
    space overlay, a remote kernel, or an external system. Any concept
    that references entities composes with Origin through syncs to get
    cross-boundary resolution, freshness tracking, and provenance display
    without each concept reimplementing boundary-crossing logic.
  }

  state {
    origins: set O
    kind: O -> String              // "local" | "space" | "kernel" | "external"
    qualifier: O -> String         // spaceId | connectionId | system:externalId
    displayName: O -> String       // "redesign" | "team-shared" | "GitHub"
    icon: O -> option String       // emoji or icon key for UI
    status: O -> String            // "connected" | "stale" | "unreachable"
    resolverConfig: O -> String    // JSON config for the resolver (endpoint, auth, etc.)
  }
}
```

### 2.2 The four origin kinds

#### `local` — same kernel, base reality
- `qualifier`: empty or "base"
- `resolverConfig`: none needed — direct storage read
- This is the **default** — references without an explicit origin are local
- UI: no indicator (clean)

#### `space` — same kernel, different VersionSpace
- `qualifier`: VersionSpace ID (e.g., `"vs-redesign"`)
- `resolverConfig`: `{ "spaceId": "vs-redesign" }`
- Resolution: `VersionSpace/resolve(space: qualifier, entity_id)` or `VersionContext/resolve_for`
- UI: colored dot + space name (e.g., `● redesign`)
- When the space merges into base, the origin transitions to `local`

#### `kernel` — different Clef kernel instance
- `qualifier`: Connection ID or endpoint (e.g., `"team-shared"` or `"ws://team.clef.dev/kernel"`)
- `resolverConfig`: `{ "connectionId": "conn-123", "endpoint": "ws://..." }`
- Resolution: `Connection/invoke(connection, concept, action, params)`
- UI: network icon + kernel name (e.g., `🔗 team-shared`)
- Status tracks connection health: connected / stale / unreachable

#### `external` — outside Clef entirely
- `qualifier`: system + external ID (e.g., `"github:anthropics/claude-code#123"`)
- `resolverConfig`: `{ "system": "github", "ingestManifest": "github-api", "externalId": "..." }`
- Resolution: ExternalHandlerGen-produced handler via `perform('http', ...)` or API import
- UI: system icon + external ID (e.g., GitHub octocat + `#123`)
- Status: connected (API reachable) / stale (cached, API unreachable) / unreachable

### 2.3 Actions

#### `register(kind, qualifier, displayName, resolverConfig)`
Register a named origin. Called when a user connects to a remote kernel, enters a version space, or imports an external source.
```
-> ok(origin: O)
-> duplicate(origin: O)
-> error(message: String)
```

#### `resolve(origin, entityId)`
Resolve an entity through this origin's boundary. Dispatches to the appropriate mechanism based on kind.
```
-> ok(fields: String, origin: O)          // Entity resolved
-> unreachable(origin: O, message: String) // Boundary not reachable
-> notfound(entityId: String)              // Entity doesn't exist at origin
```

#### `checkStatus(origin)`
Check if the origin's boundary is reachable.
```
-> connected(origin: O)
-> stale(origin: O, lastSeen: String)     // Was connected, now can't reach
-> unreachable(origin: O, message: String)
```

#### `batchResolve(origin, entityIds: String)`
Resolve multiple entities through the same origin in one call (batching for remote/external).
```
-> ok(results: String)   // JSON map of entityId → fields
```

#### `get(origin)` / `list()` / `listByKind(kind)`
Standard readers.

---

## 3. How Origin Composes with Existing Concepts

### 3.1 Reference — gains optional origin

Current: `Reference/addRef(source, target)` — target is a local entity ID.

New: `Reference/addRef(source, target, origin?)` — origin qualifies where target lives.

When `origin` is null → local (backward compatible). When set → the reference crosses a boundary.

**Resolution changes:** `Reference/resolveTarget(target)` currently does a direct existence check. With origin, it dispatches through `Origin/resolve(origin, target)`.

### 3.2 VersionPin — gains optional origin

Current: `VersionPin.sourceEntity` is a local entity ID. `VersionPin.versionRef` is a ContentHash.

New: `VersionPin` gains `origin: option String` (Origin ID). When set, the pinned entity lives at that origin, and freshness checks resolve through `Origin/resolve`.

This means a VersionPin can track the version of an entity in a remote kernel or a different version space — not just the local entity.

### 3.3 Embeds — resolve through origin

BlockEmbed, SnippetEmbed, clip-embed, region-embed all currently fetch the referenced entity directly from local storage.

With Origin, the embed resolution path becomes:
1. Check if the embedded entity has an origin qualifier
2. If yes → `Origin/resolve(origin, entityId)` → get the entity data
3. If no → direct local fetch (current behavior)

This is a sync wiring change — the embed concepts themselves don't change, just the resolution syncs.

### 3.4 Connection — is the resolver for `kernel` origins

Connection already does everything needed — `connect`, `invoke`, `discover`. Origin's `resolve` action for `kind: "kernel"` delegates to `Connection/invoke`.

New sync:
```
sync KernelOriginResolves [eager]
when { Origin/resolve: [origin: ?o, entityId: ?eid] => ... }
where { Origin: { ?o kind: "kernel"; resolverConfig: ?config } }
then { Connection/invoke: [connection: ?connId; concept: "ContentNode"; 
       action: "get"; params: ?eid] }
```

### 3.5 VersionSpace — is the resolver for `space` origins

VersionSpace already has `resolve(space, entity_id)` that walks the ancestry chain.

New sync:
```
sync SpaceOriginResolves [eager]
when { Origin/resolve: [origin: ?o, entityId: ?eid] => ... }
where { Origin: { ?o kind: "space"; qualifier: ?spaceId } }
then { VersionSpace/resolve: [space: ?spaceId; entity_id: ?eid] }
```

### 3.6 ExternalHandlerGen — is the resolver for `external` origins

External handlers generated from ingest manifests already produce handlers that `perform('http', ...)`. Origin's `resolve` for `kind: "external"` dispatches to the appropriate generated handler.

---

## 4. UI — OriginBadge Widget

One generic widget that renders provenance for any cross-boundary reference.

```
widget OriginBadge {
  anatomy: root > icon + label
  states: hidden, visible
  
  // hidden when origin is local (no visual noise)
  // visible when origin is space, kernel, or external
}
```

### 4.1 Visual treatment by origin kind

| Kind | Icon | Label | Color | Example |
|------|------|-------|-------|---------|
| local | (hidden) | (hidden) | — | — |
| space | ● (colored dot) | space name | space color from VersionSpace | `● redesign` |
| kernel | 🔗 (link) | kernel display name | neutral | `🔗 team-shared` |
| external | system icon | system + ID | system brand color | `GitHub #123` |

### 4.2 Where OriginBadge appears

| Context | Placement | Description |
|---------|-----------|-------------|
| Entity page header | After title | "This entity is from `● redesign`" |
| Reference link | Inline after link text | `See [[doc-1]] 🔗 team-shared` |
| BlockEmbed border | Top-right corner | Small badge on embed frame |
| SnippetEmbed | After snippet text | Inline badge |
| clip-embed | After source attribution | `Clip from audio.mp3 · ● redesign` |
| region-embed | After source attribution | `Region from diagram.png · 🔗 team-shared` |
| SpanGutter | Next to span indicator | Small origin dot alongside version indicator |
| Search results | After result title | Shows which origin the result comes from |
| VersionPinPanel | Per pin item | Shows origin alongside version state |

### 4.3 OriginBadge + VersionPinBadge — composition

These are **separate widgets that compose** — an embed can be both:
- **From a different origin** (shows OriginBadge: `🔗 team-shared`)
- **At an outdated version** (shows VersionPinBadge: `↻ 2 versions behind`)

Both badges appear together when applicable. OriginBadge is about *where*, VersionPinBadge is about *when*.

### 4.4 Status indicators on OriginBadge

| Status | Visual | User action |
|--------|--------|-------------|
| connected | Normal badge | — |
| stale | Badge + ⚠ warning dot | "Last synced 2h ago · [Refresh]" |
| unreachable | Badge + ✕ error dot | "Cannot reach team-shared · [Retry] [Use cached]" |

---

## 5. Interaction: Entering/Leaving Spaces

When a user enters a VersionSpace (via `VersionSpace/enter` or the future workspace UI), ALL references and embeds in their view should resolve through that space's overlay. This is already handled by `VersionContext` — the user's active space stack determines resolution.

**What's new:** The UI should show a persistent indicator of which space(s) the user is in:

- **Space indicator bar** at the top of the app: "You're viewing: `● redesign`" with [Leave] button
- **Nested spaces** show as a breadcrumb: `base > redesign > experiment`
- **All embeds/references resolve through the active space** — no per-embed origin needed for "same-space" references

Cross-space references (referencing an entity in a DIFFERENT space than the one you're in) are where Origin shines — those get the OriginBadge.

---

## 6. Cross-Reference to Other PRDs

### VersionPin PRD (`version-aware-spans-prd.md`)
- VersionPin gains optional `origin` field
- VersionPin freshness checks dispatch through Origin/resolve when origin is set
- VersionPinBadge and OriginBadge compose side-by-side

### Multimedia PRD (`multimedia-content-types.md`)
- Clip/Region embed status indicators gain OriginBadge when source is cross-boundary
- TranscriptView shows origin when transcript source audio is from another space/kernel

### View Decomposition PRD (`view-decomposition-prd.md`)
- DataSourceSpec gains optional origin — a view can query data from a remote kernel
- FilterRepresentation can filter on origin (e.g., "show only entities from redesign space")

---

## 7. Concept Dependencies

| Concept | Role | Status |
|---------|------|--------|
| **Origin** | **NEW — cross-boundary entity reference qualifier** | **New** |
| Reference | Gains optional origin on addRef | Modified |
| VersionPin | Gains optional origin for cross-boundary version tracking | Modified |
| VersionSpace | Resolver for `space` origins | Existing |
| VersionContext | User's active space stack for implicit origin | Existing |
| Connection | Resolver for `kernel` origins | Existing |
| ExternalHandlerGen | Resolver for `external` origins | Existing |
| BlockEmbed / SnippetEmbed | Resolve through origin when set | Modified (sync wiring) |
| Clip / Region | Resolve through origin when set | Modified (sync wiring) |

---

## 8. Card Inventory

### New concept
- [ ] Origin concept spec (`repertoire/concepts/linking/origin.concept` or `specs/foundation/origin.concept`)
- [ ] Origin handler

### Concept modifications
- [ ] Reference: add optional `origin` parameter to `addRef`, update `resolveTarget` to dispatch through Origin
- [ ] VersionPin: add optional `origin` field, update freshness checks
- [ ] Update Reference handler
- [ ] Update VersionPin handler

### Sync rules — resolution dispatch
- [ ] `space-origin-resolves.sync` — Origin/resolve (kind: space) → VersionSpace/resolve
- [ ] `kernel-origin-resolves.sync` — Origin/resolve (kind: kernel) → Connection/invoke
- [ ] `external-origin-resolves.sync` — Origin/resolve (kind: external) → ExternalHandler dispatch
- [ ] `enter-space-registers-origin.sync` — VersionSpace/enter → Origin/register (kind: space)
- [ ] `connect-kernel-registers-origin.sync` — Connection/connect → Origin/register (kind: kernel)
- [ ] `import-registers-origin.sync` — ApiSpecImporter/import → Origin/register (kind: external)

### Sync rules — embed resolution through origin
- [ ] `block-embed-resolves-via-origin.sync` — BlockEmbed render + origin → Origin/resolve
- [ ] `snippet-embed-resolves-via-origin.sync` — SnippetEmbed render + origin → Origin/resolve
- [ ] `clip-embed-resolves-via-origin.sync` — Clip embed + origin → Origin/resolve
- [ ] `region-embed-resolves-via-origin.sync` — Region embed + origin → Origin/resolve

### Widget specs + implementations
- [ ] OriginBadge widget spec (`.widget` file)
- [ ] OriginBadge React implementation
- [ ] SpaceIndicatorBar widget spec (persistent top bar showing active space)
- [ ] SpaceIndicatorBar React implementation
- [ ] Update BlockEmbed rendering to show OriginBadge
- [ ] Update SnippetEmbed rendering to show OriginBadge
- [ ] Update clip-embed rendering to show OriginBadge
- [ ] Update region-embed rendering to show OriginBadge
- [ ] Update entity page header to show OriginBadge
- [ ] Update search results to show OriginBadge

### Hooks
- [ ] New: `useOrigin(entityId)` — returns origin info for an entity reference
- [ ] New: `useActiveSpace()` — returns current VersionContext space stack
- [ ] Update `useEntitySpans` — enrich with origin info

### Migration
- [ ] All existing references get `origin: null` (local) — zero behavior change
- [ ] All existing VersionPins get `origin: null` — zero behavior change
