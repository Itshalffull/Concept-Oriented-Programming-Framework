# Schema / Content-Type Editor — Implementation Plan

**Version:** 1.0.0
**Date:** 2026-04-09
**Status:** Implementation-ready
**Research:** `docs/research/schema-editing/content-type-editing-ux-research.md`
**Architecture pattern:** Archetype D — Hybrid Progressive Disclosure (Levels 1–3)
**New concepts:** 3 (FieldDefinition, SchemaTemplate, SchemaUsage)
**Modified concepts:** 2 (Schema, Property)
**New widgets:** 8
**New views:** 4
**New syncs:** 6

---

## 0. Design Philosophy

The research identifies four archetypes. Clef Base needs **Archetype D** — all three levels of ceremony backed by the same underlying concepts:

| Level | Surface | Use Case | Frequency |
|---|---|---|---|
| **1 — Inline** | Column header popover on table views | Add/rename/delete a field while looking at data | 60% of edits |
| **2 — Drawer** | Side drawer on any entity page | Validation, widget, permissions, formula per field | 35% of edits |
| **3 — Full editor** | Dedicated `/admin/schemas/:id` page | Restructure model, form layout, display layout, reuse, templates | 5% of edits |

Additionally, table views should have an **InteractionSpec** that lets you edit field values inline — the table IS the editor for simple schemas, not just a read-only list.

---

## 1. Concept-Level Changes

### 1.1 FieldDefinition Concept (NEW)

Currently Schema stores fields as a flat `fields: S -> String` (comma-separated names). This is insufficient for a real editor. FieldDefinition gives each field a first-class identity.

```
concept FieldDefinition [F] {
  purpose {
    A typed field within a schema — the atomic unit of content structure.
    Each field has an immutable machine ID (stable for references, APIs,
    storage keys) and a mutable human label. Fields carry type, cardinality,
    validation rules, default value, and display hints.
  }

  state {
    // Identity
    fieldId:      F -> String       // immutable machine name (e.g., "due_date")
    schema:       F -> String       // parent schema name
    label:        F -> String       // mutable display label (e.g., "Due Date")
    description:  F -> String       // help text shown in editor

    // Type system
    fieldType:    F -> String       // "text" | "number" | "date" | "select" | "reference" | "media" | "boolean" | "rich-text" | "json" | "formula" | "relation"
    cardinality:  F -> String       // "single" | "multiple"
    typeConfig:   F -> String       // JSON: type-specific config (select options, reference targets, formula expression, etc.)

    // Constraints
    required:     F -> Boolean
    unique:       F -> Boolean
    validations:  F -> String       // JSON array of validation rules: [{ rule: "minLength", value: 3 }, ...]

    // Display
    defaultValue: F -> String       // default when creating new entities
    widget:       F -> String       // preferred widget for editing (overrides Interactor auto-select)
    formatter:    F -> String       // preferred formatter for display
    sortOrder:    F -> Int          // position in field list

    // Metadata
    createdAt:    F -> String
    updatedAt:    F -> String
  }

  actions:
    create(schema, fieldId, label, fieldType, cardinality?, typeConfig?, required?, unique?, validations?, defaultValue?, widget?, formatter?, sortOrder?)
      -> ok, duplicate, invalid_type, schema_not_found

    update(schema, fieldId, label?, description?, required?, unique?, validations?, defaultValue?, widget?, formatter?, sortOrder?)
      -> ok, not_found

    changeType(schema, fieldId, newType, newTypeConfig?, migrationStrategy?)
      -> ok, not_found, data_loss_warning(affectedCount: Int, lossDescription: String)

    rename(schema, fieldId, newLabel)
      -> ok, not_found

    remove(schema, fieldId)
      -> ok, not_found, in_use(usages: String)

    reorder(schema, fieldId, newSortOrder)
      -> ok, not_found

    get(schema, fieldId)
      -> ok, not_found

    list(schema)
      -> ok

    promote(schema, fieldId)
      -> ok, not_found  // promote to shared/reusable field

  invariants:
    always "fieldId is immutable after creation"
    always "fieldType is in valid type set"
    always "sortOrder is unique within schema"
}
```

### 1.2 SchemaTemplate Concept (NEW)

One-click starting points for common content models.

