# Block Editor Migration Guide

**Audience:** Clef Base contributors adding new block types, slash commands, or markdown shortcuts, or building new compilable derived editors.

**Status: Monolith deleted (2026-04-13).** All 25 Block Editor Parity Pass cards (MAG-767 waves 1–3) shipped. `BlockEditor.tsx` is gone. `RecursiveBlockEditor` is the sole editor. The §5 gaps listed below are resolved — see individual gap notes for the closing card reference.

---

## 1. Overview

The block editor has been refactored from a ~2,900-line monolith (`BlockEditor.tsx`) into a recursive `ViewShell` over content primitives. Each block is a `ViewShell` with `PresentationSpec = "blocks"` over the children of a `ContentNode`, resolved by `ComponentMapping` to a widget keyed on `(schema, display_mode)`. Blocks are content. There is no separate block-type registry — there is only the content pool.

### Legacy feature flag (removed)

The `preferBlockEditorFlavor` user preference key and `clef-base/config/recursive-editor-allowlist.yaml` were deleted in PP-delete-legacy (2026-04-13). `RecursiveBlockEditor` now mounts unconditionally for all schemas. The per-schema allowlist and opt-back toggle UI are gone.

### The five planes

| Plane | Extension mechanism |
|---|---|
| Content | `ComponentMapping` row (schema x display_mode → widget) |
| Command | `ActionBinding` seed (`slash_command`, `toolbar_command`, `keyboard`) |
| Tool | Widget spec + `ActionBinding` with picker semantics |
| Input | `InputRule` seed (pattern / trigger-char / paste / drop) |
| Snippet | `Template` with `trigger` field + InputRule |

### 23 schemas migrated

The following schemas are in `clef-base/config/recursive-editor-allowlist.yaml` and will mount `RecursiveBlockEditor` when the user's `preferBlockEditorFlavor` is `"recursive"`:

`paragraph`, `heading`, `bullet-list`, `numbered-list`, `quote`, `divider`, `toggle`, `code`, `callout`, `table`, `columns`, `view-embed`, `entity-embed`, `block-embed`, `snippet-embed`, `synced-content`, `code-cell`, `control`, `image`, `media-asset`, `video`, `video-asset`, `audio`, `audio-asset`, `math`, `agent-persona`

(23 schema types at the time of this writing; count may advance as Phase 2–5 cards land.)

### Feature flag

The user preference key `preferBlockEditorFlavor` has two legal values:

- `"recursive"` — mount `RecursiveBlockEditor` when the document's primary schema is in the allowlist
- `"legacy"` — always mount `BlockEditor.tsx`

**Both conditions must be satisfied for the recursive editor to mount:** the preference must be `"recursive"` AND the schema must be in the allowlist. If either check fails, `BlockEditor.tsx` mounts as fallback.

The default for new user sessions is `"recursive"`. A per-user toggle in the workspace settings panel lets any user revert to `"legacy"` without data loss — the content state is identical regardless of which editor renders it.

### When does `BlockEditor.tsx` mount as fallback?

- The user's preference is `"legacy"` (opt-back)
- The document's primary schema is not in the allowlist (future schemas default to legacy until explicitly added)
- The schema is in a known-gap path listed in §5 (no automatic mount bypass here — the editor mounts but degrades gracefully with console warnings)

**Do not delete `BlockEditor.tsx`.** Deletion is Phase 6 work and is explicitly blocked until every gap in §5 is closed and the allowlist covers 100% of schemas. See §5 for the exact gaps and their tracking cards.

---

## 2. How to Add a New Block Type

Adding a new block type requires five artifacts in sequence. The kernel must be restarted after seeding — registry reads are cached at mount time in Phase 1 per PRD §9.2 resolution #10.

### Step 1: Define the schema (if not already seeded)

Check `clef-base/seeds/Schema.seeds.yaml` and `clef-base/seeds/Schema.membership-*.seeds.yaml`. If the schema does not exist, add an entry under `Schema/defineSchema`:

```yaml
concept: Schema
action: defineSchema
entries:
  - id: my-block
    name: my-block
    fields: "content,metadata"
    description: "My new block type"
```

If the block has child blocks, also add a `childSchema` Property seed in `clef-base/seeds/Property.content-native.seeds.yaml`:

```yaml
- schema_ref: my-block
  key: childSchema
  value: paragraph
```

### Step 2: Create the widget spec

