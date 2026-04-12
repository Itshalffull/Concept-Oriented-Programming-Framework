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

### 2.7 Decoration layer — fixed slots reading existing state

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
- `EditSurface` — per-content-type editor bundle activated on focus (§2.6). The plural of "snippets have their own UI" — every content type does

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
- Three EditSurfaces registered: paragraph (text-format toolbar + format panel), heading (level picker + anchor-link panel), image (crop/filter/alt-text toolbar + EXIF inspector panel). Proves activation-on-focus across text + media.
- Three marks as RenderTransforms: **bold** + **italic** + **code**
- One theme-aware block: **callout** with `paletteRole` proving the SurfaceContract integration
- Two InputRules: markdown `##` → heading, paste `image/*` → media upload
- One ActionBinding command: "AI: continue writing" (proves AgentSession integration)
- `media-picker.widget` (upload + URL tabs)
- `RecursiveBlockEditor.tsx` React adapter — thin host mounting block-slot per child
- One derived editor: `markdown-editor.derived` composing the above
- A feature flag in clef-base selecting between legacy and recursive editor per ContentNode

**Acceptance:**
- Open a ContentNode in the recursive editor; edit paragraph / heading / image inline
- Type `##` at line start → block schema changes to heading-2
- Paste an image from clipboard → uploads via MediaAsset/createMedia, inserts image block
- Select text → inline toolbar shows bold/italic/code buttons → toggle works via mark RenderTransforms
- Callout block renders with correct palette across all 5 themes (light / dark / high-contrast / editorial / signal) with zero widget code change
- Slash menu opens on `/`, shows Basic (paragraph/heading) + Media (image) + AI (continue) sections from registries
- Switch a block's children PresentationSpec from `blocks` to `card-grid` via ViewShell override → children render as cards, same data, free filter/sort

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
- Side panels: outline, backlinks, comments
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

1. **InputRule conflict resolution.** Two rules match the same input (e.g. both `##` and `###`). Priority + first-match-wins is simple but may need "longest pattern wins" or user-configurable ordering for some cases.
2. **Compose-time vs. render-time registry resolution.** Does the editor read ComponentMapping once at mount and cache, or per-block render? Per-block is simpler; cache is faster. Start simple, profile later.
3. **Per-block FSM isolation.** If every block is its own widget with its own FSM, 100-block docs spawn 100 machines. The diagram suite has the same problem with 100-node canvases — check how Canvas handles it and reuse.
4. **Inline mark rendering performance.** RenderTransforms composing per-character for a long paragraph could be expensive. May need a fast-path that collapses contiguous same-mark runs.
5. **Paste-handler conflict.** Paste an image-URL: is it `media-embed-from-url` (YouTube-style preview) or `media-upload-from-clipboard` (download + rehost)? Priority field handles it but seed authors need clear guidance.
6. **Snippet trigger scope.** Do snippet triggers work inside code blocks? Probably not — InputRule's `scope` field lets us gate per schema, but default behavior needs deciding.

---

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

## Appendix B: Companion docs

- `docs/plans/automation-ui-prd.md` — MAG-670 flow builder (model for derived editor composition)
- `docs/plans/automation-operational-surfaces-prd.md` — MAG-691 operational UI (model for plugin-registry-driven menus)
- `docs/plans/surface-contract-theming-prd.md` — MAG-657 theming substrate
- `clef-base/docs/usability-audit.md` — source of the block-editor P1 requirements (formatting toolbar, markdown shortcuts, table blocks, @mentions)
- `repertoire/concepts/media/suite.yaml` — media suite the block editor composes
- `repertoire/concepts/diagramming/suite.yaml` — architectural model for plugin composition + derived-concept editor flavors