```
concept SchemaTemplate [T] {
  purpose {
    Pre-built schema definitions that create a complete content model
    in one action — fields, properties, display modes, and sample
    content. Reduces time-to-value for first-time schema creators.
  }

  state {
    name:        T -> String       // "article", "tasks", "events", "contacts"
    label:       T -> String       // "Article", "Task Board", "Event Calendar"
    description: T -> String
    category:    T -> String       // "content", "project", "crm", "knowledge"
    icon:        T -> String
    fields:      T -> String       // JSON: array of FieldDefinition templates
    properties:  T -> String       // JSON: content-native properties (childSchema, compilationProvider, etc.)
    sampleData:  T -> String       // JSON: optional sample entities to seed
  }

  actions:
    register(name, label, description, category, icon, fields, properties?, sampleData?)
      -> ok, duplicate

    apply(name, targetSchemaName?)
      -> ok, not_found  // creates schema + all fields + properties + display modes

    list(category?)
      -> ok

    preview(name)
      -> ok, not_found  // returns field list and sample without creating

    remove(name)
      -> ok, not_found
}
```

### 1.3 SchemaUsage Concept (NEW)

Tracks where schema fields are used — the safety net before destructive operations.

```
concept SchemaUsage [U] {
  purpose {
    Track where each schema field is referenced across the system —
    views, filters, syncs, component mappings, API endpoints, formulas.
    Queried before destructive field operations (delete, type change)
    to warn users and prevent silent breakage.
  }

  state {
    field:       U -> String       // "schema:fieldId"
    usageType:   U -> String       // "view" | "filter" | "sort" | "component_mapping" | "formula" | "sync" | "api"
    usageRef:    U -> String       // ID of the view/filter/mapping that uses this field
    usageLabel:  U -> String       // human-readable: "Source Library view, column 3"
  }

  actions:
    register(field, usageType, usageRef, usageLabel)
      -> ok, duplicate

    unregister(field, usageRef)
      -> ok, not_found

    scan(field)
      -> ok  // returns all usages for a field

    scanSchema(schema)
      -> ok  // returns all usages for all fields in a schema

    remove(field, usageRef)
      -> ok, not_found
}
```

### 1.4 Schema Concept Changes

Update Schema to delegate field management to FieldDefinition:

- `addField` action now creates a FieldDefinition record (delegates to FieldDefinition/create)
- `removeField` checks SchemaUsage/scan before allowing deletion
- New `getFields` action returns FieldDefinition list (not just names)
- `export` action includes full FieldDefinition data

### 1.5 Property Concept Changes

Add content-native editor properties:

- `editorLayout` — which form layout to use for this schema's editor
- `fieldGroups` — JSON defining tab/section groupings for the edit form
- `displayModes` — which display modes this schema supports (beyond auto-created ones)
- `schemaIcon` — icon for the schema in lists and type pickers
- `schemaColor` — color accent for the schema badge

---

## 2. Syncs

### 2.1 field-usage-on-view-create.sync

When a ViewShell is created/updated, register usage for each projected/filtered/sorted field:

```
when ViewShell/create completes ok
then SchemaUsage/register for each field in projection, filter, sort
```

### 2.2 field-usage-on-mapping-create.sync

When a ComponentMapping binds a slot to an entity_field, register usage:

```
when ComponentMapping/bindSlot completes ok
  where slotSource = "entity_field"
then SchemaUsage/register(field, "component_mapping", mappingId, label)
```

### 2.3 field-removal-checks-usage.sync

Before FieldDefinition/remove, scan usage and block if in use:

```
when FieldDefinition/remove requested
  where SchemaUsage/scan(field) returns usages
  guard(usages.length > 0)
then FieldDefinition/remove returns in_use(usages)
```

### 2.4 schema-template-creates-fields.sync

When SchemaTemplate/apply completes ok, create all FieldDefinitions and set Properties:

```
when SchemaTemplate/apply completes ok
then FieldDefinition/create for each field in template
then Property/set for each content-native property
```

### 2.5 field-create-updates-form.sync

When FieldDefinition/create completes ok, regenerate FormBuilder form and create FieldPlacement:

```
when FieldDefinition/create completes ok
then FormBuilder/buildForm(schema)
then FieldPlacement/create(schema, field, defaultFormatter)
```

### 2.6 field-reorder-updates-placements.sync

When FieldDefinition/reorder completes ok, update FieldPlacement sort orders to match.

---

## 3. Level 1 — Inline Schema Editing (Table View)

