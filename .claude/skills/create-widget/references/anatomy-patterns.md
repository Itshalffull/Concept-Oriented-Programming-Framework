# Common Anatomy Patterns by Widget Category

Reference guide for structuring widget anatomy parts across different widget categories. Each pattern shows the typical parts, their roles, and when to include optional parts.

## Feedback Widgets (dialog, toast, alert, tooltip, popover)

These widgets overlay or augment the main content to communicate information or capture a decision.

**Core pattern:**

```
anatomy {
  root:         container  { Top-level wrapper; provides stacking context }
  trigger:      action     { Element that opens/activates the feedback }
  backdrop:     overlay    { Semi-transparent layer blocking background interaction }
  positioner:   container  { Collision-aware floating container anchored to trigger }
  content:      container  { Visible surface holding all inner parts }
  title:        text       { Heading labelling the feedback for sighted and AT users }
  description:  text       { Supplementary prose explaining purpose or context }
  closeTrigger: action     { Explicit close/dismiss button }
}
```

**When to include each part:**

| Part | Include when... |
|------|----------------|
| `trigger` | Widget is opened by user interaction (dialog, popover, tooltip) |
| `backdrop` | Widget is modal (dialog, alert-dialog, drawer) |
| `positioner` | Widget floats relative to a trigger (tooltip, popover, hover-card) |
| `title` | Widget has a heading (dialog, alert, drawer) |
| `description` | Widget has explanatory text beyond the title |
| `closeTrigger` | Widget can be explicitly dismissed (dialog, drawer, toast) |
| `arrow` | Widget points to its trigger (tooltip, popover) |

**Tooltip variant (minimal):**

```
anatomy {
  root:       container  { Wrapper binding trigger and tooltip }
  trigger:    container  { Element whose hover/focus reveals the tooltip }
  positioner: container  { Collision-aware floating container }
  content:    container  { Visible tooltip surface }
  arrow:      container  { Directional indicator pointing to trigger }
}
```

**Toast variant (auto-dismissing):**

```
anatomy {
  root:         container  { Wrapper for a single toast notification }
  icon:         container  { Status icon (success, error, warning, info) }
  title:        text       { Brief summary of the notification }
  description:  text       { Additional detail text }
  closeTrigger: action     { Manual dismiss button }
  action:       action     { Optional call-to-action button }
  progress:     container  { Optional auto-dismiss countdown indicator }
}
```

## Navigation Widgets (tabs, accordion, breadcrumb, menu, sidebar)

These widgets help users navigate between content sections or execute commands.

**Tabs pattern:**

```
anatomy {
  root:      container  { Top-level wrapper grouping tab list and panels }
  list:      container  { Strip holding all tab triggers }
  trigger:   action     { Individual tab button }
  content:   container  { Panel displaying content for the active tab }
  indicator: container  { Animated underline marking the active tab }
}
```

**Accordion pattern:**

```
anatomy {
  root:      container  { Wrapper grouping all accordion items }
  item:      container  { Individual collapsible section }
  trigger:   action     { Heading button that toggles the section }
  indicator: container  { Caret showing expanded/collapsed state }
  content:   container  { Collapsible panel holding the section body }
}
```

**Menu pattern:**

```
anatomy {
  root:          container  { Top-level wrapper }
  trigger:       action     { Button that opens the menu }
  positioner:    container  { Floating container for the menu }
  content:       container  { Menu surface holding all items }
  item:          action     { Standard menu item }
  itemIcon:      container  { Leading icon for a menu item }
  itemLabel:     text       { Text label for a menu item }
  separator:     presentation { Visual divider between groups }
  group:         container  { Logical grouping of related items }
  groupLabel:    text       { Label for a group }
  submenuTrigger: action    { Item that opens a nested submenu }
}
```

**Breadcrumb pattern:**

```
anatomy {
  root:      container  { Navigation wrapper }
  list:      container  { Ordered list of breadcrumb items }
  item:      container  { Individual breadcrumb step }
  link:      action     { Clickable link to a previous level }
  separator: presentation { Visual separator between items }
}
```

## Form Control Widgets (select, checkbox, radio, slider, input)

These widgets capture user input and bind to concept state fields.

**Select/dropdown pattern:**

```
anatomy {
  root:          container  { Outermost wrapper grouping label and dropdown }
  label:         text       { Visible label describing the field }
  trigger:       action     { Button showing current value, opens dropdown }
  valueDisplay:  text       { Text of the currently selected option }
  indicator:     container  { Dropdown arrow/chevron }
  positioner:    container  { Floating positioning wrapper }
  content:       container  { Scrollable list container }
  item:          action     { Individual selectable option }
  itemLabel:     text       { Option text }
  itemIndicator: container  { Check mark for the selected option }
}
```

**Checkbox/toggle pattern:**

```
anatomy {
  root:      container  { Wrapper for the control and its label }
  control:   action     { The checkbox/toggle visual element }
  indicator: container  { Check mark or toggle thumb }
  label:     text       { Descriptive label for the control }
}
```

**Slider pattern:**

