# PRD: Block Editor Loose Ends

## Status: Draft
## Authors: 2026-04-13
## Depends on:
- Completed: Block Editor Recursive Views (MAG-708, 51 cards)
- Completed: Block Editor Gap Closure (MAG-760, 6 cards)
- Completed: Block Editor Parity Pass (MAG-767, 26 cards)

---

## 1. Problem Statement

After three epics (83 cards) the recursive block editor is production-complete, but the audit from MAG-793 revealed ~21 residual "anticipatory" concept references in ActionBindings and EditSurfaces. Most are shipped-but-mislabeled (cleaned up in `93c45291`). A genuinely pending set remains — new concepts, action additions, panel widgets, and orchestration syncs.

This PRD resolves the real design questions behind those pending items (Parse/Format/Highlight generalization, tables-as-recursive-views, Comment resolution semantics) then cards the resulting implementation work.

---

## 2. Design decisions (settled up-front)

### 2.1 Columns → GroupSpec, no new concept

Columns-block is a ViewShell with `presentation: blocks` + `group_spec: group-by-column-index`. Each child has Property `columnIndex`. "Add column" = increment a `columnCount` Property on the block + relabel children. "Move block to column 2" = `Property.set(blockId, columnIndex, 2)`. Responsive stack-on-narrow is widget-level rendering concern.

Result: **kills the Columns concept + its 5 actions.** GroupSpec + Property already exist.

### 2.2 EntityEmbed/ViewEmbed display mode → Property

Per-instance display mode persisted as `Property.set(embedBlockId, "displayMode", <mode>)`. The existing DisplayModeSwitcher widget sits in the embed's EditSurface toolbar, mutates the Property, and the embed-block widget reads it as the `display_mode` arg to `ComponentMapping/resolve`.

Result: **kills EntityEmbedBlock/setDisplayMode + ViewEmbedBlock/configure actions.** Property is the persistence; DisplayModeSwitcher is the UI.

### 2.3 ToggleBlock expand/collapse → user preference, client-side

Expansion state is per-user ephemeral. Keyed by `(userId, blockId)`, stored as a user preference (localStorage-backed via the existing preference mechanism). No ToggleBlock concept, no concept action.

Result: **kills ToggleBlock concept.** Widget reads/writes user-preference.

### 2.4 Tables → cells as ContentNodes (full recursive), orchestrated via syncs

Tables follow the recursive-views pattern: `table` block → `table-row` blocks → `table-cell` blocks → any block content. 10×10 table = 121 ContentNodes. Row/column operations are batched `addChild/moveChild/removeChild` sequences wrapped by an orchestration sync for atomicity + undo-as-one-entry.

Result: **no TableBlock concept.** 8 ActionBindings dispatch to orchestration syncs (`table-insert-row-above.sync`, etc.).

### 2.5 Syntax operations → three concepts (Parse + Format + Highlight)

Text-centric operations split Jackson-faithfully:

- `Parse` — text → AST (language-parameterized via provider registry)
- `Format` — text → Patch (language-parameterized)
- `Highlight` — text → decoration annotations (language-parameterized)

Each concept has its own provider registry. Shell derived concept `Syntax` composes all three for namespace ergonomics (optional).

### 2.6 ContentSerializer = separate (tree-centric)

Parse/Format/Highlight are text-centric. ContentSerializer walks ContentNode trees to produce markdown/html/pdf/json outputs. Separate concept, separate provider registry.

### 2.7 Comment resolve = its own thing

Add to Comment concept: state `resolved: Bool`, `resolvedAt: option DateTime`, `resolvedBy: option String`. Actions `resolve(comment, actor)` / `unresolve(comment, actor)` with self-inverse reversal pair.

Semantic: resolve hides thread from active view; unresolve reopens. `publish` stays orthogonal (draft→visible). New reply on resolved thread optionally auto-unresolves (configurable).

### 2.8 CodeFormatter → Format concept (merged into §2.5)

Format returns Patch (not formatted text) so the result integrates with the existing Patch + UndoStack pipeline. Format action is one undo entry.