### 3.1 Schema-Aware Table View

A new view type where each column is a schema field, and the InteractionSpec enables inline editing of field values AND schema structure.

**View:** `schema-table.view`
```
view "schema-table" {
  shell: "schema-table"

  features {
    filter
    sort
    projection
    interaction
    pagination
  }

  purpose {
    Table view where columns are schema fields and rows are entities.
    Column headers are editable — click to rename, right-click for
    type change/delete. The [+] column adds new fields. Cell values
    are inline-editable via InteractionSpec. This is Archetype Level 1.
  }

  invariants {
    always "purity is read-write": { purity = "read-write" }
  }
}
```

**InteractionSpec:** The interaction spec for this view includes:
- `rowClick: navigateTo entity detail`
- `cellEdit: true` — click a cell to edit its value inline
- `columnAdd: true` — [+] button on the last column header
- `columnEdit: true` — click column header for rename/type/options popover
- `columnReorder: true` — drag column headers to reorder
- `rowActions: [edit, delete]`

### 3.2 type-picker Widget

```
widget type-picker {
  purpose: Grouped, searchable, icon-driven field type picker popover.

  anatomy {
    root, searchInput, categoryGroup, categoryLabel,
    typeOption, typeIcon, typeLabel, typeDescription
  }

  states: idle [initial], searching, selected

  props {
    onSelect: callback
    currentType: String (for type-change mode)
    showAdvanced: Boolean
  }

  categories:
    Basic: text, number, select, multi-select, date, checkbox, person, url, email, file
    Advanced: relation, formula, rollup, created-time, created-by, json
    Content: rich-text, media, canvas-embed
}
```

### 3.3 field-header-popover Widget

```
widget field-header-popover {
  purpose: Anchored popover on column header for inline field editing.

  anatomy {
    root, nameInput, typeSelector, optionsList, optionItem,
    optionColor, addOptionButton, requiredToggle, defaultValuePicker,
    sortAction, filterAction, duplicateAction, deleteAction,
    usageWarning, openDrawerLink
  }

  states: closed [initial], open, editing-name, editing-options, confirming-delete

  connect: FieldDefinition/update, FieldDefinition/rename, FieldDefinition/remove
}
```

### 3.4 inline-cell-editor Widget

```
widget inline-cell-editor {
  purpose: Inline editor that appears when clicking a table cell.
  Renders the appropriate input widget based on field type.

  anatomy {
    root, inputContainer, saveButton, cancelButton
  }

  states: viewing [initial], editing, saving, error

  compose {
    text-input (for text fields)
    number-input (for number fields)
    select (for select fields)
    date-picker (for date fields)
    checkbox (for boolean fields)
    reference-picker (for relation fields)
    media-picker (for media fields)
  }
}
```

---

## 4. Level 2 — Field Configuration Drawer

### 4.1 field-config-drawer Widget

A side drawer that slides in from the right when the user clicks the gear icon on a column header or selects "Configure field" from the popover.

```
widget field-config-drawer {
  purpose: Side drawer for per-field advanced configuration —
  validation rules, permissions, widget selection, formula editing,
  conditional visibility, and reference constraints.

  anatomy {
    root, header, fieldName, fieldType, tabBar,
    // Settings tab
    settingsPane, labelInput, descriptionInput, requiredToggle,
    uniqueToggle, defaultValueInput, cardinalitySelector,
    // Validations tab
    validationsPane, ruleList, ruleItem, addRuleButton,
    ruleTypeSelector, ruleValueInput,
    // Appearance tab
    appearancePane, widgetGallery, widgetPreview, formatterGallery,
    // Permissions tab (future)
    permissionsPane
  }

  states: closed [initial], open, settings-tab, validations-tab, appearance-tab

  connect: FieldDefinition/update, FieldDefinition/changeType

  compose {
    type-picker (for type change)
    validation-rule-builder (for rule editing)
    widget-gallery (for widget selection)
  }
}
```

### 4.2 validation-rule-builder Widget

```
widget validation-rule-builder {
  purpose: Build per-field validation rules with a visual interface.

  anatomy {
    root, ruleList, ruleRow, ruleTypeSelect, ruleOperator,
    ruleValueInput, ruleErrorMessage, addRuleButton, removeRuleButton
  }

  rule types: required, min-length, max-length, min-value, max-value,
              regex, allowed-values, unique, custom-expression
}
```

