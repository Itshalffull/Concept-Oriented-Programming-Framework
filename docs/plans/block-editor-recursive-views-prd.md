# PRD: Block Editor as Recursive Views

## Status: Draft
## Authors: 2026-04-12
## Depends on:
- Completed: ViewShell + FilterSpec + SortSpec + GroupSpec + ProjectionSpec + PresentationSpec + DataSourceSpec + ComponentMapping (all in place in clef-base)
- Completed: ActionBinding + ActionButton pipeline (MAG-605 era)
- Completed: Schema + DisplayMode + Outline + ContentNode + ContentCompiler (content-native foundation)
- Completed: RenderTransform + token-remap-provider + a11y-adapt-provider (surface contract theming, MAG-657)
- Completed: SurfaceContract + SurfaceLens + ThemeRealizer (MAG-660/661)
- Completed: Automation UI (MAG-670/682/691) — proves the plugin-composition + derived-concept pattern at scale
- Completed: MediaAsset + Clip + Region + AnnotationLayer + Transcript + FileManagement suite

---

## 1. Problem Statement

The current `BlockEditor.tsx` is a ~2,900-line monolith with:
- 16 hardcoded block types in a single switch
- Hardcoded slash-menu entries
- Inline marks (bold, italic, code) implemented as contentEditable behaviors, not theme-aware transforms
- No extension surface — adding a block type / mark / toolbar command / paste handler requires editing the monolith
- No plugin separation between content, commands, tools, input-time behavior, and decorations
- Media handling is bolted on rather than composed from the MediaAsset suite
- Formatting CSS is hardcoded rather than driven by theme tokens

At the same time, clef-base has almost every primitive needed to do this right:
- ViewShell + six sub-specs (filter/sort/group/projection/presentation/interaction + data source)
- ComponentMapping as a (Schema × DisplayMode) → widget registry
- ActionBinding as a concept-mediated button / command pipeline
- RenderTransform as a functorial transformation layer (marks, theme variants, a11y adaptations)
- SurfaceContract + SurfaceLens + ThemeRealizer for theme-aware styling
- MediaAsset suite for media as first-class content
- Template concept for parameterized content (snippets)
- SyncedContent + Reference + Backlink + InlineAnnotation + Attribution + Version for collaborative doc features

The block editor should **collapse into these primitives**, not duplicate them.

---

## 2. The Model

Five planes, one new concept, and the rest is existing primitives wired through a different host widget.

### 2.1 Content plane — blocks ARE views

A block is a `ViewShell` over the children of a parent `ContentNode`, rendered with presentation `"blocks"`. Each child is itself a block — a ViewShell over its own children. Recursion bottoms out at leaf blocks (paragraph, image, divider).

**Block type ≡ (Schema, DisplayMode) pair.** ComponentMapping already resolves that pair to a widget. "Register a block type" = add a ComponentMapping row. No new BlockType registry.

**Switching a block's children to any other presentation is free.** Change `PresentationSpec` from `"blocks"` to `"card-grid"` and that block's children render as a kanban column collection. To `"calendar"` → date-grouped events. To `"timeline"` → chronological. Filter/sort/group/project come from the normal ViewShell sub-specs.

**Marks are RenderTransforms.** Bold wraps a text run with `token-remap-provider` emitting `typography.weight.bold`. Italic → `typography.style.italic`. Code → `typography.family.mono` + `palette.surface.subtle` background. Link → `palette.accent.fg` + underline token. Theme-aware automatically.

**Embeds are ContentNode references rendered with a chosen DisplayMode.** An inline `@mention` or `[[link]]` is a ContentNode ref with display mode `inline-chip`. A view-embed is a ContentNode ref with display mode `embed-frame`. No new embed primitive.

### 2.2 Command plane — ActionBinding

Anything that isn't "insert content" is an ActionBinding:
- "Turn current block into callout" (transform current selection)
- "Delete block"
- "AI: continue writing" / "AI: summarize" (AgentSession/spawn with a persona)
- "Toggle bold" / "Toggle italic" (mark toggles)
- "Indent" / "Outdent"
- "Move to trash"
- "Duplicate block"
- "Copy as markdown"

Each is a seed in `ActionBinding.seeds.yaml`. ActionBinding tags determine where the command appears:
- `slash_command: true` — shows up in the slash menu's commands section
- `toolbar_command: true` — shows up in the inline selection toolbar
- `context_menu: true` — shows up in the right-click / block-handle menu
- `keyboard: "Ctrl+B"` — bound to a keyboard chord

AI commands are ActionBindings targeting `AgentSession/spawn` with a specific persona (leveraging MAG-707 persona flow).

### 2.3 Tool plane — widgets invoked via ActionBinding

Pickers, dialogs, side panels. Each is its own `.widget` invoked by an ActionBinding with picker semantics: open → user selects → binding receives result → inserts or mutates.

- `entity-picker.widget` — for `[[link]]` / `@mention`
- `date-picker.widget`
- `emoji-picker.widget`
- `media-picker.widget` — upload / drag-drop / URL-paste tabs for MediaAsset
- `math-formula-editor.widget` — LaTeX input
- `link-editor.widget` — URL + label
- `code-language-picker.widget`
- `embed-url-resolver.widget` — paste URL, preview, pick embed type
- `template-picker.widget` — browse templates, fill variables
- Side panels: `outline-panel.widget`, `backlinks-panel.widget`, `comments-panel.widget`, `ai-chat-panel.widget` — each registered to an editor-panel slot

