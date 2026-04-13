# PRD: Block Editor Parity Pass

## Status: Draft
## Authors: 2026-04-13

---

## Addendum 2026-04-13 — Core Typing Loop Preconditions

During Playwright-driven dogfooding after commit `beaca9ef` (PageTitle
cursor fix + KeyBinding/ActionBinding/TextSpan kernel registrations), a
deeper layer of failure surfaced: **the block editor's dispatch path had
never worked end-to-end.** Every Phase 1–8 card below implicitly assumes
block creation and body persistence work. They do not. Ship this
addendum first.

### Gaps discovered

1. **`Outline/children` action doesn't exist** — the client
   (RecursiveBlockEditor.loadChildren) calls `Outline/children`, but the
   handler only implements `getChildren`. The request returns `Unknown
   action: children`.

2. **`insert-block` binding was never seeded** — client dispatches
   through a binding that wasn't in any seed file. Added in beaca9ef.

3. **`update-block-content` binding was never seeded** — same. Added
   in beaca9ef.

4. **No parent-child outline linkage on insert** — the binding now
   creates a ContentNode but nothing creates an Outline record, so
   `getChildren(root)` returns empty even after successful insert.

5. **Cursor-reset-at-offset-0 in PageTitle.tsx** — rendering
   `{localTitle}` as a JSX child of the contenteditable reconciles the
   text node on every keystroke. Fixed in beaca9ef. May recur in other
   contenteditable widgets; audit needed.

### Parity-Precondition Cards (must ship before Phase 1)

| ID | Title | Status | Commit |
|----|-------|--------|--------|
| BE-PREC-01 | Outline/children action (lists children by parent) | Done | 5b6d75a7 |
| BE-PREC-02 | Direct ContentNode + Outline dispatch from editor (ActionBinding layer inert) | Done | 5b6d75a7 |
| BE-PREC-03 | insert-block + update-block-content seeds (legacy ActionBinding path) | Done | beaca9ef |
| BE-PREC-04 | Outline/children empty-notfound fallback | Done | 5b6d75a7 |
| BE-PREC-05 | Playwright end-to-end typing verification (type, Enter, reload, verify) | Done | 5b6d75a7 |
| BE-PREC-06 | PageTitle contenteditable JSX-child fix (cursor-reset) | Done | beaca9ef |
| BE-PREC-07 | Enter auto-focuses newly-created block (Notion parity) | Done | 5b6d75a7 |
| BE-PREC-08 | Tab indents block under previous sibling | Done | 5b6d75a7 |
| BE-PREC-09 | Widget invariants + regenerated conformance tests (94 passing) | Done | 06434f0b |

## Next loop (Notion-parity core UX)

| ID | Title | Status | Commit |
|----|-------|--------|--------|
| BE-LOOP-01 | Backspace-at-offset-0 merges into previous sibling | pending | — |
| BE-LOOP-02 | Shift+Tab outdent (thread parent through BlockSlot props) | pending | — |
| BE-LOOP-03 | Delete on empty block removes block + focus to previous | pending | — |
| BE-LOOP-04 | Arrow up/down moves caret between blocks | pending | — |
| BE-LOOP-05 | Paragraph-block invariants capturing cursor-stability + Enter | pending | — |

Once BE-PREC-01..05 are green, Phase 1 below is viable.

---
## Depends on:
- Completed: Block Editor Recursive Views epic (MAG-708) — all 51 cards shipped
- Completed: Block Editor Gap Closure (MAG-760) — all 6 backing-handler gaps closed
- Existing: BlockEditor.tsx still mounted as fallback for non-allowlisted schemas

---

## 1. Problem Statement

The recursive block editor (MAG-708) has the right architecture but is missing ~27 production-expected features that users notice immediately when comparing to Notion / Outline / Linear / BlockNote. The architecture proves out — adding these features is mostly wiring existing primitives, not designing new ones. The biggest opportunity: ~8 features are already built (widgets / concepts shipped) and just need the editor host to mount them.

The goal of this PRD: ship every parity feature so RecursiveBlockEditor reaches "feels like a real product" parity. Once complete, the legacy `BlockEditor.tsx` can be deleted.

---

## 2. Scope Inventory — All Items

### 2.1 Table-stakes (7) — feels broken without these