Use the `/create-widget` skill. The widget file goes in `surface/widgets/my-block.widget`. The spec must have:

- At minimum a `root: container` anatomy part and one interactive state
- A `data-state` connect binding on root for test selectors
- Structured invariants (not prose strings) — aim for 10 or more; `WidgetComponentTest` generates framework conformance tests from them
- An accessibility role and keyboard bindings

Parse-verify the spec before committing:

```bash
npx tsx -e "
import { readFileSync } from 'fs';
import { parseWidgetFile } from './handlers/ts/framework/widget-spec-parser.js';
const src = readFileSync('surface/widgets/my-block.widget', 'utf-8');
const m = parseWidgetFile(src);
console.log('parts:', m.anatomy.map(p => p.name));
console.log('invariants:', m.invariants.length);
"
```

The parse must succeed and invariant count must be >= 10 before the seed step below.

### Step 3: Add a ComponentMapping row

Add one entry to `clef-base/seeds/ComponentMapping.block-types.seeds.yaml`:

```yaml
  - id: my-block-mapping
    name: my-block-mapping
    widget_id: my-block
    schema: my-block
    display_mode: block-editor
    insertable: true
    section: "Advanced"
    icon: "icon-token-name"
    label: "My Block"
    block_editor_context:
      - markdown
      - wiki
```

Fields:

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique stable identifier |
| `widget_id` | yes | Must match the widget filename without `.widget` |
| `schema` | yes | Schema name from Step 1 |
| `display_mode` | yes | Always `block-editor` for block types |
| `insertable` | yes | `true` to appear in the slash menu |
| `section` | yes | Slash-menu section label: `"Basic"`, `"Advanced"`, `"Media"`, `"Embeds"`, `"AI"`, `"Transform"` |
| `icon` | yes | Design system icon token |
| `label` | yes | Human-readable slash-menu label |
| `block_editor_context` | no | Which editor flavors include this type; omit for all flavors |

### Step 4: Add an EditSurface seed

Add an entry to `clef-base/seeds/EditSurface.seeds.yaml` (or a new domain-specific file like `EditSurface.my-block.seeds.yaml`):

```yaml
concept: EditSurface
action: register
entries:
  - id: my-block-editor
    schema_ref: my-block
    context: block-editor
    toolbar_widget: inline-toolbar
    command_bindings:
      - bold-toggle
      - italic-toggle
    panel_widgets: []
    context_menu_bindings: []
    input_rule_refs: []
    picker_refs: []
    compile_action_ref: null
    compile_bundle_ref: null
    compile_status_field: null
```

The four `compile_*` fields are only set for compilable schemas — see §6. Set them to `null` for ordinary block types.

### Step 5: (Removed) — no allowlist required

The `clef-base/config/recursive-editor-allowlist.yaml` file was deleted in PP-delete-legacy. `RecursiveBlockEditor` mounts unconditionally for all schemas. No allowlist step is needed for new block types — `ComponentMapping` resolution is the only gate.

### Step 6: Restart the kernel

Registry reads are cached at editor mount. Restart the kernel (or hot-reload the seed layer) for the new block type to appear in the slash menu.

---

## 3. How to Add a Slash Command

A slash command is an `ActionBinding` seed with `slash_command: true`. It does not require a widget or ComponentMapping row.

### Step 1: Write the ActionBinding seed

Add an entry to `clef-base/seeds/ActionBinding.seeds.yaml` or a domain-specific file:

```yaml
concept: ActionBinding
action: bind
entries:
  - name: my-command
    binding: my-command
    target: "ConceptName/actionName"
    parameterMap: '{"entity":"context.focusedNodeId"}'
    executionPolicy: "auto"
    label: "My Command"
    slash_command: true
    section: "Transform"
    keyboard: "Ctrl+Shift+M"
```

Fields relevant to the block editor:

| Field | Meaning |
|---|---|
| `slash_command: true` | Registers the binding in the slash-menu command section |
| `toolbar_command: true` | Registers the binding in the inline selection toolbar |
| `context_menu: true` | Registers the binding in the right-click / block-handle menu |
| `keyboard: "Ctrl+..."` | Binds a keyboard chord (optional) |
| `section` | Groups the command in the slash menu under a named header |

### Step 2: Target an existing concept action

The `target` field must be a `ConceptName/actionName` string matching a registered concept. If the concept action does not exist yet, create the concept and handler first using `/create-concept` and `/create-implementation`.

