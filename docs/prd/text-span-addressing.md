# Text Span Addressing — PRD

## Problem

Clef's content system has three reference granularities:

1. **Entity-level** — Reference concept points to whole ContentNodes
2. **Block-level** — `[[entity]]` syntax and entity-embed blocks
3. **Document-level** — InlineAnnotation uses opaque `Bytes` scope

There is no way to reference **arbitrary text within or across blocks**. Users cannot:
- Highlight a phrase and link it to another entity
- Quote the last sentence of one paragraph and the first sentence of the next
- Attach a comment to a specific sentence (only to a whole block or entity)
- Create a live excerpt of 3 blocks minus the last sentence
- Build citation chains pointing to exact source text
- Redact a specific passage while preserving surrounding content

This gap affects every feature that needs sub-block precision: comments,
annotations, citations, excerpts, transclusion, search highlighting,
AI-assisted editing (pointing at exactly what to change), and collaborative
review workflows.

## Solution

Two independent, composable concepts following Jackson's methodology:

1. **TextAnchor** — stable, relocatable position within block content
2. **TextSpan** — continuous range between two anchors, possibly cross-block

These are the **addressing primitives** that all higher-level features
(comments, citations, highlights, redactions, excerpts) compose with
through syncs.

---

## §1 TextAnchor Concept

### §1.1 Purpose

Identify a precise location within block-structured content using a
resilient addressing scheme. An anchor combines a block ID with a character
offset, plus surrounding text context for relocation when content shifts.

### §1.2 State

| Field | Type | Description |
|-------|------|-------------|
| `blockId` | String | Block containing this position |
| `offset` | Int | Character offset within block's `content` HTML (text-only counting, tags excluded) |
| `prefix` | String | ~30 characters before the position (relocation context) |
| `suffix` | String | ~30 characters after the position (relocation context) |
| `entityRef` | String | ContentNode ID this anchor lives in |
| `contentHash` | String | Hash of content at creation time (staleness detection) |
| `status` | Enum | `current` · `relocated` · `orphaned` |

### §1.3 Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `create` | ok, error | Create anchor at (entityRef, blockId, offset) with context |
| `resolve` | ok, relocated, orphaned | Find current position given latest content. If blockId+offset still match prefix/suffix → `current`. If not, search all blocks for prefix+suffix → `relocated`. If context text gone → `orphaned`. |
| `relocate` | ok, notfound | Update anchor to new position after successful resolution |
| `batchResolve` | ok | Resolve multiple anchors in one pass (avoids repeated content parsing) |
| `get` | ok, notfound | Return anchor state |
| `delete` | ok, notfound | Remove anchor |
| `listForEntity` | ok | All anchors in a given ContentNode |

### §1.4 Relocation Algorithm

```
1. Parse content into blocks, strip HTML tags for text-only offsets
2. Find block by blockId
3. Extract text at [offset-len(prefix) .. offset+len(suffix)]
4. If extracted == prefix+suffix → status=current, return (blockId, offset)
5. Else: fuzzy search all blocks for best match of prefix+suffix
   - Use longest common substring or Levenshtein distance
   - Threshold: ≥80% match → status=relocated, return new (blockId, offset)
6. If no match → status=orphaned
```

### §1.5 Operational Principle

After creating an anchor at a position in content, and the content is
subsequently edited (text inserted, deleted, blocks split or merged),
resolving the anchor against the new content will either find the original
position (current), find it at a new location (relocated), or report it
lost (orphaned). The prefix/suffix context provides the relocation
resilience — edits that preserve the surrounding ~30 characters will
always succeed.

### §1.6 Invariants

- An anchor always has non-empty prefix or suffix (at least one side of context)
- An anchor's entityRef points to an existing ContentNode at creation time
- Orphaned anchors are never auto-deleted (consumer concepts decide cleanup policy)

---

## §2 TextSpan Concept

### §2.1 Purpose

Define a continuous range of text between a start and end position,
potentially spanning multiple contiguous blocks. A span is the composable
selection primitive: it can cover a phrase within a single block, an entire
block, or a cross-block region.

### §2.2 State

| Field | Type | Description |
|-------|------|-------------|
| `startAnchor` | String | TextAnchor ID for range start |
| `endAnchor` | String | TextAnchor ID for range end |
| `entityRef` | String | ContentNode containing this span |
| `label` | option String | Human-readable label |
| `kind` | String | Semantic type: `highlight`, `citation`, `excerpt`, `redaction`, `comment-target`, `search-result`, `ai-suggestion` |
| `color` | option String | Visual color hint (for highlights) |
| `status` | Enum | `active` · `stale` · `broken` |
| `metadata` | option String | JSON blob for kind-specific data |