1. **Drag-reorder blocks** via block-handle (⠿) on hover — primary structural-edit interaction
2. **Multi-select blocks** (Shift+click, Cmd+click, Shift+Arrow) — batch ops
3. **Undo/redo** — keystroke-level (burst-coalesced) via the existing `Patch` concept + `UndoStack`. Each input event produces a Patch describing the textual diff; consecutive Patches within a burst window (≤ 800ms idle, no cursor jump, no non-typing interleave) collapse into one undo entry. Push each entry to UndoStack with `reversalAction: "Patch/applyInverse"` and the Patch payload as params. Cmd+Z dispatches `UndoStack/undo` → returns the reversal → kernel invokes `Patch/applyInverse(patchId)` → editor re-renders. New `editor-burst-tracker` helper in the React adapter manages the coalescing window. Reuses both existing concepts; no new concept required
4. **Block actions menu** (handle → Duplicate / Delete / Turn into / Copy link / Move to)
5. **Placeholder text** mechanism + per-schema placeholders ("Type / for commands", "Click to add caption")
6. **Smart paste** — markdown / HTML / rich text from clipboard → block tree
7. **Page title** as a first-class field above the block tree (separate from the first paragraph)

### 2.2 Expected (12) — users notice missing

8. **Find/replace** within doc (Ctrl+F overlay, scoped to current page)
9. **Focus mode** + reading-width toggle in header
10. **Image/video resize handles** — drag corners to resize inline media
11. **Word count + reading time** live counters in footer
12. **Hover preview** for `[[link]]` / entity-embed / mention marks
13. **Keyboard shortcut help** (Ctrl+/ or ?) — modal cheat sheet
14. **Ctrl+K command palette** — quick page/action switcher (separate from slash insertion)
15. **Breadcrumbs** — current block's ancestor path at top of viewport
16. **Export UI** driving existing ContentSerializer concept (Markdown / HTML / PDF targets)
17. **Duplicate block shortcut** (Cmd+D)
18. **Smart selection** — double-click word, triple-click block, quadruple-click section
19. **Version history browser** — Version concept exists; needs restore UI

### 2.3 Built-but-unwired (8) — high-value, low-effort

20. **Collaborative cursors + selections** — `presence-decoration.widget` (8cbf267a) needs mounting in decoration-layer slot
21. **Spell/grammar decorations** — RenderTransforms registered (a4585cc1); needs a service producing InlineAnnotations
22. **Comment gutter markers** — `comment-gutter-marker.widget` (e18549da) needs decoration-layer iteration
23. **AI chat panel default** — `ai-chat-panel.widget` (4173ba71) added to default panel set
24. **Outline panel default** — `outline-panel.widget` (8608b1eb) in default set for markdown/wiki/notebook flavors
25. **Backlinks panel default** — `backlinks-panel.widget` (3af418d8) same
26. **Offline indicator** — Replica concept exists; status-bar widget needed
27. **Track-changes panel mounting** — `changes-panel.widget` (48e8953b) auto-mount when doc has pending InlineAnnotations

### 2.4 Cross-cutting (3) — supporting infrastructure

28. **Modal stack manager** in RecursiveBlockEditor — coordinates link-editor / media-picker / emoji-picker / template-picker / link-hover so they don't fight focus
29. **PluginRegistry slot resolver** in the editor host — generic mechanism for "iterate registered widgets of type X and mount them in slot Y" (currently each panel manually mounted)
30. **Block hover state** — shared `hovered-block-id` for handle visibility, link previews, comment markers

---

## 3. Architecture

### 3.1 New concepts

None. Every feature composes existing primitives.

### 3.2 Concept extensions (additive)

- `UndoStack` — already wired for action-level undo; this PRD pushes editor-burst Patch entries onto the same stack so text edits unify with action undo
- `Patch` — verify `applyInverse(patch)` action exists with proper reversal declaration. If only `apply(patch)` + an inverse-on-construction model exists, add `applyInverse` so UndoStack can dispatch it directly. Patch's existing algebra (invertible/composable) is exactly what we need
- `Outline` — no new action needed; text edits become Patches against the block's body field, not Outline-level mutations
- `Schema` Property keys (additive seed-only):
  - `placeholder: option String` — per-block-type placeholder text
  - `placeholderEmpty: option String` — placeholder shown only when block is empty
  - `wordCountMode: "exclude" | "include" = "include"` — whether block contributes to doc word count

