# PRD: KeyBinding Concept + Editor + Migration

## Status: Draft
## Authors: 2026-04-13
## Depends on:
- Existing: ActionBinding concept (KeyBinding/resolve dispatches via ActionBinding/invoke)
- Existing: Invocation Lifecycle epic (MAG-842) — keystroke→action invocations get observable feedback automatically
- Existing: Creation UX epic (MAG-850) — KeybindingEditor plugs into the same create_surface routing as ViewEditor/SchemaEditor/etc.
- Existing: Property concept — per-user/per-workspace overrides stored as Properties

---

## 1. Problem Statement

Today every keyboard shortcut in Clef Base is hardcoded — onKeyDown handlers in 50+ widgets, scattered useEffect listeners, contentEditable bindings inline. The audit's "Keyboard Navigation" P1 (DataTable arrows, Board card nav, etc.) and "Accessibility" P2 (slash-menu aria, focus trap, keyboard help completeness) both fall out of fixing the architecture, not patching individual widgets.

A `KeyBinding [K]` concept treats keys the same way ActionBinding treats clicks: declarative bindings as data, dispatched through a generic resolver, customizable by users, observable by Score, and feeding into the existing Invocation lifecycle for free.

What we get:
- **Auto-generated, never-stale keyboard help** — derived from the registry
- **User customization** — vim/dvorak/accessibility users can rebind via overrides
- **Conflict detection at boot** — two seeds binding the same key in the same scope error explicitly
- **Per-context overrides** — "Tab indents in code-block, focuses next anywhere else" is data
- **a11y audit reports** — Score queries flag interactive widgets without bindings
- **Pilot/agent control** — agents can query and fire bindings programmatically

---

## 2. Design decisions (settled — see §11 for the design discussion that produced these)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Hierarchical scopes** (`app.editor.code-block`) | Closer ancestor wins on conflict; child inherits parent unless explicitly excluded |
| 2 | **Per-user with per-workspace fallback** | User Property override → workspace Property fallback → seed default. Per-device deferred |
| 3 | **`mod` virtual modifier as default** | Resolves to Cmd on Mac, Ctrl elsewhere. Explicit `cmd`/`ctrl` for platform-specific cases |
| 4 | **Store `event.key` + `event.code`** (VS Code pattern) | Letters use key (locale-aware); resolver matches both for AZERTY/Dvorak compat |
| 5 | **Chords supported from v1** | `Cmd+K Cmd+S`, `g i` (gmail-style); 2-second timeout; mid-chord overlay shows partial state |
| 6 | **contentEditable**: skip dispatcher for letter keys, dispatch modifier combos | Typing letters into a code block doesn't trigger global handlers; Cmd+B still triggers Bold |
| 7 | **Per-binding `phase: capture | bubble`** (default bubble) | Esc-closes-modal needs capture; Tab-within-widget needs bubble |
| 8 | **Explicit `priority: Int` field; error at boot if priorities tie** | No silent shadowing |
| 9 | **Browser-default override allowed with warning** | Cmd+W intercepts allowed but logged; KeybindingEditor shows a "overrides browser default" badge |
| 10 | **Category as field on KeyBinding** | Help-modal grouping is data, not derived |
| 11 | **KeyBinding/resolve returns matched ActionBinding id; dispatcher invokes** | Separation of concerns; reuses Invocation lifecycle for feedback |
| 12 | **Recorder UI inline (not modal); keystroke-blocking** | Focus capture suppresses dispatcher during recording; visual feedback via outline + keycap chips |
| 13 | **Preset packs as a separate `KeybindingPreset [P]` concept** | Vim/Emacs/VSCode/Notion/Linear bundles; queryable, scoreable, partially overridable |
| 14 | **Three-mode editor** (view / edit / create) — single widget | Help modal is the same component in `mode: "view"`; "rebind from help" is a free affordance |

---

## 3. Architecture

### 3.1 KeyBinding concept