### §2.3 Actions

| Action | Variants | Description |
|--------|----------|-------------|
| `create` | ok, error | Create span from two anchors. Error if anchors in different entities or end before start. |
| `resolve` | ok, stale, broken | Walk block tree between anchors, return fragments array: `[{ blockId, startOffset, endOffset, text }]`. Stale if an anchor was relocated. Broken if an anchor is orphaned. |
| `getText` | ok, broken | Concatenated plain text of the span |
| `getFragments` | ok, broken | Structured fragments with block IDs and offsets |
| `resize` | ok, notfound | Replace start/end anchors |
| `split` | ok, notfound, error | Split into two spans at a given anchor position |
| `merge` | ok, error | Merge two adjacent/overlapping spans into one |
| `setKind` | ok, notfound | Change the semantic type |
| `setLabel` | ok, notfound | Change the label |
| `get` | ok, notfound | Return span state |
| `list` | ok | All spans in a given ContentNode |
| `listByKind` | ok | All spans of a given kind in an entity |
| `delete` | ok, notfound | Remove span (does not delete anchors — they may be shared) |

### §2.4 Cross-Block Resolution Algorithm

```
1. Resolve startAnchor → (startBlockId, startOffset)
2. Resolve endAnchor → (endBlockId, endOffset)
3. Flatten block tree via flattenTree(blocks)
4. Find startBlockIndex and endBlockIndex in flat list
5. For each block from startBlockIndex to endBlockIndex:
   - If first block: fragment starts at startOffset, ends at block length
   - If last block: fragment starts at 0, ends at endOffset
   - If middle block: fragment covers entire block content
6. Return fragments array
```

This works for:
- **Same block**: startBlockId == endBlockId, single fragment
- **Sibling blocks**: consecutive in flat list, multiple fragments
- **Parent-child**: flattenTree visits children after parent, so parent→child spans work naturally
- **Partial blocks**: offsets within first/last blocks define the sub-block boundaries

### §2.5 Operational Principle

After creating a span between two anchors, resolving the span against
current content will enumerate every block fragment covered by the range.
If the content has been edited, anchors may relocate (stale) or become
lost (broken). Splitting a span at any interior point produces two valid
spans. Merging two contiguous spans produces one. These operations are
algebraic — split then merge returns the original span.

### §2.6 Invariants

- A span's start anchor always precedes its end anchor in document order
- A span's two anchors reference the same entityRef
- Deleting a span does not delete its anchors
- Split(merge(a, b)) = (a, b) when a and b are contiguous

---

## §3 Sync Compositions

### §3.1 Comment on Text Span

```
sync CommentAttachesToSpan [eager] {
  when Comment/create => ok(comment, entityRef, attachmentRef)
  where {
    // attachmentRef is a TextSpan ID (not a block or entity ID)
    query TextSpan/get(span: $attachmentRef) => ok(startAnchor, endAnchor)
  }
  then TextSpan/setKind(span: $attachmentRef, kind: "comment-target")
}
```

### §3.2 InlineAnnotation Uses TextSpan

```
sync AnnotationCreatesSpan [eager] {
  when InlineAnnotation/annotate => ok(annotationId, contentRef, scope)
  then TextAnchor/create(entityRef: $contentRef, ...) => ok(startAnchor)
  then TextAnchor/create(entityRef: $contentRef, ...) => ok(endAnchor)
  then TextSpan/create(entityRef: $contentRef, startAnchor: $startAnchor,
                       endAnchor: $endAnchor, kind: "annotation")
}
```

### §3.3 Live Excerpt via Transclusion

```
sync ExcerptCreatesTransclusion [eager] {
  when TextSpan/create => ok(span, entityRef, kind: "excerpt")
  then SyncedContent/createReference(ref: $span, original: $entityRef)
}
```

### §3.4 Citation Chain

```
sync CitationLinksSource [eager] {
  when TextSpan/create => ok(span, entityRef, kind: "citation", metadata)
  where {
    // metadata contains sourceEntityRef and sourceSpanId
    guard $metadata != none
  }
  then Reference/addRef(source: $span, target: $metadata.sourceSpanId)
}
```

### §3.5 Search Result Highlighting

