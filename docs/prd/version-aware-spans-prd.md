# PRD: Version-Pinned Content References

## Status: Draft
## Date: 2026-04-03

---

## 1. Problem Statement

Any feature that embeds, quotes, or transcludes content from a versioned source faces the same problem: when the source changes, the reference becomes stale. Today this manifests in TextSpan (highlights go broken), but the same issue applies to BlockEmbed, SnippetEmbed, citations, excerpts, transclusions, and any future content-referencing concept.

Currently each concept handles (or ignores) version staleness independently:
- **TextSpan** re-resolves anchors on every edit. No version tracking. Broken spans lose their original text.
- **BlockEmbed** has no version awareness at all — it renders the current block content.
- **SnippetEmbed** renders a span's current text — if the span breaks, the snippet shows nothing.
- **Clip** (multimedia PRD) has ad-hoc `status: active|stale` with a dedicated staleness sync.
- **Region** (multimedia PRD) has the same ad-hoc `status: active|stale` pattern.
- **Transcript** (multimedia PRD) is a snapshot of audio — no version tracking for when audio is re-processed.

> **Cross-reference:** The multimedia content types PRD (`docs/prd/multimedia-content-types.md`)
> introduces Clip, Region, Transcript, and AnnotationLayer — all of which reference versioned
> source content. Clip and Region each implemented ad-hoc `status: active|stale` fields with
> dedicated staleness syncs (`source-update-stales-clips`, `source-update-stales-regions`).
> VersionPin supersedes these ad-hoc mechanisms — those syncs are marked as superseded in the
> multimedia PRD and replaced by generic VersionPin wiring.

This is the same independent behavior reimplemented (or not) in each concept. By Jackson's methodology, it's a concept waiting to be extracted.

---

## 2. The Independent Concept: VersionPin

**VersionPin** is the version-tracking primitive that any content-referencing concept composes with. It handles:

- Capturing the source version at reference time
- Detecting when the source has moved ahead (freshness)
- Policy for how to handle staleness (auto-update, pin, best-effort)
- Retrieving the original content from the pinned version
- Reanchoring to a new version
- Batch freshness checks when a source entity changes

### 2.1 Concept Spec

```
concept VersionPin [P] {

  purpose {
    Pin a reference to a specific version of source content, with
    policy-driven staleness management. Any concept that embeds,
    quotes, or transcludes versioned content composes with VersionPin
    through syncs — without reimplementing version logic.
  }

  state {
    pins: set P
    sourceEntity: P -> String       // Entity being referenced
    versionRef: P -> String         // ContentHash digest at pin time
    policy: P -> String             // "auto" | "pin" | "best-effort"
    freshness: P -> String          // "current" | "outdated" | "orphaned"
    ownerKind: P -> String          // "TextSpan" | "BlockEmbed" | "SnippetEmbed" | ...
    ownerRef: P -> String           // ID within the owning concept
    originalContent: P -> String    // Cached content snapshot at pin time (optional)
  }
}
```

### 2.2 Actions

#### `create(pin, sourceEntity, versionRef, policy, ownerKind, ownerRef)`
Register a version pin. Called by syncs when a referencing concept creates a record.
```
-> ok(pin: P)
-> duplicate(pin: P)          // Same ownerKind+ownerRef already pinned
-> error(message: String)
```

#### `checkFreshness(pin, currentVersion)`
Compare the pin's versionRef against the entity's current version.
```
-> current(pin: P)            // versionRef == currentVersion
-> outdated(pin: P, versionsBehind: Int)  // versionRef is behind
-> orphaned(pin: P)           // Content at versionRef can't resolve in current
-> notfound(message: String)
```

#### `batchCheck(sourceEntity, currentVersion)`
Check all pins for a source entity. Returns categorized results.
```
-> ok(current: String, outdated: String, orphaned: String)
  // JSON arrays of pin IDs in each category
```

#### `reanchor(pin, targetVersion)`
Update the pin's versionRef to a new version.
```
-> ok(pin: P)                 // Successfully reanchored
-> refused(pin: P)            // Policy is "pin" — manual override required
-> notfound(message: String)
```