### 2.9 Template trigger lookup → exact-first, prefix-fallback

`Template/queryByTrigger(trigger)` tries exact match first; if none, returns all templates with a trigger that begins with the given string. Picker UI shows multiple candidates if >1. No fuzzy match in Phase 1 (defer to a follow-up if users ask).

### 2.10 ContentNode/createWithSchema = atomic additive action

Avoids the two-dispatch race where a node exists un-schema'd between `create` and `Schema/applyTo`. Adds `createWithSchema(id, schema, body)` as a single action; the existing `create` remains for cases where schema is assigned later.

---

## 3. Scope

### 3.1 New concepts (4)

| Concept | Purpose | Actions |
|---|---|---|
| `Parse [P]` | text → AST (language-parameterized) | register, parse, listLanguages |
| `Format [F]` | text → Patch (language-parameterized) | register, format, listLanguages |
| `Highlight [H]` | text → decoration annotations (language-parameterized) | register, highlight, listLanguages |
| `ContentSerializer [S]` | tree → output format (target-parameterized) | register, serialize, listTargets |

### 3.2 New derived (1)

- `Syntax [T]` — shell composing Parse + Format + Highlight; surface actions delegate via sync. Ergonomic facade only.

### 3.3 Provider implementations

Parse providers: micromark-parse (markdown), github-callout-parse, mkdocs-callout-parse, obsidian-callout-parse (three callout dialects on top of the markdown base), katex-parse (latex), domparser-parse (html).

Format providers: prettier (js/ts/json/css/html), micromark-format (markdown round-trip).

Highlight providers: shiki (broad language set), katex (latex error markers).

ContentSerializer providers: markdown (GFM walk), html (semantic walk), json (raw tree), pdf (wraps html + window.print).

### 3.4 Existing-concept additions

- `Comment`: resolved/resolvedAt/resolvedBy state; resolve/unresolve actions with self-inverse reversal
- `ContentNode`: `createWithSchema(id, schema, body)` atomic action
- `Template`: `queryByTrigger(trigger)` action

### 3.5 Sync orchestration (tables)

Six syncs in `syncs/app/`:

- `table-insert-row-above.sync` / `table-insert-row-below.sync`
- `table-insert-column-left.sync` / `table-insert-column-right.sync`
- `table-delete-row.sync` / `table-delete-column.sync`

Each expands one ActionBinding invocation into N ContentNode create + Outline addChild / moveChild calls, wrapped with a single UndoStack push so the entire operation is one undo step.

### 3.6 Widgets (8 small panels)

Each is an editor-panel plugin registered via PluginRegistry, mounted by EditSurface defaults:

- `image-metadata-panel.widget` — width / height / EXIF / file size
- `exif-panel.widget` — camera / location / timestamps from EXIF
- `anchor-link-panel.widget` — heading's `id` slug for deep-links; copy-URL affordance
- `entity-metadata-panel.widget` — referenced entity's summary + backlinks
- `view-embed-filter-override-panel.widget` — per-embed filter overrides on top of inherited FilterSpec
- `code-syntax-error-panel.widget` — consumes Highlight output's error-kind annotations + surfaces them as a reviewable list
- `columns-layout-panel.widget` — columnCount + per-column width sliders + stack-on-narrow toggle
- `control-action-picker.widget` — picker for binding a control block to an ActionBinding

### 3.7 InputRule seeds (6)

- markdown-heading-1 (`^# `) — target `Schema/applyTo` with schema heading, level 1
- markdown-heading-3/4/5/6 — same pattern
- github-callout (`^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]`) — target Parse provider, route to callout block with paletteRole from keyword
- (mkdocs + obsidian dialects register through their Parse providers at provider-registration time; no additional InputRule seed needed unless the user explicitly enables those dialects)

---

## 4. Architecture

### 4.1 Provider registration pattern

Each of the 4 new concepts uses the same provider-registry shape:

```
register(provider: String, <discriminator>: String, config: Bytes) -> ok | duplicate | error
```

