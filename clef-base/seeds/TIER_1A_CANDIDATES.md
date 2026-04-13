# Tier 1a Candidates — Schemas That Need Bespoke Editors

## Role of This File

During the Phase C admin/meta schema audit, 5 of the 9 requested schemas
were found to be insufficiently served by a flat FormSpec. This document
records each schema, explains why a standard form is wrong for it, and
specifies what the bespoke editor must handle.

A Tier 1a entity gets an `InteractionSpec.create_surface` pointing at a
named bespoke editor widget, plus an admin route segment under
`/admin/<surface>/new`. See `creation-routing.md` §Tier 1a for the
wiring contract (mode/context props, save dispatch, route registration).

---

## 1. Concept

**Schema fields (Schema.seeds):** `name, uri`

**Why FormSpec is wrong:** The `name` and `uri` fields on the Concept
schema are read-only metadata produced by concept handler registration —
`ConceptScaffoldGen/generate` writes the `.concept` file and the kernel
registers the handler, at which point the ContentNode and its Concept
schema overlay are created automatically by the `schema-creates-content-node`
sync. There is no user-authored creation flow that should directly set these
fields as raw strings. Attempting to create a Concept record via a two-field
text form bypasses the scaffold generation pipeline entirely and produces an
orphaned record with no backing handler.