```
concept KeyBinding [K, A] {
  state {
    bindings: set K
    binding: K -> {
      label: String,                  -- "Bold", "Open command palette"
      description: option String,
      category: String,                -- "Editing", "Navigation", "Formatting", ...
      scope: String,                   -- hierarchical: "app.editor.code-block"
      priority: Int,                   -- conflict resolution; ties = boot error

      -- Key combination (chord supported as comma-separated stages)
      chord: list KeyStroke,           -- single keystroke = list of length 1
                                       -- KeyStroke = { mod: list Modifier, key: String, code: String }

      -- Behavior
      phase: "capture" | "bubble",     -- default "bubble"
      onlyOutsideTextInput: Bool,      -- default true for letter keys
      overridesBrowser: Bool,          -- default false; true logs warning at registration

      -- Dispatch target
      actionBinding: A,                -- the ActionBinding to invoke on match
      params: option Bytes,            -- static params merged into the action's context
    }
  }

  actions {
    register(binding: K, label: String, ..., chord: list KeyStroke, actionBinding: A) -> ok | duplicate | conflict | error
    deregister(binding: K) -> ok | not_found
    resolveKey(scope: String, event: KeyEvent, chordState: option ChordState) -> match(actionBinding: A, params: Bytes) | partial(prefix: list KeyStroke) | none
    listByScope(scope: String) -> ok(bindings: list K)
    listByCategory(category: String) -> ok(bindings: list K)
    setOverride(binding: K, scope: "user" | "workspace", chord: list KeyStroke) -> ok | error
    clearOverride(binding: K, scope: "user" | "workspace") -> ok | not_found
  }

  invariants {
    never "two bindings same key same scope same priority" {
      b1 != b2 && b1.scope == b2.scope && b1.chord == b2.chord && b1.priority == b2.priority
    }
    always "scope is hierarchical path" { binding.scope matches /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/ }
    always "chord is non-empty" { binding.chord.length > 0 }
  }
}
```

### 3.2 KeybindingPreset concept

```
concept KeybindingPreset [P, K] {
  state {
    presets: set P
    preset: P -> { name: String, description: String, bindings: list K }
    activePerUser: User -> option P     -- which preset is currently active
  }

  actions {
    register(preset: P, name: String, description: String) -> ok | duplicate
    addBinding(preset: P, binding: K, chord: list KeyStroke) -> ok
    activate(user: User, preset: P) -> ok
    deactivate(user: User) -> ok
  }
}
```

Activating a preset = bulk Property/set on user-scope overrides. Deactivating = bulk clear.

### 3.3 Dispatcher (useKeyBindings hook)

Single React hook installed at app shell root. Listens to keydown at document level (capture phase for the resolver layer; per-binding phase governs whether it preventDefault before bubble).

State machine:
```
idle ──key event──> resolve(event, currentScope, chordState=null)
                     │
                     ├── match → invoke ActionBinding → idle
                     ├── partial(prefix) → chordState=prefix, show overlay, start 2s timeout
                     │                       ├── on match within timeout → invoke → idle
                     │                       ├── on no match within timeout → idle (warn user)
                     │                       └── on Esc → idle (cancel)
                     └── none → fall through to default browser behavior
```

`currentScope` resolved from focused element walking up via `data-keybinding-scope` attributes. Modal sets `data-keybinding-scope="app.modal.<name>"`; widgets set their own scope on root.

contentEditable handling: if `event.target.isContentEditable && !event.metaKey && !event.ctrlKey && !event.altKey`, skip dispatcher entirely (typing letters).

### 3.4 KeybindingEditor widget (three-mode)

```
widget keybinding-editor {
  modes: view | edit | create
  anatomy:
    root, search, list, list-item (label, keycap-chips, scope-path, modified-indicator),
    detail-pane, recorder, conflict-warning, preset-picker, reset-button, modified-filter
  states: idle | recording | recording-chord-stage-2 | conflict
  props: mode (default view), context (selected binding for edit/create), scope-filter
}
```

Three-pane layout when `mode != "view"`. View mode = list-only with search.

Recorder UI: focus capture suppresses dispatcher during recording (sets a global ref the dispatcher checks). Backspace deletes most-recent stroke in chord. Esc cancels recording.

### 3.5 KeybindingHint component

Single React component, used everywhere shortcuts are displayed:

```tsx
<KeybindingHint actionBindingId="bold" />
// renders: ⌘B  (Mac) or Ctrl+B (Windows), keycap-styled, auto-updates if user rebinds
```