For Parse/Format/Highlight, `discriminator` is `language`. For ContentSerializer, `discriminator` is `target`. Config holds provider-specific hints (e.g. prettier plugins list).

Providers are registered via sync on kernel boot. Each provider ships as a small TypeScript handler invoked by its concept's dispatch action.

### 4.2 Dispatch flow

`Syntax/parse(language: "markdown", text: "...")` →
→ sync routes to `Parse/parse(language, text)` →
→ Parse handler looks up provider by language →
→ provider runs (e.g. micromark) →
→ returns `ok(ast: Bytes)` to caller

Same shape for Format (returns Patch) and Highlight (returns annotations).

### 4.3 Table orchestration sync pattern

```
sync TableInsertRowAbove
  when ActionBinding/invoke(binding: "table-insert-row-above", context: {tableId, rowIndex})
  where
    query tableRows = Outline/children(parent: tableId) where schema=table-row
    bind columnCount as |first-row-of-table|.children.length
  then
    // 1. Create new row ContentNode
    ContentNode/createWithSchema(id: newRowId, schema: "table-row")
    // 2. Insert at position
    Outline/addChild(parent: tableId, child: newRowId, position: rowIndex)
    // 3. Create N cells
    traverse columnCount:
      ContentNode/createWithSchema(id: uuidv4, schema: "table-cell")
      Outline/addChild(parent: newRowId, child: cellId, position: i)
    // 4. Push one UndoStack entry
    UndoStack/push(stack, "table-insert-row-above", {tableId, rowIndex, newRowId})
```

Undo of this entry invokes a single reverse sync that removes the row + all its cells.

### 4.4 Shell composition for Syntax

```
derived Syntax [T] {
  composes { Parse [T]; Format [T]; Highlight [T] }
  surface {
    action parse(language, text) matches: Parse/parse
    action format(language, text) matches: Format/format
    action highlight(language, text) matches: Highlight/highlight
  }
}
```

Callers import `Syntax/parse` instead of `Parse/parse` if they want a single namespace; underlying concepts remain directly-callable.

---

## 5. Phasing

### Phase 1 — Core concepts (4 cards)

1. Parse concept + handler + conformance tests
2. Format concept + handler + conformance tests
3. Highlight concept + handler + conformance tests
4. ContentSerializer concept + handler + conformance tests

### Phase 2 — Provider implementations (~10 cards, can parallelize)

5. micromark-parse (markdown) provider + registration sync
6. github/mkdocs/obsidian callout Parse providers (one card for all three dialects)
7. katex-parse (latex) provider
8. domparser-parse (html) provider
9. prettier format provider (js/ts/json/css/html)
10. micromark-format round-trip provider
11. shiki highlight provider
12. katex highlight (latex error markers) provider
13. ContentSerializer markdown + html + json providers (one card for all three)
14. ContentSerializer pdf provider (wraps html + window.print)

### Phase 3 — Shell derived + wiring (2 cards)