### 4.3 widget-gallery Widget

```
widget widget-gallery {
  purpose: Visual gallery of available widgets for a field type,
  with preview thumbnails. Used in the Appearance tab.

  anatomy {
    root, galleryGrid, widgetCard, widgetThumbnail,
    widgetName, widgetDescription, selectedIndicator
  }

  connect: Interactor/classify → filter available widgets by field type
}
```

---

## 5. Level 3 — Full Schema Editor

### 5.1 Schema Detail View

**View:** `schema-detail.view`

A dedicated page at `/admin/schemas/:id` with three tabs.

```
view "schema-detail" {
  shell: "schema-detail"

  features {
    projection
    interaction
  }

  purpose {
    Full schema editor with three tabs: Fields (reorderable list
    with type badges and config), Form Layout (drag-drop arrangement
    into groups/tabs/sidebars), and Display Layout (per-mode formatter
    assignment with live preview). The definitive admin surface for
    content model management.
  }

  invariants {
    always "purity is read-write": { purity = "read-write" }
  }
}
```

### 5.2 schema-fields-editor Widget

The Fields tab — a reorderable field list with full CRUD.

```
widget schema-fields-editor {
  purpose: Reorderable list of all fields in a schema with drag handles,
  type badges, required indicators, and inline edit/delete actions.
  The primary Level 3 editing surface.

  anatomy {
    root, fieldList, fieldRow, dragHandle, fieldLabel, fieldTypeBadge,
    requiredIndicator, uniqueIndicator, editButton, removeButton,
    addFieldButton, reuseFieldButton, importJsonButton, exportJsonButton
  }

  states: idle [initial], dragging, adding-field, confirming-remove

  connect:
    FieldDefinition/list → populate field list
    FieldDefinition/create → add field
    FieldDefinition/reorder → drag reorder
    FieldDefinition/remove → delete with usage check
    SchemaUsage/scan → show usage before delete

  compose {
    type-picker (for add field)
    field-header-popover (for quick edit)
    field-config-drawer (for full config)
  }
}
```

### 5.3 form-layout-editor Widget

The Form Layout tab — visual arrangement of fields into groups, tabs, and sidebars for the editing experience.

```
widget form-layout-editor {
  purpose: Drag-and-drop editor for arranging schema fields into
  groups, tabs, sections, and sidebars. Controls the edit form
  layout that content editors see. Live preview on the right.

  anatomy {
    root, layoutCanvas, dropZone, group, groupHeader,
    fieldSlot, unplacedFieldsList, previewPanel,
    addGroupButton, addTabButton, addSidebarButton
  }

  states: idle [initial], dragging, previewing

  layout-types: main-content, sidebar, tab-group, accordion-section, fieldset
}
```

### 5.4 display-mode-editor Widget

The Display tab — configure how fields render in each display mode (card, table-row, detail, teaser).

```
widget display-mode-editor {
  purpose: Per-display-mode configuration of field formatters.
  Choose which fields appear in each mode, which formatter renders
  each field, and preview the result live.

  anatomy {
    root, modeSelector, fieldFormatterList, fieldRow,
    formatterPicker, visibilityToggle, previewPanel
  }

  states: idle [initial], selecting-mode, editing-formatter, previewing

  connect:
    DisplayMode/list → available modes
    FieldPlacement/configure → set formatter per field per mode
}
```

### 5.5 schema-template-picker Widget

Shown when creating a new schema — one-click starting points.

```
widget schema-template-picker {
  purpose: Gallery of pre-built schema templates with preview.
  One click creates a complete content model with fields,
  properties, display modes, and optional sample data.

  anatomy {
    root, searchInput, categoryTabs, templateGrid, templateCard,
    templateIcon, templateName, templateDescription, templatePreview,
    fieldCountBadge, useTemplateButton, startBlankButton
  }

  states: browsing [initial], previewing, applying

  connect: SchemaTemplate/list, SchemaTemplate/preview, SchemaTemplate/apply
}
```

---

## 6. Views & Layouts

### 6.1 Views

| View | Shell | Display | Purpose |
|---|---|---|---|
| `schema-admin-list` | schema-admin-list | table | List all schemas with field count, entity count, last modified. Row click → schema detail. |
| `schema-detail` | schema-detail | detail (3-tab) | Full editor: Fields / Form / Display tabs |
| `schema-table` | schema-table | table (editable) | Inline-editable table with column-as-field headers. InteractionSpec enables cell edit, column add/edit |
| `schema-template-gallery` | schema-template-gallery | card-grid | Template picker for new schema creation |

