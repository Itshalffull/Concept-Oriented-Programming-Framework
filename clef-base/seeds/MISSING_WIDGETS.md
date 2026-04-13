# Missing Field Widgets — Phase C → Phase D Handoff

## Role of This File

During Phase C of the Creation UX epic, each schema audit writes FormSpec seeds
and maps every field to a ComponentMapping form-field entry. When a field's
natural widget type does not yet exist in the 6 shipping form-field blocks
(text, textarea, select, checkbox, date, number), the seed uses the closest
available widget as a placeholder and appends the real widget here.

Phase D reads this file to dispatch one card per entry. Each card produces:
- A `.widget` spec (anatomy, states, a11y)
- A `ComponentMapping` seed entry (wires the new widget to its schema + display_mode)
- A schema-field-type → block-widget mapping in `ComponentMapping.form-field.seeds.yaml`

After Phase D ships all widgets, Phase E reruns all FormSpec seed audits to
replace `MISSING_WIDGET` placeholders with the real block widget IDs and verifies
`grep -r "MISSING_WIDGET" clef-base/seeds/` returns empty.

---

## Discovered in Phase C — Batch 1 (ContentNode, TaxonomyTerm, Article)

- **form-field-richtext-block** (needed for ContentNode.content, Article.body):
  Micro block-editor embedded inside a form field. Supports inline marks
  (bold, italic, code, link) and basic block types (paragraph, heading, list).
  Should accept and emit a Clef block-tree JSON string. Closest existing
  placeholder: `form-field-textarea-block`.

- **form-field-json-block** (needed for ContentNode.metadata):
  Validated JSON editor with syntax highlighting and parse-error display.
  Accepts any arbitrary JSON object; emits a JSON string. Should show a
  Monaco-lite or CodeMirror editor panel. Closest existing placeholder:
  `form-field-textarea-block`.

- **form-field-entity-picker-block** (needed for ContentNode.createdBy,
  TaxonomyTerm.vocab, TaxonomyTerm.parent, Article.author,
  Comment.author, Comment.target, Page.template):

  Single-entity reference picker. **The picker is architecturally a
  ViewShell rendered as a dropdown** — same query pipeline, same
  filter/sort/projection primitives, no new concepts. Configuration
  follows the resolution hierarchy (cheapest → most expressive):

  1. `entitySchema: "<name>"` — minimum constraint. Picker does
     `ContentNode/listBySchema` with a result cap. Fine for small sets
     (<100).
  2. `entitySchema` + `filterSpec: "<named-filterspec>"` — applies a
     named FilterSpec seed to scope results (e.g., "active-members"
     when picking an assignee).
  3. `dataSource: "<named-datasource>"` — picker delegates entirely to
     a DataSourceSpec, covering federated queries, remote APIs, or
     computed sets (including enum lists as a static DataSourceSpec,
     which removes the need for a separate enum-picker widget).
  4. `contextBindings: { <filterParam>: context.<runtimeField> }` —
     runtime values from the user's current context (workspace, role,
     selected row, etc.) flow into the filter's bound variables.

  Optional configuration on top of any resolution mode:
  - `sortSpec: "<named>"` — ordering (e.g. "recently-used")
  - `projectionSpec: "<named>"` — which fields appear in dropdown rows
  - `presentation: { displayField, secondaryField, avatarField,
    max_results }` — dropdown row rendering hints
  - `nullable: true` — allow clearing for optional reference fields
    (TaxonomyTerm.parent)
  - `multi: false` — single-select by default; `multi: true` would
    split into a separate `form-field-entity-multi-picker-block`

  Emits the selected entity's node ID as a string (or JSON array for
  multi). Closest existing placeholder: `form-field-text-block`.

  **Why ViewShell composition matters:** RBAC exclusions flow through
  the filter layer (users can't pick what they can't see), custom
  pickers are a config change not a new widget, performance is shared
  with table views.

- **form-field-datetime-block** (needed for ContentNode.createdAt,
  Article.publishedAt, Page.publishedAt):
  Date-plus-time picker. The existing `form-field-date-block` captures only
  a calendar date (YYYY-MM-DD). This widget adds an hour:minute input or a
  combined datetime-local `<input>` that emits an ISO-8601 datetime string.
  Should respect the user's locale for display but always store UTC.
  Closest existing placeholder: `form-field-date-block`.

---

## Discovered in Phase C — Continuation (AutomationRule edit form)