#### `batchReanchor(sourceEntity, targetVersion)`
Reanchor all auto-update pins for a source entity. Pinned pins are skipped.
```
-> ok(updated: String, skipped: String, failed: String)
```

#### `forceReanchor(pin, targetVersion)`
Override pin policy and reanchor anyway. For explicit user action.
```
-> ok(pin: P)
-> notfound(message: String)
```

#### `getOriginal(pin)`
Retrieve the content snapshot from the pin's version.
```
-> ok(content: String, version: String)
-> notfound(message: String)
-> error(message: String)     // Version content not retrievable
```

#### `setPolicy(pin, policy)`
Change the update policy.
```
-> ok(pin: P)
-> notfound(message: String)
-> error(message: String)     // Invalid policy
```

#### `get(pin)` / `list(sourceEntity)` / `listByOwner(ownerKind, ownerRef)`
Standard readers.

### 2.3 Kind-Based Default Policies

When a sync creates a VersionPin, the `policy` is derived from the owning concept's semantics:

| Owner Concept | Default Policy | Rationale |
|--------------|---------------|-----------|
| TextSpan (highlight) | auto | Follow the text |
| TextSpan (citation) | pin | Quote specific historical text |
| TextSpan (comment-target) | best-effort | Show in current context if possible |
| TextSpan (excerpt) | pin | Snapshot |
| TextSpan (redaction) | auto | Must track what it's hiding |
| BlockEmbed | auto | Show current block content |
| SnippetEmbed | pin | Snapshot of span text at embed time |
| Annotation (multimedia) | best-effort | Commentary should follow the content, but show drift |
| Highlight (multimedia) | auto | Extractive mark should track the source |
| Transcript | pin | Transcript is a snapshot of audio at a point in time |
| Anchor (multimedia) | auto | Address should track the media location |

Note: The multimedia concepts (Anchor, Annotation, Highlight, Transcript, etc.)
from `docs/research/multi-media/` follow the same pattern. The Anchor concept
in the multimedia decomposition is the cross-media generalization of TextAnchor —
and VersionPin serves both text and multimedia anchoring equally.

---

## 3. Sync Wiring

### 3.1 Pin creation syncs (one per owning concept)

```
sync SpanCreatesPin [eager]
when { TextSpan/create: [...] => ok(span: ?span) }
where { ContentNode/get: [node: ?entityRef] => ok(content: ?content)
        ContentHash/store: [content: ?content] => ok(hash: ?version) }
then { VersionPin/create: [sourceEntity: ?entityRef; versionRef: ?version;
        policy: ?defaultPolicy; ownerKind: "TextSpan"; ownerRef: ?span] }

sync BlockEmbedCreatesPin [eager]
when { BlockEmbed/create: [...] => ok(embed: ?embed) }
where { ContentHash/store: [...] => ok(hash: ?version) }
then { VersionPin/create: [sourceEntity: ?source; versionRef: ?version;
        policy: "auto"; ownerKind: "BlockEmbed"; ownerRef: ?embed] }

sync SnippetEmbedCreatesPin [eager]
when { SnippetEmbed/create: [...] => ok(embed: ?embed) }
where { ContentHash/store: [...] => ok(hash: ?version) }
then { VersionPin/create: [sourceEntity: ?source; versionRef: ?version;
        policy: "pin"; ownerKind: "SnippetEmbed"; ownerRef: ?embed] }
```

### 3.2 Content change triggers batch check

```
sync ContentChangeChecksPins [lazy]
when { ContentNode/update: [node: ?node; content: ?content] => ok() }
where { ContentHash/store: [content: ?content] => ok(hash: ?newVersion) }
then { VersionPin/batchReanchor: [sourceEntity: ?node;
        targetVersion: ?newVersion] }
```

This replaces `content-edit-invalidates-spans` — VersionPin handles the freshness logic, and only auto-update pins are reanchored.

### 3.3 Freshness propagates back to owners