Subscribes to KeyBinding state for the matching action; re-renders on override change.

### 3.6 Override resolution

When KeyBinding/resolveKey runs, it walks the override chain:
1. User Property override (`Property.get(user-id, "keybinding-override:<binding-id>")`)
2. Workspace Property override (`Property.get(workspace-id, "keybinding-override:<binding-id>")`)
3. Seed default (the binding's declared chord)

First non-null wins.

### 3.7 Integration with existing systems

- **ActionBinding**: KeyBinding/resolve returns an action-binding id; dispatcher calls ActionBinding/invoke. Free Invocation lifecycle (pending/ok/error feedback per MAG-842).
- **PluginRegistry**: not needed at the top level; KeyBindings are seeded directly. PluginRegistry used internally for registering keybinding categories or scope handlers if extension grows.
- **Score**: queries like "all bindings for scope X", "interactive widgets without bindings", "bindings overriding browser defaults" all fall out of standard concept queries.
- **Pilot**: agent action `pilot/keybinding(action_id)` — query the registry, fire the binding without simulating keystrokes.
- **Creation UX (CUX)**: KeybindingEditor implements `mode + context` props; registered in CREATE_SURFACES; admin route `/admin/keybinding-editor`. InteractionSpec for the Settings → Keybindings destination has `create_surface: keybinding-editor`, `create_mode_hint: page`.

---

## 4. Phasing

### Phase A — Core (4 cards)

1. KeyBinding concept + handler + conformance tests (chord-aware state model from start)
2. KeybindingPreset concept + handler + conformance tests
3. useKeyBindings hook + chord state machine + 2s timeout + scope-walking resolver
4. Default-scope seed: app-shell scope, register a baseline empty KeyBinding registry; smoke test verifying dispatcher routes a fixture key to a fixture ActionBinding

### Phase B — Inline display (2 cards)

5. `<KeybindingHint actionBindingId>` component + platform keycap renderer (Mac symbols vs Windows text)
6. Migrate every existing inline shortcut display (button tooltips, command palette, slash menu, context menus) to use `<KeybindingHint>` — read from the registry, not hardcoded strings

### Phase C — Help modal rewrite (1 card)

7. Replace KeyboardHelpModal hand-curated content with KeybindingEditor in `mode: "view"`. Remove the hand-curated help content. Search + category grouping + click-to-edit affordance.

### Phase D — KeybindingEditor + recorder (3 cards)

8. KeybindingEditor widget spec (3-pane, 3-mode, anatomy + states + a11y)
9. KeybindingEditor React handler with inline recorder, focus-capture dispatcher suppression, chord recording (backspace deletes stage, Esc cancels)
10. Conflict warnings inline (recorder shows "Cmd+B is already bound to Bold — replace?"), modified-filter, reset-to-default

### Phase E — Per-user + workspace overrides (2 cards)

11. Property/set wiring per-user-scope (`keybinding-override:<id>` Property keys); workspace fallback resolver in KeyBinding/resolveKey
12. Settings → Keybindings destination wiring: InteractionSpec.create_surface seed; admin route `/admin/keybinding-editor`; menu link

### Phase F — Preset packs (2 cards)

13. KeybindingPreset seeds: VsCode-default (close to current), Vim, Emacs, Notion-default, Linear-default. Each preset = bundle of overrides
14. KeybindingEditor preset-picker UI: apply preset (bulk activate), unapply (bulk deactivate), partial-customize-on-top-of-preset

### Phase G — Onboarding micro-UX (1 card)

15. Linear-style ephemeral shortcut hint: when user clicks a button with a registered binding, show the keycap below it for 600ms. First-run toast: "Keybindings are now editable — press ? for help, open Settings to customize."

### Phase H — Seed migration (5-7 cards across widget clusters)

16. App-shell + modals seeds: Cmd+K (palette), Cmd+/ (help), Esc (close modal), Enter (submit modal). Migrate ModalStackProvider + AppShell.
17. Block editor seeds: Cmd+B/I/U/`, slash, Cmd+Z/Shift+Z (undo/redo), Cmd+Enter (toggle to-do), Tab/Shift+Tab (indent/outdent in lists). Migrate RecursiveBlockEditor.
18. Display widgets seeds: arrow keys for DataTable cell nav, Board card nav between columns, CardGrid nav. Migrate DataTable + BoardDisplay + CardGridDisplay.
19. Tab-group + SplitLayout seeds: arrow nav between tabs, Cmd+1..9 to focus pane n. Migrate ViewTabBar + SplitLayoutRenderer.
20. Editor seeds: collapse/expand Enter/Space bindings on tree-shaped widgets (TreeDisplay, BlockHandle).
21. Form seeds: Tab through fields (default browser behavior — only register if we override), Cmd+S = save, Esc = cancel. Migrate FormRenderer + FormBuilder.
22. (Buffer card) — Anything missed during the Phase H migration.

### Phase I — Conformance + close-out (1 card)

23. Score query asserting every interactive widget (data-keybinding-scope set) has at least one registered binding. Smoke test for vim-mode override (apply Vim preset, assert hjkl bindings active). Chord state-machine integration test (Cmd+K Cmd+S → Save).

---

## 5. Success Criteria

1. Every keyboard shortcut in Clef Base is registered in KeyBinding (no hardcoded handlers remain except contentEditable letter typing)
2. KeyboardHelpModal is fully derived from the registry; no hand-curated text
3. KeybindingEditor allows a user to remap any binding; persists per-user via Property; survives reload
4. Vim preset can be applied via the preset picker and rebinds h/j/k/l for navigation; KeybindingHint components reflect the change immediately
5. Chord bindings work: Cmd+K Cmd+S triggers Save with mid-chord overlay; 2s timeout cancels gracefully; Esc cancels mid-chord
6. Conflict detection: ship a deliberately-conflicting test seed; assert boot fails with a clear error pointing at both bindings
7. Score query "interactive widgets without registered bindings" returns empty after Phase H
8. Pilot/agent can list bindings for a scope and fire one programmatically

---

## 6. Non-goals

- **Keyboard input for full keyboard layout authoring** — users can rebind individual keys, not redefine the whole layout matrix. Layout files (Dvorak, Colemak) are OS-level concerns.
- **Macros / multi-action bindings** — one binding triggers one ActionBinding. Multi-step workflows go through ActionBinding composition (which is a separate concern).
- **OS-level shortcut interception** — we can't intercept Cmd+Tab, Cmd+Q at OS level. Some browser-defaults too (Cmd+T for new tab on most browsers). Document these as "uninterceptable."
- **Mobile gesture shortcuts** — touch gestures are a separate input modality.

---

## 7. Open Questions

1. **What about contentEditable shortcut rendering?** When user is inside a code block and presses Cmd+B, do we want the formatting toolbar to flash an indicator showing the binding fired? Lean yes (Linear pattern from Phase G applies here too).
2. **Per-binding category vs per-binding tags?** Today: single category field. Later: tags for cross-cutting (e.g., a binding could be in "Editing" + "Power-user"). Defer; single category covers v1.
3. **How to handle "this key combination is invalid / unbindable"?** E.g., user tries to bind plain Tab without modifier — that's almost always wrong (conflicts with focus traversal). Recorder warns but allows. Or refuses outright?
4. **Workspace preset enforcement** — admin sets workspace preset; can users still override individual keys, or is the workspace preset locked? Lean users can still override individual keys; the preset is a starting point, not a cage. But admin should be able to mark specific bindings as "locked".
5. **Telemetry / analytics on binding usage** — should we log which bindings users actually fire? Useful for "which shortcuts are dead weight?". Privacy concern. Defer; design ActionLog so it's queryable without adding new fields.

---

## 8. Card Plan

23 cards across 9 phases. See VK breakdown for blocking relationships and per-card descriptions.

Phase ordering:
- Phase A blocks B, C, D (concept must exist before display/editor work)
- Phase B + Phase C can run parallel after A
- Phase D blocks E (editor + recorder before override persistence makes sense)
- Phase F blocks H (preset packs ship before seed migration so users can opt into pre-baked sets)
- Phase H is parallelizable across widget clusters once A+E+F land
- Phase I closes everything out
