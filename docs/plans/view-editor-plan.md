# View Editor — Implementation Plan

**Version:** 1.0.0
**Date:** 2026-04-10
**Status:** Complete
**Research:** `docs/research/views/view-editor-research.md`
**Patterns implemented:** 5 of 5 (toolbar-with-popovers, stepwise notebook, dual-mode, tab bar, filter pills)
**New widgets:** 15
**New views:** 2 (view-editor, view-creation)
**Modified components:** ViewEditor.tsx, ViewRenderer.tsx

---

## 0. Current State

ViewEditor.tsx exists with basic popovers (FilterConfigurator, SortGroupConfigurator, FieldConfigurator, SourceSelector, StyleSelector). But it lacks:
- Toolbar layout with per-concept buttons
- Filter pills showing active filters at a glance
- Field type-aware operator/value inputs
- View tab bar with saved views
- Display mode switcher
- Step-by-step view creation flow
- Code mode toggle

The concepts are solid (FilterSpec, SortSpec, GroupSpec, ProjectionSpec, PresentationSpec, InteractionSpec, ViewShell, FilterRepresentation). The gap is entirely UI.

---

## 1. Pattern 1 — Toolbar-with-Popovers (Default Editor)

The "home screen" of view editing. Every existing view gets this automatically.

### 1.1 view-editor-toolbar Widget

The horizontal bar above every data view.

```
widget view-editor-toolbar {
  anatomy {
    root, viewTabBar, viewTab, activeViewIndicator, addViewButton,
    viewMenuButton, toolbarRow, filterButton, sortButton, groupButton,
    fieldsButton, layoutButton, sourceButton, saveButton,
    unsavedIndicator, filterPillBar, filterPill, filterPillField,
    filterPillOperator, filterPillValue, filterPillRemove, addFilterPill
  }

  states: collapsed [initial], expanded, saving

  connect:
    ViewShell (active view), FilterSpec, SortSpec, GroupSpec,
    ProjectionSpec, PresentationSpec, DataSourceSpec
}
```

### 1.2 filter-popover Widget

Opens from the Filter toolbar button.

```
widget filter-popover {
  anatomy {
    root, conditionList, conditionRow, fieldPicker, operatorPicker,
    valueInput, conjunctionToggle, removeCondition, addConditionButton,
    addGroupButton, conditionGroup, groupConjunction,
    saveForEveryoneCheckbox
  }

  states: closed [initial], open, adding-condition

  props: schema, currentFilter (FilterSpec JSON), onApply
}
```

### 1.3 sort-popover Widget

```
widget sort-popover {
  anatomy {
    root, sortList, sortRow, fieldPicker, directionToggle,
    dragHandle, removeSortButton, addSortButton
  }

  states: closed [initial], open

  props: schema, currentSort (SortSpec JSON), onApply
}
```

### 1.4 group-popover Widget

```
widget group-popover {
  anatomy {
    root, groupFieldPicker, sortWithinGroup, hideEmptyToggle,
    defaultCollapseToggle
  }

  states: closed [initial], open

  props: schema, currentGroup (GroupSpec JSON), onApply
}
```

### 1.5 fields-popover Widget

```
widget fields-popover {
  anatomy {
    root, searchInput, fieldList, fieldRow, fieldCheckbox,
    fieldLabel, fieldTypeBadge, dragHandle, showAllButton,
    hideAllButton, addFieldButton
  }

  states: closed [initial], open, searching

  props: schema, currentProjection (ProjectionSpec JSON), onApply
}
```

### 1.6 display-mode-switcher Widget

```
widget display-mode-switcher {
  anatomy {
    root, modeList, modeOption, modeIcon, modeLabel,
    rowHeightSelector, cardCoverPicker
  }

  states: idle [initial], selecting

  props: currentMode, availableModes, onSelect
}
```

### 1.7 filter-pill Widget (reusable)

A single active filter displayed as a clickable chip.

```
widget filter-pill {
  anatomy {
    root, fieldSegment, operatorSegment, valueSegment, removeButton
  }

  states: idle [initial], editing-field, editing-operator, editing-value

  props: field, operator, value, fieldType, onEdit, onRemove
}
```

---

## 2. Cross-Cutting Widgets (used by all patterns)

### 2.1 typed-value-input Widget

The single most important reusable component. Morphs based on field type.

```
widget typed-value-input {
  anatomy {
    root, textInput, numberInput, datePickerInput, selectInput,
    multiSelectInput, relationPickerInput, booleanToggle,
    relativePresetList, relativePreset
  }

  states: idle [initial], focused, selecting

  props: fieldType, value, onChange, schema (for relation targets)

  behavior:
    text → free text input
    number → numeric stepper with min/max
    date → calendar picker with relative presets (last 7 days, this month, etc.)
    select → dropdown of options
    multi-select → tag chip picker
    relation → reference-picker (from schema editor)
    boolean → toggle (or no input for "is empty")
    rich-text → not filterable (hidden)
}
```

### 2.2 operator-dropdown Widget

Context-sensitive operators based on field type.

```
widget operator-dropdown {
  anatomy {
    root, selectedOperator, dropdownList, operatorOption
  }

  props: fieldType, currentOperator, onChange

  operators by type:
    text: is, is not, contains, does not contain, starts with, ends with, is empty, is not empty
    number: =, ≠, >, ≥, <, ≤, between, is empty
    date: is, is before, is after, is on or before, is on or after, is within, is empty
    select: is, is not, is any of, is none of, is empty
    multi-select: has any of, has all of, has none of, is empty
    relation: is, is not, is any of, is empty
    boolean: is true, is false
}
```

