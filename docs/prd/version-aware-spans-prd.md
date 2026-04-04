# PRD: Version-Aware Text Spans

## Status: Draft
## Date: 2026-04-03

---

## 1. Problem Statement

TextSpan currently anchors to a ContentNode (`entityRef`) with **no version reference**. When content changes, the `content-edit-invalidates-spans` sync re-resolves all anchors against the latest content, and the span status transitions `active → stale → broken` based on whether context text is still findable.

This creates three problems:

1. **Citations lose their referent.** A citation should quote specific text *as it was written*. If the source text changes, the citation should show the original alongside the current — not silently re-anchor to different text.

2. **No user agency over updates.** When content changes, all spans auto-re-resolve. The user can't say "keep this pinned to the version I annotated" vs "follow the text wherever it moves."

3. **Broken spans lose context.** When a span goes `broken`, the original text is gone — you can't see what it used to say, because there's no version to retrieve it from.

---

## 2. Design

### Core change: TextSpan gets a `versionRef`

Every TextSpan records the version of the content it was created against. This is a `ContentHash` digest or `DAGHistory` node ID — an immutable pointer to the exact content state.

```
New state field:
  versionRef: S -> String    // ContentHash digest at creation time
```

**Version freshness** is computed, not stored — it's the comparison between `span.versionRef` and the entity's current version (via `Ref/resolve` or `DAGHistory/tip`).

### Three version states (computed)

| State | Condition | Meaning |
|-------|-----------|---------|
| **current** | `span.versionRef == entity.currentVersion` | Span was created against the latest content. Renders normally. |
| **outdated** | `span.versionRef != entity.currentVersion` AND anchors resolve against current content | Content has changed but the span's text is still findable. Can update. |
| **orphaned** | `span.versionRef != entity.currentVersion` AND anchors DON'T resolve | The span's text no longer exists in the current version. Original text retrievable from `versionRef`. |

Note: this replaces the existing `status` field semantics. Currently `status` is `active | stale | broken`. The new model is:
- `active` + `versionRef == current` → **current**
- `active` + `versionRef != current` → not possible in new model (span is always tied to a version)
- `stale` → **outdated** (anchors resolved but shifted)
- `broken` → **orphaned** (anchors unresolvable in current version)

### Kind-based default behavior

Different span kinds have different versioning intent:

| Kind | Default behavior | Rationale |
|------|-----------------|-----------|
| `highlight` | Auto-update | You highlighted text because you care about *that text in the document*. If it moves, follow it. |
| `citation` | Pin to version | You're quoting specific text as it was. The citation is a reference to a historical state. |
| `comment-target` | Best-effort update | The comment is about specific text, but viewing it in current context is more useful. |
| `excerpt` | Pin to version | An excerpt is a snapshot. Show original + offer to update. |
| `redaction` | Auto-update | A redaction must track the text it's hiding. |

This is a **default** — the user can override per-span via a new `versionPolicy` field:

```
New state field:
  versionPolicy: S -> String   // "auto" | "pin" | "best-effort"
```

---

## 3. Concept Changes

### 3.1 TextSpan — new state fields

```
versionRef: S -> String         // ContentHash at creation time
versionPolicy: S -> String      // "auto" | "pin" | "best-effort"
```

### 3.2 TextSpan — new actions

#### `reanchor(span: S, targetVersion: String, currentContent: String)`

Re-resolve the span's anchors against the specified version's content. If successful, update `versionRef` to `targetVersion` and reset status to `active`.

```
-> ok(span: S)              // Anchors resolved in target version. versionRef updated.
-> stale(span: S)           // Anchors relocated but text shifted. versionRef updated. 
-> broken(message: String)  // Anchors can't resolve in target version.
-> notfound(message: String)
```

#### `reanchorToLatest(span: S, currentContent: String, currentVersion: String)`

Convenience: reanchor to the latest version. Equivalent to `reanchor(span, currentVersion, currentContent)`.

```
-> ok(span: S)
-> stale(span: S)
-> broken(message: String)
-> notfound(message: String)
-> current(span: S)         // Already at latest version. No-op.
```

#### `batchReanchor(entityRef: String, targetVersion: String, currentContent: String)`

Re-anchor all auto-update spans in the entity to the target version. Pinned spans are skipped.

```
-> ok(updated: String, skipped: String, broken: String)
  // JSON arrays of span IDs in each category
```

#### `getOriginalText(span: S)`

Retrieve the text the span covered *at the version it was created*. Resolves anchors against the content stored at `versionRef` (retrieved via `ContentHash/retrieve`).

```
-> ok(text: String, version: String)
-> notfound(message: String)
-> error(message: String)    // versionRef content not retrievable
```

#### `getVersionInfo(span: S, currentVersion: String)`

Return the version state of a span: current, outdated, or orphaned, plus version metadata.

```
-> ok(span: S, versionRef: String, currentVersion: String, 
      versionState: String, versionPolicy: String)
  // versionState: "current" | "outdated" | "orphaned"
-> notfound(message: String)
```