### Step 3: Restart the kernel

`RegisterSlashCommand` sync fires on `ActionBinding/bind` with `slash_command: true` and adds the binding to the slash-menu command registry. The registry is re-read on each slash-menu open, so a kernel restart is not always required — but seed loading is batch-applied at startup.

---

## 4. How to Add a Markdown Shortcut

A markdown shortcut is an `InputRule` seed with `kind: pattern`. It dispatches to an existing `ActionBinding` when the typed text matches the pattern at the start of a block.

### Step 1: Write the InputRule seed

Add an entry to `clef-base/seeds/InputRule.seeds.yaml`:

```yaml
concept: InputRule
action: register
entries:
  - name: my-markdown-shortcut
    rule: my-markdown-shortcut
    kind: pattern
    pattern: "^=== "
    action_ref: my-command
    priority: 100
    scope: null
```

Fields:

| Field | Meaning |
|---|---|
| `kind` | `"pattern"` for regex match at line start, `"trigger-char"` for character trigger, `"paste"` for MIME-typed paste, `"drop"` for drop events |
| `pattern` | Regex string (for `pattern`) or MIME type (for `paste`/`drop`) or trigger character string (for `trigger-char`) |
| `action_ref` | ID of an existing `ActionBinding` to invoke when the rule fires |
| `priority` | Integer; higher wins. Use `100` for standard block-editor rules. Increase to pre-empt existing rules on conflict |
| `scope` | Schema name to restrict this rule to blocks of that type, or `null` for global scope |

### Step 2: Lower priority only if needed

Standard rules use `priority: 100`. If your rule is more general than an existing rule it may conflict — check `InputRule/match` semantics: higher priority wins; ties break on longest pattern. Raise priority to pre-empt, lower to yield.

### Step 3: Create the ActionBinding if it does not exist

If `action_ref` points to an ActionBinding that does not yet exist, create it first (see §3). The `InputRule/match` dispatch will fail silently (warning logged) if the ActionBinding is missing.

---

## 5. Known Gaps — All Resolved (PP-delete-legacy, 2026-04-13)

The audit at commit `f60b0540` (MAG-757) identified the following gaps between the recursive editor and the legacy monolith. All gaps were closed across PP waves 1–3 (MAG-767). `BlockEditor.tsx` has been deleted. The notes below are preserved for historical reference and post-mortem review.

### Gap 1: InlineMark concept wiring — bold/italic/code are no-ops [RESOLVED: PP1.03]

**What fails:** Ctrl+B / Ctrl+I / Ctrl+E (code) in `RecursiveBlockEditor` log a warning and do nothing. Bold, italic, and code mark toggles in the inline toolbar are also inert.

**Why (resolved):** The `InlineMark` concept was planned as part of Phase 1 but was initially absent. The ActionBindings `bold-toggle`, `italic-toggle`, and `code-toggle` seeded in `clef-base/seeds/ActionBinding.seeds.yaml` referenced `InlineMark/toggleMark`. `InlineMark/toggleMark` shipped in commit `dc7da671`; the targets are now real actions.

**Anticipatory reference created by:** MAG-718 (bold/italic/code mark RenderTransforms, commit `eaebdff7`). The RenderTransforms ship correctly; the missing piece is the concept action that applies a mark to a selection range in the editor state and triggers the transform.

**Fix:** Introduce `InlineMark [M]` with `toggleMark(blockId: String, range: String, markKind: String)` action. Wire the existing `bold-toggle` / `italic-toggle` / `code-toggle` ActionBindings to it. Wire the RecursiveBlockEditor's selection state so it passes `blockId` and `range` through the ActionBinding `parameterMap`. One concept + one handler + seed updates.

**UX regression severity:** High. Bold/italic/code are the most frequently used formatting actions. Users on the recursive editor who expect keyboard shortcuts for marks will find them inert. The opt-back toggle to `"legacy"` is the workaround until closed.

---

### Gap 2: ContentNode/clone — persona-duplicate and meeting-notes-duplicate are broken [RESOLVED: PP3.03]

**What fails:** "Duplicate page" actions for `agent-persona` and `meeting-notes` documents opened in `RecursiveBlockEditor` do not clone the document.

**Why (resolved):** `ContentNode/clone` shipped in commit `a6d18662`. The `ActionBinding` seeds for persona-duplicate and meeting-notes-duplicate (written in MAG-721, commit `3e79c85c`) reference `ContentNode/clone`; the handler plumbing was subsequently wired as part of PP3.03.