### 2.3 field-picker-dropdown Widget

Searchable field list grouped by type.

```
widget field-picker-dropdown {
  anatomy {
    root, searchInput, fieldList, fieldGroup, fieldGroupLabel,
    fieldOption, fieldIcon, fieldLabel
  }

  props: schema, selectedField, onChange, groupBy (type | source)
}
```

---

## 3. Pattern 2 — Stepwise Notebook (View Creation)

Accessed via "Create View" button or when promoting a saved search.

### 3.1 view-creation-notebook Widget

```
widget view-creation-notebook {
  anatomy {
    root, stepList, stepCard, stepNumber, stepTitle, stepContent,
    stepPreviewButton, stepPreviewCount, stepConnector,
    dataSourceStep, filterStep, fieldsStep, groupStep, sortStep,
    displayStep, previewPane, previewTable, previewCount,
    codeToggleButton, saveButton, cancelButton
  }

  states: editing [initial], previewing, saving

  steps (in pipeline order):
    1. Data Source — collection picker + join button
    2. Filter — inline condition rows (reuses filter-popover content)
    3. Fields — chip row with drag handles (reuses fields-popover content)
    4. Group — field picker + display options
    5. Sort — field + direction rows
    6. Display — layout type segmented control + options

  per-step preview: [▶ N] button shows first 10 rows at that pipeline stage
}
```

---

## 4. Pattern 3 — Dual-Mode Visual↔Code

Toggled from any editor via keyboard shortcut or button.

### 4.1 view-code-editor Widget

```
widget view-code-editor {
  anatomy {
    root, modeToggle, visualPane, codePane, codeInput,
    lineNumbers, syntaxHighlight, autocomplete, cursorPosition,
    syncIndicator, errorHighlight, previewPane
  }

  states: visual-only [initial], code-only, split, syncing, sync-error

  code format: .view file syntax (same as specs/view/views/*.view)

  bidirectional sync:
    visual change → regenerate code
    code change → parse and update visual controls
    sync indicator: "Last synced: just now ✓" or "⚠ Parse error at line N"
}
```

---

## 5. View Management

### 5.1 view-tab-bar Widget

Tab strip showing saved views with type icons.

```
widget view-tab-bar {
  anatomy {
    root, tabList, viewTab, viewTabIcon, viewTabName,
    viewTabUnsavedDot, addViewButton, viewMenuButton,
    viewMenuPopover, renameOption, duplicateOption,
    deleteOption, lockOption, shareOption
  }

  states: idle [initial], menu-open, renaming

  view modes: collaborative (shared, editable), personal (private), locked (visible, read-only)
}
```

### 5.2 Saved search → view promotion

When a user applies ad-hoc filters, a "Save as View" button appears contextually near the filter pills. One click creates a named ViewShell from the current filter/sort/group state.

---

## 6. Views & Destinations

### 6.1 Views

| View | Purpose |
|---|---|
| `view-editor` | Full-page view editor (toolbar + data view + optional panels) |
| `view-creation` | Stepwise notebook for creating new views |

### 6.2 Destinations

The view editor is not a separate destination — it's embedded in every data view. The "Create View" flow is triggered from the view tab bar's [+] button.

---

## 7. Concept Mapping

Each toolbar button / notebook step maps directly to a view suite concept:

| UI Element | Concept | Action on save |
|---|---|---|
| Source selector | DataSourceSpec | DataSourceSpec/create or update |
| Filter popover/pills | FilterSpec | FilterSpec/create or compose |
| Sort popover | SortSpec | SortSpec/create or compose |
| Group popover | GroupSpec | GroupSpec/create |
| Fields popover | ProjectionSpec | ProjectionSpec/create |
| Display switcher | PresentationSpec | PresentationSpec/create |
| View tabs | ViewShell | ViewShell/create or update |

---

## 8. Implementation Cards

| Card | What | Blocked By | Priority |
|---|---|---|---|
| **MAG-593** ✅ Cross-cutting: typed-value-input, operator-dropdown, field-picker-dropdown | — | high |
| **MAG-594** ✅ Toolbar: view-editor-toolbar, filter-pill | MAG-593 | high |
| **MAG-595** ✅ Popovers: filter-popover, sort-popover, group-popover, fields-popover | MAG-593 | high |
| **MAG-596** ✅ Display: display-mode-switcher + view-tab-bar | — | high |
| **MAG-597** ✅ Stepwise: view-creation-notebook | MAG-593, MAG-595 | medium |
| **MAG-598** ✅ Dual-mode: view-code-editor | MAG-594 | medium |
| **MAG-599** ✅ Integration: wire into ViewEditor.tsx + ViewRenderer.tsx | MAG-593–598 | medium |
| **MAG-600** ✅ Tests + .view files for editor views | MAG-593–599 | medium |

---

## 9. Cross-Cutting Best Practices (from research)

Implemented across all patterns:

1. **Auto-apply** — filter/sort/group changes take effect immediately, no "Apply" button
2. **Unsaved changes indicator** — dot on view tab when state differs from saved
3. **Save for everyone** — checkbox in filter popover to promote personal filters to shared
4. **Three view modes** — collaborative (shared), personal (private), locked (read-only)
5. **Field-type-aware operators** — operator-dropdown changes based on field type
6. **Morphing value input** — typed-value-input renders different widget per field type
7. **Per-step preview** — stepwise notebook shows record count after each step
8. **Saved search → view promotion** — contextual "Save as View" when filters are active
9. **Reuse FieldValueInput everywhere** — same typed-value-input in filters, defaults, conditions
