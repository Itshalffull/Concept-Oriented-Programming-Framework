# PRD: Creation UX — End-to-End Beautiful Create Flows

## Status: Draft
## Authors: 2026-04-13
## Depends on:
- Existing: FormSpec concept at `specs/view/form-spec.concept` with `resolve` action
- Existing: FormRenderer (1,004 lines) with tab/column/fieldset/section/accordion layouts
- Existing: CreateForm with schema-driven resolution path via `schemaId` prop
- Existing: FormBuilder (1,529 lines) for designing FormSpecs visually
- Existing: SchemaFieldsEditor (687 lines) for schema field type authoring
- Existing: 6 field-block widgets (text, textarea, select, checkbox, date, number)
- Existing: Bespoke editors — ViewEditor, SchemaEditor, FlowBuilderView, UserSyncEditorView, FormBuilder
- Existing: InteractionSpec concept with `create_form_config` field

---

## 1. Problem Statement

Today when a user hits any "Create" button from the sidebar, they get one of:
1. A 3-field-type generic form (text/textarea/select only) — because `FormSpec/resolve` returns not-found and `CreateForm` falls through to its primitive fallback path.
2. The same generic form for entity types like Schema, View, Workflow where bespoke editors exist but aren't wired to the create button.

The infrastructure for beautiful creation is **already built**. What's missing is three kinds of *content*:

1. **FormSpec seeds** — zero exist today, so auto-generation from schema never activates (the rich FormRenderer path is dark code).
2. **Create Surface Routing** — no mechanism for "this entity's create button should mount ViewEditor / SchemaEditor / FlowBuilder, not the generic form."
3. **Field widget coverage gaps** — the 6 shipping field-blocks cover basics but miss email, URL, color, entity-picker, tag, file-upload, rich-text, range, datetime, currency, etc. Some will only surface during the seed-writing audit when a schema needs a type we don't have.

This PRD ships all three in a single epic because they're interlocking — writing a FormSpec seed for a schema with a reference field requires the entity-picker block; routing Create to SchemaEditor requires SchemaEditor to accept a `mode: "create"` prop; and so on.

---

## 2. Architecture

Four tiers that resolve in order when a Create button fires:

```
User clicks Create on destination X
   │
   ├─→ InteractionSpec.create_surface set?
   │      YES → mount that widget with {mode: "create", context: null}
   │            (Tier 1a: destination-level bespoke editor override)
   │      NO  → continue
   │
   ├─→ Schema X has displayWidget Property set (content-native)?
   │      YES → ContentNode/createWithSchema + navigate to entity page
   │            which mounts the block editor (or named widget)
   │            with default Template blocks scaffolded
   │            (Tier 1b: page-as-record / content-native pattern)
   │      NO  → continue
   │
   ├─→ FormSpec registered for schema X?
   │      YES → FormRenderer drives the form via FormSpec layout
   │            (Tier 2: seeded rich form)
   │      NO  → continue
   │
   └─→ Fallback to CreateForm's 3-type primitive path
          (Tier 3: today's crappy form — becomes rare)
```

Every entity type ends up in one of these buckets. The goal is to get every entity type out of Tier 3. The Tier 1a/1b split matters because:

- **Tier 1a (spec-like)** covers View/Schema/Workflow/Form and also ProcessSpec (which edits via FlowBuilder since a process IS a step graph). These are meta-entities: their "shape" IS the data, so a form over fields doesn't express the thing being created.
- **Tier 1b (content-native)** covers every schema where the record IS a page: agent personas, meeting notes, process documentation, any page-as-record schema. The content-native-schema.sync already wires `ContentNode/createWithSchema` + Template scaffolding + `Property.set(schema, "displayWidget", ...)`. We just need the create button to honor it: spawn the ContentNode with the schema overlay, scaffold the default block tree from Template, and navigate to the entity detail page (which already mounts the block editor).

### 2.1 Tier 1 — Create Surface Routing

New field on `InteractionSpec`:
```
create_surface: option String       -- widget id to mount (e.g., "view-editor")
create_mode_hint: "modal" | "page" | "panel"  -- where to mount it
```

Resolution in the sidebar / destination-create-button code:
- If `create_surface` set + widget registered in PluginRegistry → navigate or modal that widget with `?mode=create` or `props.mode="create"`
- Fallback to Tier 2 or 3

Bespoke editor widgets (ViewEditor, SchemaEditor, FlowBuilder, UserSyncEditor, FormBuilder) each accept two new props:
- `mode: "create" | "edit"` (default "edit" for backcompat)
- `context: option <entity record>` (null for create, populated for edit)