### 3.3 TextSpan — modified actions

#### `create` — gains `versionRef` parameter

```
action create(span: S, entityRef: String, startAnchor: String, 
              endAnchor: String, kind: String, label: option String,
              versionRef: String)
```

The `versionPolicy` is set automatically based on `kind`:
- `highlight`, `redaction` → `"auto"`
- `citation`, `excerpt` → `"pin"`
- `comment-target` → `"best-effort"`

Can be overridden via a new `setVersionPolicy` action.

#### `setVersionPolicy(span: S, policy: String)`

```
-> ok(span: S)
-> notfound(message: String)
-> error(message: String)    // Invalid policy value
```

---

## 4. Sync Changes

### 4.1 Modify: `content-edit-invalidates-spans`

Currently: re-resolves ALL anchors on every content edit.

New behavior: only re-resolves anchors for spans with `versionPolicy: "auto"`. Pinned spans are left alone — they stay anchored to their version.

```
sync ContentEditReanchorsAutoSpans [lazy]
  purpose: "When content is updated, batch-reanchor only auto-update
            spans to the new version. Pinned spans retain their version."
when {
  ContentNode/update: [node: ?node; content: ?content] => ok(node: ?node)
}
where {
  ContentHash/store: [content: ?content] => ok(hash: ?newVersion)
}
then {
  TextSpan/batchReanchor: [
    entityRef: ?node;
    targetVersion: ?newVersion;
    currentContent: ?content ]
}
```

### 4.2 New: `version-diff-updates-span-status`

When a diff is computed, check all outdated spans and update their version state for UI display.

```
sync VersionDiffUpdatesSpanStatus [eager]
when {
  Diff/diff: [contentA: ?before; contentB: ?after]
    => diffed(editScript: ?editScript)
}
then {
  TextSpan/batchReanchor: [
    entityRef: ?entityRef;
    targetVersion: ?afterVersion;
    currentContent: ?after ]
}
```

### 4.3 New: `span-creation-captures-version`

When a TextSpan is created, automatically store the current content version.

```
sync SpanCreationCapturesVersion [eager]
when {
  TextSpan/create: [entityRef: ?entityRef] => ok(span: ?span)
}
where {
  ContentNode/get: [node: ?entityRef] => ok(content: ?content)
  ContentHash/store: [content: ?content] => ok(hash: ?version)
}
then {
  -- versionRef is set during create, but this sync ensures 
  -- the ContentHash exists for later retrieval
}
```

---

## 5. Widget Changes

### 5.1 SpanGutter — version indicators

**Current:** Shows colored bars (highlights), icons (comments, citations), reference counts.

**Add:** Version state indicator per span fragment.

| Version State | Gutter Visual | Description |
|--------------|--------------|-------------|
| current | (no change) | Normal rendering — solid bar/icon |
| outdated | Dashed border + ↻ icon | Small refresh icon overlaid. Subtle — not alarming. |
| orphaned | ⚠ icon + faded bar | Warning indicator. Bar is faded/ghosted. |

Clicking an outdated indicator opens a popover: "This highlight was made in an earlier version. [Update] [Keep pinned]"

Clicking an orphaned indicator shows: "This text was removed. [View original] [Delete span]"

### 5.2 SpanToolbar — version actions

**Current:** Highlight color picker, Comment, Cite, Excerpt, Copy Snippet, Copy Link, Split, Merge.

**Add to existing span toolbar** (shown when clicking an existing span, not on new selection):

- **Version badge:** Shows "v3" or "2 versions behind" next to the span kind label
- **Update button:** "↻ Update to latest" — calls `reanchorToLatest`. Only shown for outdated spans.
- **Pin/Unpin toggle:** Lock icon — switches between auto-update and pin. Shows current policy.
- **View original:** For outdated/orphaned spans — opens a popover showing the original text from `versionRef` alongside the current text (inline diff).

### 5.3 New: SpanVersionBadge widget

Small inline badge rendered at the start of a span's highlight region.

```
Anatomy: root > label + icon
States: current (hidden), outdated (visible, info), orphaned (visible, warning)
```

- **current:** Badge is hidden (no visual noise for up-to-date spans)
- **outdated:** Small "↻" icon at the start of the highlight. Subtle blue/gray. Hover shows "Created in version 3 · text shifted slightly"
- **orphaned:** Small "⚠" icon. Orange/amber. Hover shows original text snippet.

### 5.4 New: SpanVersionPanel widget

Sidebar panel showing all version-aware span information for the current entity.

```
Anatomy: root > header + spanList > spanItem > (kindIcon + label + versionBadge + actions)
States: empty, populated
```

- **Header:** "Spans · 3 outdated" with batch actions: "Update all auto-update spans"
- **Span list:** Grouped by version state (current, outdated, orphaned)
- **Each item:** Kind icon + label + version badge + [Update] / [View original] / [Delete]
- **Orphaned section:** Shows original text from the span's version, with a "This text was removed in version 5" note