- **form-field-binding-picker-block** (needed for AutomationRule.trigger):
  Concept-action binding picker. The trigger field on an AutomationRule is a
  dynamic string reference to a concept action installed in the current
  workspace (e.g. `ContentNode/create`, `Workflow/transition`). Unlike a
  static enum, the available options depend on which concepts are registered
  in the kernel at runtime.

  Architecture: **a ViewShell-backed picker** (same as form-field-entity-picker-block)
  but querying `ScoreApi/listConcepts` + flattening to `concept/action` pairs
  rather than ContentNode rows. The dropdown rows show concept name, action
  name, and a short purpose snippet. Emits a `"Concept/action"` string.

  Optional configuration:
  - `filterKind: "trigger"` — limits to actions that are valid trigger points
    (i.e. non-query, non-pure actions). Requires ScoreApi support for effect-based
    filtering (post-Phase D).
  - `allowFreeText: true` — fall back to plain text entry for custom trigger IDs
    not yet modelled as concepts.

  Until this widget ships, use `form-field-text-block` as placeholder with a
  note in the overrides config.
  Closest existing placeholder: `form-field-text-block`.

- **form-field-condition-builder-block** (needed for AutomationRule.conditions):
  Visual condition builder for the AutomationRule conditions JSON array. Each
  condition is a `{ field, op, value }` triple. The widget renders a row-per-
  condition UI with field-selector, operator dropdown, and value input. Emits a
  JSON array string. Unlike the general-purpose `form-field-json-block`, this
  widget validates structure and guides users away from raw JSON editing.

  Until this widget ships, use `form-field-json-block` as placeholder.
  Closest existing placeholder: `form-field-json-block`.

- **form-field-action-builder-block** (needed for AutomationRule.actions):
  Visual action step builder for the AutomationRule actions JSON array. Each
  step is a `{ type, params }` object. The widget renders a step list with
  type-picker (invoke-action-binding, webhook, set-field, etc.) and a
  type-specific params sub-form. Emits a JSON array string. Conceptually
  similar to the process-step editor but scoped to automation action types.

  Until this widget ships, use `form-field-json-block` as placeholder.
  Closest existing placeholder: `form-field-json-block`.

---

## Discovered in Phase C — Batch 2 (Canvas, ConnectorPort, ConstraintAnchor, DiagramNotation)

- **form-field-entity-multi-picker-block** (needed for Canvas.items,
  Canvas.connectors, ConstraintAnchor.items):

  Multi-entity reference picker — the multi-valued counterpart to
  `form-field-entity-picker-block`. Where the single picker emits one node ID
  string, this widget manages an ordered list of node ID strings.

  Architecture: **a ViewShell-backed picker rendered as a tag-list + search
  dropdown**. The same resolution hierarchy as the single picker applies:

  1. `entitySchema: "<name>"` — minimum constraint; queries
     `ContentNode/listBySchema` with a result cap.
  2. `entitySchema` + `filterSpec: "<named-filterspec>"` — narrows the pool
     (e.g. only canvas items of a particular notation type).
  3. `dataSource: "<named-datasource>"` — full DataSourceSpec delegation for
     computed or federated sets.
  4. `contextBindings: { <filterParam>: context.<runtimeField> }` — runtime
     context values injected into filter parameters.

  Optional configuration:
  - `sortSpec: "<named>"` — ordering for the dropdown suggestion list.
  - `projectionSpec: "<named>"` — which fields appear in dropdown rows and
    in the selected-tag chips.
  - `presentation: { displayField, secondaryField, avatarField, max_results }`
    — dropdown row and chip rendering hints.
  - `maxItems: <n>` — cap the maximum number of selected items (default
    unbounded). Useful for constraints like "exactly 2 items to align".
  - `minItems: <n>` — enforce a minimum selection count (e.g. ConstraintAnchor
    requires at least 2 items to be meaningful).
  - `orderable: true` — renders drag handles on selected chips so the user
    can reorder the list (needed when item order is semantically significant).

  Emits a JSON array of node ID strings. Closest existing placeholder:
  `form-field-text-block` (comma-separated IDs as a degraded fallback).

  **Why not just `multi: true` on the single picker?** The multi variant has
  meaningfully different UX (chip display, reorder affordance, min/maxItems
  validation) and distinct a11y requirements (multi-select listbox vs
  combobox), so it warrants its own widget spec and block ID rather than a
  prop on the single picker.