```
anatomy {
  root:    container  { Wrapper for the full slider }
  track:   container  { Background track showing the value range }
  range:   container  { Filled portion of the track }
  thumb:   action     { Draggable handle for setting the value }
  label:   text       { Descriptive label }
  output:  text       { Current value display }
}
```

**Text input pattern:**

```
anatomy {
  root:    container  { Wrapper for the input field }
  label:   text       { Descriptive label }
  input:   interactive { The text input element }
  helper:  text       { Help text below the input }
  error:   text       { Validation error message }
  prefix:  container  { Optional leading icon or text }
  suffix:  container  { Optional trailing icon or text }
}
```

## Data Display Widgets (data-table, list, card, chart, timeline)

These widgets present structured data in various formats.

**Data table pattern:**

```
anatomy {
  root:          container  { Top-level wrapper with scroll context }
  header:        container  { Table header region }
  headerRow:     container  { Row of column headings }
  headerCell:    action     { Individual column heading (clickable if sortable) }
  body:          container  { Table body with data rows }
  row:           container  { Single data row }
  cell:          container  { Individual data cell }
  footer:        container  { Optional footer for summary or pagination }
  sortIndicator: container  { Sort direction indicator }
  pagination:    widget     { Pagination controls }
}
```

**Card pattern:**

```
anatomy {
  root:    container  { Card wrapper with elevation }
  header:  container  { Top section with title and actions }
  title:   text       { Card heading }
  body:    container  { Main content area }
  footer:  container  { Bottom section with actions or metadata }
  media:   container  { Optional image or media section }
}
```

**List pattern:**

```
anatomy {
  root:       container  { List wrapper }
  item:       container  { Individual list entry }
  itemIcon:   container  { Leading icon or avatar }
  itemLabel:  text       { Primary text }
  itemMeta:   text       { Secondary text or metadata }
  itemAction: action     { Trailing action button }
  separator:  presentation { Divider between items }
  empty:      text       { Message when list is empty }
}
```

## Complex Input Widgets (date-picker, color-picker, file-upload, rich-text-editor)

These widgets handle complex input patterns that go beyond simple form controls.

**Date picker pattern:**

```
anatomy {
  root:        container  { Top-level wrapper }
  trigger:     action     { Button showing current date, opens calendar }
  positioner:  container  { Floating container for calendar }
  content:     container  { Calendar surface }
  header:      container  { Month/year navigation bar }
  prevButton:  action     { Navigate to previous month }
  nextButton:  action     { Navigate to next month }
  title:       text       { Current month and year display }
  grid:        container  { Calendar day grid }
  dayLabel:    text       { Day-of-week column header }
  day:         action     { Individual day cell }
}
```

**File upload pattern:**

```
anatomy {
  root:       container  { Top-level wrapper }
  dropzone:   interactive { Drag-and-drop target area }
  trigger:    action     { Browse button to open file picker }
  label:      text       { Instructions text }
  fileList:   container  { List of selected/uploaded files }
  fileItem:   container  { Individual file entry }
  fileName:   text       { File name display }
  fileSize:   text       { File size display }
  progress:   container  { Upload progress indicator }
  remove:     action     { Remove file button }
}
```

## Composite Widgets (master-detail, filter-builder, faceted-search)

These widgets compose multiple simpler widgets into a higher-level pattern.

**Master-detail pattern:**

```
anatomy {
  root:       container  { Layout wrapper for master and detail panels }
  masterPane: container  { List/selection panel }
  detailPane: container  { Content panel showing selected item details }
  divider:    interactive { Resizable divider between panes }
  empty:      text       { Message when no item is selected }
}
```

**Filter builder pattern:**

```
anatomy {
  root:        container  { Wrapper for the filter builder }
  ruleList:    container  { List of filter rules }
  rule:        container  { Individual filter rule row }
  fieldSelect: widget     { Field selector dropdown }
  opSelect:    widget     { Operator selector dropdown }
  valueInput:  widget     { Value input field }
  addButton:   action     { Add new rule button }
  removeButton: action    { Remove rule button }
  groupOp:     action     { AND/OR toggle between rules }
}
```

## General Anatomy Guidelines

1. **Every widget needs `root: container`** -- The root is always the outermost wrapper.

2. **Use `action` for anything clickable** -- Triggers, buttons, selectable items, sortable headers.

3. **Use `text` for any displayed text** -- Labels, titles, descriptions, error messages. This enables independent styling and ARIA references.

4. **Use `container` for structural grouping** -- Headers, footers, content areas, lists.

5. **Use `presentation` for decorative elements** -- Separators, arrows, indicators that are `aria-hidden`.

6. **Use `overlay` for backdrop/scrim elements** -- Semi-transparent layers behind modal content.

7. **Use `widget` when a part is implemented by a composed child widget** -- Pagination, embedded selects, etc.

8. **Use `interactive` for raw input elements** -- Text inputs, textareas, draggable surfaces.

9. **Naming convention: always camelCase** -- `closeTrigger`, not `close-trigger` or `CloseButton`.

10. **Part names describe function, not appearance** -- `indicator` not `chevron`, `trigger` not `button`, `content` not `panel`.