### 5.5 New: SpanDiffPopover widget

Inline popover comparing original span text vs current text.

```
Anatomy: root > header + diffView > (originalText + currentText) + actions
States: loading, resolved, error
```

- **header:** "Citation · version 3 → version 7"
- **diffView:** Side-by-side or inline diff showing what changed
- **originalText:** The text from `versionRef` (via `getOriginalText`)
- **currentText:** The text at the same anchor positions in current content (via `resolve`)
- **actions:** "Update to latest" / "Keep pinned" / "Delete span"

### 5.6 Modified: BlockEditor highlight rendering

**Current:** Spans render as colored background highlights via `useEntitySpans`.

**Add:** Version-state-dependent rendering:

| Version State | Highlight Style |
|--------------|----------------|
| current | Solid background (no change) |
| outdated | Solid background + dashed underline + SpanVersionBadge at start |
| orphaned | No inline highlight (text is gone). Ghost marker at last known position. |

For **orphaned** spans in **pinned** mode (citations): render a collapsed inline marker `[†]` that expands to show the original quoted text on click.

---

## 6. Hook Changes

### 6.1 `useEntitySpans` — version enrichment

**Current:** Returns `SpanFragment[]` with `spanId, blockId, startOffset, endOffset, kind, color, label`.

**Add to SpanFragment:**
```typescript
interface SpanFragment {
  // ... existing fields
  versionRef: string;
  versionState: 'current' | 'outdated' | 'orphaned';
  versionPolicy: 'auto' | 'pin' | 'best-effort';
  versionsBehind: number;  // 0 for current, N for outdated
}
```

The hook calls `TextSpan/getVersionInfo` for each span and enriches the fragments.

### 6.2 New: `useSpanVersionActions` hook

```typescript
function useSpanVersionActions(entityRef: string) {
  return {
    reanchorSpan: (spanId: string) => Promise<'ok' | 'stale' | 'broken'>;
    reanchorAll: () => Promise<{ updated: string[]; skipped: string[]; broken: string[] }>;
    getOriginalText: (spanId: string) => Promise<string>;
    setVersionPolicy: (spanId: string, policy: 'auto' | 'pin' | 'best-effort') => Promise<void>;
    outdatedCount: number;
    orphanedCount: number;
  };
}
```

---

## 7. Migration

### 7.1 Existing spans get `versionRef: "unknown"`

All existing TextSpan records have no `versionRef`. Migration sets `versionRef: "unknown"` which means "created before version tracking." These spans behave as `auto` policy — they re-resolve against current content on every edit, matching current behavior exactly.

### 7.2 Gradual adoption

- New spans automatically capture `versionRef` via the creation sync
- Existing spans continue working via the "unknown" fallback
- No breaking changes — all existing syncs and UI continue working
- Version UI indicators only appear for spans with known `versionRef`

---

## 8. Concept Dependencies

| Concept | Role | New? |
|---------|------|------|
| TextSpan | Core — gains versionRef, versionPolicy, new actions | Modified |
| TextAnchor | Unchanged — still the addressing primitive | Existing |
| ContentHash | Stores immutable content versions for retrieval | Existing |
| DAGHistory | Version graph — used to compute "versions behind" | Existing |
| Ref | Mutable pointer to latest version | Existing |
| Diff | Computes diffs between versions for the diff popover | Existing |
| ContentNode | The entity being versioned | Existing |

No new concepts needed — this is a modification to TextSpan + new syncs + new widgets.

---

## 9. Card Inventory

### Concept changes
- [ ] Add `versionRef` and `versionPolicy` to TextSpan state
- [ ] Add `reanchor` action to TextSpan
- [ ] Add `reanchorToLatest` action to TextSpan
- [ ] Add `batchReanchor` action to TextSpan
- [ ] Add `getOriginalText` action to TextSpan
- [ ] Add `getVersionInfo` action to TextSpan
- [ ] Add `setVersionPolicy` action to TextSpan
- [ ] Modify `create` to accept `versionRef` parameter
- [ ] Update TextSpan handler for all new actions

### Sync changes
- [ ] Modify `content-edit-invalidates-spans` → only auto-update spans
- [ ] New sync: `span-creation-captures-version`
- [ ] Modify `version-diff-resolves-spans` → use batchReanchor

### Widget changes
- [ ] SpanGutter: add version state indicators (outdated ↻, orphaned ⚠)
- [ ] SpanToolbar: add version badge, update button, pin toggle, view original
- [ ] New widget: SpanVersionBadge (inline indicator)
- [ ] New widget: SpanVersionPanel (sidebar panel with batch actions)
- [ ] New widget: SpanDiffPopover (original vs current text diff)
- [ ] BlockEditor: version-state-dependent highlight rendering

### Hook changes
- [ ] `useEntitySpans`: enrich SpanFragment with version fields
- [ ] New hook: `useSpanVersionActions`

### Migration
- [ ] Backfill existing spans with `versionRef: "unknown"`
- [ ] Ensure backward compatibility with unknown versionRef