**Anticipatory reference created by:** MAG-721 (AI continue ActionBinding + persona, commit `3e79c85c`). The persona seed workflow assumed clone was fully invokable at that point.

**Fix:** Wire the `ActionBinding` parameterMap for `persona-duplicate` and `meeting-notes-duplicate` so `entity_id` is populated from `context.focusedNodeId`. Verify `ContentNode/clone` handler round-trips correctly with a conformance test against the two schemas. One seed update + one handler conformance test.

**UX regression severity:** Medium. Duplicate is a common scaffolding action when creating new personas or meeting notes from an existing template. The legacy editor invokes clone through a direct React handler that bypasses ActionBinding; users on recursive who click duplicate see no response.

---

### Gap 3: MediaAsset context threading — paste/drop image insert is broken [RESOLVED: PP7.01]

**What fails:** Pasting an image from the clipboard or dropping a file onto `RecursiveBlockEditor` does not insert an image block. The paste and drop InputRules fire correctly (dispatching to `media-upload-from-clipboard` and `media-upload-from-drop` ActionBindings), but `MediaAsset/createMedia` receives `focusedDocId: null` and fails to associate the new media asset with the current document.

**Why:** `MediaAsset/createMedia` context threading was shipped in commit `a6feeac7`. The clef-base React paste and drop handlers in `RecursiveBlockEditor.tsx` need to read `context.focusedDocId` from the editor's kernel-observed state and thread it through the ActionBinding `parameterMap` before dispatching. This read-from-context step was not implemented.

**Anticipatory reference created by:** MAG-717 (image-block + media-picker + seeds, commit `cd47ce57`). The media-picker widget correctly resolves focusedDocId from the picker's open action; the paste/drop path bypasses the picker and has no equivalent context read.

**Fix:** In `RecursiveBlockEditor.tsx`, add `focusedDocId: editorState.nodeId` to the context object passed into the `DispatchInputRule` sync for paste and drop events. One React adapter change, no concept or seed changes.

**UX regression severity:** High. Paste-image is a primary content authoring gesture. Users on the recursive editor who paste images see no insert and no error; the paste appears to be silently swallowed. The legacy editor handles paste through a direct React handler that already has the doc ID in scope.

---

### Gap 4: ViewShell/refresh not declared [RESOLVED: PP7.03]

**What fails:** The `view-embed-block` component (MAG-731) issues a `ViewShell/refresh` invocation after an inline edit action completes. The `ViewShell` concept does not declare a `refresh` action, so the invocation resolves to `notfound` and the embedded view does not re-render.

**Anticipatory reference created by:** MAG-731 (view-embed block, flagged in the Phase 1 card completion audit). The view-embed block seed references `ViewShell/refresh` in its interaction ActionBinding for post-edit re-query.

**Fix:** Add `refresh(shell: V)` to the `ViewShell [V]` concept spec and implement the corresponding handler action. The action marks the shell's compiled query as stale and triggers re-execution via the existing `compile-query.sync` / `execute-query.sync` chain. One concept action + one handler method.

**UX regression severity:** Low. The embedded view continues to display its pre-edit data until the user navigates away and back. No data loss; the underlying content is saved correctly. The embedded view re-renders correctly after a full page reload.

---

### Gap 5: ProcessRun/listBySpec not declared [RESOLVED: PP7.04]

**What fails:** The `consumers_panel_ref` widget for the `workflow` compilable schema (part of `WorkflowEditor.derived`) attempts to list active ProcessRuns for a given ProcessSpec page via `ProcessRun/listBySpec`. The action is not declared on the `ProcessRun` concept.

**Anticipatory reference created by:** MAG-747 (workflow-editor.derived, commit `4173ba71`). The consumers panel seed was written assuming `listBySpec` would be added alongside MAG-747 but it was deferred.

**Fix:** Add `listBySpec(spec: P) -> ok(runs: list R)` to the `ProcessRun [R, P]` concept spec and implement the handler. One concept action + one handler method + one conformance test fixture.

**UX regression severity:** Low. The consumers panel for workflow pages is blank rather than showing active runs. The page-level compile surface (compile button, status badge, ProcessSpec preview) works correctly. No production ProcessRun execution is affected.

---

### Gap 6: AgentSession/cancel not declared [RESOLVED: PP7.05/06]

