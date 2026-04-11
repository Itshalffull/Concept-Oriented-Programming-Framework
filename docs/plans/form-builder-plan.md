# Form Builder — Implementation Plan

**Version:** 1.0.0
**Date:** 2026-04-10
**Status:** Complete
**Research:** `docs/research/schema-editing/content-type-editing-ux-research.md`, web research on form builder UX patterns
**Audit ref:** `clef-base/docs/usability-audit.md` — GAP 3 (Form Builder), P1 #5
**New widgets:** 9
**New concepts:** 1 (FormSpec)
**Modified components:** CreateForm.tsx, FormMode.tsx, FieldWidget.tsx, InlineEdit.tsx, EntityDetailView.tsx
**New views:** 2 (form-editor, form-list)

---

## 0. Problem Statement

The usability audit identified that Clef Base has no UI for designing forms. Users can't:
- Pick which fields appear on a create/edit form
- Set field order, grouping, or validation
- Create multi-step forms
- Add conditional visibility
- Use typed inputs beyond text/textarea/select

Forms are entirely driven by InteractionSpec seeds — users can't create or modify
forms without editing JSON or YAML files.

### What Exists Today

| Component | Types Supported | Validation | Conditional Logic |
|---|---|---|---|
| CreateForm.tsx | text, textarea, select | HTML5 required only | None |
| FormMode.tsx | text, textarea, select, boolean, json | None | mutability only |
| FieldWidget.tsx | text, textarea, select, boolean, json | None | None |
| InlineEdit.tsx | text only | None | None |

### What's Needed

A form builder that lets users visually configure forms per schema, with:
- Full field type coverage (14+ types from FieldDefinition)
- Validation rules (required, min/max, regex, unique, custom expressions)
- Conditional visibility (show/hide fields based on other field values)
- Field groups and sections (tabs, accordions, columns)
- Multi-step wizard forms
- Default values and placeholder text
- Live preview of the form being designed

---

## 1. Architecture — Three Separable Concerns (Drupal Pattern)

Following the Drupal model and Clef's concept decomposition:

| Concern | Concept | What It Controls |
|---|---|---|
| **Storage** | FieldDefinition | Field type, cardinality, validation rules, machine ID |
| **Edit form** | FormSpec (NEW) | Which fields appear, in what order, grouped how, with what widget, conditional visibility |
| **Read display** | PresentationSpec + ProjectionSpec | Which fields show, with what formatter, in what layout |

