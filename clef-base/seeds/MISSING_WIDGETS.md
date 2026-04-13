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
  TaxonomyTerm.vocab, TaxonomyTerm.parent, Article.author):

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
  Article.publishedAt):
  Date-plus-time picker. The existing `form-field-date-block` captures only
  a calendar date (YYYY-MM-DD). This widget adds an hour:minute input or a
  combined datetime-local `<input>` that emits an ISO-8601 datetime string.
  Should respect the user's locale for display but always store UTC.
  Closest existing placeholder: `form-field-date-block`.