Panels are registered via PluginRegistry with type `editor-panel`; the host's compose slot populates dynamically.

### 2.4 Input plane — one new concept: `InputRule`

The only genuinely new primitive. Unified extension point for all input-time behavior.

```
concept InputRule [R] {
  purpose {
    Declarative input-time pattern matching that dispatches to ActionBinding.
    Covers markdown shortcuts, trigger characters, paste handlers, and drop handlers
    through a single extension surface.
  }

  state {
    rules: set R
    kind: R -> String          // "pattern" | "trigger-char" | "paste" | "drop"
    pattern: R -> String       // regex for pattern/trigger; MIME for paste/drop
    action_ref: R -> String    // ActionBinding id to invoke with captures
    priority: R -> Int         // higher = tried first
    scope: R -> option String  // optional schema filter: only apply in blocks of this schema
  }

  actions {
    action register(rule: R, kind: String, pattern: String, action_ref: String, priority: Int, scope: option String)
    action match(kind: String, input: String, scope: option String) -> ok(rule: R, action_ref: String, captures: String) | no_match
    action unregister(rule: R)
  }
}
```

Examples:
- `kind: pattern, pattern: "^## ", action_ref: "markdown-heading-2"` — Markdown shortcut
- `kind: trigger-char, pattern: "@", action_ref: "entity-picker-open"` — @-mention trigger
- `kind: trigger-char, pattern: "[[", action_ref: "entity-picker-open"` — wiki-link trigger
- `kind: paste, pattern: "^image/*", action_ref: "media-upload-from-clipboard"` — paste-image
- `kind: paste, pattern: "^https?://(www\\.)?(youtube|vimeo)\\.", action_ref: "media-embed-from-url"` — paste-YouTube
- `kind: drop, pattern: "*/*", action_ref: "media-upload-from-drop"` — drag-drop any file
- `kind: trigger-char, pattern: ";", action_ref: "snippet-expand"` — snippet activation

Markdown shortcuts, autocomplete triggers, paste handlers, drop handlers, snippet activation — all one concept.

### 2.5 Snippets — reuse Template

Snippets are already expressible as the existing `Template` concept + a `trigger: String` field. Typing the trigger (via InputRule) opens a prompt for template variables, then `Template/expand` produces a block subtree that gets inserted. No new concept.

### 2.6 Per-content-type editor surfaces — `EditSurface`

The five planes above describe *kinds* of plugins. `EditSurface` is the mechanism that **activates the right plugins for the focused content**. It's the parallel of ComponentMapping for the edit axis.

Each content type (Schema, optionally per context like `block-editor` / `standalone` / `inspector`) registers an EditSurface that declares:
- Which ActionBinding commands are surfaced (command plane)
- Which side-inspector panels appear in the right rail (tool plane)
- Which floating toolbar widget shows over selections (command plane)
- Which context menu entries appear (command plane)
- Which InputRules are scoped to this surface (input plane)
- Which pickers are available for inline invocation (tool plane)

The editor host listens for focus changes. On focus:
1. Read focused node's schema.
2. Call `EditSurface/resolve(schema, context)` to get the bundle.
3. Rebind all five plane registries to the surface's refs — toolbar swaps, panels populate, context menu updates, scoped InputRules become active.

On blur: deactivate. Bundles don't bleed across types.

This is what makes snippets feel "type-aware" today (variable-fill + trigger-config appear when editing a Template). EditSurface generalizes that pattern to every content type:

- **Text block** → bold/italic/link toolbar, text-format side panel
- **Code block** → language picker + run button + syntax-error panel, format-on-save toggle in inspector
- **Image block** → crop / filter / alt-text / replace toolbar; image metadata in inspector; EXIF panel
- **Video block** → clip creator + transcript sidecar, annotation tools, keyboard shortcuts for play/pause
- **Math block** → LaTeX editor in inspector, formula preview, symbol picker
- **Table block** → row/column tools, cell-type picker, sort-by-column commands
- **Snippet (Template)** → variable-fill / trigger-config / preview (today's UX)
- **Entity embed** → entity picker, display mode switcher, reference metadata
- **View embed** → filter/sort/group editor panel (reuses existing ViewEditor)
- **Process-spec step** → reuses MAG-694 step-inspector tab strip as its EditSurface
- **Sync definition** → reuses MAG-690 User Sync Editor surface
- **Canvas node** → shape inspector, connector tools (parallel of FlowchartEditor's controls)
- **Form field** → reuses MAG-601 FormBuilder per-field config

Each surface composes plane-specific plugins. Adding a new content type = shipping its EditSurface seed alongside its schema + widget. No editor-host edits.

**Derived editors compose EditSurfaces.** `MarkdownEditor` composes text / heading / code / image / link / divider surfaces. `NotebookEditor` = MarkdownEditor + code-cell surface (with run button) + AI-chat surface. `WikiEditor` = MarkdownEditor + entity-embed surface (with `[[link]]` picker). Composition, not inheritance.

**Context orthogonality.** Same schema, different context, different surface. A `process-spec-step` focused inside FlowBuilderView activates the step-inspector tab strip. Focused inside a doc block, activates a thinner inline surface with a "Open in Builder" affordance + summary inspector. The `context` field lets a schema present differently depending on where it's embedded.

### 2.7 Structured content compilation — ContentCompiler integration

The block editor isn't just editing visual content. When a page has a Schema overlay (via `Schema/applyTo`), its block tree IS structured data that compiles into concept-specific output through `ContentCompiler`:

- `agent-persona` page → `PromptAssembly` (used by `AgentSession/spawn`)
- `meeting-notes` page → `CalendarEvent` (surfaced in calendar views)
- `workflow` page → `ProcessSpec` (executed by `ProcessRun`)
- `filter-draft` page → `FilterNode` (installed into a ViewShell)
- any future compilable schema → registered provider output via `PluginRegistry`

Per the existing `content-native-schema.sync` pattern (foundation/content-compiler.concept), edits auto-fire `ContentCompiler/markStale`. The block editor makes all of this **first-class, in-place** — not a separate "compile" view, but surfaced alongside normal editing through the EditSurface for each compilable schema.

EditSurface for a compilable schema declares four compilation-related plugin refs:

| Bundle field | What it provides |
|---|---|
| `compile_action_ref` | ActionBinding calling `ContentCompiler/compile` or `/recompile`. Rendered in the page-level toolbar slot. |
| `status_decoration_ref` | Decoration widget rendering compile status badge (`compiled` / `stale` / `invalid` / `never-compiled`) with `lastCompiledAt`. Reads ContentCompiler state for the page. |
| `output_preview_ref` | Right-rail panel widget rendering the compiled output in a schema-specific way. PromptAssembly → role-sectioned text preview; CalendarEvent → mini event card; ProcessSpec → FlowchartEditor preview (reuses MAG-689); FilterNode → filter-pill preview. |
| `consumers_panel_ref` | Backlinks panel showing downstream consumers (AgentSessions using this persona, ProcessRuns of this spec, calendars rendering this event). Reuses Reference + Backlink. |

**What the user sees** on a page with schema `agent-persona`:
- Normal block editor body (paragraph / heading / callout / code blocks forming the prompt)
- Page header: status badge "Compiled 2m ago — stale" + "Recompile" button
- Right rail panel: "Compiled PromptAssembly" preview with role sections, tool list, temperature settings
- Right rail panel below: "Used by 3 AgentSessions" (live consumers, click → navigate)
- Edit a block → auto-stale-mark fires → badge flips to stale → Recompile button activates

Page-level compile surface + inline block surfaces coexist. Focus a paragraph inside the persona page and the text-format toolbar appears inline; the page-level compile surface stays mounted in the header and right rail.

**Derived editors for compilable schemas** compose the compile surface with the content surfaces:
- `MarkdownEditor` — plain content, no compile surface
- `PersonaEditor [T]` — MarkdownEditor + `agent-persona` compile surface + PromptAssembly preview + AgentSession backlinks
- `MeetingNotesEditor [T]` — MarkdownEditor + `meeting-notes` compile surface + CalendarEvent preview
- `WorkflowEditor [T]` — **MAG-689 FlowBuilderView IS this.** ProcessSpec page + graph-view preview (= compiled output) + ProcessRun backlinks (= consumers). MAG-689 is retroactively an instance of this exact pattern — the PRD here describes the general shape that MAG-689 built one specialization of.
- `FilterDraftEditor [T]` — block editor + `filter-draft` compile surface + filter-pill preview + ViewShell backlinks

**What this unlocks for free** via composition of existing concepts:

- **Compilation history + diff.** `ContentCompiler.listByPage` returns historical compilations; the preview panel renders "added 2 tools, changed temperature since previous compile" via the existing Diff concept.
- **"Compile all" operations.** `ContentCompiler.listBySchema("agent-persona")` backs a ViewShell with compilations as rows + bulk-recompile ActionBinding. Zero new concepts.
- **Consumer impact warnings.** Editing a persona's prompt block → "3 live AgentSessions will pick up the change on next spawn." Derived from Reference + ContentCompiler state.
- **Pre-compile validation.** An ActionBinding that inspects the block tree for required schema fields; gaps shown inline in the status badge. Handler-side, no new concept.
- **Cross-schema nesting.** A meeting-notes page embeds a workflow diagram (via SyncedContent) — compiling the meeting notes surfaces the embedded workflow's own compilation metadata, doesn't re-compile. The provider sees the embed as a reference.
- **Stale-cascade through SyncedContent.** Edit a shared persona-snippet transcluded across 5 persona pages → all 5 compilations mark stale automatically. Already wired via the existing content-native syncs.

### 2.8 Decoration layer — fixed slots reading existing state

Overlays / ephemeral UI that isn't content: selection toolbar, hover cards, presence indicators, comment gutters, track-changes highlights. Each is a fixed slot on the editor host, rendering from existing state concepts:
- Selection toolbar reads selection state + queries `toolbar_command` ActionBindings
- Presence indicators read from Replica peer state
- Comment ranges read from a Comment concept (composed via SyncedContent + InlineAnnotation pattern)
- Track-changes highlights read from `InlineAnnotation` (already exists)
- Hover cards read from Reference metadata for [[links]] / @mentions

Not plugins. Just compose slots with well-known roles.

---

## 3. Media Integration

Media isn't a special case — it's the hardest proof point for the architecture. If the same pattern handles both structured text and binary assets, the abstraction is right.

- **MediaAsset = ContentNode with schema `media-asset`.** ComponentMapping rows give display variants: `thumbnail`, `inline-media`, `full-bleed`, `gallery-card`, `lightbox`.
- **Gallery = blocks with `card-grid` presentation over media-asset children.** Free filter/sort/group.
- **Clips (time-slices) as children of a video asset = timeline view** by switching PresentationSpec.
- **Paste image / drop file / paste YouTube URL = InputRule seeds** dispatching to upload or embed ActionBindings.
- **Upload picker = `media-picker.widget` in the tool plane.**
- **Annotations (AnnotationLayer + Region) = decoration layer** rendering region overlays on the media widget.
- **Transcript = separate ContentNode** viewable as its own block tree, as a sidecar panel, or as subtitle decorations.
- **Image filters (existing `image-filter.concept`) = RenderTransforms** declared per theme, applied automatically at render.

Phase 1 ships image as one of the first three migrated block types (alongside paragraph + heading) to validate the pattern across modalities.

---

## 4. Theme Integration

Every bit of visual formatting flows through theme tokens, not CSS literals.

- **Marks emit token references** via `token-remap-provider`. Swap theme → bold/italic/code/links restyle automatically.
- **Theme-aware schemas** declare `paletteRole: "info" | "warning" | "danger" | "success" | "accent"`. The widget resolves the role to the active theme's palette at render. Works across light / dark / high-contrast / editorial / signal themes with zero code change.
- **SurfaceContract + SurfaceLens + ThemeRealizer** (MAG-657 epic) handles the cross-platform case. Each block widget declares a surface contract with semantic slots; each theme supplies a lens. Realizer compiles to CSS / SwiftUI / XAML variants automatically.
- **Density variants** (compact/comfortable/spacious) and **a11y adaptations** (`a11y-adapt-provider`) apply to blocks via the same pipeline already in place for forms and data tables.
- **Motion tokens** drive block animations — collapse/expand uses `motion.duration.short` + `motion.easing.collapse` with automatic `prefers-reduced-motion` fallback.
- **Image filters** (existing `image-filter.concept`) attach per-theme via the RenderTransform registry. Editorial theme → subtle desaturation; signal theme → saturated. Images re-tint on theme swap.

---

## 5. Architecture

### 5.1 Concepts (new + reused)

**New:**
- `InputRule` — unified input-plane plugin surface (§2.4)
- `EditSurface` — per-content-type editor bundle activated on focus (§2.6). The plural of "snippets have their own UI" — every content type does. Also carries optional compilation bundle fields (§2.7) so compilable schemas expose compile/status/preview/consumers surfaces in-place.

**Reused, unchanged:**
- `ViewShell`, `FilterSpec`, `SortSpec`, `GroupSpec`, `ProjectionSpec`, `PresentationSpec`, `DataSourceSpec`, `InteractionSpec` — view configuration
- `ComponentMapping` — block-type registry (with new `insertable` + `block-editor-context` metadata)
- `Schema`, `DisplayMode`, `Outline`, `ContentNode`, `ContentCompiler` — content primitives
- `ActionBinding` — command plane (with new `slash_command` / `toolbar_command` / `context_menu` metadata)
- `RenderTransform` + providers — marks, theme variants, a11y
- `SurfaceContract` + `SurfaceLens` + `ThemeRealizer` — cross-platform theming
- `MediaAsset`, `Clip`, `Region`, `AnnotationLayer`, `Transcript` — media primitives
- `Template` (with new `trigger: String` metadata) — snippets
- `Reference`, `Backlink`, `SyncedContent`, `InlineAnnotation`, `Attribution`, `Version`, `Patch` — collaborative doc features (all free)
- `ContentCompiler` — schema-overlaid page → concept-specific output. EditSurface for compilable schemas declares compile/status/preview/consumers bundle fields (§2.7). Existing `content-native-schema.sync` pattern auto-marks stale on edit.

**Metadata additions (no concept change, just seed fields):**
- `ComponentMapping.insertable: Bool` — should slash menu offer this mapping as a new-block option
- `ComponentMapping.block_editor_context: List String` — in which editor flavors (e.g. `["markdown", "wiki", "notebook"]`)
- `ActionBinding.slash_command: Bool`
- `ActionBinding.toolbar_command: Bool`
- `ActionBinding.context_menu: Bool`
- `ActionBinding.keyboard: option String`
- `ActionBinding.section: option String` — grouping in slash menu ("Basic" / "Media" / "Embeds" / "AI" / "Transform")
- `Template.trigger: option String` — snippet activation keyword
- `Template.trigger_kind: option String` — `"prefix"` | `"slash"` | `"keyword"`

### 5.2 PresentationSpec additions

- `blocks` — renders children as a block tree (recursive ViewShell mounting)
- `inline` — renders children as an inline run (for mark composition)

### 5.3 DataSourceSpec addition

- `outline-children` — resolves to children of a specified parent ContentNode, ordered by Outline position

### 5.4 Surface widgets

**New host widgets:**
- `block-editor.widget` — the recursive ViewShell host; has compose slots for content / slashMenu / inlineToolbar / sidePanels / decorationLayer
- `block-slot.widget` — generic block renderer that resolves (Schema, DisplayMode) → widget via ComponentMapping
- `inline-toolbar.widget` — mark toolbar host, populated from `toolbar_command` ActionBindings
- `slash-menu.widget` — slash host, populated from `insertable` ComponentMappings + `slash_command` ActionBindings, grouped by `section`
- `context-menu.widget` — right-click / block-handle menu host
- `media-picker.widget` — upload / drag-drop / URL-paste tabbed picker

**New block-type widgets** (one per migrated type):
- `paragraph-block.widget`
- `heading-block.widget` (h1-h6 variants via prop)
- `image-block.widget` — bound to `(media-asset, inline-media)` mapping
- `bullet-list-block.widget`
- `numbered-list-block.widget`
- `quote-block.widget`
- `divider-block.widget`
- `code-block.widget`
- `callout-block.widget` — uses `paletteRole` for theming
- `table-block.widget`
- `toggle-block.widget` — collapsible
- `view-embed-block.widget` — embeds a ViewShell as a block
- `entity-embed-block.widget` — embeds another ContentNode

**New side-panel widgets** (registered as editor-panel plugins):
- `outline-panel.widget`
- `backlinks-panel.widget`
- `comments-panel.widget`
- `ai-chat-panel.widget`

### 5.5 Syncs

- `RegisterInsertableBlockType` — on `ComponentMapping/register` with `insertable: true`, add to slash-menu registry
- `RegisterSlashCommand` — on `ActionBinding/register` with `slash_command: true`, add to slash-menu command section
- `RegisterToolbarCommand` — on `ActionBinding/register` with `toolbar_command: true`, add to inline toolbar
- `RegisterContextMenu` — on `ActionBinding/register` with `context_menu: true`, add to context menu
- `RegisterEditorPanel` — on widget registration with type `editor-panel`, add to side-panel registry
- `DispatchInputRule` — on editor input/paste/drop events, call `InputRule/match` and dispatch to bound ActionBinding
- `RegisterSnippet` — on `Template/create` with `trigger` set, register an InputRule
- `MediaUploadFromClipboard` — paste-image InputRule dispatch
- `MediaUploadFromDrop` — drop-file InputRule dispatch
- `MediaEmbedFromURL` — paste-URL InputRule dispatch

### 5.6 Derived editor concepts

Compose a specific plugin set into a named editor flavor. Same pattern as `FlowchartEditor.derived`.

```
specs/editors/
  markdown-editor.derived     # Outline + text block types + markdown input rules + markdown serializer
  wiki-editor.derived         # Markdown + entity-embed + [[link]] mark + wikilink paste handler
  notebook-editor.derived     # Markdown + code-cell block + AI commands + execution toolbar
  form-builder-editor.derived # Outline + form-field block types (not text blocks)
  media-library.derived       # ALREADY EXISTS in media suite — gets recursive-view treatment
```

### 5.7 Clef-base integration

- `BlockEditor.tsx` is incrementally replaced by `RecursiveBlockEditor.tsx` — a thin host that uses `useKernelInvoke` to read block-type registry and dynamically mount `block-slot.widget` per block
- Legacy `BlockEditor.tsx` stays as the fallback path during migration; a feature flag or per-doc schema hint picks which editor mounts
- Existing `EntityDetailView` keeps its current block editor mount but adds a switch to the recursive version for migrated schemas
- New route `/editors/:flavor/:nodeId` mounts a specific derived editor (MarkdownEditor / WikiEditor / NotebookEditor)
- `AppShell` adds panel docks for outline / backlinks / comments / AI chat, populated from the editor-panel registry

---

## 6. Migration Strategy

No big-bang rewrite. The legacy monolith shrinks as plugins register.

### Phase 1 — Proof of pattern

Minimal end-to-end proof across text + media + marks + theme.

**Ships:**
- `InputRule` concept + handler + conformance tests
- `blocks` PresentationSpec type + renderer
- `outline-children` DataSourceSpec type + resolver
- Metadata additions to ComponentMapping + ActionBinding + Template (seed schema changes)
- `block-editor.widget` + `block-slot.widget` + `slash-menu.widget` + `inline-toolbar.widget` host widget specs
- Three block types migrated: **paragraph** + **heading** + **image** (the latter proves media integration)
- Three block-level EditSurfaces: paragraph (text-format toolbar + format panel), heading (level picker + anchor-link panel), image (crop/filter/alt-text toolbar + EXIF inspector panel). Proves activation-on-focus across text + media.
- **One page-level compilable-schema EditSurface: `agent-persona`.** Declares all four compile bundle fields (compile_action_ref, status_decoration_ref, output_preview_ref, consumers_panel_ref). Proves the ContentCompiler integration end-to-end: editing a persona page in the block editor, seeing compile status in the header, PromptAssembly preview in the right rail, AgentSession backlinks below. Stale-on-edit cascades via existing content-native-schema sync.
- Three marks as RenderTransforms: **bold** + **italic** + **code**
- One theme-aware block: **callout** with `paletteRole` proving the SurfaceContract integration
- Two InputRules: markdown `##` → heading, paste `image/*` → media upload
- One ActionBinding command: "AI: continue writing" (proves AgentSession integration)
- `media-picker.widget` (upload + URL tabs)
- `RecursiveBlockEditor.tsx` React adapter — thin host mounting block-slot per child
- Two derived editors: `markdown-editor.derived` (paragraph/heading/image + marks + text InputRules); `persona-editor.derived` composing MarkdownEditor + the agent-persona compile surface. PersonaEditor proves the derived-editor composition pattern for compilable schemas — the same shape that MAG-689 FlowBuilderView already demonstrates works for ProcessSpec.
- A feature flag in clef-base selecting between legacy and recursive editor per ContentNode

**Acceptance:**
- Open a ContentNode in the recursive editor; edit paragraph / heading / image inline
- Type `##` at line start → block schema changes to heading-2
- Paste an image from clipboard → uploads via MediaAsset/createMedia, inserts image block
- Select text → inline toolbar shows bold/italic/code buttons → toggle works via mark RenderTransforms
- Callout block renders with correct palette across all 5 themes (light / dark / high-contrast / editorial / signal) with zero widget code change
- Slash menu opens on `/`, shows Basic (paragraph/heading) + Media (image) + AI (continue) sections from registries
- Switch a block's children PresentationSpec from `blocks` to `card-grid` via ViewShell override → children render as cards, same data, free filter/sort
- Open an `agent-persona` ContentNode in PersonaEditor → edit a prompt block → status badge flips from "compiled" to "stale" → click Recompile → PromptAssembly preview refreshes in right rail → AgentSession backlinks panel shows live consumers. End-to-end compile loop works through the same block editor used for plain content.

### Phase 2 — Complete text + marks

- Block types: bullet-list, numbered-list, quote, divider, code-block, toggle
- Marks: link (with link-editor picker), strikethrough, subscript, superscript
- Mark toolbars: selection toolbar, keyboard chords (Ctrl+B/I/U/E/K)
- InputRules: `- ` → bullet, `1. ` → numbered, `> ` → quote, ``` → code fence, `---` → divider, `[[` → entity picker trigger, `@` → entity picker trigger, `:` → emoji picker trigger
- Entity embed block + [[link]] mark
- View embed block (embeds a ViewShell as a block)

### Phase 3 — Structural blocks + collaboration

- Table block with row/column operations
- Columns / split-layout blocks
- Synced content blocks (transclude another block's content)
- Comment ranges (InlineAnnotation integration)
- Track changes (InlineAnnotation + Attribution)
- Side panels: outline, backlinks, comments (panel reuses existing Comment concept + new listByEntity action)
- Comments displayed via 3 surfaces: gutter marker (decoration), inline span underline (RenderTransform keyed by InlineAnnotation.kind — serves comments / AI suggestions / track-changes / spell-check uniformly), comments panel (editor-panel plugin). Activated per schema via `isCommentable` / `commentScope` / `commentGutterPosition` Property seeds. No new Comment concept work — the existing concept is already polymorphic + threaded.
- Real-time presence indicators (Replica + CausalClock)

### Phase 4 — Specialized editors

- `wiki-editor.derived` — markdown + wiki features
- `notebook-editor.derived` — code cells + AI tools + execution
- `form-builder-editor.derived` — repositioned FormBuilder on the block editor pattern
- AI chat side panel
- Template picker + snippet activation via `;trigger`

### Phase 5 — Media suite expansion

- Video block with Clip timeline view
- Audio block with Transcript sidecar
- Annotation tools (Region + AnnotationLayer overlays)
- Image filter picker (per-theme + per-image overrides)
- Media library view at `/media` with `MediaLibrary.derived`

### Phase 6 — Retire legacy

- Migrate remaining legacy block types one at a time
- Delete `BlockEditor.tsx` when coverage = 100%
- Remove feature flag; recursive editor becomes default

---

## 7. Success Criteria

1. **A new block type adds with one ComponentMapping row + one widget.** No edits to the editor host.
2. **A new slash command adds with one ActionBinding seed.** No edits to the slash menu widget.
3. **A new markdown shortcut adds with one InputRule seed.** No edits to the editor input handling.
4. **A new theme restyles all blocks automatically.** Zero widget changes when adding a 6th theme.
5. **Media and text share the same editor path.** `image` block and `paragraph` block both go through `block-slot.widget` → ComponentMapping resolution.
6. **A block's children can render as any ViewShell presentation.** Switch `blocks` → `card-grid` and the same child data becomes a gallery; no recursion hacks.
7. **All five UX research patterns inherited from MAG-670 carry through**: progressive disclosure (marks hidden until selection), live sample data (preview blocks with real theme tokens), first-class error paths (failed uploads visible, not hidden), universal replay (paste-URL resolver offers retry), governance-aware (per-schema visibility carries through MAG-688 pattern).
8. **Legacy editor works unchanged during migration.** Feature flag, not big-bang. Ship Phase 1 value without a rewrite.

---

## 8. Non-goals

- Delete the legacy `BlockEditor.tsx` in Phase 1 (see Phase 6)
- Real-time collaboration protocols (that's CausalClock + Replica territory; comes free when wired but not a Phase 1 deliverable)
- Custom block framework for third-party bundled plugins (plugins are seeds in this codebase; external plugin packaging is future work)
- Change any existing concept API in a breaking way (all changes are additive metadata fields)
- Ship new themes as part of this work (the existing 5 themes validate the theme-aware pattern)

---

## 9. Open Questions

### 9.1 Resolved (2026-04-12, pre-Phase-1)

1. **EditSurface `context` vocabulary — ENUM, not open string.** Initial closed set: `block-editor` | `standalone` | `inspector` | `canvas` | `preview-only` | `page-level`. `EditSurface/register` validates against this set and rejects unknown values. Adding a new context requires a concept migration + seed update. Open string was too permissive and would fragment the registry.

2. **Surface nesting semantics — page-level mounts always; inline surfaces stack innermost-wins.** When focus lands three-deep (e.g. paragraph inside view-embed inside persona page):
   - The `page-level` surface (outermost activating, keyed by page's schema) always mounts header toolbar + right-rail panels
   - The `block-editor` surface for the innermost focused block provides selection toolbar + context menu + scoped InputRules
   - Intermediate surfaces don't mount unless their context also matches (e.g. view-embed inside persona contributes no UI unless we invent an `inspector`-context surface for it)
   - Slots of the same kind don't merge — the innermost context scope wins; the outermost page-level scope keeps header and right rail
   - `EditSurface.context` field is the disambiguator

3. **Feature-flag granularity — per-user-session + global schema-allowlist.** Flag stored in user preferences (`user.preferBlockEditorFlavor: "legacy" | "recursive"`). Global schema allowlist gates which schemas are eligible (starts minimal, grows as block types migrate). Users can opt in to recursive for any allowlisted schema; collaborative editing unaffected because content state is identical regardless of which editor renders it. No per-ContentNode flag — too fragile.

4. **Compiled-output preview refresh — kernel observation subscription.** The `output_preview_ref` widget subscribes to `ContentCompiler` state for its page id via kernel observation. `ContentCompiler/markStale` or `/recompile` completion fires → subscription fires a render. No polling, no explicit refetch ActionBinding. Same pattern as other data-driven widgets in clef-base.

5. **InputRule conflict resolution — higher priority wins; ties broken by longest-pattern-wins.** Documented in `InputRule/match` semantics. Seed authors set `priority: Int` explicitly when collision is possible; rules within the same priority tier tiebreak on regex length. Registry warning logged if two rules have identical priority + pattern.

6. **Paste-handler conflict — priority + MIME-specificity tiebreaker.** Paste `image/*` + `https?://.*youtube\\..*` on the same content → specific MIME / URL pattern wins over generic fallback. Tiebreaker: longer pattern + explicit scope filter wins. Seed guidance doc added as part of P1.12.

7. **Snippet trigger scope — default off in `literal`-tagged schemas.** Any schema with Property `literal: true` (code-block, math-block, raw-html-block) disables InputRule trigger expansion within its content range. Other schemas default to on. Per-rule `scope` field overrides.

8. **`isCommentable` + related Schema Properties.** Three new Property keys on Schema for comment display control:
   - `isCommentable: Bool` (default false) — block-level comments allowed
   - `commentScope: "block" | "inline" | "both"` (default `"block"` when `isCommentable`) — whether selecting text enables span-commenting via InlineAnnotation
   - `commentGutterPosition: "left" | "right" | "hidden"` (default `"right"`) — per-schema override for the gutter marker
   Seeds on paragraph / heading / quote / callout / image schemas in Phase 3.

9. **Comment concept — add `listByEntity` read action.** Additive, non-breaking. Returns all comments attached to a given entity id preserving `threadPath` order for direct tree render. Powers the block gutter marker, inline span underline lookup, and comments-panel. Part of the Phase 3 card set.

### 9.2 Deferred to implementation time

10. **Compose-time vs. render-time registry resolution.** Does the editor read ComponentMapping once at mount and cache, or per-block render? Per-block is simpler; cache is faster. Start simple, profile later. Affects "add a new block type without refresh" UX — acceptable to require refresh in Phase 1.

11. **Per-block FSM isolation.** If every block is its own widget with its own FSM, 100-block docs spawn 100 machines. The diagram suite has the same problem with 100-node canvases — audit `canvas.handler.ts` at Phase 1 implementation time and reuse its pooling / lazy-spawn strategy.

12. **Inline mark rendering performance.** RenderTransforms composing per-character for a long paragraph could be expensive. May need a fast-path that collapses contiguous same-mark runs. Not a Phase 1 concern until a 10k-character block exists.

13. **Decoration layer performance under heavy load.** Comments + track-changes + presence + AI suggestions on a 1000-block doc with 500 annotations. Virtual-scroll-aware decoration dispatch. Deferred to Phase 3 when comments ship.

14. **Collaborative block reordering.** Is Outline's current model sufficient for concurrent block drag-drop under Replica + CausalClock, or do we need a sequence CRDT (fractional-indexing or RGA)? Audit at Phase 3.

15. **View-embed lazy loading.** A doc embedding a 1000-row ViewShell — eager, paginated, or virtualized? Parallel to the N+1 display-mode resolve bug in ViewRenderer. Address when P2.07 starts.

16. **AI slash-command context size.** "Continue writing" — pass full doc, current block, last N tokens? Persona-level config (PromptAssembly defines context assembly rules). Default-persona convention in P1.13; per-persona overrides later.

17. **Transcluded content surface ownership.** Same ContentNode embedded in two parent pages via SyncedContent — focusing the content from each parent: whose page-level EditSurface wins? Rule: the **host** page's surface wins, not the content's home context. The content is being read from the host.

18. **Migration permanence risk.** If Phase 5 ends with some block type unable to clear the recursive-editor bar, Phase 6 stays open rather than the monolith returning to default. Call it explicitly: legacy BlockEditor.tsx is deletable only when 100% schema coverage, otherwise the flag stays.

---

## 10.1 Phase 1 Commit Log

| Card | Title | Status | Commit | Tests/Invariants |
|---|---|---|---|---|
| MAG-722 | InputRule concept | Done | `bb02b0e2` | 42 tests |
| MAG-723 | EditSurface concept | Done | `ddf357ca` | 57 tests |
| MAG-724 | blocks/outline-children | Done | `f30b5777` | 80 tests |
| MAG-725 | Metadata additions | Done | `73104f25` | 183 tests |
| MAG-713 | block-editor host widget | Done | `dc6d5f46` | 27 invariants |
| MAG-719 | callout-block widget | Done | `19c4d7e6` | 23 invariants |
| MAG-721 | AI continue ActionBinding + persona | Done | `3e79c85c` | 124 seed tests |
| MAG-720 | markdown-editor.derived | Done | `06c13bb7` | parser OK |
| MAG-720b | InputRule seeds + paste-image sync | Done | `1a7676d4` | 42 tests |
| MAG-714 | block-slot + slash/toolbar/context menus | Done | `98fa0d2d` | 55 invariants |
| MAG-715 | paragraph-block widget + seeds | Done | `2908ebdf` | 19 invariants |
| MAG-716 | heading-block widget + seeds | Done | `251c59d1` | 21 invariants |
| MAG-717 | image-block + media-picker + seeds | Done | `cd47ce57` | 31 invariants |
| MAG-718 | bold/italic/code mark RenderTransforms | Done | `eaebdff7` | 3 syncs |
| MAG-723 | persona-editor.derived + compile EditSurface + 3 widgets | Done | `202db185` | 43 invariants |
| MAG-724 | RecursiveBlockEditor React + feature flag | Done | `7527e2c6` | partial acceptance (4 gaps flagged) |

**Phase 1 complete (2026-04-12) — 16/16 cards shipped.** Callout theming and slash-menu registry queries work fully; four acceptance items remain partial pending backing-handler work (InlineMark concept, MediaAsset context threading, ContentNode/clone, paragraph-block FSM handler wiring). These become Phase 2 scope.

**Concept API gaps noted (follow-up cards needed):**
- `Outline` has no block-schema-change action — markdown-heading-2 ActionBinding uses `Schema/applyTo` as proxy (should be `Outline/retype` or similar)
- `MediaAsset/createMedia` doesn't thread `focusedDocId` through — paste-image-to-block sync has placeholder parent binding
- No `InlineMark` concept exists for toggling marks on a selection range — bold/italic/code ActionBindings reference placeholder `InlineMark/toggleMark`. Follow-up card needed to introduce `InlineMark [M]` with `toggleMark(blockId, range, markKind)` action.

## 10. Card Plan (Phase 1 only; Phase 2+ carded after Phase 1 ships)

See VK cards under epic "Block Editor — Recursive Views (Phase 1)" for the card breakdown.

Phase 1 card count: ~14-16 cards. Dispatching workflow: same as MAG-670 / MAG-691 — specialized agents (concept-scaffold-gen, handler-scaffold-gen, surface-component-scaffold-gen, sync-scaffold-gen, clef-base) per card, parse-verify before commit, commit per card.

---

## Appendix A: Plane mapping cheat-sheet

| Plane | Extension mechanism | Example |
|---|---|---|
| Content | ComponentMapping row | "Add a recipe block type" |
| Command | ActionBinding seed | "Add AI: translate command" |
| Tool | Widget + ActionBinding | "Add GIF picker" |
| Input | InputRule seed | "Add `--- ` → divider shortcut" |
| Snippet | Template with `trigger` | "Add `;sig` → email signature" |
| Decoration | Fixed host slot reading existing state | "Add AI suggestion decoration" |
| Theme | RenderTransform + SurfaceContract | "Add muted block variant" |
| Per-type editor surface | EditSurface seed | "Add image block inspector panel with EXIF + crop/filter toolbar" |
| Compilable-schema surface | EditSurface seed with compile bundle fields + ContentCompiler provider | "Add a `meeting-notes` compile surface: compile button + CalendarEvent preview + calendar backlinks" |

## Appendix B: Companion docs

- `docs/plans/automation-ui-prd.md` — MAG-670 flow builder (model for derived editor composition)
- `docs/plans/automation-operational-surfaces-prd.md` — MAG-691 operational UI (model for plugin-registry-driven menus)
- `docs/plans/surface-contract-theming-prd.md` — MAG-657 theming substrate
- `clef-base/docs/usability-audit.md` — source of the block-editor P1 requirements (formatting toolbar, markdown shortcuts, table blocks, @mentions)
- `repertoire/concepts/media/suite.yaml` — media suite the block editor composes
- `repertoire/concepts/diagramming/suite.yaml` — architectural model for plugin composition + derived-concept editor flavors