```
sync PinOutdatedNotifiesSpan [eager]
when { VersionPin/checkFreshness: [...] => outdated(pin: ?pin) }
where { VersionPin: { ?pin ownerKind: "TextSpan"; ownerRef: ?spanId } }
then { TextSpan/markStale: [span: ?spanId] }

sync PinOrphanedNotifiesSpan [eager]
when { VersionPin/checkFreshness: [...] => orphaned(pin: ?pin) }
where { VersionPin: { ?pin ownerKind: "TextSpan"; ownerRef: ?spanId } }
then { TextSpan/markBroken: [span: ?spanId] }

sync PinCurrentNotifiesSpan [eager]
when { VersionPin/reanchor: [...] => ok(pin: ?pin) }
where { VersionPin: { ?pin ownerKind: "TextSpan"; ownerRef: ?spanId } }
then { TextSpan/markActive: [span: ?spanId] }
```

Similar syncs wire to BlockEmbed and SnippetEmbed — each owning concept gets notified when its pin status changes.

### 3.4 Version diff enrichment

```
sync DiffChecksPins [eager]
when { Diff/diff: [...] => diffed(editScript: ?script) }
then { VersionPin/batchCheck: [sourceEntity: ?entityRef;
        currentVersion: ?afterVersion] }
```

---

## 4. TextSpan Changes (minimal)

With VersionPin extracted, TextSpan itself needs very little change:

### 4.1 No new state fields on TextSpan
Version tracking lives in VersionPin, not TextSpan. The `status` field (`active | stale | broken`) remains — it's set by syncs from VersionPin freshness events.

### 4.2 New convenience actions on TextSpan

#### `markStale(span)` / `markBroken(span)` / `markActive(span)`
Set the span's status field. Called by syncs from VersionPin notifications.

#### `getVersionInfo(span)`
Proxy: looks up the VersionPin for this span and returns its freshness, versionRef, and policy.
```
-> ok(versionRef: String, freshness: String, policy: String, versionsBehind: Int)
-> notfound
```

#### `getOriginalText(span)`
Proxy: calls VersionPin/getOriginal for this span's pin, then resolves the span against the historical content.
```
-> ok(text: String, version: String)
-> notfound | error
```

---

## 5. Widget Changes

### 5.1 SpanGutter — version indicators

| Freshness | Gutter Visual |
|-----------|--------------|
| current | Normal rendering (no change) |
| outdated | Dashed border + ↻ icon overlay |
| orphaned | ⚠ icon + faded/ghosted bar |

Click outdated → popover: "Created in an earlier version. [Update] [Keep pinned]"
Click orphaned → "This text was removed. [View original] [Delete span]"

### 5.2 SpanToolbar — version actions

Added to existing span toolbar (for existing spans, not new selections):

- **Version badge:** "2 versions behind" next to kind label
- **Update button:** "↻ Update to latest" — calls VersionPin/forceReanchor
- **Pin toggle:** Lock icon — calls VersionPin/setPolicy
- **View original:** Opens SpanDiffPopover with original vs current text

### 5.3 New: VersionPinBadge widget

Small inline badge at the start of any version-pinned highlight/embed.

```
Anatomy: root > icon + label
States: current (hidden), outdated (visible, info), orphaned (visible, warning)
```

- **current:** Hidden
- **outdated:** Small "↻" icon. Hover: "Created in version 3 · text shifted"
- **orphaned:** Small "⚠" icon. Hover: original text snippet

This widget is **generic** — works for TextSpan highlights, BlockEmbed borders, SnippetEmbed frames, clip-embed status, region-embed status, and any future content-referencing concept's embed display mode. The multimedia PRD's clip-embed and region-embed status indicators (`docs/prd/multimedia-content-types.md` §5.1, §5.2) are instances of this widget.

### 5.4 New: VersionPinPanel widget

Sidebar panel showing all version pins for the current entity.

```
Anatomy: root > header + pinList > pinItem > (ownerIcon + label + badge + actions)
States: empty, populated
```

- **Header:** "References · 3 outdated" + "Update all"
- **Grouped by:** freshness state (current, outdated, orphaned)
- **Each item:** Owner kind icon + label + version badge + actions
- Shows TextSpans, BlockEmbeds, SnippetEmbeds, Clips, Regions — all in one unified list
- Multimedia embed staleness (from `multimedia-content-types.md`) appears here alongside text staleness