15. Syntax derived concept + composition syncs
16. Wire Syntax/parse into smart-paste handler (replaces PP1.06's direct micromark call); wire Syntax/format into code-block format button; wire Syntax/highlight into code-block + latex decorations

### Phase 4 — Existing-concept additions (3 cards)

17. Comment resolve/unresolve + state + reversal
18. ContentNode/createWithSchema atomic action
19. Template/queryByTrigger action (exact-first + prefix-fallback)

### Phase 5 — Table orchestration (1 card)

20. Six table orchestration syncs (insert-row-above/below, insert-column-left/right, delete-row, delete-column) + ActionBindings + UndoStack integration

### Phase 6 — Panel widgets (1 card covering all 8)

21. Eight panel widgets + PluginRegistry seeds + EditSurface panel_widgets updates. Small, repetitive; one card over multiple files.

### Phase 7 — InputRule seeds (1 card)

22. markdown-heading-1/3/4/5/6 + github-callout InputRule seeds + any companion ActionBindings (routing captured level / dialect to Schema/applyTo or Parse provider).

---

## 6. Success Criteria

1. Every remaining "anticipated" reference in audit is either shipped or explicitly marked out-of-scope in this PRD
2. ExportDialog drops its local-traversal fallback; ContentSerializer is the only path
3. Code-block format button returns a Patch, is undoable via Cmd+Z
4. `table-insert-row-above` is one undo step (not N cell-creation steps)
5. Resolving a comment hides the thread from comments-panel; unresolving restores; both reversible via Cmd+Z (action-level undo via UndoStack reversal)
6. Markdown paste handles GitHub callouts (`> [!NOTE]`) in addition to plain markdown
7. shiki-backed syntax coloring renders on all code-cell + code-block instances

## 7. Non-goals

- New editors / new views — this PRD is close-out only
- Real-time collaborative syntax highlighting — Highlight is client-local
- Server-side export pipelines — ContentSerializer runs in-kernel, PDF uses browser print (external scheduled export is a future concern)
- Grammar-check as a Syntax provider — spell-check service exists (MAG-792); extending to grammar is its own scope

## 8. Open Questions

1. **PDF serialization fidelity** — `window.print` is the simplest path; is fidelity acceptable vs a server-side Puppeteer render? Default yes, revisit if users complain.
2. **Auto-unresolve on reply** — when a reply lands on a resolved thread, auto-unresolve or stay resolved until explicit action? Lean auto-unresolve (Linear model); make it a Property so it's per-workspace configurable.
3. **Table row heights** — cells wrap or expand? This PRD doesn't address presentation of oversized cells. Defer.
4. **Syntax provider fallback chain** — if no provider registered for a given language, error or fall through to a plain-text default? Currently spec says `no_provider` variant. Callers decide.
5. **ContentNode/createWithSchema idempotency** — if called twice with same id, return `duplicate` or the existing node? Lean `duplicate` for consistency with ContentNode/create semantics.
6. **Template trigger prefix disambiguation** — if `;sig` matches 3 templates, show picker or insert the first? Picker is more explicit but slower. Lean picker, 300ms delay-insert if only one match.

---

## 9. Card Plan

22 cards under epic MAG-794 "Block Editor Loose Ends". All shipped 2026-04-13.

| Card | Title | Commit |
|---|---|---|
| MAG-795 | LE-01 Parse concept + handler | 698075c3 |
| MAG-796 | LE-02 Format concept + handler | 443080ee |
| MAG-797 | LE-03 Highlight concept + handler | d44dca9c |
| MAG-798 | LE-04 ContentSerializer concept + handler | 38140757 |
| MAG-799 | LE-05 micromark-parse provider | 0ec0d780 |
| MAG-800 | LE-06 GitHub/mkdocs/obsidian callout providers | abf84b3d |
| MAG-801 | LE-07 katex-parse provider | 8918327e |
| MAG-802 | LE-08 domparser-parse provider | 1021f59a |
| MAG-803 | LE-09 prettier Format provider | 5a143751 |
| MAG-804 | LE-10 micromark-format Format provider | 1b1d93da |
| MAG-805 | LE-11 shiki Highlight provider | 03fc177e |
| MAG-806 | LE-12 katex Highlight provider | 0289ddc8 |
| MAG-807 | LE-13 ContentSerializer md/html/json providers | 5db05cb6 |
| MAG-808 | LE-14 ContentSerializer pdf provider | 5838258a |
| MAG-809 | LE-15 Syntax derived shell + delegate syncs | 430b5d4b |
| MAG-810 | LE-16 Syntax + ContentSerializer wiring | 87b84ea5 |
| MAG-811 | LE-17 Comment resolve/unresolve | dfbb9cfa |
| MAG-812 | LE-18 ContentNode/createWithSchema | dd49a1a0 |
| MAG-813 | LE-19 Template/queryByTrigger | 9a72d00e |
| MAG-814 | LE-20 Table orchestration syncs | a56bc73c |
| MAG-815 | LE-21 Eight panel widgets + seeds | 64810394 |
| MAG-816 | LE-22 InputRule seeds (heading + callout) | e12a23b3 |