Known wirings for Tier 1a (destination-level overrides):
- View → view-editor
- Schema → schema-editor
- Workflow → flow-builder
- ProcessSpec → flow-builder (spec steps = graph; reuses the workflow surface)
- AutomationRule → user-sync-editor (or a new automation-rule-editor if the sync-editor shape doesn't fit)
- Form → form-builder

Tier 1b routing activates automatically for any Schema with `displayWidget` Property set (the content-native-schema.sync convention). Known page-as-record schemas today: agent-persona, and any schema the user configures via the content-type scaffold generator. The create button for these fires:
1. `ContentNode/createWithSchema(newId, schema, body: "")` (LE-18, shipped at dd49a1a0)
2. Content-native-schema.sync auto-scaffolds default Template blocks for the schema
3. Navigate to the entity detail page → block editor mounts with the scaffolded body

### 2.2 Tier 2 — FormSpec seeds for every shipping schema

The 24 shipping schemas get one FormSpec seed each. Authored by inspecting the Schema's field list, grouping related fields into sections/tabs per domain, selecting appropriate field-block widgets per field type.

Seed format (existing FormSpec shape):
```yaml
concept: FormSpec
action: define
entries:
  - id: form-contentnode-create
    schemaId: content-node
    mode: create
    layout:
      type: tabs
      tabs:
        - label: Basic
          fields: [title, summary]
        - label: Metadata
          fields: [tags, schema_memberships]
    field_widgets:
      title: form-field-text-block
      summary: form-field-richtext-block    # may not exist yet — flagged
      tags: form-field-tag-multi-block      # may not exist yet — flagged
```

### 2.3 Tier 3 — Field widget coverage gaps (discovered during Tier 2)

**Explicit scope point:** Writing FormSpecs for 24 schemas will surface every missing field-block widget. Each audit card for a schema MUST produce a written list of field types that need widgets we don't have. Those widgets become follow-up cards in this same epic — not a future epic.

Known or likely missing today (pre-audit guess; actual list emerges from auditing the schemas):
- email
- url
- color
- entity-picker (reference to another entity)
- tag-multi (multi-value input)
- tag-single
- file-upload
- rich-text (micro block-editor inside a field)
- range / slider
- datetime (date exists, not datetime)
- duration
- currency
- percentage
- enum-radio-group
- json-editor
- code-editor (existing code-block repurposed as field)
- image-url
- boolean-toggle (larger than checkbox)
- entity-multi-picker

Each field widget = one .widget spec + one ComponentMapping seed + one schema-field-type mapping. Authoring follows the pattern of existing 6 field-blocks.

---

## 3. Scope

### 3.1 Concept changes (1)

**InteractionSpec** gets `create_surface: option String` + `create_mode_hint: "modal" | "page" | "panel"` additive fields. Concept-parameter-update, additive only.

### 3.2 Widget prop changes (5)

ViewEditor / SchemaEditor / FlowBuilder / UserSyncEditor / FormBuilder each gain `mode` + `context` props. Editors handle empty-state for create mode.

### 3.3 Dispatcher changes (1)

CreateForm (or wherever the Create button resolves) checks `create_surface` first, falls through to FormSpec resolution, falls through to primitive. Needs to wire this decision into the destination-navigation code.

### 3.4 InteractionSpec seeds (5)

Five seeds setting `create_surface` for View/Schema/Workflow/AutomationRule/Form destinations.

### 3.5 FormSpec seeds (24)

One seed per shipping schema. Authors MUST surface missing field-widget types during each schema's audit.

### 3.6 Field widget expansion (N, discovered)

Each missing field-widget surfaces as its own card within this epic. Template card shape:
- `.widget` spec (anatomy: root, label, input, error, hint; states: idle/focused/error/disabled)
- ComponentMapping seed
- Schema-field-type → block-widget mapping entry

Estimated N = 10-15 based on the guess list in §2.3; actual count emerges from audit.

### 3.7 Create button wiring (1)

Sidebar + destination create button in clef-base honors `create_surface` first; delegates to CreateForm (which handles FormSpec resolution + fallback).

---

## 4. Phasing

### Phase A — Routing infrastructure (5 cards)

1. Extend InteractionSpec with `create_surface` + `create_mode_hint` additive fields (concept-parameter-update)
2. Add `mode` + `context` props to ViewEditor / SchemaEditor / FlowBuilder / UserSyncEditor / FormBuilder (5 widgets touched in 1 card — the prop shape is identical)
3. CreateForm dispatcher extended to the 4-tier resolution order from §2 (checks create_surface, then Schema.displayWidget Property, then FormSpec, then primitive fallback)
4. Sidebar / destination-create-button wiring honors the new resolution order
5. Tier 1b content-native create flow: a helper (hook or shared function) that performs ContentNode/createWithSchema + navigates to the entity detail page, used by the destination-create-button code when displayWidget is set

### Phase B — Bespoke-surface + content-native seeds (1 card)

6. InteractionSpec seeds pointing View / Schema / Workflow / ProcessSpec / AutomationRule / Form destinations at their bespoke editors. Verify content-native schemas (agent-persona and any others) have `displayWidget` Property set via their content-native-schema.sync invocation — these activate Tier 1b automatically and need no InteractionSpec seed.

### Phase C — FormSpec seed authoring (24 cards, parallel-safe)

Each card audits one shipping schema, writes its FormSpec seed, **and produces a written list of missing field-widget types**. Format:
- Input: schema name, its field list, typical usage patterns
- Output: one FormSpec seed yaml file + one `MISSING_WIDGETS.md` append
- Agent: seed-data

Cards 7-30: one per schema. Actual schema list to be enumerated from `Schema.define` seeds. Parallelizable since each touches one seed file. **Schemas with `displayWidget` Property set (content-native page-as-record types) are marked as Tier 1b and do NOT need a FormSpec seed** — those cards become "verify Template scaffold exists, document displayWidget routing" instead of form authoring.

### Phase D — Field widget expansion (N cards, dispatched after Phase C surfaces requirements)

Cards 30..30+N: one per discovered missing field-widget. Each creates a `.widget` spec + ComponentMapping seed + schema-type mapping. Dispatched in a batch once Phase C has aggregated the missing list.

### Phase E — Re-audit + close (1 card)

Final card reruns the Phase C audit against the now-expanded widget set to confirm every FormSpec seed's `field_widgets` map resolves; patches any seed that was left with a TODO during initial authoring.

---

## 5. Success Criteria

1. Every destination in the sidebar's "create" button produces a tier-1 or tier-2 experience — no destination falls to the 3-type fallback.
2. View / Schema / Workflow / AutomationRule / Form creation routes to bespoke editors in create mode, not generic forms.
3. Every shipping schema has a FormSpec seed that FormRenderer resolves without TODO placeholders.
4. Every field type referenced by any FormSpec seed has a registered ComponentMapping + field-block widget.
5. `grep -r "MISSING_WIDGET" clef-base/seeds/` returns empty after Phase E.
6. Smoke test: click Create on each sidebar destination; assert the rendered form has at least one domain-specific field widget (i.e., it's not just text/textarea/select primitives).

---

## 6. Non-goals

- **Form validation UX** — per-field validation rendering is covered by existing FormRenderer; this PRD doesn't change validation semantics
- **Multi-step / wizard forms** — FormSpec already supports sections/tabs; actual wizard flows (step 1 → step 2 conditional on step 1) are a separate concept if needed
- **Conditional field visibility** — "show field X only when field Y == foo" is a follow-up if the 24-schema audit surfaces real demand
- **Form i18n** — label strings are English-only; localization is separate
- **CRUD for the seeds themselves via UI** — FormBuilder exists for designing FormSpecs visually; this PRD uses FormBuilder's output format, not its UI

---

## 7. Open Questions

1. **What does "create mode" mean for FlowBuilder?** FlowBuilder edits an existing workflow's state machine. Create mode = empty workflow with a default "start" node? Or a naming step followed by editor? Lean default-start-node; naming as a header input.
2. **AutomationRule's create surface** — user-sync-editor handles user-authored syncs; automation rules are similar but not identical. Reuse or new `automation-rule-editor`? Defer until Phase A card 2 has eyes on both.
3. **FormSpec mode parameter** — today's `mode: create | edit` distinguishes the two, but editors often need the same layout with just empty values. Should a single seed cover both modes, or are they independent seeds? Lean single seed with mode-scoped overrides.
4. **Field-widget scope boundary** — rich-text-in-a-field might reuse the block editor; image-url might reuse existing image-block. Reuse vs new widget is a per-field decision. Document each case.
5. **Parallel schema audits discovering conflicting widget names** — if two agents both discover they need "tag-multi" and propose it, deduplicate before Phase D cards go out. Phase C cards append to a single MISSING_WIDGETS.md so dedup is trivial at Phase D dispatch time.

---

## 8. Card Plan

~35-40 cards under epic "Creation UX" — exact count depends on Phase C audit results. See VK breakdown.

Phase ordering:
- Phase A blocks B, C (routing + widget props before seeds rely on them)
- Phase B is 1 card; parallel-safe with Phase C start
- Phase C is 24 parallel cards; appends to shared MISSING_WIDGETS.md
- Phase D dispatched as a batch once Phase C completes (all 24 audits in)
- Phase E closes out after Phase D