### 6.2 Layouts

| Layout | Kind | Zones | Usage |
|---|---|---|---|
| `schema-detail-layout` | sidebar | Main: 3-tab editor, Sidebar: schema metadata + stats | Schema detail page |
| `schema-table-layout` | stack | Full-width table with column header editing | Inline schema editing on data |

### 6.3 Pages (DestinationCatalog)

| Page | Group | Path | View |
|---|---|---|---|
| Schema Editor | Structure | `/admin/schemas` | schema-admin-list |

Schema detail is a dynamic route: `/admin/schemas/:id` → schema-detail view.

---

## 7. Seed Data

### 7.1 Schema Templates

| Template | Category | Fields |
|---|---|---|
| Article | content | title (text, required), slug (text, unique), excerpt (text), body (rich-text, required), featuredImage (media), author (reference→Person), tags (multi-select), publishedAt (date) |
| Tasks | project | title (text, required), status (select: todo/doing/done), priority (select: P1-P4), assignee (reference→Person), dueDate (date), description (rich-text) |
| Events | content | title (text, required), startDate (date, required), endDate (date), location (text), description (rich-text), organizer (reference→Person), rsvpCount (number) |
| Contacts | crm | firstName (text, required), lastName (text, required), email (text, unique), phone (text), company (text), role (text), notes (rich-text), avatar (media) |
| Knowledge Base | knowledge | title (text, required), body (rich-text, required), category (select), tags (multi-select), relatedArticles (relation), lastReviewedAt (date) |
| Meeting Notes | content | title (text, required), date (date, required), attendees (multi-select), agenda (rich-text), notes (rich-text), actionItems (rich-text), recording (media) |

### 7.2 Field Type Registry

Seed the TypeSystem with the standard field types and their metadata:

| Type | Icon | Category | Config Options |
|---|---|---|---|
| text | Aa | Basic | minLength, maxLength, regex |
| number | # | Basic | min, max, precision, format (integer/decimal/currency/percent) |
| select | ▾ | Basic | options (label, value, color) |
| multi-select | ▾▾ | Basic | options, maxSelections |
| date | 📅 | Basic | includeTime, format, timezone |
| checkbox | ☑ | Basic | — |
| person | 👤 | Basic | allowMultiple |
| url | 🔗 | Basic | — |
| email | ✉ | Basic | — |
| file | 📎 | Basic | allowedTypes, maxSize |
| rich-text | 📝 | Content | allowedBlocks, allowedMarks |
| media | 🖼 | Content | allowedTypes (image/video/audio), crop, focalPoint |
| relation | ↔ | Advanced | targetSchemas, cardinality, displayField |
| formula | ƒ | Advanced | expression, outputType |
| rollup | ∑ | Advanced | sourceRelation, aggregation |
| json | {} | Advanced | schema (optional JSON Schema) |
| created-time | 🕐 | Meta | — (auto-filled, read-only) |
| created-by | 👤 | Meta | — (auto-filled, read-only) |
| auto-number | 🔢 | Meta | prefix, startFrom |

---

## 8. Content-Native Integration

### 8.1 Schema Properties for Editor

When a schema is created/edited, these Property values control the content-native behavior:

| Property | Effect |
|---|---|
| `childSchema` | Blocks within this schema's pages use this child schema for metadata |
| `defaultTemplate` | Template to scaffold when creating new pages with this schema |
| `compilationProvider` | Which ContentCompiler provider processes this schema's pages |
| `displayWidget` | Default widget for rendering this schema in entity detail |
| `schemaIcon` | Icon in type picker and schema list |
| `schemaColor` | Color accent for badges and chips |
| `editorLayout` | Which form layout to use (full-page, sidebar, tabs) |
| `fieldGroups` | JSON defining tab/section groupings for the edit form |

### 8.2 CompilationProvider Integration

The schema editor should show compilation status for content-native schemas:
- If `compilationProvider` is set, show a "Compile" button in the editor toolbar
- Show stale/compiled indicator on entity pages
- Preview compiled output in a panel

---

## 9. Clef Base Integration Deliverables

Everything needed to make this work end-to-end in clef-base:

### 9.1 Seed Files to Create

| File | Contents |
|---|---|
| `clef-base/seeds/SchemaTemplate.seeds.yaml` | 6 templates: Article, Tasks, Events, Contacts, Knowledge Base, Meeting Notes |
| `clef-base/seeds/FieldType.seeds.yaml` | 19 field types with icons, categories, config schemas |
| `clef-base/seeds/View.schema-editor.seeds.yaml` | schema-admin-list, schema-detail, schema-table, schema-template-gallery views |
| `clef-base/seeds/DestinationCatalog.schema-editor.seeds.yaml` | Schema Editor destination + Schema Templates destination |

### 9.2 Seed Files to Update

| File | Change |
|---|---|
| `clef-base/seeds/Layout.seeds.yaml` | Add schema-detail-layout (sidebar), schema-table-layout (stack) |
| `clef-base/seeds/ViewShell.seeds.yaml` | Add schema-admin-list, schema-detail, schema-table, schema-template-gallery shells |
| `clef-base/seeds/DataSourceSpec.seeds.yaml` | Add schema-list-source (FieldDefinition/list), template-list-source (SchemaTemplate/list) |
| `clef-base/seeds/FilterSpec.seeds.yaml` | Add schema-category-filter (for template gallery) |
| `clef-base/seeds/SortSpec.seeds.yaml` | Add schema-name-sort, field-order-sort |
| `clef-base/seeds/PresentationSpec.seeds.yaml` | Add schema-table-presentation, schema-card-presentation |
| `clef-base/seeds/ProjectionSpec.seeds.yaml` | Add schema-admin-fields (name, fieldCount, entityCount, updatedAt) |
| `clef-base/seeds/InteractionSpec.seeds.yaml` | Add schema-table-interaction (cellEdit, columnAdd, columnEdit, columnReorder) |

### 9.3 DestinationCatalog Entries

```yaml
# Schema Editor destinations
- destination: schemas
  name: schemas
  targetConcept: Schema
  targetView: schema-admin-list
  href: /admin/schemas
  icon: "⬡"
  group: Structure

- destination: schema-templates
  name: schema-templates
  targetConcept: SchemaTemplate
  targetView: schema-template-gallery
  href: /admin/schemas/templates
  icon: "⬡"
  group: Structure
```

### 9.4 Handlers to Create

| Handler | File | Style |
|---|---|---|
| FieldDefinition | `handlers/ts/app/field-definition.handler.ts` | Functional (StorageProgram) |
| SchemaTemplate | `handlers/ts/app/schema-template.handler.ts` | Functional |
| SchemaUsage | `handlers/ts/app/schema-usage.handler.ts` | Functional |

### 9.5 Concept Specs to Create

| Spec | File |
|---|---|
| FieldDefinition | `repertoire/concepts/classification/field-definition.concept` |
| SchemaTemplate | `repertoire/concepts/classification/schema-template.concept` |
| SchemaUsage | `repertoire/concepts/classification/schema-usage.concept` |

### 9.6 Syncs to Create

| Sync | File |
|---|---|
| field-usage-on-view-create | `clef-base/suites/entity-lifecycle/syncs/field-usage-on-view-create.sync` |
| field-usage-on-mapping-create | `clef-base/suites/entity-lifecycle/syncs/field-usage-on-mapping-create.sync` |
| field-removal-checks-usage | `clef-base/suites/entity-lifecycle/syncs/field-removal-checks-usage.sync` |
| schema-template-creates-fields | `clef-base/suites/entity-lifecycle/syncs/schema-template-creates-fields.sync` |
| field-create-updates-form | `clef-base/suites/entity-lifecycle/syncs/field-create-updates-form.sync` |
| field-reorder-updates-placements | `clef-base/suites/entity-lifecycle/syncs/field-reorder-updates-placements.sync` |

### 9.7 Widget Specs to Create

| Widget | File |
|---|---|
| type-picker | `surface/widgets/type-picker.widget` |
| field-header-popover | `surface/widgets/field-header-popover.widget` |
| inline-cell-editor | `surface/widgets/inline-cell-editor.widget` |
| field-config-drawer | `surface/widgets/field-config-drawer.widget` |
| validation-rule-builder | `surface/widgets/validation-rule-builder.widget` |
| widget-gallery | `surface/widgets/widget-gallery.widget` |
| schema-fields-editor | `surface/widgets/schema-fields-editor.widget` |
| form-layout-editor | `surface/widgets/form-layout-editor.widget` |
| display-mode-editor | `surface/widgets/display-mode-editor.widget` |
| schema-template-picker | `surface/widgets/schema-template-picker.widget` |