**What fails:** The `ai-chat-panel.widget` (MAG-744, commit `4173ba71`) exposes a "Stop" button that dispatches `AgentSession/cancel`. The action is not declared on the `AgentSession` concept.

**Anticipatory reference created by:** MAG-744 (notebook-editor.derived + ai-chat-panel widget, commit `4173ba71`). The widget spec was written with `cancel` as an expected action; the concept declaration and handler were deferred.

**Fix:** Add `cancel(session: S) -> ok | notfound` to the `AgentSession [S]` concept spec. Implement the handler to mark the session as cancelled and signal the AgentLoop to stop after the current step. One concept action + one handler method.

**UX regression severity:** Medium. Users interacting with the AI chat panel cannot stop a running agent response. The "Stop" button is rendered but pressing it logs a warning and does nothing. The agent eventually completes or times out. In long-running agent loops this is disruptive.

---

## 6. How to Add a Compilable Derived Editor

A compilable derived editor is an editor flavor where the page's block tree IS structured data that compiles into concept-specific output via `ContentCompiler`. Examples: `PersonaEditor` (blocks → PromptAssembly), `MeetingNotesEditor` (blocks → CalendarEvent), `WorkflowEditor` (blocks → ProcessSpec).

The full chain is: schema + ContentCompiler provider + derived concept + EditSurface compile bundle + status/preview/consumers widgets + route.

### Step 1: Define the schema

If the schema is not already seeded, add it under `clef-base/seeds/Schema.seeds.yaml`. Set the `compilationProvider` Property key to the provider name you will register in Step 2:

```yaml
# In clef-base/seeds/Property.content-native.seeds.yaml:
- schema_ref: meeting-notes
  key: compilationProvider
  value: CalendarEvent
```

### Step 2: Register a ContentCompiler provider via sync

Write a sync that fires on `ContentCompiler/compile` when the schema matches `meeting-notes` and produces `CalendarEvent` output via the relevant concept action. Register it via `PluginRegistry`:

```
sync MeetingNotesCompile [eager]
  purpose: "Compile meeting-notes page blocks into a CalendarEvent via ContentCompiler"
when {
  ContentCompiler/compile: [ page: ?page; schema: "meeting-notes" ] => [ page: ?page ]
}
then {
  PluginRegistry/dispatch: [
    provider: "CalendarEvent";
    page: ?page ]
}
```

The `content-native-schema.sync` already wires `ContentNode` saves to mark compilations stale. Your sync only needs to handle the compile step.

### Step 3: Create the derived concept

Place the derived concept spec in `specs/editors/meeting-notes-editor.derived`. Use the `/create-derived-concept` skill:

```
derived MeetingNotesEditor [T] {

  purpose {
    Compose the block editor with the meeting-notes compilation surface,
    producing a CalendarEvent from the page's block tree and surfacing
    compile status, event preview, and calendar backlinks in-place.
  }

  composes {
    derived MarkdownEditor [T]
    ContentCompiler [T]
    CalendarEvent [T]
  }

  syncs {
    required: [meeting-notes-compile]
  }

  surface {
    action compile() {
      matches: ContentCompiler/compile(schema: "meeting-notes")
    }

    query compiledOutput() -> ContentCompiler/getLatest(schema: "meeting-notes")
  }

  principle {
    after compile()
    then compiledOutput() returns a CalendarEvent
  }
}
```

### Step 4: Add the EditSurface seed with compile bundle fields

Add an entry to `clef-base/seeds/EditSurface.meeting-notes.seeds.yaml`:

```yaml
concept: EditSurface
action: register
entries:
  - id: meeting-notes-page-level
    schema_ref: meeting-notes
    context: page-level
    toolbar_widget: meeting-notes-toolbar
    command_bindings:
      - meeting-notes-compile
      - meeting-notes-recompile
    panel_widgets:
      - meeting-notes-calendar-preview
      - meeting-notes-consumers-panel
    context_menu_bindings: []
    input_rule_refs: []
    picker_refs: []
    compile_action_ref: meeting-notes-compile
    compile_bundle_ref: meeting-notes-compile-bundle
    compile_status_field: compiledAt
```

The four compile bundle fields activate the in-place compile UX:

| Field | Widget role |
|---|---|
| `compile_action_ref` | ActionBinding rendered as the "Compile" button in the page-level toolbar |
| `compile_bundle_ref` | Optional bundle reference grouping the compile/recompile pair |
| `compile_status_field` | ContentCompiler state field used to drive the status badge label (e.g., "Compiled 2m ago") |
| (`status_decoration_ref`) | Widget rendering the status badge — declared in the panel widget list |
| (`output_preview_ref`) | Right-rail widget rendering the compiled output — declared in `panel_widgets` |
| (`consumers_panel_ref`) | Backlinks panel widget — declared in `panel_widgets` |

### Step 5: Create status, preview, and consumers widgets

Create three widget specs using `/create-widget`:

- `surface/widgets/meeting-notes-status-badge.widget` — reads `ContentCompiler` state for the page; renders `compiled` / `stale` / `invalid` / `never-compiled` with timestamp
- `surface/widgets/meeting-notes-calendar-preview.widget` — renders the `CalendarEvent` compiled output as a mini event card in the right rail; subscribes to `ContentCompiler` state via kernel observation
- `surface/widgets/meeting-notes-consumers-panel.widget` — renders backlinks showing calendars and sessions that consume the event (uses `Reference` + `Backlink`)

Register each widget in `panel_widgets` of the EditSurface seed above.

Reuse generic widgets where possible. The `backlinks-panel.widget` already handles the consumers pattern for `agent-persona`; it may be reusable for meeting-notes with a `schemaFilter` prop.

### Step 6: Add a route

Add a route entry in the clef-base router for the new editor flavor:

```
/editors/meeting-notes/:nodeId
```

The route mounts `RecursiveBlockEditor` with `editorFlavor = "meeting-notes-editor"`, which selects the `MeetingNotesEditor.derived` composition and activates its EditSurface bundle on page load.

---

## 7. Reference Architecture

### Primary PRD

`docs/plans/block-editor-recursive-views-prd.md` — full design, plane model, migration strategy, acceptance criteria, and commit log for all Phase 1 cards.

### Widget spec grammar

`examples/devtools/devtools.interface.yaml` → `create-widget` skill section, or invoke `/create-widget` for the full grammar reference including anatomy, states, accessibility, connect, and structured invariant syntax.

### Key concepts

| Concept | Role in the block editor |
|---|---|
| `InputRule` | Unified input-plane plugin surface — markdown shortcuts, trigger chars, paste, drop |
| `EditSurface` | Per-content-type editor bundle activated on focus; carries compile bundle fields for compilable schemas |
| `ComponentMapping` | (Schema x DisplayMode) → widget registry; `insertable: true` entries feed the slash menu |
| `ActionBinding` | Command plane; `slash_command` / `toolbar_command` / `context_menu` / `keyboard` tags route the binding |
| `ContentCompiler` | Walks the Outline block tree and produces concept-specific output via PluginRegistry dispatch |
| `Template` | Snippet support; `trigger` field activates via InputRule |
| `RenderTransform` | Marks (bold/italic/code/link) and theme variants as composable functorial transforms |
| `ViewShell` | Data-driven view that renders blocks; `PresentationSpec = "blocks"` activates recursive block rendering |
| `DataSourceSpec` | `outline-children` kind resolves to children of a parent ContentNode in Outline order |
| `PresentationSpec` | `blocks` kind mounts recursive block rendering; swapping to `card-grid` / `calendar` / `timeline` is free |

### Key seed files

| File | Contents |
|---|---|
| `clef-base/seeds/ComponentMapping.block-types.seeds.yaml` | All block-type (schema x display_mode) → widget registrations |
| `clef-base/seeds/EditSurface.seeds.yaml` | Core block-type edit surfaces (paragraph, heading, image, entity-embed) |
| `clef-base/seeds/EditSurface.*.seeds.yaml` | Domain-specific edit surfaces (image, meeting-notes, form-field, etc.) |
| `clef-base/seeds/ActionBinding.seeds.yaml` | Core command bindings (theme, schema, workspace, content actions) |
| `clef-base/seeds/ActionBinding.*.seeds.yaml` | Domain-specific command bindings (image, code-block, columns, audio, etc.) |
| `clef-base/seeds/InputRule.seeds.yaml` | All input-plane rules (markdown shortcuts, trigger chars, paste, drop) |
| `clef-base/config/recursive-editor-allowlist.yaml` | Per-schema allowlist controlling which schemas may mount RecursiveBlockEditor |

### Legacy fallback

`clef-base/app/components/widgets/BlockEditor.tsx` — remains as the fallback. Do not delete until all six gaps in §5 are closed and allowlist coverage is 100%.
