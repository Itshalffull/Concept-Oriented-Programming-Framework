# Creation Routing — How "Create" Buttons Resolve in Clef Base

When a user clicks a Create button on any destination in Clef Base, the
CreateForm dispatcher resolves the right creation flow through a
**4-tier resolution order**. Agents that author concepts, seeds,
schemas, widgets, or app-shell wiring MUST understand this matrix to
avoid generating creation code that bypasses the dispatcher.

Reference: `docs/plans/creation-ux-prd.md`. Implementation:
`clef-base/app/components/widgets/CreateForm.tsx`.

## The 4-Tier Resolution Order

When the user clicks Create on destination X with target schema Y:

```
1a. InteractionSpec.create_surface set?
       YES → mount that widget with {mode:"create", context:null}
             create_mode_hint controls modal | page | panel mounting
       NO  → continue

1b. Schema Y has displayWidget Property set?
       YES → useContentNativeCreate(Y).create() —
             ContentNode/createWithSchema + content-native-schema.sync
             auto-scaffolds default Template blocks + navigates to
             /content/[id] (block editor on the new entity)
       NO  → continue

2.  FormSpec/resolve(Y, mode:"create") returns ok?
       YES → FormRenderer drives the form via the seeded FormSpec layout
             (sections, tabs, accordions, columns, fieldsets)
       NO  → continue

3.  Primitive 3-type fallback (text, textarea, select)
       Existing CreateForm shape; should be rare after Phase C is done.
```

## Decision Matrix for Authors

When you create a new entity type or destination, decide which tier
applies before writing any seed:

| Entity kind | Tier | What you author |
|---|---|---|
| Meta-spec (View, Schema, Workflow, ProcessSpec, Form, AutomationRule) — its "shape" IS the data | 1a | InteractionSpec.create_surface + create_mode_hint pointing at the bespoke editor widget |
| Page-as-record / content-native (agent-persona, meeting-notes, article, etc.) — the record IS a page | 1b | Property/set(<schema>, "displayWidget", "<widget>") + Property/set for childSchema/defaultTemplate/compilationProvider as applicable |
| Structured record with non-trivial form layout (multi-section, conditional, grouped) | 2 | FormSpec seed defining layout + field_widgets |
| Trivial 1-3 field record (e.g., a Tag with name+vocab) | 2 (still — flat layout) or fall through to 3 | FormSpec with `layout: flat` is preferred over the primitive fallback |

**Avoid Tier 3 falls-through.** The 3-type primitive form is the ugly
default. Every shipping entity type should reach Tier 1 or Tier 2.

## Authoring Patterns by Tier

### Tier 1a — Bespoke editor

InteractionSpec entry on the destination's controls:

```yaml
concept: InteractionSpec
action: create
entries:
  - name: <destination>-controls
    create_surface: <widget-id>          # "view-editor", "schema-editor",
                                          # "flow-builder", "form-builder",
                                          # "user-sync-editor", or new
    create_mode_hint: page                # modal | page | panel
    # ... existing fields preserved
```

Page-mode surfaces need a matching admin route — see
`clef-base/app/admin/[[...slug]]/page.tsx` for the existing 5 wired
routes (`view-editor/new`, `schema-editor/new`, `flow-builder/new`,
`user-sync-editor/new`, `form-builder/new`). Adding a new
create_surface widget = adding a new route segment.

The bespoke editor widget MUST accept `mode: "create" | "edit"` +
`context: option <entity>` props. The 5 shipped editors (commit
2e235c3c) already do.

### Tier 1b — Content-native page-as-record

Property/set entries on the schema:

```yaml
concept: Property
action: set
entries:
  - entity: <schema-id>
    key: displayWidget
    value: block-editor               # or specialized widget if one exists
  - entity: <schema-id>
    key: childSchema                  # optional — block children get this schema
    value: <child-schema>
  - entity: <schema-id>
    key: defaultTemplate              # optional — Template id scaffolded on create
    value: <template-id>
  - entity: <schema-id>
    key: compilationProvider          # optional — ContentCompiler provider
    value: <provider-id>
```

The content-native-schema.sync at
`repertoire/concepts/foundation/syncs/content-native-schema.sync`
auto-wires creation, child-schema overlay, default-template
scaffolding, and compilation-provider registration when these
Properties are set.

`useContentNativeCreate` (clef-base/lib/useContentNativeCreate.ts)
generates a UUID + dispatches ContentNode/createWithSchema + navigates
to /content/[id]. No additional widget code needed.

### Tier 2 — Seeded FormSpec

```yaml
concept: FormSpec
action: define
entries:
  - id: form-<schema>-create
    schemaId: <schema-id>
    mode: create
    layout:
      type: tabs                      # tabs | groups | accordion | flat
      tabs:
        - label: Basic
          fields: [title, summary]
        - label: Metadata
          fields: [tags, status]
    field_widgets:
      title: form-field-text-block
      summary: form-field-textarea-block
      status: form-field-select-block
      tags: form-field-tag-multi-block   # if widget exists; else MISSING_WIDGETS
```

**Layout heuristic** (from Phase C pilot findings):
- 1–4 fields: `flat`
- 5–7 fields, related groups obvious: `groups`
- 8+ fields or clearly separate concern clusters: `tabs`

**System-managed fields (createdAt, updatedAt) should be omitted from
create forms.** They are populated by the handler.

**Enum fields** map cleanly to `form-field-select-block` with hardcoded
options — no missing widget needed.

**If a field's natural widget doesn't exist**, append it to
`clef-base/seeds/MISSING_WIDGETS.md` with a description so Phase D can
build it. Use the closest existing widget as a placeholder.

### Tier 3 — Primitive fallback

Avoid. If you find yourself relying on it, you should be writing a
FormSpec instead. The primitive path exists only as a last-resort
default for entities that haven't been audited yet.

## Common Pitfalls

- **Setting create_form_config + create_surface on the same
  InteractionSpec.** Tier 1a wins; create_form_config is dead. Either
  pick one, or use create_form_config only as a backstop noted in a
  yaml comment.
- **Forgetting to add the admin route** when introducing a new
  create_surface widget with create_mode_hint:page. The dispatcher
  navigates to `/admin/<surface>/new` — without a matching route the
  user lands on a 404.
- **Setting displayWidget on a schema that already has a Tier 1a
  InteractionSpec.create_surface set.** Tier 1a takes precedence. Both
  can coexist as long as they agree (e.g., process-spec routes to
  flow-builder via both Tier 1a and Tier 1b — same target).
- **Treating SchemaTemplate `properties` as already-Property/set.**
  The propagation sync at
  `clef-base/suites/entity-lifecycle/syncs/schema-template-properties-to-properties.sync`
  fires only when SchemaTemplate/apply runs. Schema entities seeded
  directly (not via template instantiation) need explicit Property/set
  seeds.
- **Authoring a bespoke editor widget without the mode/context props.**
  The 5 shipping editors handle this; new ones must follow the same
  contract (mode default "edit", context default null, in-create mode
  initialize empty state, save dispatches define/create vs update).

## Related Reference

- `docs/plans/creation-ux-prd.md` — full architecture + phasing
- `clef-base/seeds/MISSING_WIDGETS.md` — Phase C → Phase D handoff
  doc for missing field-block widgets
- `clef-base/lib/create-surfaces.ts` — widget-id → React component
  registry consulted by the dispatcher
- `clef-base/lib/useContentNativeCreate.ts` — Tier 1b helper
- `clef-base/app/components/widgets/CreateForm.tsx` — the dispatcher
  itself (4-tier resolution implementation)