```
sync SearchHighlightsMatches [eager] {
  when Query/execute => ok(results)
  // For each result with a text match, create a temporary highlight span
  then TextAnchor/create(...) // start of match
  then TextAnchor/create(...) // end of match
  then TextSpan/create(kind: "search-result", ...)
}
```

### §3.6 AI Suggestion Targeting

```
sync AISuggestionCreatesSpan [eager] {
  when SemanticEvaluator/assess => ok(ratings, issues)
  // For each issue with a location, create a span marking the problematic text
  then TextAnchor/create(...)
  then TextAnchor/create(...)
  then TextSpan/create(kind: "ai-suggestion", metadata: $issue)
}
```

### §3.7 Stale Span Cleanup

```
sync ContentEditInvalidatesSpans [lazy] {
  when ContentNode/update => ok(node)
  then TextAnchor/batchResolve(entityRef: $node)
  // Anchors that become orphaned trigger span status updates
}

sync OrphanedAnchorBreaksSpan [eager] {
  when TextAnchor/resolve => orphaned(anchor)
  where {
    query TextSpan spans where startAnchor = $anchor or endAnchor = $anchor
  }
  then TextSpan/markBroken(span: $span)
}
```

---

## §4 UI Integration

### §4.1 BlockEditor Text Selection

When a user selects text in the BlockEditor (via mouse drag or shift+arrow keys):

1. Capture `Selection` API range: `startContainer`, `startOffset`, `endContainer`, `endOffset`
2. Map DOM nodes back to block IDs via `data-block-id` attributes
3. Extract prefix/suffix context from the block content
4. Call `TextAnchor/create` for start and end positions
5. Call `TextSpan/create` with the two anchors

### §4.2 Span Rendering

When rendering block content, resolve all active spans for the entity:

1. Call `TextSpan/list(entityRef)` → get all spans
2. Call `TextSpan/resolve(span, content)` for each → get fragments
3. For each fragment, wrap the text range in a `<span>` with:
   - `data-span-id` attribute
   - CSS class based on `kind` (highlight-yellow, citation-blue, etc.)
   - Click handler for span interaction (show comment, navigate to source, etc.)

### §4.3 Span Toolbar

When a user selects text or clicks on an existing span:

- **Highlight** — create span with kind=highlight, pick color
- **Comment** — create span with kind=comment-target, open comment thread
- **Cite** — create span with kind=citation, link to source
- **Excerpt** — create span with kind=excerpt, create transclusion
- **Copy Snippet Reference** — copy `((entityId#span=spanId))` to clipboard
- **Copy Link** — copy a deep link URL: `/content/{entityId}#span={spanId}`

### §4.4 Block Menu — Copy Block Reference

Each block's action menu (⋮ handle) gains a "Copy Block Reference" action:

1. Click → copy `((entityRef#blockId))` to clipboard
2. Keyboard shortcut: Ctrl+Shift+B / Cmd+Shift+B when block is focused
3. Right-click context menu on block handle
4. Toast: "Block reference copied"

### §4.5 Span Gutter

In the content body margin, show span indicators:
- Colored bars for highlights
- Comment bubble icons for comment-targets
- Quote marks for citations
- Link icons for excerpts

---

## §5 Deep Links

Spans enable deep linking into content:

```
/content/{entityId}#span={spanId}
/content/{entityId}#anchor={anchorId}
/content/{entityId}#text={prefix},{suffix}
```

The `#text=` form creates a temporary anchor on navigation (like Chrome's
Text Fragments) without persisting state.

---

## §6 Implementation Phases

### Phase 1: Core Concepts (TextAnchor + TextSpan)
- Create TextAnchor concept spec and handler
- Create TextSpan concept spec and handler
- Conformance tests for both
- Basic resolve/relocate algorithms

### Phase 2: BlockEditor Integration
- Text selection → anchor/span creation
- Span rendering (highlight overlays)
- Span toolbar (highlight, comment, cite, excerpt)
- Span gutter indicators

### Phase 3: Sync Compositions
- Comment on TextSpan sync
- InlineAnnotation uses TextSpan sync
- Excerpt/transclusion sync
- Citation chain sync
- Content edit invalidation sync

### Phase 4: Advanced Features
- Search result highlighting
- AI suggestion targeting
- Deep link navigation
- Batch resolution optimization
- Span merging/splitting UI

### Phase 5: Block & Snippet References
- `block-embed` block type with `((entity#block))` syntax
- `snippet-embed` block type with `((entity#span=id))` syntax
- Copy Block Reference flow (block menu → clipboard → paste)
- Copy Snippet Reference flow (text selection → clipboard → paste)
- Inline snippet reference syntax for short excerpts
- Snippet backlinks — show where spans are referenced