FormSpec is independent of FieldDefinition (Jackson's rule). FormSpec says "show fields
A, B, C in this order with these groups." FieldDefinition says "field A is a date with
min=today." The sync wires them together.

---

## 2. FormSpec Concept (NEW)

```
concept FormSpec [F] {
  purpose {
    Declare how a schema's fields are presented for editing — field order,
    grouping, conditional visibility, widget overrides, and multi-step flow.
    Independent of storage types (FieldDefinition) and read display
    (PresentationSpec). A single schema can have multiple FormSpecs
    (e.g., "quick create" vs "full edit" vs "admin form").
  }

  state {
    forms: set F
    schema:     F -> String
    name:       F -> String
    mode:       F -> String       // "create" | "edit" | "both"
    steps:      F -> String       // JSON: FormStep[] (multi-step)
    layout:     F -> String       // JSON: FormLayout (groups, sections)
    conditions: F -> String       // JSON: FieldCondition[] (show/hide rules)
    defaults:   F -> String       // JSON: { fieldId: defaultValue }
    overrides:  F -> String       // JSON: { fieldId: { widget, placeholder, helpText } }
  }

  actions {
    create(form: F, schema: String, name: String, mode: String)
    update(form: F, layout: String, steps: String, conditions: String, defaults: String)
    addField(form: F, fieldId: String, group: String, position: Int)
    removeField(form: F, fieldId: String)
    reorderField(form: F, fieldId: String, position: Int)
    addCondition(form: F, fieldId: String, condition: String)
    removeCondition(form: F, fieldId: String)
    addStep(form: F, title: String, position: Int)
    removeStep(form: F, stepIndex: Int)
    get(form: F)
    list(schema: String)
    resolve(schema: String, mode: String)
    remove(form: F)
  }
}
```

### FormLayout JSON Shape

```json
{
  "groups": [
    {
      "id": "basic",
      "label": "Basic Info",
      "type": "section",         // section | tab | accordion | fieldset | columns
      "fields": ["title", "description", "status"],
      "columns": 2               // optional: multi-column within group
    },
    {
      "id": "metadata",
      "label": "Metadata",
      "type": "accordion",
      "fields": ["tags", "category", "publishDate"],
      "collapsed": true
    }
  ]
}
```

### FieldCondition JSON Shape

```json
[
  {
    "fieldId": "publishDate",
    "showWhen": {
      "field": "status",
      "operator": "equals",
      "value": "published"
    }
  },
  {
    "fieldId": "rejectionReason",
    "showWhen": {
      "field": "status",
      "operator": "equals",
      "value": "rejected"
    }
  }
]
```

### FormStep JSON Shape (Multi-Step)

```json
[
  { "title": "Basic Info", "groups": ["basic"] },
  { "title": "Details", "groups": ["metadata", "relations"] },
  { "title": "Review", "groups": ["*"], "readOnly": true }
]
```

---

## 3. Typed Field Inputs — FieldWidget Upgrade

The current FieldWidget supports 5 types. We need 14+:

| Field Type | Widget | Validation |
|---|---|---|
| text | Text input | minLength, maxLength, regex |
| textarea | Auto-growing textarea | minLength, maxLength |
| number | Numeric input with stepper | min, max, step |
| date | Date picker (calendar popup) | min date, max date |
| datetime | Date + time picker | min, max |
| boolean | Toggle switch | — |
| select | Dropdown | allowedValues |
| multi-select | Tag chip picker | minItems, maxItems |
| relation | Reference picker (entity search) | target schema |
| media | File upload + preview | accept types, maxSize |
| url | URL input with validation | pattern |
| email | Email input | pattern |
| rich-text | Block editor (mini) | — |
| json | Code editor (monospace) | JSON.parse validation |
| person | User reference picker | — |
| file | File attachment | accept, maxSize |

Each field type maps to a widget via a **FieldTypeRegistry** — a simple
map from type string to React component. TypedValueInput already exists
for the filter UI; we extend it for form contexts with validation support.

---

## 4. Validation Engine

### Client-Side Validation

A lightweight validation runner that takes a FieldDefinition's `validations`
JSON and a value, returns errors:

```typescript
interface ValidationRule {
  type: 'required' | 'min-length' | 'max-length' | 'min-value' | 'max-value'
       | 'regex' | 'allowed-values' | 'unique' | 'custom-expression';
  params: Record<string, unknown>;
  message?: string;  // custom error message
}

function validateField(value: unknown, rules: ValidationRule[]): string[];
```

### Validation UX

Following research best practices:
- **Don't validate on every keystroke** — validate on blur or after a brief pause
- **Inline errors** — show below the field, not in a summary at the top
- **Error ↔ input linking** — aria-describedby connects error to field
- **Required indicator** — asterisk on label, not just red border on submit

---

## 5. Conditional Visibility

### How It Works

1. FormSpec stores `conditions` — an array of `{ fieldId, showWhen }` rules
2. The form renderer evaluates `showWhen` against current form values
3. Hidden fields are unmounted (not just display:none) — they don't submit values
4. Conditions can be chained: field C depends on B depends on A (daisy-chain)
5. **Constraint**: conditional field must reference a field that appears *before* it in the form order (Airtable pattern — prevents circular dependencies)

### Operators

| Operator | Description |
|---|---|
| equals | Field value === target |
| not-equals | Field value !== target |
| contains | String contains substring |
| is-empty | Field is null/undefined/"" |
| is-not-empty | Field has a value |
| any-of | Field value is in array of targets |
| greater-than | Numeric comparison |
| less-than | Numeric comparison |

---

## 6. Widget Specs

### 6.1 form-builder Widget

The main form design surface.

```
widget form-builder {
  anatomy {
    root, canvas, fieldList, fieldRow, fieldLabel, fieldTypeBadge,
    fieldDragHandle, fieldRemoveButton, fieldConfigButton,
    groupHeader, groupDropZone, addFieldButton, addGroupButton,
    stepTabBar, stepTab, addStepButton, previewPane,
    conditionIndicator, requiredIndicator
  }

  states: idle [initial], dragging-field, configuring-field, adding-field, previewing

  connect: FormSpec, FieldDefinition, Schema
}
```

### 6.2 form-field-config Widget

Side panel for configuring a single field within the form builder.

```
widget form-field-config {
  anatomy {
    root, tabs, settingsTab, validationTab, appearanceTab,
    labelInput, placeholderInput, helpTextInput, defaultValueInput,
    widgetPicker, requiredToggle, conditionalSection,
    conditionFieldPicker, conditionOperator, conditionValue,
    addConditionButton, removeConditionButton
  }

  states: closed [initial], open, editing-condition

  props: fieldDefinition, formSpec, onUpdate
}
```

### 6.3 form-preview Widget

Live preview of the form being designed.

```
widget form-preview {
  anatomy {
    root, formContainer, stepIndicator, fieldGroup, fieldSlot,
    validationMessage, submitButton, resetButton,
    deviceFrame, deviceToggle
  }

  states: idle [initial], filling, validating, submitted

  props: formSpec, fieldDefinitions, deviceMode (desktop | tablet | mobile)
}
```

### 6.4 form-step-editor Widget

Configure multi-step form steps.

```
widget form-step-editor {
  anatomy {
    root, stepList, stepCard, stepTitle, stepGroupList,
    stepGroupChip, addGroupButton, removeStepButton,
    dragHandle, progressPreview
  }

  states: idle [initial], editing-step, dragging-step

  props: steps, groups, onUpdate
}
```

### 6.5 form-group-editor Widget

Configure field groups (sections, tabs, columns, accordions).

```
widget form-group-editor {
  anatomy {
    root, groupTypeSelector, groupLabelInput, groupFieldList,
    fieldChip, addFieldButton, removeFieldButton,
    columnCountSelector, collapsedToggle, dragHandle
  }

  states: idle [initial], editing, dragging-field

  props: group, availableFields, onUpdate
}
```

### 6.6 form-condition-editor Widget

Visual editor for conditional visibility rules.

```
widget form-condition-editor {
  anatomy {
    root, conditionList, conditionRow, fieldPicker,
    operatorPicker, valuePicker, removeButton,
    addButton, previewIndicator
  }

  states: idle [initial], adding, editing

  props: conditions, availableFields, onUpdate
}
```

### 6.7 typed-field-input Widget (upgrade of FieldWidget)

Enhanced field input that morphs based on field type with validation.

```
widget typed-field-input {
  anatomy {
    root, label, requiredIndicator, input, helpText,
    validationMessage, characterCount
  }

  states: idle [initial], focused, valid, invalid, disabled

  props: fieldDefinition, value, onChange, validationRules, showValidation

  behavior:
    text → text input with character count
    number → numeric stepper with min/max
    date → calendar picker
    boolean → toggle switch
    select → dropdown with search
    multi-select → tag chip picker
    relation → entity reference picker
    media → file upload with preview
    rich-text → mini block editor
    json → code textarea
    url → url input with link preview
    email → email input with validation
}
```

### 6.8 form-renderer Widget

Runtime form renderer that reads FormSpec and FieldDefinitions.

```
widget form-renderer {
  anatomy {
    root, stepBar, stepContent, fieldGroup, groupHeader,
    fieldSlot, navigationButtons, prevButton, nextButton,
    submitButton, progressBar, errorSummary
  }

  states: idle [initial], filling, step-transitioning, validating, submitting, submitted, error

  connect: FormSpec, FieldDefinition, Schema
}
```

### 6.9 field-type-picker Widget

Grouped, icon-driven field type selector (Drupal 10.2 pattern).

```
widget field-type-picker {
  anatomy {
    root, searchInput, typeGrid, typeGroup, typeGroupLabel,
    typeOption, typeIcon, typeLabel, typeDescription
  }

  states: closed [initial], open, searching

  groups:
    Text: plain-text, formatted, long-text
    Number: integer, decimal, currency, percentage
    Date/Time: date, datetime, duration
    Choice: boolean, select, multi-select, rating
    Reference: relation, person, file, media
    Special: url, email, json, rich-text, formula
}
```

---

## 7. Syncs

### 7.1 form-spec-from-schema Sync

When a schema is created, auto-generate a default FormSpec with all fields
in definition order, single group, no conditions.

```
when Schema/defineSchema completes ok
then FormSpec/create with all FieldDefinition fields in order
```

### 7.2 field-added-updates-form Sync

When a FieldDefinition is added to a schema, append it to the default FormSpec.

```
when FieldDefinition/create completes ok
then FormSpec/addField to default form for that schema
```

### 7.3 field-removed-updates-form Sync

When a FieldDefinition is removed, remove it from all FormSpecs for that schema.

```
when FieldDefinition/remove completes ok
then FormSpec/removeField from all forms for that schema
```

### 7.4 form-resolve-wires-interaction Sync

When a view's InteractionSpec has a createForm, resolve the FormSpec for that
schema+mode and use it to generate the field configuration.

```
when InteractionSpec/resolve completes ok
then FormSpec/resolve for the target schema
```

---

## 8. Integration Points in Clef Base

### 8.1 CreateForm.tsx Upgrade

Replace the current simple modal with a FormSpec-driven renderer:
1. When CreateForm opens, invoke `FormSpec/resolve(schema, "create")`
2. If a FormSpec exists, render fields using typed-field-input per FieldDefinition
3. Apply conditional visibility rules in real-time
4. Run validation on blur/submit
5. If multi-step, show step navigation
6. Fallback to current behavior when no FormSpec exists

### 8.2 FormMode.tsx Upgrade

Replace the static field list with FormSpec-driven layout:
1. Invoke `FormSpec/resolve(schema, "edit")`
2. Render field groups (sections/tabs/accordions)
3. Apply conditional visibility
4. Typed inputs per FieldDefinition
5. Validation on blur

### 8.3 InlineEdit.tsx Upgrade

Make inline editing type-aware:
1. Look up FieldDefinition for the field being edited
2. Render appropriate typed input (date picker, number stepper, etc.)
3. Validate before saving

### 8.4 EntityDetailView.tsx

Wire the form builder access point:
- Add "Edit Form" gear icon next to the schema name in the property sidebar
- Opens the form-builder for that schema

### 8.5 New Routes

| Route | Component | Purpose |
|---|---|---|
| `/admin/forms` | form-list view | Browse all FormSpecs |
| `/admin/forms/{schemaId}` | form-builder | Visual form designer |
| `/admin/forms/{schemaId}/{formName}` | form-builder | Edit specific form variant |

### 8.6 Navigation

Add "Forms" destination to sidebar under Design Tools group (alongside View Builder, Display Modes, etc.)

---

## 9. .view Files

### form-list.view

Lists all FormSpecs with schema name, mode, field count, step count.

### form-editor.view

The form builder view itself — detail display with the form-builder widget.

---

## 10. Implementation Cards

| Card | What | Blocked By | Priority |
|---|---|---|---|
| **MAG-601** ✅ FormSpec concept + handler (121 tests) | — | high |
| **MAG-602** ✅ Validation engine (48 tests) | — | high |
| **MAG-603** ✅ FieldWidget upgrade → 19 field types | MAG-602 | high |
| **MAG-604** ✅ Conditional visibility engine (28 tests) | — | high |
| **MAG-605** ✅ Widget specs: form-builder, form-field-config, form-preview | — | high |
| **MAG-606** ✅ Widget specs: form-step-editor, form-group-editor, form-condition-editor | — | medium |
| **MAG-607** ✅ Widget specs: form-renderer, field-type-picker, form-field-input | — | medium |
| **MAG-608** ✅ React: FormRenderer (570 lines, groups/steps/conditions/validation) | MAG-601–604 | high |
| **MAG-609** ✅ React: FormBuilder (3-column design surface, drag-drop, auto-save) | MAG-605, 606, 608 | high |
| **MAG-610** ✅ React: CreateForm upgrade (FormSpec-driven with fallback) | MAG-608 | medium |
| **MAG-611** ✅ React: FormMode upgrade (FormSpec-driven with diff) | MAG-608 | medium |
| **MAG-612** ✅ React: InlineEdit upgrade (10 typed inputs + validation) | MAG-603 | medium |
| **MAG-613** ✅ Syncs: 4 sync files wiring FormSpec lifecycle | MAG-601 | medium |
| **MAG-614** ✅ Seeds + routes + navigation + .view files | MAG-608, 609 | medium |
| **MAG-615** ✅ Tests: 200 total (121 conformance + 48 validation + 28 conditions + 3 views) | MAG-601–614 | medium |

---

## 11. UX Principles (from Research)

1. **Schema drives structure, FormSpec drives presentation** — same field can appear differently on different forms
2. **Progressive disclosure** — start with a flat field list, add groups/steps/conditions as needed
3. **Live preview** — always show what the user will see, with device frame toggle
4. **Validate on blur, not keystroke** — don't punish users mid-typing
5. **Inline errors linked to fields** — aria-describedby, not alert boxes
6. **Drag-and-drop + keyboard alternatives** — always provide arrow buttons alongside drag handles
7. **Conditional chaining forwards only** — field B depends on A, C depends on B (no circular refs)
8. **Default form auto-created** — every schema gets a default FormSpec on creation
9. **Fallback gracefully** — if no FormSpec exists, render all fields in definition order (current behavior)
10. **Multi-step = grouped groups** — steps just reference group IDs, no special model