### 9.8 .view Files to Create

| View | File |
|---|---|
| schema-admin-list | `specs/view/views/schema-admin-list.view` |
| schema-detail | `specs/view/views/schema-detail.view` |
| schema-table | `specs/view/views/schema-table.view` |
| schema-template-gallery | `specs/view/views/schema-template-gallery.view` |

### 9.9 Kernel Registration

Add to kernel concept registration in `clef-base/lib/kernel.ts`:
- Register FieldDefinition handler
- Register SchemaTemplate handler
- Register SchemaUsage handler
- Call `storage.ensureIndex('field', 'schema')` for fast field-by-schema lookups
- Call `storage.ensureIndex('usage', 'field')` for fast usage scans

### 9.10 Suite Updates

Update `clef-base/suites/entity-lifecycle/suite.yaml`:
- Add FieldDefinition, SchemaTemplate, SchemaUsage to concept list
- Add 6 new syncs to sync list

### 9.11 Derived Concept Update

Update `clef-base/derived/content-platform.derived` or create `clef-base/derived/schema-editing.derived`:
- Compose: Schema + FieldDefinition + SchemaTemplate + SchemaUsage + Property + TypeSystem + FormBuilder + FieldPlacement + Interactor + ComponentMapping
- Surface actions: createSchema, addField, applyTemplate, configureField
- Surface queries: getSchemaFields, getFieldUsage, listTemplates

---

## 10. Implementation Cards

### Kanban Cards (Vibe Kanban)

| Card | PRD Sections | Blocked By | Blocks | Priority | Commit |
|---|---|---|---|---|---|
| **MAG-556** FieldDefinition Concept + Handler | §1.1, §9.4, §9.5 | — | MAG-558–564 | urgent | |
| **MAG-557** SchemaTemplate + SchemaUsage Concepts + Handlers | §1.2, §1.3, §9.4, §9.5 | — | MAG-560, MAG-563 | high | |
| **MAG-558** Field Lifecycle Syncs | §2, §9.6 | MAG-556 | MAG-561–564 | high | |
| **MAG-559** Level 1 Widgets: type-picker, field-header-popover, inline-cell-editor | §3.2–3.4, §9.7 | — | MAG-560, MAG-561 | high | |
| **MAG-560** Level 1 View: schema-table + InteractionSpec + Seeds | §3.1, §9.1, §9.2, §9.8 | MAG-556, MAG-559 | MAG-564 | high | |
| **MAG-561** Level 2 Widgets: field-config-drawer, validation-rule-builder, widget-gallery | §4, §9.7 | MAG-556, MAG-559 | MAG-564 | medium | |
| **MAG-562** Level 3 Widgets: schema-fields-editor, form-layout-editor, display-mode-editor | §5.2–5.4, §9.7 | MAG-556 | MAG-563 | medium | |
| **MAG-563** Level 3 Views + Layouts + Destinations + Templates + Seeds | §5.1, §5.5, §6, §7, §9.1–9.3, §9.8 | MAG-557, MAG-562 | MAG-564 | medium | |
| **MAG-564** Integration Tests + Derived Concept + Suite Update | §9.9–9.11 | MAG-556–563 | — | medium | |

---

## 11. Open Questions

1. **Field type migration strategies** — When changing a text field to a number, what coercion strategies should be offered? Options: coerce (parse numbers, null on failure), null-out (clear all values), backup-and-convert (create a backup field with old values).

2. **Collaborative schema editing** — Should schema edits be CRDT-backed for real-time collaboration, or is optimistic locking sufficient? The research shows this is rare but valuable for team environments.

3. **Schema versioning** — Should schema changes create versions (like content versioning)? This would enable rollback but adds complexity. Could reuse the existing DAGHistory infrastructure.

4. **Formula engine** — The formula field type needs an expression language. Options: use existing StorageProgram DSL, JavaScript subset, or a custom expression language. The research shows formula editors need real space (drawer, not popover).

5. **API field exposure** — Should FieldDefinition track which fields are exposed via REST/GraphQL APIs? This would enable the "API preview" tab in the schema editor.
