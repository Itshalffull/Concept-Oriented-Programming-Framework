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
  Single-entity reference picker. Accepts `entitySchema` config to scope
  the search to one schema type. Renders a search-as-you-type combobox
  that queries `ContentNode/listBySchema`. Emits the selected entity's node
  ID as a string. Should support an optional `nullable` flag to allow clearing
  the selection (for optional reference fields like TaxonomyTerm.parent).
  Closest existing placeholder: `form-field-text-block`.

- **form-field-datetime-block** (needed for ContentNode.createdAt,
  Article.publishedAt):
  Date-plus-time picker. The existing `form-field-date-block` captures only
  a calendar date (YYYY-MM-DD). This widget adds an hour:minute input or a
  combined datetime-local `<input>` that emits an ISO-8601 datetime string.
  Should respect the user's locale for display but always store UTC.
  Closest existing placeholder: `form-field-date-block`.