### 5.5 New: VersionDiffPopover widget

Inline popover comparing original pinned content vs current.

```
Anatomy: root > header + diffView > (original + current) + actions
States: loading, resolved, error
```

- **header:** "Citation · version 3 → version 7"
- **diffView:** Inline diff of original vs current text
- **actions:** "Update to latest" / "Keep pinned" / "Delete"

### 5.6 BlockEditor highlight rendering — version states

| Freshness | Highlight Style |
|-----------|----------------|
| current | Solid background (no change) |
| outdated | Solid background + dashed underline + VersionPinBadge |
| orphaned | Ghost marker at last known position + collapsed `[†]` for citations |

### 5.7 BlockEmbed rendering — version states

| Freshness | Embed Style |
|-----------|-------------|
| current | Normal embed border (no change) |
| outdated | Amber dashed border + "Source updated" banner + [Update] button |
| orphaned | Red dashed border + "Source block removed" + original content from pin |

### 5.8 Clip-embed / Region-embed rendering — version states

> These are defined in the multimedia PRD (`multimedia-content-types.md` §5.1, §5.2)
> but their status rendering is provided by VersionPinBadge, not custom per-concept UI.

| Concept | Freshness | Rendering |
|---------|-----------|-----------|
| Clip (clip-embed) | current | Normal mini-player |
| Clip (clip-embed) | outdated | VersionPinBadge ↻ + "Source audio updated · [Update]" |
| Clip (clip-embed) | orphaned | VersionPinBadge ⚠ + original audio range from pin |
| Region (region-embed) | current | Normal cropped image |
| Region (region-embed) | outdated | VersionPinBadge ↻ + "Source image updated · [Update]" |
| Region (region-embed) | orphaned | VersionPinBadge ⚠ + original snapshot from pin |

---

## 6. Hook Changes

### 6.1 `useEntitySpans` — enrichment via VersionPin

Add to SpanFragment:
```typescript
interface SpanFragment {
  // ... existing fields
  freshness: 'current' | 'outdated' | 'orphaned';
  versionPolicy: 'auto' | 'pin' | 'best-effort';
  versionsBehind: number;
}
```

The hook calls `VersionPin/listByOwner("TextSpan", spanId)` for each span.

### 6.2 New: `useVersionPins(entityRef)` hook

Generic hook for any component that shows version-pinned references:
```typescript
function useVersionPins(entityRef: string) {
  return {
    pins: VersionPinInfo[];           // All pins for this entity
    outdatedCount: number;
    orphanedCount: number;
    reanchor: (pinId: string) => Promise<void>;
    reanchorAll: () => Promise<{ updated, skipped, failed }>;
    getOriginal: (pinId: string) => Promise<string>;
    setPolicy: (pinId: string, policy) => Promise<void>;
  };
}
```

---

## 7. Migration

### 7.1 Existing spans
- Create a VersionPin for each existing TextSpan with `versionRef: "unknown"` and `policy: "auto"`
- Unknown-version pins always return `freshness: "current"` (no version to compare against)
- Zero behavior change — existing auto-resolve-on-edit behavior is preserved

### 7.2 Existing embeds
- Create VersionPins for existing BlockEmbed/SnippetEmbed records similarly
- These start rendering version indicators only once the source entity gets a new version after migration

---

## 8. Concept Dependencies