### 3.3 New widgets

| Widget | Type | Purpose |
|---|---|---|
| `block-handle.widget` | decoration-layer | Hover-visible drag handle + actions menu trigger |
| `block-actions-menu.widget` | popover | Per-block actions (duplicate / delete / turn-into / copy-link) |
| `multi-select-overlay.widget` | decoration-layer | Visual indication of selected blocks + batch toolbar |
| `find-replace-overlay.widget` | overlay | Ctrl+F search within doc |
| `command-palette.widget` | modal | Ctrl+K page/action navigator |
| `breadcrumbs.widget` | header-slot | Ancestor path |
| `word-count-indicator.widget` | footer-slot | Live counter |
| `keyboard-help-modal.widget` | modal | Shortcut cheat sheet |
| `link-hover-preview.widget` | popover | Preview card on `[[link]]` / mention hover |
| `media-resize-handle.widget` | decoration-layer | Image/video corner resize |
| `version-history-browser.widget` | side-panel | Restore from Version concept |
| `export-dialog.widget` | modal | ContentSerializer target picker |
| `placeholder-decoration.widget` | decoration-layer | Render placeholder text per block |
| `offline-indicator.widget` | status-bar | Replica peer state visualization |
| `focus-mode-toggle.widget` | header-slot | Hide chrome / set reading width |
| `smart-paste-converter` | (handler not widget) | Markdown/HTML → block tree |
| `modal-stack-manager` | (host integration) | Coordinates open modals/popovers |

### 3.4 New ActionBindings (representative subset)

- `block-drag-start` / `block-drag-over` / `block-drop` — Outline/moveChild
- `block-duplicate` — ContentNode/clone (existing) + Outline/addChild after current
- `block-multi-delete` — bulk over multi-select state
- `block-turn-into` — Schema/applyTo with target schema picker
- `block-copy-link` — clipboard with deep-link to block
- `editor-undo` / `editor-redo` — Patch/apply + Patch/invert
- `find-replace-find-next` / `find-replace-replace-all`
- `command-palette-open` (Ctrl+K)
- `keyboard-help-open` (Ctrl+/)
- `export-doc` (Ctrl+Shift+E) → opens export-dialog
- `media-resize-commit` — MediaAsset/setDimensions
- `version-restore` — Version/restore (concept already exists)
- `focus-mode-toggle` — user-pref update

### 3.5 Editor host extensions (RecursiveBlockEditor.tsx)

- **Multi-select state** — Set<blockId> + selection range tracking
- **Hover state** — currentHoveredBlockId for handle/preview triggers
- **Drag state** — drag-source / drag-over-target / drop-position
- **Modal stack** — array of open modals/popovers with focus-trap coordination
- **Undo stack** — Patch sequence + position pointer
- **Plugin slot resolver** — generic helper that queries PluginRegistry for `type=X` and mounts each in slot Y
- **Title field** — distinct input above the block tree, bound to ContentNode.title
- **Header / footer slots** — new compose slots for breadcrumbs / word-count / focus-mode-toggle / offline-indicator
- **Modal mount point** — single z-stacked region for command-palette, find-replace, keyboard-help, version-history, export-dialog, link-editor, media-picker, etc.

---

## 4. Phasing

### Phase 1 — Block ergonomics (table-stakes core)

1. **block-handle.widget + drag-reorder + actions menu** — items 1, 4
2. **Multi-select state + batch ops + multi-select-overlay** — item 2
3. **Undo/redo (keystroke-level, burst-coalesced)** — `editor-burst-tracker` helper in RecursiveBlockEditor produces a Patch per input burst (collapsing consecutive keystrokes within 800ms / same-cursor / typing-only); push each to UndoStack with `reversalAction: "Patch/applyInverse"` + Patch payload; verify Cmd+Z routes UndoStack/undo → Patch/applyInverse and editor re-renders. Verify `Patch/applyInverse` action exists; add it if only `apply` exists today — item 3
4. **placeholder-decoration + per-schema Property seeds** — item 5
5. **Page title field above block tree** — item 7
6. **Smart paste handler (markdown/HTML → blocks)** — item 6
7. **Cmd+D duplicate-block shortcut** — item 17 (small, fits here)
8. **Smart selection (double/triple-click handlers)** — item 18