**What the bespoke editor needs:**
- The existing concept-browser destination (`/admin/concept-browser`) shows
  registered concepts. The "create" surface should launch the
  `concept-scaffold-gen` flow (already wired via the ConceptBrowser
  destination's `create_surface`).
- The editor needs: concept name (slug), type parameter (single uppercase
  letter), purpose (textarea), state field list (table-style row editor),
  action list with per-action variant list (accordion with dynamic rows),
  invariant declarations (code block or structured builder), version number,
  capability flags.
- On save: invokes `ConceptScaffoldGen/generate` → writes `.concept` file →
  triggers kernel reload → handler registers → ContentNode created by sync.
- This is substantially a multi-section wizard, not a flat form. The
  `flow-builder` or a dedicated `concept-builder` widget is appropriate.
- **Existing partial solution:** `concept-browser` destination + devtools
  `ConceptScaffoldGen` MCP tool. A React admin editor composing these
  already covers the kernel-connected create path.

---

## 2. Derived

**Schema fields (Schema.seeds):**
`name, purpose, composedConcepts, composedDerived, requiredSyncs, recommendedSyncs`

**Why FormSpec is wrong:** `composedConcepts` and `composedDerived` are
lists of concept/derived references forming a directed acyclic composition
graph. `requiredSyncs` and `recommendedSyncs` are lists of sync rule
references with tier metadata. Authoring these as raw JSON strings in a
textarea is error-prone and provides no validation against the installed
concept/sync catalog. The relationships between fields (which syncs are
valid given the composed concepts) require dynamic query/suggestion logic
that a static form cannot provide.

**What the bespoke editor needs:**
- **Composition panel:** multi-select or drag-connect picker of installed
  Concept and Derived nodes. Shows purpose tooltips. Validates that all
  composed entities exist in the kernel.
- **Sync boundary panel:** two lists (required / recommended) populated by
  querying `SyncEngine/listSyncs` and filtering to those whose `when`
  clause involves a composed concept. Drag-and-drop from candidate list to
  required/recommended bins.
- **Purpose textarea:** prose editor for the derived concept's purpose
  statement.
- **Operational principle builder:** structured form for the derived
  concept's principle statements (or a code block for advanced users).
- On save: invokes `DerivedScaffoldGen/generate` → writes `.derived` file
  → kernel registers derived.
- A dedicated `derived-builder` widget, or an extension of the existing
  `flow-builder` widget with a "derived concept" mode, is appropriate.

---

## 3. Sync

**Schema fields (Schema.seeds):** `suite, tier, pattern`

**Why FormSpec is wrong:** The `pattern` field is a structured string
encoding a full `.sync` rule (`when Concept/action where [...] then [...]`).
Rendering it as a plain text input gives no validation, no concept/action
autocomplete, and no structural feedback. Sync rules are the wiring language
of the framework; incorrect patterns cannot be caught until runtime. The
`suite` and `tier` fields are meaningful only in relation to the pattern's
trigger concept and the installed suite catalog.

Furthermore, Sync records in Clef Base are primarily *catalog entries* for
existing `.sync` files shipped with suites. The canonical creation path is:
1. Author the `.sync` file using `SyncScaffoldGen/generate` (or manually).
2. Include it in a suite.
3. The sync-creates-content-node sync registers the ContentNode
   automatically when the suite is installed.

A "create sync record" form that writes only a ContentNode row — without
producing the backing `.sync` file — creates a broken catalog entry.

**What the bespoke editor needs:**
- Mirrors the `user-sync-editor` flow (already Tier 1a for AutomationRule).
- `when` clause: concept picker → action picker (filtered by that concept's
  actions). Completion variant filter optional.
- `where` clause: structured condition builder rows (bind, query, not,
  filter, guard conditions). Each row selects condition type and fills fields.
- `then` clause: one or more effect rows, each with concept picker →
  action picker → parameter binding table.
- Suite and tier assignment: select from installed suites, tier enum.
- On save: invokes `SyncScaffoldGen/generate` → writes `.sync` file →
  suite manifest updated → ContentNode created by sync.
- The existing `user-sync-editor` widget covers AutomationRule syncs; a
  kernel-sync variant of the same editor (with concept/action pickers
  scoped to the full installed catalog, not just automation triggers) is
  the right approach. Could be the same widget with a `domain: "kernel"`
  prop to unlock the full concept picker.

---

## 4. Widget

**Schema fields (Schema.seeds):** `name, framework`

**Why FormSpec is wrong:** The `name` and `framework` fields on the Widget
schema are read-only metadata produced by `SurfaceComponentScaffoldGen/generate`.
A widget record in Clef Base represents a *registered, parsed widget AST* —
it is created by the scaffold generator and then registered into the Widget
concept's catalog via `Widget/register`. Directly creating a Widget
ContentNode by filling in two text fields produces a catalog entry with no
backing `.widget` spec, no AST, and no React/Swift/GTK implementation.

**What the bespoke editor needs:**
- The widget scaffold editor needs: widget name, anatomy parts (dynamic
  row list), states (FSM nodes), events (FSM transitions), accessibility
  role, affordance config, props list, compose declarations.
- This is a multi-panel editor, not a form. The `surface-component-scaffold-gen`
  devtools workflow already generates widget files; the bespoke create
  surface should wrap it with a React admin UI equivalent to the
  `SurfaceComponentScaffoldGen/generate` MCP tool.
- On save: invokes `SurfaceComponentScaffoldGen/generate` → writes
  `.widget` file → parser registers AST → Widget ContentNode created by
  sync.
- A dedicated `widget-builder` admin surface is needed. No existing admin
  route covers this; a new `/admin/widget-builder/new` route segment must
  be registered in `clef-base/app/admin/[[...slug]]/page.tsx`.

---

## Next Steps

| Schema | Action needed |
|--------|--------------|
| Concept | Confirm the existing concept-browser create_surface covers the kernel-connected create path; if not, track a `concept-builder` widget card. |
| Derived | Design a `derived-builder` widget or extend `flow-builder` with a derived-concept mode. Create an InteractionSpec.create_surface entry. |
| Sync | Extend `user-sync-editor` with a `domain: "kernel"` prop, or create a sibling `kernel-sync-editor` widget. Create an InteractionSpec.create_surface entry and admin route. |
| Widget | Design a `widget-builder` admin surface. Register `/admin/widget-builder/new` route. Create an InteractionSpec.create_surface entry. |