| Concept | Role | Status |
|---------|------|--------|
| **VersionPin** | **NEW — the independent version-pinning concept** | **New** |
| **Origin** | Qualifies where a reference comes from (local/space/kernel/external). VersionPin gains optional `origin` field. See `cross-boundary-references-prd.md`. | **New (separate PRD)** |
| TextSpan | Composes with VersionPin via syncs. Gains markStale/markBroken/markActive. | Modified |
| BlockEmbed | Composes with VersionPin via syncs | Modified (minimal) |
| SnippetEmbed | Composes with VersionPin via syncs | Modified (minimal) |
| Anchor (multimedia) | Composes with VersionPin — cross-media addressing | Existing (multimedia suite) |
| Annotation (multimedia) | Composes with VersionPin — commentary on media | Existing (multimedia suite) |
| Highlight (multimedia) | Composes with VersionPin — extractive marks | Existing (multimedia suite) |
| Transcript | Composes with VersionPin — audio snapshot | Existing (multimedia suite) |
| MediaAsset | The media being versioned (multimedia equivalent of ContentNode) | Existing (multimedia suite) |
| ContentHash | Stores immutable content versions. VersionPin reads from it. | Existing |
| DAGHistory | Version graph — used to compute "versions behind" | Existing |
| Ref | Mutable pointer to latest version | Existing |
| Diff | Computes diffs for the diff popover | Existing |
| ContentNode | The entity being versioned | Existing |

---

## 9. Card Inventory

### New concept
- [ ] VersionPin concept spec (`specs/content/version-pin.concept`)
- [ ] VersionPin handler (`handlers/ts/content/version-pin.handler.ts`)

### TextSpan modifications
- [ ] Add `markStale`, `markBroken`, `markActive` actions to TextSpan
- [ ] Add `getVersionInfo` proxy action to TextSpan
- [ ] Add `getOriginalText` proxy action to TextSpan
- [ ] Update TextSpan handler for new actions

### Sync rules — content suite
- [ ] `span-creates-pin.sync` — TextSpan/create → VersionPin/create
- [ ] `block-embed-creates-pin.sync` — BlockEmbed/create → VersionPin/create
- [ ] `snippet-embed-creates-pin.sync` — SnippetEmbed/create → VersionPin/create
- [ ] `content-change-checks-pins.sync` — ContentNode/update → VersionPin/batchReanchor
- [ ] `pin-outdated-notifies-span.sync` — VersionPin/outdated → TextSpan/markStale
- [ ] `pin-orphaned-notifies-span.sync` — VersionPin/orphaned → TextSpan/markBroken
- [ ] `pin-current-notifies-span.sync` — VersionPin/reanchor ok → TextSpan/markActive
- [ ] `diff-checks-pins.sync` — Diff/diff → VersionPin/batchCheck
- [ ] Remove/replace `content-edit-invalidates-spans.sync`

### Sync rules — multimedia suite (supersedes `MAG-400` staleness syncs from multimedia PRD)
- [ ] `clip-creates-pin.sync` — Clip/create → VersionPin/create (policy: "pin")
- [ ] `region-creates-pin.sync` — Region/create → VersionPin/create (policy: "auto")
- [ ] `transcript-creates-pin.sync` — Transcript/create → VersionPin/create (policy: "pin")
- [ ] `media-change-checks-pins.sync` — MediaAsset change → VersionPin/batchReanchor
- [ ] `pin-outdated-notifies-clip.sync` — VersionPin/outdated (owner: Clip) → Clip staleness
- [ ] `pin-outdated-notifies-region.sync` — VersionPin/outdated (owner: Region) → Region staleness
- [ ] `annotation-creates-pin.sync` — Annotation/annotate → VersionPin/create (research concepts)
- [ ] `highlight-creates-pin.sync` — Highlight/highlight → VersionPin/create (research concepts)

### Widget specs + implementations
- [ ] VersionPinBadge widget spec + React implementation
- [ ] VersionPinPanel widget spec + React implementation
- [ ] VersionDiffPopover widget spec + React implementation
- [ ] SpanGutter: add version state indicators
- [ ] SpanToolbar: add version badge, update, pin toggle, view original
- [ ] BlockEditor: version-state-dependent highlight rendering
- [ ] BlockEmbed: version-state-dependent embed rendering

### Hooks
- [ ] `useEntitySpans`: enrich SpanFragment with version fields
- [ ] New: `useVersionPins` hook

### Migration
- [ ] Backfill VersionPins for existing TextSpan records
- [ ] Backfill VersionPins for existing BlockEmbed/SnippetEmbed records
- [ ] Backward compatibility for `versionRef: "unknown"`