### Phase 6: Cross-Entity Spans
- Spans that reference text in other entities (cross-document citations)
- Span-aware version diffing (VersionSpace integration)
- Span-aware conflict resolution

---

## §7 Concept Independence Verification

| Principle | TextAnchor | TextSpan |
|-----------|-----------|----------|
| **Independent purpose** | Stable position addressing | Continuous range selection |
| **Own state** | blockId, offset, prefix, suffix, status | startAnchor, endAnchor, kind, status |
| **Own operational principle** | create → resolve → relocate | create → resolve → split/merge |
| **No concept coupling** | Doesn't import TextSpan | Doesn't import TextAnchor |
| **Sync-only composition** | Wired via syncs | References anchors by ID string, not direct dependency |
| **Useful alone** | Bookmarks, cursor positions, insertion points | Selection, highlighting (with synthetic anchors) |

---

## §8 Block & Snippet References

### §8.1 Current State

clef-base has three reference syntaxes:
- `[[entity-name]]` — inline entity link, renders as clickable chip
- `((entity-id))` — entity transclusion, auto-converts to entity-embed block
- `entity-embed` block type — embeds whole ContentNode with display mode picker

Missing: block-level and text-snippet references.

### §8.2 New Reference Syntax

| Syntax | Type | Renders as |
|--------|------|-----------|
| `((entity-id))` | Entity transclusion (existing) | entity-embed block |
| `((entity-id#block-id))` | Block reference (new) | block-embed block — single block from source |
| `((entity-id#span=spanId))` | Snippet reference (new) | snippet-embed block — resolved TextSpan excerpt |
| Inline `((entity#span=id))` | Inline snippet (new) | Styled chip with excerpt text (short spans) |

### §8.3 Block-Embed Block Type

New block type in BlockEditor:
- **Meta**: `{ entityId: string, blockId: string }`
- **Render**: Fetch source entity content, find block by ID, render with display mode
- **Slash command**: `/block-embed` with entity+block picker
- **Paste detection**: `((entity#block))` pattern in transclusion handler
- **Live updates**: Re-fetches when source changes

### §8.4 Snippet-Embed Block Type

New block type in BlockEditor:
- **Meta**: `{ entityId: string, spanId: string }`
- **Render**: Call TextSpan/resolve → get fragments → render concatenated text with source attribution badge and "View in context" link
- **Status indicators**: Stale (relocated) → warning badge. Broken (orphaned) → error state.
- **Slash command**: `/snippet` with entity+span picker
- **Paste detection**: `((entity#span=id))` pattern in transclusion handler
- **Live updates**: Re-resolve span when source content changes

### §8.5 Copy Flows

**Copy Block Reference**:
1. Block menu (⋮) → "Copy Block Reference"
2. Keyboard: Ctrl+Shift+B / Cmd+Shift+B
3. Clipboard: `((entityRef#blockId))`
4. Paste: auto-converts to block-embed

**Copy Snippet Reference**:
1. Select text → span toolbar → "Copy Snippet Reference"
2. Keyboard: Ctrl+Shift+C / Cmd+Shift+C
3. Creates TextAnchor pair + TextSpan if needed
4. Clipboard: `((entityRef#span=spanId))`
5. Paste: auto-converts to snippet-embed

### §8.6 Snippet Backlinks

Extend the existing backlinks system:
- Span gutter shows "referenced N times" for spans embedded elsewhere
- Click reveals popover listing referencing entities
- Entity detail Backlinks section includes snippet references
- Contextual filter: `source_type: "snippet-reference"`

---

## §9 Relation to Existing Concepts

| Concept | Current State | With TextSpan |
|---------|--------------|---------------|
| **InlineAnnotation** | Opaque `Bytes` scope | Scope becomes a TextSpan ID — structured, relocatable |
| **Reference** | Entity-to-entity only | Can point to a TextSpan — sub-entity precision |
| **SyncedContent** | Whole-entity transclusion | Transclusion of a TextSpan — live excerpts |
| **Comment** | Attaches to entity | Attaches to TextSpan — inline comment threads |
| **CheckVerification** | References step/process | Can reference exact text being evaluated |
| **FormulaField** | Attaches to entity/schema | Inline formula can reference surrounding text context |
| **SemanticEvaluator** | Returns issues with locations | Issues create TextSpans for precise UI highlighting |
| **Query** | Returns entity results | Search matches create temporary TextSpans |