### Phase 2 — Find / navigate / palette

9. **find-replace-overlay** — item 8
10. **command-palette (Ctrl+K)** — item 14
11. **breadcrumbs in header slot** — item 15
12. **keyboard-help-modal (Ctrl+/)** — item 13

### Phase 3 — Wire built-but-unmounted

13. **PluginRegistry slot resolver in host** — cross-cutting #29
14. **Modal stack manager** — cross-cutting #28
15. **Mount comment-gutter-marker, presence-decoration, track-changes-panel via slot resolver** — items 20, 22, 26
16. **Default panel set update** (outline / backlinks / AI chat per editor flavor) — items 23, 24, 25
17. **link-hover-preview popover for [[link]] + entity-embed + mention** — item 12
18. **placeholder mechanism integrated with existing block widgets** — completes item 5

### Phase 4 — Media polish

19. **media-resize-handle + MediaAsset/setDimensions action** — item 10
20. **focus-mode-toggle + reading-width** — item 9

### Phase 5 — Reading affordances + footer

21. **word-count-indicator** — item 11
22. **offline-indicator** — item 26 (status-bar)

### Phase 6 — Export / import / version

23. **smart-paste handler** moved here if not feasible in P1 (markdown / HTML deserialize)
24. **export-dialog + ContentSerializer wiring** (Markdown / HTML / PDF) — item 16
25. **version-history-browser side-panel + restore action** — item 19

### Phase 7 — Spell-check service integration

26. **Spell/grammar service** producing InlineAnnotations of kind="spelling"/"grammar" — item 21 (the RenderTransforms are already registered; this card adds a dispatcher to a browser/native API or external service)

### Phase 8 — Final delete

27. **Reopen MAG-758** — delete `BlockEditor.tsx` once parity confirmed across all schemas via smoke-test pass

---

## 5. Success Criteria

1. **No "feels broken" gaps** — drag-reorder, multi-select, undo, placeholders, title field, smart paste all present
2. **No high-value asset sitting unmounted** — every shipped widget is reachable
3. **Slash menu ≠ Ctrl+K** — distinct insertion vs navigation surfaces
4. **Export round-trips** — markdown export then re-import preserves block tree fidelity
5. **Undo coverage 100%** — every editor mutation reversible via Ctrl+Z
6. **Legacy BlockEditor.tsx deletable** — recursive editor handles every previously-supported schema with no UX regressions
7. **PluginRegistry slot resolver** is the only mounting mechanism for panels / decorations — no bespoke slot wiring per widget
8. **All 5 themes** continue to look correct after every parity feature lands (regression check)

---

## 6. Non-goals

- Real-time collaborative protocols (presence widget mounts but transport is out of scope; existing CausalClock + Replica concepts cover the data model)
- Custom block framework for third-party packages (extension model stays seed-driven)
- IME / international input optimization beyond what contentEditable provides
- Mobile-specific gesture support (separate audit)
- Accessibility audit (separate WCAG-focused PRD; this PRD only doesn't regress what's there)

---

## 7. Open Questions

1. **Drag-reorder visual feedback** — drop-zone line vs ghost block vs both?
2. **Multi-select range semantics** — Shift+click extends to block-tree DFS order or visual order? (probably visual)
3. **Burst-coalescing window** — 800ms idle is the default. Burst breaks on: cursor jump (Arrow keys, mouse click moving caret > N chars), non-typing edit interleaved (e.g. mark toggle, format change), explicit save/blur, focus switch to another block. Open: should pasted text be its own undo entry (yes, leans correct) or merge with adjacent typing burst? Open: should `Patch/applyInverse` push a redo-stack entry (it does today via UndoStack/redo), or treat undo+typing-after as a redo-truncate?
4. **Smart-paste markdown dialect** — CommonMark strict, GFM, or detect?
5. **Export PDF rendering** — server-side via Puppeteer, client-side via print CSS, or both?
6. **Spell-check provider** — browser native (limited control) vs external service (privacy implications)?
7. **Page title** — render as h1 above block tree, or as a separate input outside the editor frame?
8. **Command palette scope** — current doc only / workspace-wide / both with toggle?

---

## 8. Card Plan

27 cards total. See VK epic "Block Editor Parity Pass" for the breakdown with per-card descriptions, dependencies, and assignments to specialized agents.
