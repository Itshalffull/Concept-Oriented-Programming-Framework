# Clef Surface Widget Library — Implementation Plan

**Scope:** Complete `.widget` specification library covering every UI component, pattern, and interaction cataloged in `docs/reference/ui-library.md` and architected in `docs/architecture/surface-spec.md`.

**Current state:** Zero `.widget` files exist. The infrastructure is built: WidgetParser, WidgetGen, Widget catalog concept, Affordance/Interactor/WidgetResolver concepts, tree-sitter parser handler, symbol extraction, and test framework are all in place.

**Target:** 120+ `.widget` specifications organized into 8 tiers, from atomic primitives through domain-specific composites. Each spec declares anatomy, state machine, accessibility, props, connect mappings, and affordance declarations per the `.widget` format defined in `surface-spec.md` Section 3.1.

**Location:** All `.widget` and `.theme` spec files live in `surface/specs/`, organized by category. This keeps them inside the Surface subsystem alongside the concepts that parse them (`surface/suites/surface-spec/`) and the per-framework renderers that consume them (`surface/widgets/`).

---

## Tier structure

| Tier | Name | Widget count | Description |
|------|------|-------------|-------------|
| 0 | Atomic Primitives | 14 | Basic building blocks everything composes from |
| 1 | Form Controls | 16 | Standard affordance-mapped input widgets |
| 2 | Feedback & Overlay | 10 | Dialogs, toasts, tooltips, alerts |
| 3 | Navigation & Layout | 14 | Tabs, menus, toolbars, containers |
| 4 | Data Display | 15 | Tables, cards, lists, charts, badges |
| 5 | Complex Inputs | 12 | Rich text, date pickers, file upload, formula |
| 6 | Composite Patterns | 16 | Query builders, view switchers, property panels |
| 7 | Domain Composites | 25 | Block editors, canvas, workflow, graphs |
| | **Total** | **122** | |

Each tier depends only on tiers below it. Tier 0 has no widget dependencies.

---

## Directory layout

```
surface/
├── specs/
│   ├── widgets/
│   │   ├── primitives/           ← tier 0: atomic building blocks
│   │   ├── form-controls/        ← tier 1: standard inputs
│   │   ├── feedback/             ← tier 2: dialogs, toasts, overlays
│   │   ├── navigation/           ← tier 3: tabs, menus, layout containers
│   │   ├── data-display/         ← tier 4: tables, cards, charts
│   │   ├── complex-inputs/       ← tier 5: date pickers, rich text, file upload
│   │   ├── composites/           ← tier 6: query builders, property panels
│   │   └── domain/               ← tier 7: block editors, canvas, workflow
│   └── themes/
│       ├── light.theme
│       ├── dark.theme
│       └── high-contrast.theme
├── suites/                       ← existing: concepts that process specs
└── widgets/                      ← existing: per-framework rendered output
```

---

## Tier 0: Atomic Primitives

Foundation widgets with no widget dependencies. Every higher-tier widget composes from these.

### 0.01 — button

The fundamental action trigger. All button variants (filled, outline, text, danger, icon-only) are props on a single widget spec.

| Field | Value |
|-------|-------|
| **ARIA pattern** | button |
| **Anatomy** | root (action), label (text), icon (container, optional), spinner (container, optional) |
| **States** | idle → hover → pressed → idle; disabled (parallel); loading (parallel) |
| **Affordance** | serves: action-primary (specificity 10), action-secondary (10), action-tertiary (10), action-danger (10) |
| **Props** | variant: "filled" \| "outline" \| "text" \| "danger" = "filled"; size: "sm" \| "md" \| "lg" = "md"; disabled: Bool = false; loading: Bool = false; type: "button" \| "submit" \| "reset" = "button" |
| **Keyboard** | Enter/Space → activate; focus via Tab |
| **Complexity** | Low |

### 0.02 — text-input

Single-line text entry. Foundation for all text-based inputs.

| Field | Value |
|-------|-------|
| **ARIA pattern** | textbox |
| **Anatomy** | root (container), label (text), input (action), description (text, optional), error (text, optional), prefix (container, optional), suffix (container, optional), clearButton (action, optional) |
| **States** | empty [initial] → filled; idle → focused → idle; valid/invalid (parallel) |
| **Affordance** | serves: text-short (specificity 5, fallback) |
| **Props** | value: String = ""; placeholder: String = ""; required: Bool = false; disabled: Bool = false; readOnly: Bool = false; maxLength: option Int; pattern: option String |
| **Keyboard** | Standard text input; Escape → clear/blur |
| **Complexity** | Low |

### 0.03 — checkbox

Single boolean toggle rendered as a check mark box.

| Field | Value |
|-------|-------|
| **ARIA pattern** | checkbox |
| **Anatomy** | root (container), input (action), control (container), indicator (container), label (text) |
| **States** | unchecked [initial] ↔ checked; indeterminate (parallel state for tree parents) |
| **Affordance** | serves: toggle (specificity 8, condition: density = "compact") |
| **Props** | checked: Bool = false; indeterminate: Bool = false; disabled: Bool = false; required: Bool = false; value: String |
| **Keyboard** | Space → toggle; Tab to navigate |
| **Complexity** | Low |

### 0.04 — label

Text label bound to a form control via `for`/`id` association.

| Field | Value |
|-------|-------|
| **ARIA pattern** | label (native) |
| **Anatomy** | root (text), requiredIndicator (text, optional) |
| **States** | static (no transitions) |
| **Affordance** | serves: display-text (specificity 3, internal use) |
| **Props** | text: String; for: option String; required: Bool = false |
| **Keyboard** | Click transfers focus to associated control |
| **Complexity** | Trivial |

### 0.05 — icon

Decorative or semantic icon container. Wraps SVG/font icons with proper ARIA.

| Field | Value |
|-------|-------|
| **ARIA pattern** | img (when semantic) or presentation (when decorative) |
| **Anatomy** | root (container) |
| **States** | static |
| **Affordance** | N/A (composition primitive) |
| **Props** | name: String; size: "xs" \| "sm" \| "md" \| "lg" = "md"; decorative: Bool = true; label: option String |
| **Keyboard** | N/A |
| **Complexity** | Trivial |

### 0.06 — separator

Visual divider between sections. Horizontal or vertical.

| Field | Value |
|-------|-------|
| **ARIA pattern** | separator |
| **Anatomy** | root (container) |
| **States** | static |
| **Affordance** | N/A (layout primitive) |
| **Props** | orientation: "horizontal" \| "vertical" = "horizontal" |
| **Keyboard** | N/A |
| **Complexity** | Trivial |

### 0.07 — visually-hidden

Screen-reader-only text. No visual rendering.

| Field | Value |
|-------|-------|
| **ARIA pattern** | N/A (CSS technique) |
| **Anatomy** | root (text) |
| **States** | static |
| **Affordance** | N/A (accessibility primitive) |
| **Props** | text: String |
| **Complexity** | Trivial |

### 0.08 — portal

Renders children into a different DOM location (for overlays, popovers).

| Field | Value |
|-------|-------|
| **ARIA pattern** | N/A (rendering primitive) |
| **Anatomy** | root (container) |
| **States** | unmounted [initial] → mounted |
| **Affordance** | N/A (infrastructure primitive) |
| **Props** | target: option String; disabled: Bool = false |
| **Complexity** | Low |

### 0.09 — focus-trap

Contains Tab focus within a boundary. Used by dialog, popover, drawer.

| Field | Value |
|-------|-------|
| **ARIA pattern** | N/A (behavior primitive) |
| **Anatomy** | root (container), sentinelStart (container), sentinelEnd (container) |
| **States** | inactive [initial] → active |
| **Affordance** | N/A (behavior primitive) |
| **Props** | active: Bool = false; initialFocus: option String; returnFocus: Bool = true |
| **Keyboard** | Tab/Shift+Tab cycle within boundary |
| **Complexity** | Medium |

### 0.10 — scroll-lock

Prevents body scroll when active (for modals/overlays).

| Field | Value |
|-------|-------|
| **ARIA pattern** | N/A (behavior primitive) |
| **Anatomy** | root (container) |
| **States** | unlocked [initial] ↔ locked |
| **Affordance** | N/A (behavior primitive) |
| **Props** | active: Bool = false |
| **Complexity** | Low |

### 0.11 — presence

Manages mount/unmount animations. Delays unmount until exit animation completes.

| Field | Value |
|-------|-------|
| **ARIA pattern** | N/A (animation primitive) |
| **Anatomy** | root (container) |
| **States** | unmounted [initial] → mounting → mounted → unmounting → unmounted |
| **Affordance** | N/A (animation primitive) |
| **Props** | present: Bool = false; animateOnMount: Bool = false |
| **Complexity** | Medium |

### 0.12 — avatar

User/entity image with fallback initials.

| Field | Value |
|-------|-------|
| **ARIA pattern** | img |
| **Anatomy** | root (container), image (container), fallback (text) |
| **States** | loading [initial] → loaded \| error |
| **Affordance** | serves: display-media (specificity 8, condition: shape = "circle") |
| **Props** | src: option String; name: String; size: "xs" \| "sm" \| "md" \| "lg" = "md" |
| **Complexity** | Low |

### 0.13 — spinner

Loading/indeterminate progress indicator.

| Field | Value |
|-------|-------|
| **ARIA pattern** | progressbar (indeterminate) |
| **Anatomy** | root (container), track (container), indicator (container), label (text, optional) |
| **States** | spinning (single state, always active when mounted) |
| **Affordance** | serves: display-progress (specificity 6, condition: determinate = false) |
| **Props** | size: "sm" \| "md" \| "lg" = "md"; label: option String |
| **Complexity** | Low |

### 0.14 — chip

Compact element representing an input, attribute, or action. Used in tag inputs, filters.

| Field | Value |
|-------|-------|
| **ARIA pattern** | option (in listbox context) or button (standalone) |
| **Anatomy** | root (container), label (text), deleteButton (action, optional), icon (container, optional) |
| **States** | idle [initial] → selected; deletable (parallel) |
| **Affordance** | serves: display-badge (specificity 8, condition: interactive = true) |
| **Props** | label: String; selected: Bool = false; deletable: Bool = false; disabled: Bool = false; color: option String |
| **Keyboard** | Enter/Space → select; Backspace/Delete → remove (if deletable) |
| **Complexity** | Low |

---

## Tier 1: Form Controls

Standard affordance-mapped widgets. Each directly serves one or more interactor types from the affordance table in `surface-spec.md` Section 6.3.

### 1.01 — textarea

Multi-line text input with auto-resize.

| Field | Value |
|-------|-------|
| **ARIA pattern** | textbox (multiline) |
| **Anatomy** | root (container), label (text), textarea (action), description (text, optional), error (text, optional), charCount (text, optional) |
| **States** | empty [initial] → filled; idle → focused → idle; valid/invalid (parallel) |
| **Affordance** | serves: text-long (specificity 10) |
| **Props** | value: String = ""; rows: Int = 3; autoResize: Bool = true; maxLength: option Int; placeholder: String = "" |
| **Keyboard** | Standard textarea; Enter adds newline (no submit) |
| **Composes** | label (0.04) |
| **Complexity** | Low |

### 1.02 — number-input

Numeric input with optional increment/decrement buttons.

| Field | Value |
|-------|-------|
| **ARIA pattern** | spinbutton |
| **Anatomy** | root (container), label (text), input (action), incrementButton (action), decrementButton (action), description (text, optional), error (text, optional) |
| **States** | idle → focused; valid/invalid (parallel) |
| **Affordance** | serves: number-exact (specificity 5, fallback) |
| **Props** | value: option Float; min: option Float; max: option Float; step: Float = 1; precision: option Int |
| **Keyboard** | ArrowUp/Down → increment/decrement; Home → min; End → max |
| **Composes** | label (0.04), button (0.01) |
| **Complexity** | Medium |

### 1.03 — slider

Range input with thumb on a track. Single or dual thumbs.

| Field | Value |
|-------|-------|
| **ARIA pattern** | slider |
| **Anatomy** | root (container), label (text), track (container), range (container), thumb (action), output (text) |
| **States** | idle [initial] → dragging → idle |
| **Affordance** | serves: number-approx (specificity 10) |
| **Props** | value: Float; min: Float = 0; max: Float = 100; step: Float = 1; orientation: "horizontal" \| "vertical" = "horizontal" |
| **Keyboard** | ArrowLeft/Down → decrease; ArrowRight/Up → increase; Home → min; End → max; PageUp/Down → large step |
| **Composes** | label (0.04) |
| **Complexity** | Medium |

### 1.04 — toggle-switch

On/off toggle with sliding thumb animation.

| Field | Value |
|-------|-------|
| **ARIA pattern** | switch |
| **Anatomy** | root (container), input (action), control (container), thumb (container), label (text) |
| **States** | off [initial] ↔ on |
| **Affordance** | serves: toggle (specificity 10); also toggle (specificity 9, condition: platform = "mobile") for switch variant |
| **Props** | checked: Bool = false; disabled: Bool = false; label: String |
| **Keyboard** | Space → toggle; Enter → toggle |
| **Complexity** | Low |

### 1.05 — radio-group

Single-choice selection from a visible set of options.

| Field | Value |
|-------|-------|
| **ARIA pattern** | radiogroup with radio |
| **Anatomy** | root (container), label (text), items (container), item (container), itemInput (action), itemControl (container), itemLabel (text) |
| **States** | Per item: unselected [initial] ↔ selected |
| **Affordance** | serves: single-choice (specificity 10, condition: maxOptions = 8) |
| **Props** | value: option String; options: list { label: String, value: String, disabled: Bool }; orientation: "horizontal" \| "vertical" = "vertical" |
| **Keyboard** | Arrow keys → navigate options; Space → select focused |
| **Composes** | label (0.04) |
| **Complexity** | Medium |

### 1.06 — radio-card

Visual single-choice cards with comparison layout.

| Field | Value |
|-------|-------|
| **ARIA pattern** | radiogroup with radio |
| **Anatomy** | root (container), label (text), items (container), card (container), cardInput (action), cardContent (container), cardLabel (text), cardDescription (text, optional), cardIcon (container, optional) |
| **States** | Per card: unselected [initial] ↔ selected |
| **Affordance** | serves: single-choice (specificity 12, conditions: maxOptions = 4, comparison = true) |
| **Props** | value: option String; options: list { label: String, value: String, description: option String, icon: option String } |
| **Keyboard** | Arrow keys → navigate; Space → select |
| **Composes** | label (0.04), icon (0.05) |
| **Complexity** | Medium |

### 1.07 — select

Dropdown single-choice selector (native or custom).

| Field | Value |
|-------|-------|
| **ARIA pattern** | listbox (custom) or select (native) |
| **Anatomy** | root (container), label (text), trigger (action), valueDisplay (text), indicator (container), positioner (container), content (container), item (action), itemLabel (text), itemIndicator (container) |
| **States** | closed [initial] ↔ open; idle → focused |
| **Affordance** | serves: single-choice (specificity 5, fallback) |
| **Props** | value: option String; options: list { label: String, value: String, disabled: Bool }; placeholder: String = "Select..." |
| **Keyboard** | Enter/Space/ArrowDown → open; Arrow keys → navigate; Enter → select; Escape → close; typeahead |
| **Composes** | label (0.04), portal (0.08) |
| **Complexity** | High |

### 1.08 — combobox

Searchable single-choice with filtered dropdown.

| Field | Value |
|-------|-------|
| **ARIA pattern** | combobox with listbox |
| **Anatomy** | root (container), label (text), inputWrapper (container), input (action), trigger (action), clearButton (action, optional), positioner (container), content (container), item (action), itemLabel (text), empty (text) |
| **States** | closed [initial] ↔ open; idle → filtering → idle |
| **Affordance** | serves: single-choice (specificity 8, condition: minOptions = 20); single-pick (specificity 10) |
| **Props** | value: option String; inputValue: String = ""; options: list { label: String, value: String }; placeholder: String = "Search..."; allowCustom: Bool = false |
| **Keyboard** | Type → filter; ArrowDown → open/navigate; Enter → select; Escape → close; clear with Backspace on empty |
| **Composes** | text-input (0.02), label (0.04), portal (0.08) |
| **Complexity** | High |

### 1.09 — segmented-control

Inline single-choice as a button group. Desktop-oriented.

| Field | Value |
|-------|-------|
| **ARIA pattern** | radiogroup with radio |
| **Anatomy** | root (container), items (container), item (action), itemLabel (text), indicator (container) |
| **States** | Per item: unselected [initial] ↔ selected; indicator animates between items |
| **Affordance** | serves: single-choice (specificity 11, conditions: maxOptions = 5, platform = "desktop") |
| **Props** | value: String; options: list { label: String, value: String }; size: "sm" \| "md" = "md" |
| **Keyboard** | Arrow keys → navigate; Space/Enter → select |
| **Complexity** | Medium |

### 1.10 — checkbox-group

Multi-choice from a visible set of checkboxes.

| Field | Value |
|-------|-------|
| **ARIA pattern** | group with checkbox |
| **Anatomy** | root (container), label (text), items (container), item (container), itemInput (action), itemControl (container), itemLabel (text) |
| **States** | Per item: unchecked [initial] ↔ checked |
| **Affordance** | serves: multi-choice (specificity 10, condition: maxOptions = 8) |
| **Props** | values: set String; options: list { label: String, value: String, disabled: Bool }; orientation: "horizontal" \| "vertical" = "vertical" |
| **Keyboard** | Tab between items; Space → toggle |
| **Composes** | checkbox (0.03), label (0.04) |
| **Complexity** | Medium |

### 1.11 — multi-select

Dropdown multi-choice with chips in trigger.

| Field | Value |
|-------|-------|
| **ARIA pattern** | listbox (multiselectable) |
| **Anatomy** | root (container), label (text), trigger (container), chipList (container), chip (widget), input (action, optional), positioner (container), content (container), item (action), itemLabel (text), itemIndicator (container) |
| **States** | closed [initial] ↔ open |
| **Affordance** | serves: multi-choice (specificity 5, fallback) |
| **Props** | values: set String; options: list { label: String, value: String }; placeholder: String = "Select..." |
| **Keyboard** | Enter/Space → open; Arrow keys → navigate; Space → toggle item; Escape → close; Backspace → remove last chip |
| **Composes** | chip (0.14), portal (0.08), label (0.04) |
| **Complexity** | High |

### 1.12 — combobox-multi

Searchable multi-choice with autocomplete and chips.

| Field | Value |
|-------|-------|
| **ARIA pattern** | combobox with listbox (multiselectable) |
| **Anatomy** | root (container), label (text), inputWrapper (container), chipList (container), chip (widget), input (action), positioner (container), content (container), item (action), itemLabel (text), empty (text) |
| **States** | closed [initial] ↔ open; filtering |
| **Affordance** | serves: multi-choice (specificity 8, condition: minOptions = 20) |
| **Props** | values: set String; inputValue: String = ""; options: list { label: String, value: String }; placeholder: String = "Search..." |
| **Keyboard** | Type → filter; ArrowDown → open/navigate; Enter → toggle item; Escape → close; Backspace → remove last chip |
| **Composes** | chip (0.14), text-input (0.02), portal (0.08) |
| **Complexity** | High |

### 1.13 — chip-input

Free-form multi-value input with chip display and optional autocomplete.

| Field | Value |
|-------|-------|
| **ARIA pattern** | combobox with listbox |
| **Anatomy** | root (container), label (text), inputWrapper (container), chipList (container), chip (widget), input (action), positioner (container), suggestions (container), suggestion (action), createOption (action, optional) |
| **States** | idle [initial] → typing → suggesting → idle |
| **Affordance** | serves: multi-pick (specificity 10, condition: optionSource = "open") |
| **Props** | values: list String; allowCreate: Bool = true; maxItems: option Int; separator: String = "," |
| **Keyboard** | Enter/comma → create chip; Backspace on empty → delete last; ArrowDown → navigate suggestions |
| **Composes** | chip (0.14), text-input (0.02), portal (0.08) |
| **Complexity** | High |

### 1.14 — stepper

Increment/decrement number input for small domains (1-10).

| Field | Value |
|-------|-------|
| **ARIA pattern** | spinbutton |
| **Anatomy** | root (container), label (text), decrementButton (action), value (text), incrementButton (action) |
| **States** | idle; atMin (decrement disabled); atMax (increment disabled) |
| **Affordance** | serves: number-exact (specificity 10, condition: domain = "1-10") |
| **Props** | value: Int; min: Int = 0; max: Int = 10; step: Int = 1 |
| **Keyboard** | ArrowUp → increment; ArrowDown → decrement |
| **Composes** | button (0.01), label (0.04) |
| **Complexity** | Low |

### 1.15 — progress-bar

Determinate or indeterminate progress indicator bar.

| Field | Value |
|-------|-------|
| **ARIA pattern** | progressbar |
| **Anatomy** | root (container), track (container), fill (container), label (text, optional), valueText (text, optional) |
| **States** | indeterminate [initial]; determinate |
| **Affordance** | serves: display-progress (specificity 10) |
| **Props** | value: option Float; min: Float = 0; max: Float = 100; label: option String |
| **Keyboard** | N/A (display only) |
| **Complexity** | Low |

### 1.16 — badge

Compact status indicator/count. Used on icons, in lists, as tags.

| Field | Value |
|-------|-------|
| **ARIA pattern** | status |
| **Anatomy** | root (container), label (text) |
| **States** | static; dot (no label, just indicator) |
| **Affordance** | serves: display-badge (specificity 10) |
| **Props** | label: option String; variant: "filled" \| "outline" \| "dot" = "filled"; color: option String; max: option Int |
| **Complexity** | Trivial |

---

## Tier 2: Feedback & Overlay

Components that appear above the page surface to communicate information or collect focused input.

### 2.01 — dialog

Modal overlay with focus trap, backdrop, and escape-to-close. The reference `.widget` example from `surface-spec.md` Section 3.1.

| Field | Value |
|-------|-------|
| **ARIA pattern** | dialog |
| **Anatomy** | root (container), trigger (action), backdrop (overlay), positioner (container), content (container), title (text), description (text), closeTrigger (action) |
| **Slots** | header (before title), body (after description), footer (end of content) |
| **States** | closed [initial] ↔ open; entry: [trapFocus, preventScroll, setAriaHidden]; exit: [releaseFocus, restoreScroll, clearAriaHidden] |
| **Affordance** | serves: overlay (specificity 10, condition: modal = true) |
| **Props** | open: Bool = false; closeOnOutsideClick: Bool = true; closeOnEscape: Bool = true; role: "dialog" \| "alertdialog" = "dialog" |
| **Keyboard** | Escape → close; Tab → trapped within content |
| **Composes** | portal (0.08), focus-trap (0.09), scroll-lock (0.10), presence (0.11) |
| **Complexity** | High |

### 2.02 — alert-dialog

Confirmation dialog that requires explicit user action. No outside-click dismiss.

| Field | Value |
|-------|-------|
| **ARIA pattern** | alertdialog |
| **Anatomy** | Same as dialog but role = "alertdialog" |
| **States** | Same as dialog |
| **Affordance** | serves: overlay (specificity 12, condition: modal = true, requiresAction = true) |
| **Props** | Extends dialog with: role = "alertdialog" (fixed); closeOnOutsideClick = false (fixed) |
| **Keyboard** | Escape → does NOT close (must click action); Tab trapped |
| **Composes** | dialog (2.01) |
| **Complexity** | Low (extends dialog) |

### 2.03 — popover

Non-modal floating content anchored to a trigger. Click-outside dismisses.

| Field | Value |
|-------|-------|
| **ARIA pattern** | dialog (non-modal) |
| **Anatomy** | root (container), trigger (action), positioner (container), content (container), arrow (container, optional), closeTrigger (action, optional), title (text, optional), description (text, optional) |
| **States** | closed [initial] ↔ open |
| **Affordance** | serves: overlay (specificity 8, condition: modal = false) |
| **Props** | open: Bool = false; placement: String = "bottom"; closeOnOutsideClick: Bool = true; closeOnEscape: Bool = true |
| **Keyboard** | Escape → close; Tab navigates within |
| **Composes** | portal (0.08), presence (0.11) |
| **Complexity** | High (positioning logic) |

### 2.04 — tooltip

Supplementary text on hover/focus. No interactive content.

| Field | Value |
|-------|-------|
| **ARIA pattern** | tooltip |
| **Anatomy** | root (container), trigger (container), positioner (container), content (container), arrow (container, optional) |
| **States** | hidden [initial] → showing → visible → hiding → hidden |
| **Affordance** | N/A (supplementary, not interactive) |
| **Props** | label: String; placement: String = "top"; openDelay: Int = 700; closeDelay: Int = 300 |
| **Keyboard** | Focus trigger → show; Escape → hide; blur → hide |
| **Composes** | portal (0.08), presence (0.11) |
| **Complexity** | Medium |

### 2.05 — toast

Ephemeral notification message. Auto-dismisses with timer.

| Field | Value |
|-------|-------|
| **ARIA pattern** | alert (polite) or status |
| **Anatomy** | root (container), icon (container, optional), title (text), description (text, optional), action (action, optional), closeTrigger (action) |
| **States** | entering → visible → paused (on hover) → exiting → removed |
| **Affordance** | N/A (system feedback, not form control) |
| **Props** | title: String; description: option String; variant: "info" \| "success" \| "warning" \| "error" = "info"; duration: Int = 5000; closable: Bool = true |
| **Keyboard** | Tab → focus action/close; Escape → dismiss |
| **Composes** | icon (0.05), button (0.01), presence (0.11) |
| **Complexity** | Medium |

### 2.06 — toast-manager

Container managing a stack/queue of toast instances with positioning.

| Field | Value |
|-------|-------|
| **ARIA pattern** | region (aria-live="polite") |
| **Anatomy** | root (container), list (container), item (widget) |
| **States** | empty [initial]; hasToasts |
| **Affordance** | N/A (infrastructure) |
| **Props** | placement: String = "bottom-right"; max: Int = 5; gap: Int = 8 |
| **Composes** | toast (2.05), portal (0.08) |
| **Complexity** | Medium |

### 2.07 — alert

Inline status message (not a toast — persists in layout).

| Field | Value |
|-------|-------|
| **ARIA pattern** | alert or status |
| **Anatomy** | root (container), icon (container), content (container), title (text), description (text, optional), closeTrigger (action, optional) |
| **States** | visible [initial] → dismissed (if closable) |
| **Affordance** | N/A (feedback component) |
| **Props** | variant: "info" \| "success" \| "warning" \| "error" = "info"; closable: Bool = false |
| **Composes** | icon (0.05), button (0.01) |
| **Complexity** | Low |

### 2.08 — drawer

Slide-in panel from edge of screen. Like dialog but anchored to an edge.

| Field | Value |
|-------|-------|
| **ARIA pattern** | dialog |
| **Anatomy** | root (container), trigger (action), backdrop (overlay), content (container), header (container), body (container), footer (container, optional), closeTrigger (action) |
| **States** | closed [initial] ↔ open |
| **Affordance** | serves: overlay (specificity 9, condition: anchored = true) |
| **Props** | open: Bool = false; placement: "left" \| "right" \| "top" \| "bottom" = "right"; size: "sm" \| "md" \| "lg" = "md" |
| **Keyboard** | Escape → close; Tab trapped |
| **Composes** | portal (0.08), focus-trap (0.09), scroll-lock (0.10), presence (0.11) |
| **Complexity** | Medium |

### 2.09 — hover-card

Preview card on hover/focus. Richer than tooltip, can contain interactive content.

| Field | Value |
|-------|-------|
| **ARIA pattern** | dialog (non-modal, supplementary) |
| **Anatomy** | root (container), trigger (container), positioner (container), content (container), arrow (container, optional) |
| **States** | hidden [initial] → open (with delay) → hidden |
| **Affordance** | N/A (supplementary) |
| **Props** | openDelay: Int = 700; closeDelay: Int = 300; placement: String = "bottom" |
| **Composes** | portal (0.08), presence (0.11) |
| **Complexity** | Medium |

### 2.10 — context-menu

Right-click menu. Positioned at pointer location.

| Field | Value |
|-------|-------|
| **ARIA pattern** | menu with menuitem |
| **Anatomy** | root (container), trigger (container), positioner (container), content (container), item (action), separator (container), label (text) |
| **States** | closed [initial] ↔ open |
| **Affordance** | N/A (contextual interaction) |
| **Props** | items: list { label: String, action: String, icon: option String, disabled: Bool, destructive: Bool } |
| **Keyboard** | Arrow keys navigate; Enter → activate; Escape → close |
| **Composes** | portal (0.08), presence (0.11) |
| **Complexity** | High |

---

## Tier 3: Navigation & Layout

Structural widgets that organize content and navigation flow.

### 3.01 — tabs

Tabbed content switcher. View switcher base pattern.

| Field | Value |
|-------|-------|
| **ARIA pattern** | tablist with tab and tabpanel |
| **Anatomy** | root (container), list (container), trigger (action), content (container), indicator (container, optional) |
| **States** | Per tab: inactive [initial] ↔ active |
| **Affordance** | serves: navigation (specificity 10, condition: contentSwitching = true) |
| **Props** | value: String; orientation: "horizontal" \| "vertical" = "horizontal"; activationMode: "automatic" \| "manual" = "automatic" |
| **Keyboard** | ArrowLeft/Right (horizontal) or ArrowUp/Down (vertical) → navigate tabs; Home → first; End → last |
| **Complexity** | Medium |

### 3.02 — toolbar

Row of action controls with roving tabindex. Used for formatting bars, action bars.

| Field | Value |
|-------|-------|
| **ARIA pattern** | toolbar |
| **Anatomy** | root (container), group (container, optional), separator (container, optional) |
| **Slots** | items (within root) |
| **States** | static |
| **Affordance** | N/A (layout container) |
| **Props** | orientation: "horizontal" \| "vertical" = "horizontal"; label: String |
| **Keyboard** | Tab → enter toolbar (single stop); Arrow keys → navigate between items; Home/End → first/last |
| **Complexity** | Medium |

### 3.03 — menu

Dropdown command menu triggered by a button.

| Field | Value |
|-------|-------|
| **ARIA pattern** | menu with menuitem, menuitemcheckbox, menuitemradio |
| **Anatomy** | root (container), trigger (action), positioner (container), content (container), item (action), itemIcon (container, optional), itemLabel (text), itemShortcut (text, optional), separator (container), group (container), groupLabel (text), submenuTrigger (action), submenuContent (container) |
| **States** | closed [initial] ↔ open; submenu: closed ↔ open |
| **Affordance** | N/A (command dispatch) |
| **Props** | items: list MenuItem; placement: String = "bottom-start" |
| **Keyboard** | Enter/Space/ArrowDown → open; Arrow keys → navigate; Enter → activate; ArrowRight → open submenu; ArrowLeft → close submenu; Escape → close; typeahead |
| **Composes** | portal (0.08), presence (0.11) |
| **Complexity** | High |

### 3.04 — breadcrumb

Hierarchical location trail with clickable path segments.

| Field | Value |
|-------|-------|
| **ARIA pattern** | navigation with list |
| **Anatomy** | root (container), list (container), item (container), link (action), separator (text), currentPage (text) |
| **States** | static |
| **Affordance** | N/A (navigation aid) |
| **Props** | items: list { label: String, href: option String }; separator: String = "/" |
| **Keyboard** | Tab between links |
| **Complexity** | Low |

### 3.05 — accordion

Vertically stacked collapsible sections. Single or multiple open.

| Field | Value |
|-------|-------|
| **ARIA pattern** | disclosure (multiple) or accordion |
| **Anatomy** | root (container), item (container), trigger (action), indicator (container), content (container) |
| **States** | Per item: collapsed [initial] ↔ expanded |
| **Affordance** | serves: group-section (specificity 8, condition: collapsible = true) |
| **Props** | value: set String; multiple: Bool = false; collapsible: Bool = true |
| **Keyboard** | Enter/Space → toggle; ArrowDown → next trigger; ArrowUp → previous trigger; Home → first; End → last |
| **Composes** | presence (0.11) |
| **Complexity** | Medium |

### 3.06 — disclosure

Single expand/collapse toggle. Simpler than accordion.

| Field | Value |
|-------|-------|
| **ARIA pattern** | disclosure (button + region) |
| **Anatomy** | root (container), trigger (action), indicator (container), content (container) |
| **States** | collapsed [initial] ↔ expanded |
| **Affordance** | serves: group-conditional (specificity 8) |
| **Props** | open: Bool = false |
| **Keyboard** | Enter/Space → toggle |
| **Composes** | presence (0.11) |
| **Complexity** | Low |

### 3.07 — pagination

Page navigation for lists/tables. Page numbers, prev/next, optional jump-to.

| Field | Value |
|-------|-------|
| **ARIA pattern** | navigation |
| **Anatomy** | root (container), prevButton (action), nextButton (action), items (container), item (action), ellipsis (text) |
| **States** | atFirst (prev disabled); atLast (next disabled); middle |
| **Affordance** | N/A (data navigation) |
| **Props** | page: Int = 1; totalPages: Int; siblingCount: Int = 1 |
| **Keyboard** | Tab between controls; Enter/Space → navigate |
| **Composes** | button (0.01) |
| **Complexity** | Medium |

### 3.08 — command-palette

Modal search overlay with categorized results. VS Code / Raycast pattern.

| Field | Value |
|-------|-------|
| **ARIA pattern** | dialog + combobox with listbox |
| **Anatomy** | root (container), backdrop (overlay), input (action), list (container), group (container), groupLabel (text), item (action), itemIcon (container, optional), itemLabel (text), itemShortcut (text, optional), empty (text), footer (container, optional) |
| **States** | closed [initial] ↔ open; empty → searching → hasResults \| noResults |
| **Affordance** | N/A (command dispatch) |
| **Props** | open: Bool = false; placeholder: String = "Type a command..." |
| **Keyboard** | Cmd+K / Ctrl+K → open; Type → filter; ArrowUp/Down → navigate; Enter → activate; Escape → close |
| **Composes** | dialog (2.01), text-input (0.02) |
| **Complexity** | High |

### 3.09 — sidebar

Collapsible side panel. Supports navigation items, nested groups.

| Field | Value |
|-------|-------|
| **ARIA pattern** | complementary (landmark) + navigation |
| **Anatomy** | root (container), header (container), content (container), footer (container), toggleButton (action), group (container), groupLabel (text), item (action), itemIcon (container, optional), itemLabel (text), itemBadge (widget, optional) |
| **States** | expanded [initial] ↔ collapsed; mini (icons only) |
| **Affordance** | N/A (layout container) |
| **Props** | collapsed: Bool = false; collapsible: Bool = true; width: String = "256px"; miniWidth: String = "64px" |
| **Keyboard** | Tab between items; Enter/Space → activate/expand |
| **Composes** | disclosure (3.06), badge (1.16), icon (0.05) |
| **Complexity** | Medium |

### 3.10 — splitter

Resizable pane divider. Drag to resize adjacent panels.

| Field | Value |
|-------|-------|
| **ARIA pattern** | separator (focusable, with aria-valuenow) |
| **Anatomy** | root (container), panelBefore (container), handle (action), panelAfter (container) |
| **States** | idle [initial] → dragging → idle |
| **Affordance** | N/A (layout control) |
| **Props** | orientation: "horizontal" \| "vertical" = "horizontal"; defaultSize: Float = 50; min: Float = 10; max: Float = 90 |
| **Keyboard** | ArrowLeft/Right or ArrowUp/Down → resize; Home → min; End → max |
| **Complexity** | Medium |

### 3.11 — floating-toolbar

Bubble toolbar appearing on text selection. Used by block editors.

| Field | Value |
|-------|-------|
| **ARIA pattern** | toolbar |
| **Anatomy** | root (container), content (container) |
| **Slots** | items (within content) |
| **States** | hidden [initial] → visible → hidden (follows selection) |
| **Affordance** | N/A (contextual toolbar) |
| **Props** | placement: String = "top"; offset: Int = 8 |
| **Keyboard** | Arrow keys between items (roving tabindex) |
| **Composes** | toolbar (3.02), portal (0.08) |
| **Complexity** | Medium |

### 3.12 — fieldset

Form field grouping with legend. Maps to group-fields interactor.

| Field | Value |
|-------|-------|
| **ARIA pattern** | group with legend |
| **Anatomy** | root (container), legend (text), content (container), description (text, optional) |
| **States** | static; disabled (all children disabled) |
| **Affordance** | serves: group-fields (specificity 8) |
| **Props** | label: String; disabled: Bool = false; collapsible: Bool = false |
| **Composes** | disclosure (3.06) when collapsible |
| **Complexity** | Low |

### 3.13 — form

Form container with validation and submission lifecycle.

| Field | Value |
|-------|-------|
| **ARIA pattern** | form |
| **Anatomy** | root (container), fields (container), actions (container), submitButton (widget), resetButton (widget, optional), errorSummary (container, optional) |
| **Slots** | fields, actions |
| **States** | idle [initial] → validating → submitting → success \| error → idle |
| **Affordance** | serves: group-fields (specificity 10, condition: submittable = true) |
| **Props** | onSubmit: String; validateOnBlur: Bool = true; validateOnChange: Bool = false |
| **Keyboard** | Enter in last field → submit (if single-line); Tab through fields |
| **Composes** | button (0.01), alert (2.07), fieldset (3.12) |
| **Complexity** | High |

### 3.14 — navigation-menu

Top-level navigation bar with dropdowns and mobile hamburger.

| Field | Value |
|-------|-------|
| **ARIA pattern** | navigation with menu |
| **Anatomy** | root (container), list (container), item (container), trigger (action), link (action), content (container), indicator (container), viewport (container) |
| **States** | Per item: closed ↔ open; mobile: collapsed ↔ expanded |
| **Affordance** | N/A (page navigation) |
| **Props** | items: list NavigationItem; orientation: "horizontal" \| "vertical" = "horizontal" |
| **Keyboard** | Arrow keys → navigate items; Enter → activate/open; Escape → close dropdown |
| **Composes** | portal (0.08), presence (0.11) |
| **Complexity** | High |

---

## Tier 4: Data Display

Widgets for presenting structured data: tables, cards, lists, charts, and statistics.

### 4.01 — data-table

Sortable, filterable table with column configuration. Core data display.

| Field | Value |
|-------|-------|
| **ARIA pattern** | grid (interactive) or table (static) |
| **Anatomy** | root (container), header (container), headerRow (container), headerCell (action), body (container), row (container), cell (container), footer (container, optional), footerRow (container), footerCell (container), sortIndicator (container), pagination (widget, optional) |
| **States** | idle [initial]; sorting; loading; empty |
| **Affordance** | serves: group-repeating (specificity 10, condition: viewType = "table") |
| **Props** | columns: list ColumnDef; data: list Object; sortable: Bool = true; selectable: Bool = false; stickyHeader: Bool = false |
| **Keyboard** | Arrow keys → navigate cells; Enter → sort column / activate cell; Space → select row |
| **Composes** | checkbox (0.03) for selection, pagination (3.07), badge (1.16) |
| **Complexity** | Very High |

### 4.02 — card

Surface container with header, body, footer regions. Base for all card patterns.

| Field | Value |
|-------|-------|
| **ARIA pattern** | article or generic region |
| **Anatomy** | root (container), header (container), body (container), footer (container, optional), media (container, optional), title (text), description (text, optional), actions (container, optional) |
| **Slots** | header, body, footer, media |
| **States** | idle [initial] → hovered → idle; interactive (clickable) |
| **Affordance** | N/A (layout container, used by composition) |
| **Props** | variant: "elevated" \| "filled" \| "outlined" = "elevated"; clickable: Bool = false |
| **Keyboard** | Tab to card (if clickable); Enter → activate |
| **Complexity** | Low |

### 4.03 — list

Vertical list of items with optional selection, reorder, dividers.

| Field | Value |
|-------|-------|
| **ARIA pattern** | list with listitem; or listbox with option (if selectable) |
| **Anatomy** | root (container), item (container), itemIcon (container, optional), itemLabel (text), itemDescription (text, optional), itemAction (action, optional), divider (container, optional) |
| **States** | Per item: idle → hovered → selected (if selectable) |
| **Affordance** | serves: group-repeating (specificity 5, fallback view) |
| **Props** | items: list ListItem; selectable: Bool = false; dividers: Bool = true |
| **Keyboard** | Arrow keys → navigate; Enter/Space → select/activate |
| **Complexity** | Medium |

### 4.04 — card-grid

Responsive grid of card components. Gallery/marketplace view.

| Field | Value |
|-------|-------|
| **ARIA pattern** | list with listitem (or grid) |
| **Anatomy** | root (container), item (widget) |
| **States** | static; loading; empty |
| **Affordance** | serves: group-repeating (specificity 8, condition: viewType = "gallery") |
| **Props** | columns: Int = 3; gap: Int = 16; minCardWidth: String = "280px" |
| **Composes** | card (4.02) |
| **Complexity** | Low |

### 4.05 — stat-card

KPI display card: label, large value, optional trend indicator.

| Field | Value |
|-------|-------|
| **ARIA pattern** | region with aria-label |
| **Anatomy** | root (container), label (text), value (text), trend (container, optional), trendIcon (container), trendValue (text), description (text, optional) |
| **States** | static; up/down/neutral (trend direction) |
| **Affordance** | serves: display-number (specificity 8, condition: summary = true) |
| **Props** | label: String; value: String; trend: option { direction: "up" \| "down" \| "neutral", value: String }; description: option String |
| **Complexity** | Low |

### 4.06 — kanban-board

Column-based drag-and-drop board (Trello/Linear pattern).

| Field | Value |
|-------|-------|
| **ARIA pattern** | grid with drag-and-drop; or list of lists |
| **Anatomy** | root (container), column (container), columnHeader (container), columnTitle (text), columnCount (text), cardList (container), card (widget), addCardButton (action, optional), dragPlaceholder (container) |
| **States** | idle [initial]; dragging (card); draggingBetween (columns) |
| **Affordance** | serves: group-repeating (specificity 12, condition: viewType = "board", groupField exists) |
| **Props** | columns: list { id: String, title: String, items: list Object }; draggable: Bool = true |
| **Keyboard** | ArrowLeft/Right → move between columns; ArrowUp/Down → navigate cards; Space → pick up/drop card; Escape → cancel drag |
| **Composes** | card (4.02) |
| **Complexity** | Very High |

### 4.07 — calendar-view

Monthly/weekly calendar grid with event placement.

| Field | Value |
|-------|-------|
| **ARIA pattern** | grid with gridcell |
| **Anatomy** | root (container), header (container), navigation (container), prevButton (action), nextButton (action), title (text), viewToggle (widget, optional), grid (container), weekRow (container), dayCell (container), dayLabel (text), eventList (container), event (action) |
| **States** | monthView [initial] ↔ weekView; navigating |
| **Affordance** | serves: group-repeating (specificity 10, condition: viewType = "calendar", dateField exists) |
| **Props** | value: DateTime; view: "month" \| "week" = "month"; events: list { date: DateTime, label: String } |
| **Keyboard** | Arrow keys → navigate days; Enter → select; PageUp/Down → prev/next month |
| **Composes** | button (0.01) |
| **Complexity** | High |

### 4.08 — timeline

Horizontal time axis with bars and dependency arrows. Gantt chart.

| Field | Value |
|-------|-------|
| **ARIA pattern** | grid or custom (with aria-label) |
| **Anatomy** | root (container), header (container), timeAxis (container), tick (container), tickLabel (text), body (container), row (container), rowLabel (text), bar (action), dependencyArrow (container), milestone (container) |
| **States** | idle → scrolling; idle → resizing (bar duration) |
| **Affordance** | serves: group-repeating (specificity 10, condition: viewType = "timeline") |
| **Props** | items: list { id: String, label: String, start: DateTime, end: DateTime, dependencies: list String }; scale: "day" \| "week" \| "month" = "week" |
| **Keyboard** | Arrow keys → navigate rows/bars; Enter → select; +/- → zoom |
| **Composes** | tooltip (2.04) |
| **Complexity** | Very High |

### 4.09 — empty-state

Placeholder when a view has no data. Icon, message, action.

| Field | Value |
|-------|-------|
| **ARIA pattern** | region |
| **Anatomy** | root (container), icon (container), title (text), description (text), action (widget, optional) |
| **States** | static |
| **Props** | title: String; description: option String; icon: option String |
| **Composes** | icon (0.05), button (0.01) |
| **Complexity** | Trivial |

### 4.10 — data-list

Key-value pair display (description list). For detail views.

| Field | Value |
|-------|-------|
| **ARIA pattern** | definition list (dl/dt/dd) |
| **Anatomy** | root (container), item (container), term (text), detail (container) |
| **States** | static |
| **Affordance** | serves: group-fields (specificity 6, condition: readOnly = true) |
| **Props** | items: list { label: String, value: String }; orientation: "horizontal" \| "vertical" = "horizontal" |
| **Complexity** | Low |

### 4.11 — chart

Bar/line/pie chart container. Wraps a charting library.

| Field | Value |
|-------|-------|
| **ARIA pattern** | img (with aria-label and data table fallback) |
| **Anatomy** | root (container), chart (container), legend (container), legendItem (container), tooltip (widget, optional), dataTableFallback (container) |
| **States** | loading → rendered; hovered (highlight segment) |
| **Props** | type: "bar" \| "line" \| "pie" \| "donut"; data: String; width: option String; height: option String |
| **Keyboard** | Tab → focus chart; Arrow keys → navigate segments; Enter → show detail |
| **Composes** | tooltip (2.04) |
| **Complexity** | High (integration with chart library) |

### 4.12 — gauge

Circular or arc progress indicator for hit rates, utilization, scores.

| Field | Value |
|-------|-------|
| **ARIA pattern** | meter |
| **Anatomy** | root (container), track (container), fill (container), label (text), value (text) |
| **States** | static; thresholds (normal, warning, critical) |
| **Props** | value: Float; min: Float = 0; max: Float = 100; thresholds: option { warning: Float, critical: Float } |
| **Complexity** | Medium |

### 4.13 — notification-item

Single notification entry in a feed. Icon, text, timestamp, actions.

| Field | Value |
|-------|-------|
| **ARIA pattern** | article or listitem |
| **Anatomy** | root (container), icon (container), avatar (widget, optional), content (container), title (text), description (text, optional), timestamp (text), actions (container, optional), unreadDot (container) |
| **States** | unread [initial] ↔ read; idle → hovered |
| **Affordance** | N/A (item in notification list) |
| **Props** | title: String; description: option String; timestamp: DateTime; read: Bool = false; actions: list { label: String, action: String } |
| **Composes** | avatar (0.12), icon (0.05) |
| **Complexity** | Low |

### 4.14 — view-toggle

Compact toggle between display modes: grid/list/board/etc.

| Field | Value |
|-------|-------|
| **ARIA pattern** | radiogroup |
| **Anatomy** | root (container), item (action), itemIcon (container) |
| **States** | Per item: inactive ↔ active |
| **Props** | value: String; options: list { value: String, icon: String, label: String } |
| **Keyboard** | Arrow keys → navigate; Space/Enter → select |
| **Complexity** | Low |

### 4.15 — skeleton

Loading placeholder mimicking content shape. Shows while data loads.

| Field | Value |
|-------|-------|
| **ARIA pattern** | N/A (aria-busy on parent, aria-hidden on skeleton) |
| **Anatomy** | root (container), line (container), circle (container), rect (container) |
| **States** | loading (pulse animation) |
| **Props** | variant: "text" \| "circular" \| "rectangular" = "text"; width: option String; height: option String; lines: Int = 1 |
| **Complexity** | Low |

---

## Tier 5: Complex Inputs

Specialized input widgets requiring substantial state management.

### 5.01 — date-picker

Calendar-based date selection with popover.

| Field | Value |
|-------|-------|
| **ARIA pattern** | combobox → grid (calendar) |
| **Anatomy** | root (container), label (text), input (action), trigger (action), positioner (container), content (container), header (container), prevButton (action), nextButton (action), title (text), viewButton (action), grid (container), row (container), cell (action), cellLabel (text) |
| **States** | closed [initial] ↔ open; dayView [initial] ↔ monthView ↔ yearView |
| **Affordance** | serves: date-point (specificity 10) |
| **Props** | value: option DateTime; min: option DateTime; max: option DateTime; format: String = "yyyy-MM-dd"; locale: String = "en" |
| **Keyboard** | ArrowDown → open; Arrow keys → navigate days; Enter → select; Escape → close; PageUp/Down → prev/next month |
| **Composes** | text-input (0.02), popover (2.03), button (0.01) |
| **Complexity** | Very High |

### 5.02 — date-range-picker

Dual-calendar date range selection.

| Field | Value |
|-------|-------|
| **ARIA pattern** | group with two combobox/grid |
| **Anatomy** | Extends date-picker with: startInput, endInput, presets (container), preset (action) |
| **States** | closed ↔ open; selectingStart ↔ selectingEnd; hovering (range preview) |
| **Affordance** | serves: date-range (specificity 10) |
| **Props** | startDate: option DateTime; endDate: option DateTime; presets: option list { label: String, range: { start: DateTime, end: DateTime } } |
| **Composes** | date-picker (5.01) |
| **Complexity** | Very High |

### 5.03 — color-picker

Color selection with swatch, sliders, and text input.

| Field | Value |
|-------|-------|
| **ARIA pattern** | application (complex interactive region) |
| **Anatomy** | root (container), trigger (action), swatch (container), positioner (container), content (container), area (container), areaThumb (action), channelSlider (action), channelSliderTrack (container), channelSliderThumb (action), input (action), swatchGroup (container), swatchTrigger (action), eyeDropperButton (action, optional) |
| **States** | closed [initial] ↔ open; selecting |
| **Affordance** | serves: color (specificity 10) |
| **Props** | value: String = "#000000"; format: "hex" \| "rgb" \| "hsl" \| "oklch" = "hex"; swatches: option list String |
| **Keyboard** | Arrow keys → adjust area/sliders; Enter → confirm; Escape → close |
| **Composes** | popover (2.03), text-input (0.02), slider (1.03) |
| **Complexity** | Very High |

### 5.04 — file-upload

Drag-and-drop upload zone with file list and progress.

| Field | Value |
|-------|-------|
| **ARIA pattern** | button (click) + region (drop zone) |
| **Anatomy** | root (container), dropzone (container), dropzoneIcon (container), dropzoneLabel (text), input (action), fileList (container), fileItem (container), fileIcon (container), fileName (text), fileSize (text), fileProgress (widget), fileRemove (action), fileError (text) |
| **States** | idle [initial] → dragOver → idle; uploading; complete; error |
| **Affordance** | serves: file-attach (specificity 10) |
| **Props** | accept: option String; multiple: Bool = true; maxSize: option Int; maxFiles: option Int |
| **Keyboard** | Enter/Space → open file picker; Delete → remove selected file |
| **Composes** | progress-bar (1.15), button (0.01), icon (0.05) |
| **Complexity** | High |

### 5.05 — rich-text-editor

Block-based rich text editing with formatting toolbar and slash commands.

| Field | Value |
|-------|-------|
| **ARIA pattern** | textbox (multiline, contenteditable) with toolbar |
| **Anatomy** | root (container), toolbar (widget), editor (container), slashMenu (widget, optional), bubbleMenu (widget, optional), placeholder (text) |
| **Slots** | toolbar, editor, slashMenu |
| **States** | empty [initial] → editing; idle → selecting → formatting |
| **Affordance** | serves: text-rich (specificity 10) |
| **Props** | value: String = ""; placeholder: String = ""; readOnly: Bool = false; enableSlashCommands: Bool = true |
| **Keyboard** | Cmd+B → bold; Cmd+I → italic; / → slash menu; Markdown shortcuts |
| **Composes** | toolbar (3.02), floating-toolbar (3.11), command-palette (3.08) |
| **Complexity** | Very High (integrates ProseMirror/TipTap/Slate) |

### 5.06 — mention-input

Trigger-character autocomplete (@ mentions, [[ wikilinks, # tags).

| Field | Value |
|-------|-------|
| **ARIA pattern** | combobox (inline, within text) |
| **Anatomy** | root (container), input (action), suggestions (container), suggestion (action), suggestionIcon (container, optional), suggestionLabel (text), suggestionDescription (text, optional), mentionChip (container) |
| **States** | idle [initial] → triggered → suggesting → idle |
| **Affordance** | serves: single-pick (specificity 12, condition: inline = true) |
| **Props** | triggers: list { char: String, dataSource: String }; renderMention: option String |
| **Keyboard** | Type trigger char → show suggestions; Arrow keys → navigate; Enter/Tab → select; Escape → dismiss |
| **Composes** | portal (0.08), chip (0.14) |
| **Complexity** | High |

### 5.07 — tree-select

Hierarchical tree with checkboxes for taxonomy/category selection.

| Field | Value |
|-------|-------|
| **ARIA pattern** | tree with treeitem |
| **Anatomy** | root (container), item (container), itemToggle (action), itemCheckbox (widget, optional), itemLabel (text), itemChildren (container) |
| **States** | Per item: collapsed [initial] ↔ expanded; unchecked ↔ checked ↔ indeterminate |
| **Affordance** | serves: multi-choice (specificity 12, condition: hierarchical = true) |
| **Props** | items: list TreeNode; selectable: Bool = true; multiSelect: Bool = true; defaultExpanded: set String |
| **Keyboard** | Arrow Up/Down → navigate; Left → collapse/parent; Right → expand/child; Space → toggle check; Enter → activate |
| **Composes** | checkbox (0.03) |
| **Complexity** | High |

### 5.08 — formula-editor

Expression editor with syntax highlighting, autocomplete, and live preview.

| Field | Value |
|-------|-------|
| **ARIA pattern** | textbox with combobox (autocomplete) |
| **Anatomy** | root (container), input (container), autocomplete (container), suggestion (action), functionBrowser (container, optional), preview (container), error (text, optional), propertyToken (container) |
| **States** | empty [initial] → editing → previewing; valid/invalid (parallel) |
| **Affordance** | serves: text-rich (specificity 12, condition: domain = "formula") |
| **Props** | value: String = ""; schema: String; functions: list { name: String, category: String, signature: String } |
| **Keyboard** | Type → autocomplete suggestions; Tab → accept suggestion; Escape → dismiss |
| **Composes** | popover (2.03), chip (0.14) for property tokens |
| **Complexity** | Very High |

### 5.09 — range-slider

Dual-thumb slider for selecting a numeric range (min-max).

| Field | Value |
|-------|-------|
| **ARIA pattern** | group with two sliders |
| **Anatomy** | root (container), label (text), track (container), range (container), thumbMin (action), thumbMax (action), outputMin (text), outputMax (text) |
| **States** | idle [initial] → dragging (min or max thumb) → idle |
| **Affordance** | serves: range-select (specificity 10) |
| **Props** | min: Float = 0; max: Float = 100; valueMin: Float; valueMax: Float; step: Float = 1; minRange: option Float |
| **Keyboard** | Arrow keys → adjust focused thumb; Tab between thumbs |
| **Composes** | label (0.04) |
| **Complexity** | Medium |

### 5.10 — rating

Star rating input (1-5 or configurable). Click or keyboard to set.

| Field | Value |
|-------|-------|
| **ARIA pattern** | radiogroup |
| **Anatomy** | root (container), item (action), icon (container) |
| **States** | Per item: empty ↔ filled ↔ half; hovering (preview) |
| **Affordance** | serves: single-choice (specificity 15, condition: domain = "1-5", context = "rating") |
| **Props** | value: Float = 0; max: Int = 5; half: Bool = false; readOnly: Bool = false |
| **Keyboard** | ArrowLeft/Right → adjust; Home → min; End → max |
| **Complexity** | Medium |

### 5.11 — pin-input

Segmented digit input for verification codes (OTP).

| Field | Value |
|-------|-------|
| **ARIA pattern** | group with textbox (one per digit) |
| **Anatomy** | root (container), label (text), input (action per digit), separator (container, optional) |
| **States** | empty [initial] → partial → complete |
| **Affordance** | serves: text-short (specificity 12, condition: pattern = "pin") |
| **Props** | length: Int = 6; type: "numeric" \| "alphanumeric" = "numeric"; mask: Bool = false |
| **Keyboard** | Type → fill and advance; Backspace → clear and go back; Paste → fill all |
| **Complexity** | Medium |

### 5.12 — signature-pad

Freeform signature capture via mouse/touch drawing.

| Field | Value |
|-------|-------|
| **ARIA pattern** | application (custom interactive) |
| **Anatomy** | root (container), canvas (container), clearButton (action), label (text) |
| **States** | empty [initial] → drawing → drawn |
| **Affordance** | serves: file-attach (specificity 8, condition: type = "signature") |
| **Props** | width: Int = 400; height: Int = 200; penColor: String = "#000"; backgroundColor: String = "#fff" |
| **Complexity** | Medium |

---

## Tier 6: Composite Patterns

Assembled from lower-tier widgets to implement complete interaction patterns from the domain catalog.

### 6.01 — filter-builder

Visual query builder with stacked filter rows, AND/OR toggles, and nesting.

| Field | Value |
|-------|-------|
| **Domain reference** | Query builders (GROUP 2) |
| **Anatomy** | root (container), addButton (action), filterRow (container), fieldSelector (widget), operatorSelector (widget), valueInput (widget), removeButton (action), logicToggle (action), group (container) |
| **States** | empty [initial] → hasFilters; idle → editing |
| **Composes** | select (1.07), text-input (0.02), combobox (1.08), date-picker (5.01), button (0.01) |
| **Complexity** | Very High |

### 6.02 — sort-builder

Sortable priority list of sort criteria with direction toggles.

| Field | Value |
|-------|-------|
| **Domain reference** | Query builders (GROUP 2) |
| **Anatomy** | root (container), addButton (action), sortRow (container), fieldSelector (widget), directionToggle (action), dragHandle (action), removeButton (action) |
| **Composes** | select (1.07), button (0.01) |
| **Complexity** | Medium |

### 6.03 — view-switcher

Tab bar + per-view configuration for table/board/calendar/timeline/gallery views.

| Field | Value |
|-------|-------|
| **Domain reference** | View switchers (GROUP 2) |
| **Anatomy** | root (container), tabBar (widget), addViewButton (action), viewConfig (container), content (container) |
| **States** | Per view type: active/inactive |
| **Composes** | tabs (3.01), data-table (4.01), kanban-board (4.06), calendar-view (4.07), timeline (4.08), card-grid (4.04), filter-builder (6.01), sort-builder (6.02) |
| **Complexity** | Very High |

### 6.04 — property-panel

Click-to-edit property rows from concept schema. Notion-style.

| Field | Value |
|-------|-------|
| **Domain reference** | Property panels (GROUP 1) |
| **Anatomy** | root (container), header (container), toggleButton (action), propertyList (container), propertyRow (container), propertyLabel (text), propertyValue (container), addPropertyButton (action) |
| **States** | expanded ↔ collapsed; per row: displaying → editing → displaying |
| **Composes** | text-input (0.02), select (1.07), date-picker (5.01), chip-input (1.13), checkbox (0.03), avatar (0.12), badge (1.16) |
| **Complexity** | High |

### 6.05 — schema-editor

Field type/validation builder. Airtable/Notion database property manager.

| Field | Value |
|-------|-------|
| **Domain reference** | Schema builders (GROUP 1) |
| **Anatomy** | root (container), fieldList (container), fieldRow (container), fieldName (widget), typeSelector (widget), configPanel (container), dragHandle (action), removeButton (action), addFieldButton (action) |
| **Composes** | text-input (0.02), select (1.07), checkbox (0.03), button (0.01) |
| **Complexity** | High |

### 6.06 — notification-center

Bell icon → dropdown panel with notification feed, tabs, and preferences.

| Field | Value |
|-------|-------|
| **Domain reference** | Notification centers (GROUP 3) |
| **Anatomy** | root (container), trigger (action), bellIcon (widget), unreadBadge (widget), panel (container), tabs (widget), notificationList (container), notificationItem (widget), emptyState (widget) |
| **Composes** | popover (2.03), tabs (3.01), notification-item (4.13), badge (1.16), icon (0.05), empty-state (4.09) |
| **Complexity** | High |

### 6.07 — preference-matrix

Grid of event types × channels with toggles. Notification preferences.

| Field | Value |
|-------|-------|
| **Domain reference** | Notification centers (GROUP 3) — preference matrix |
| **ARIA pattern** | grid |
| **Anatomy** | root (container), header (container), headerCell (text), body (container), group (container), groupLabel (text), row (container), rowLabel (text), cell (container), toggle (widget), selectAllToggle (widget, optional) |
| **Composes** | checkbox (0.03) or toggle-switch (1.04), fieldset (3.12) |
| **Complexity** | High |

### 6.08 — permission-matrix

Roles × resources × actions grid with indeterminate states.

| Field | Value |
|-------|-------|
| **Domain reference** | Permission editors (GROUP 4) |
| **ARIA pattern** | grid |
| **Anatomy** | root (container), roleHeader (container), roleCell (text), resourceGroup (container), resourceRow (container), resourceLabel (text), actionCell (container), actionCheckbox (widget) |
| **Composes** | checkbox (0.03) with indeterminate, tree-select (5.07) for resource hierarchy |
| **Complexity** | High |

### 6.09 — faceted-search

Search input + facet sidebar + result list + active filter chips.

| Field | Value |
|-------|-------|
| **Domain reference** | Search interfaces (GROUP 2) |
| **Anatomy** | root (container), searchInput (widget), facetSidebar (container), facetGroup (container), facetLabel (text), facetItems (container), facetItem (widget), activeFilters (container), activeChip (widget), results (container), resultCount (text), pagination (widget, optional) |
| **Composes** | text-input (0.02), checkbox-group (1.10), slider (1.03) for range facets, chip (0.14), pagination (3.07), card-grid (4.04) or list (4.03) |
| **Complexity** | High |

### 6.10 — file-browser

Upload zone + grid/list toggle + breadcrumb + detail sidebar.

| Field | Value |
|-------|-------|
| **Domain reference** | File browsers (GROUP 4) |
| **Anatomy** | root (container), toolbar (container), uploadButton (action), viewToggle (widget), breadcrumb (widget), content (container), grid (widget), list (widget), detailSidebar (container), multiSelectBar (container) |
| **Composes** | file-upload (5.04), card-grid (4.04), data-table (4.01), breadcrumb (3.04), view-toggle (4.14), splitter (3.10), drawer (2.08) |
| **Complexity** | Very High |

### 6.11 — queue-dashboard

Stat cards + charts + job table with status filtering.

| Field | Value |
|-------|-------|
| **Domain reference** | Queue monitors (GROUP 3) |
| **Anatomy** | root (container), statRow (container), statCard (widget), chartPanel (container), chart (widget), tabs (widget), jobTable (widget), jobDetail (container) |
| **Composes** | stat-card (4.05), chart (4.11), tabs (3.01), data-table (4.01), badge (1.16) |
| **Complexity** | High |

### 6.12 — diff-viewer

Side-by-side or unified diff with character-level highlighting.

| Field | Value |
|-------|-------|
| **Domain reference** | Config diff viewers (GROUP 4) |
| **Anatomy** | root (container), modeToggle (widget), fileList (container), fileItem (action), diffPanel (container), leftPane (container), rightPane (container), hunkHeader (container), lineNumber (text), lineContent (text), addedLine (container), removedLine (container), unchangedLine (container), inlineHighlight (container), expandButton (action) |
| **States** | sideBySide [initial] ↔ unified |
| **Composes** | view-toggle (4.14), splitter (3.10), disclosure (3.06) |
| **Complexity** | Very High |

### 6.13 — backlink-panel

Incoming references panel with context preview. Obsidian/Roam pattern.

| Field | Value |
|-------|-------|
| **Domain reference** | Embedded references (GROUP 1) |
| **Anatomy** | root (container), header (container), title (text), count (text), linkedList (container), linkedItem (container), linkedItemBreadcrumb (widget), linkedItemContext (text), unlinkedList (container), unlinkedItem (container), linkButton (action) |
| **Composes** | breadcrumb (3.04), disclosure (3.06) |
| **Complexity** | Medium |

### 6.14 — plugin-card

Marketplace plugin card with rating, install count, action button.

| Field | Value |
|-------|-------|
| **Domain reference** | Plugin marketplaces (GROUP 4) |
| **Anatomy** | root (container), icon (container), name (text), author (text), description (text), rating (widget), installCount (text), installButton (widget) |
| **States** | available → installing → installed → enabled |
| **Composes** | card (4.02), rating (5.10), button (0.01), badge (1.16) |
| **Complexity** | Medium |

### 6.15 — cache-dashboard

Hit/miss gauges + key browser + memory bars + flush controls.

| Field | Value |
|-------|-------|
| **Domain reference** | Cache dashboards (GROUP 4) |
| **Anatomy** | root (container), gaugeRow (container), gauge (widget), chart (widget), keyBrowser (container), keySearch (widget), keyTree (widget), memoryBar (widget), flushButton (action), confirmDialog (widget) |
| **Composes** | gauge (4.12), chart (4.11), tree-select (5.07), text-input (0.02), progress-bar (1.15), alert-dialog (2.02), button (0.01) |
| **Complexity** | High |

### 6.16 — master-detail

Split view: list on left, selected item detail on right.

| Field | Value |
|-------|-------|
| **Domain reference** | Standard views (synthesis) |
| **Anatomy** | root (container), masterPane (container), list (widget), detailPane (container), detailContent (container), emptyDetail (widget) |
| **States** | noSelection [initial] → hasSelection |
| **Composes** | list (4.03) or data-table (4.01), splitter (3.10), empty-state (4.09) |
| **Complexity** | Medium |

---

## Tier 7: Domain Composites

Full-domain widgets that implement specific software patterns from the catalog.

### 7.01 — block-editor

Full block-based document editor (Notion/TipTap pattern).

| Field | Value |
|-------|-------|
| **Domain reference** | Block editors (GROUP 1) |
| **Anatomy** | root (container), editor (container), block (container), blockDragHandle (action), blockMenu (widget), slashMenu (widget), selectionToolbar (widget), placeholder (text) |
| **Block types** | paragraph, heading (H1-H6), bulleted-list, numbered-list, checklist, quote, code-block, table, image, embed, divider, callout, toggle |
| **Composes** | rich-text-editor (5.05), context-menu (2.10), command-palette (3.08), floating-toolbar (3.11) |
| **Complexity** | Extreme |

### 7.02 — slash-menu

Filterable block-type palette triggered by "/".

| Field | Value |
|-------|-------|
| **Domain reference** | Block editors — slash command |
| **Anatomy** | root (container), input (action), groups (container), group (container), groupLabel (text), item (action), itemIcon (container), itemLabel (text), itemDescription (text) |
| **Composes** | command-palette (3.08) |
| **Complexity** | Medium |

### 7.03 — outliner

Infinitely nested bullet list with zoom, indent/outdent, collapse.

| Field | Value |
|-------|-------|
| **Domain reference** | Outliners (GROUP 1) |
| **ARIA pattern** | tree with treeitem |
| **Anatomy** | root (container), breadcrumb (widget), item (container), bullet (action), collapseToggle (action), content (action), children (container), dragHandle (action, optional) |
| **States** | Per item: expanded ↔ collapsed; editing ↔ viewing; zoomed (subtree is root) |
| **Composes** | breadcrumb (3.04), text-input (0.02) |
| **Complexity** | Very High |

### 7.04 — canvas

Infinite 2D spatial plane with node/connector system. tldraw-inspired.

| Field | Value |
|-------|-------|
| **Domain reference** | Canvas interfaces (GROUP 1) |
| **Anatomy** | root (container), viewport (container), grid (container), nodeLayer (container), edgeLayer (container), selectionBox (container), toolbar (widget), minimap (container), propertyPanel (container) |
| **States** | select [initial], hand, draw, erase, text, shape, connector, frame |
| **Composes** | toolbar (3.02), context-menu (2.10), popover (2.03) |
| **Complexity** | Extreme |

### 7.05 — canvas-node

Individual canvas element: sticky note, shape, text, frame.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), content (container), handles (container), handle (action), label (text, optional) |
| **States** | idle → selected → editing → idle; idle → dragging → idle; idle → resizing → idle |
| **Props** | type: "sticky" \| "rectangle" \| "ellipse" \| "diamond" \| "text" \| "frame"; position: { x: Float, y: Float }; size: { width: Float, height: Float } |
| **Complexity** | High |

### 7.06 — canvas-connector

Edge/arrow between two canvas nodes with routing.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), path (container), startHandle (action), endHandle (action), label (text, optional) |
| **States** | idle → dragging (endpoint) → idle |
| **Complexity** | High |

### 7.07 — workflow-editor

Node-graph workflow canvas (n8n/Node-RED pattern).

| Field | Value |
|-------|-------|
| **Domain reference** | Workflow editors (GROUP 3) |
| **Anatomy** | root (container), canvas (widget), nodePalette (widget), configPanel (container), minimap (container), toolbar (container), executeButton (action) |
| **Composes** | canvas (7.04), command-palette (3.08), splitter (3.10), drawer (2.08) |
| **Complexity** | Extreme |

### 7.08 — workflow-node

Single workflow node with typed ports.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), header (container), icon (container), title (text), statusBadge (widget), inputPorts (container), inputPort (action), outputPorts (container), outputPort (action), body (container, optional) |
| **States** | idle → selected → configuring; pending → running → success \| error |
| **Composes** | badge (1.16), icon (0.05) |
| **Complexity** | High |

### 7.09 — state-machine-diagram

Visual state/transition diagram (Drupal Workflows pattern).

| Field | Value |
|-------|-------|
| **Domain reference** | Workflow editors — state machine model |
| **Anatomy** | root (container), stateList (container), stateItem (container), stateName (text), stateFlags (container), transitionList (container), transitionItem (container), transitionFrom (text), transitionArrow (container), transitionTo (text), transitionLabel (text), addStateButton (action), addTransitionButton (action) |
| **Composes** | data-table (4.01), button (0.01), dialog (2.01) for editing |
| **Complexity** | High |

### 7.10 — automation-builder

Linear step sequence with trigger, conditions, actions (Zapier pattern).

| Field | Value |
|-------|-------|
| **Domain reference** | Automation rule builders (GROUP 3) |
| **Anatomy** | root (container), stepList (container), step (container), stepIcon (container), stepType (text), stepConfig (container), addStepButton (action), connector (container), branchButton (action, optional), testPanel (container) |
| **States** | Per step: idle → configuring → testing → idle |
| **Composes** | card (4.02), select (1.07), filter-builder (6.01), button (0.01), drawer (2.08) |
| **Complexity** | Very High |

### 7.11 — graph-view

Force-directed node/edge visualization with filters and controls.

| Field | Value |
|-------|-------|
| **Domain reference** | Graph visualizations (GROUP 2) |
| **Anatomy** | root (container), canvas (container), filterPanel (container), searchInput (widget), typeToggles (container), displayControls (container), nodeSizeSlider (widget), linkThicknessSlider (widget), forceControls (container), minimap (container), detailPanel (container), modeToggle (widget) |
| **States** | globalView [initial] ↔ localView; idle → navigating |
| **Composes** | slider (1.03), text-input (0.02), checkbox-group (1.10), splitter (3.10), drawer (2.08), view-toggle (4.14) |
| **Complexity** | Very High |

### 7.12 — condition-builder

Field + operator + value row with AND/OR logic. Used in automations and filters.

| Field | Value |
|-------|-------|
| **Domain reference** | Automation rule builders — condition builder |
| **Anatomy** | root (container), rows (container), row (container), fieldSelector (widget), operatorSelector (widget), valueInput (widget), removeButton (action), logicToggle (action), addButton (action) |
| **Composes** | select (1.07), text-input (0.02), combobox (1.08), date-picker (5.01), button (0.01) |
| **Complexity** | High |

### 7.13 — field-mapper

Map output fields from one step to input fields of another.

| Field | Value |
|-------|-------|
| **Domain reference** | Automation rule builders — field mapper |
| **Anatomy** | root (container), mappingRow (container), targetField (container), targetLabel (text), mappingInput (widget), insertFieldButton (action), fieldPicker (widget) |
| **Composes** | text-input (0.02), popover (2.03), chip (0.14) |
| **Complexity** | High |

### 7.14 — minimap

Zoom/pan overview of a larger canvas or document.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), canvas (container), viewport (action), zoomControls (container), zoomIn (action), zoomOut (action), zoomFit (action), zoomLevel (text) |
| **States** | idle → panning → idle |
| **Composes** | button (0.01) |
| **Complexity** | Medium |

### 7.15 — color-label-picker

Colored tag/label selector with swatches (GitHub labels pattern).

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), trigger (action), panel (container), search (widget), options (container), option (action), colorSwatch (container), optionLabel (text), createButton (action, optional) |
| **Composes** | popover (2.03), text-input (0.02), chip (0.14) |
| **Complexity** | Medium |

### 7.16 — drag-handle

Reorder handle for list items, blocks, or table rows.

| Field | Value |
|-------|-------|
| **Anatomy** | root (action), icon (container) |
| **States** | idle [initial] → grabbed → dragging → idle |
| **Props** | orientation: "horizontal" \| "vertical" = "vertical" |
| **Keyboard** | Space → grab/release; Arrow keys → move position; Escape → cancel |
| **Complexity** | Medium |

### 7.17 — inline-edit

Click-to-edit text display. Toggles between display and input mode.

| Field | Value |
|-------|-------|
| **Domain reference** | Property panels — click-to-edit inline |
| **Anatomy** | root (container), display (container), displayText (text), editButton (action, optional), input (widget), confirmButton (action, optional), cancelButton (action, optional) |
| **States** | displaying [initial] ↔ editing |
| **Props** | value: String; placeholder: String = "Click to edit" |
| **Keyboard** | Enter/click → start editing; Enter → confirm; Escape → cancel |
| **Composes** | text-input (0.02), button (0.01) |
| **Complexity** | Medium |

### 7.18 — step-indicator

Stepper/wizard progress indicator showing current step in a multi-step flow.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), step (container), stepNumber (text), stepLabel (text), stepDescription (text, optional), connector (container) |
| **States** | Per step: upcoming → current → completed |
| **Props** | currentStep: Int; steps: list { label: String, description: option String }; orientation: "horizontal" \| "vertical" = "horizontal" |
| **Complexity** | Medium |

### 7.19 — image-gallery

Thumbnail grid with lightbox preview. For file browsers and media assets.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), grid (container), thumbnail (action), lightbox (widget), lightboxImage (container), prevButton (action), nextButton (action), counter (text), closeButton (action) |
| **States** | grid [initial]; lightbox (viewing single image) |
| **Composes** | card-grid (4.04), dialog (2.01) |
| **Complexity** | High |

### 7.20 — markdown-preview

Live markdown rendering with syntax highlighting.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), content (container) |
| **States** | static |
| **Props** | source: String; sanitize: Bool = true |
| **Complexity** | Medium (depends on markdown parser integration) |

### 7.21 — code-block

Syntax-highlighted code display with copy button and optional line numbers.

| Field | Value |
|-------|-------|
| **Anatomy** | root (container), header (container), language (text), copyButton (action), lineNumbers (container), code (container) |
| **States** | idle; copied (briefly after copy) |
| **Props** | code: String; language: String = "plaintext"; showLineNumbers: Bool = true; highlightLines: option list Int |
| **Composes** | button (0.01) |
| **Complexity** | Medium |

### 7.22 — policy-editor

Visual + JSON dual-mode policy editor (AWS IAM pattern).

| Field | Value |
|-------|-------|
| **Domain reference** | Permission editors — policy editor |
| **Anatomy** | root (container), modeToggle (widget), visualEditor (container), serviceSelector (widget), actionSelector (widget), resourceSelector (widget), jsonEditor (container), validateButton (action), simulatorButton (action) |
| **States** | visual [initial] ↔ json; valid/invalid (parallel) |
| **Composes** | view-toggle (4.14), combobox (1.08), checkbox-group (1.10), code-block (7.21), button (0.01) |
| **Complexity** | Very High |

### 7.23 — plugin-detail-page

Plugin marketplace detail page with tabbed content.

| Field | Value |
|-------|-------|
| **Domain reference** | Plugin marketplaces — detail page |
| **Anatomy** | root (container), hero (container), heroIcon (container), heroTitle (text), heroStats (container), installButton (widget), tabs (widget), descriptionTab (container), screenshotsTab (container), reviewsTab (container), changelogTab (container) |
| **Composes** | tabs (3.01), rating (5.10), button (0.01), image-gallery (7.19), card (4.02) |
| **Complexity** | High |

### 7.24 — token-input

Formula/expression property token (styled pill showing referenced field).

| Field | Value |
|-------|-------|
| **Domain reference** | Formula editors — property tokens |
| **Anatomy** | root (container), label (text), typeIcon (container, optional), removeButton (action, optional) |
| **States** | static; hovered (shows type info) |
| **Props** | label: String; type: option String; removable: Bool = false |
| **Composes** | chip (0.14), tooltip (2.04) |
| **Complexity** | Low |

### 7.25 — cron-editor

Visual cron expression builder for scheduled jobs.

| Field | Value |
|-------|-------|
| **Domain reference** | Automation/queue patterns |
| **Anatomy** | root (container), tabs (widget), simpleEditor (container), frequencySelect (widget), timeInput (widget), daySelect (widget), advancedEditor (container), cronInput (widget), preview (container), nextRuns (container) |
| **Composes** | tabs (3.01), select (1.07), text-input (0.02), list (4.03) |
| **Complexity** | High |

---

## Implementation order

The tiers define **dependency order** (lower tiers first), but within each tier, widgets should be implemented by priority. The priority is based on frequency of use across the 25 domains cataloged in `ui-library.md`.

### Milestone 1: Minimum viable widget library

Widgets needed for a working zero-config CRUD interface from a concept spec:

1. button (0.01)
2. text-input (0.02)
3. checkbox (0.03)
4. label (0.04)
5. icon (0.05)
6. portal (0.08)
7. focus-trap (0.09)
8. textarea (1.01)
9. number-input (1.02)
10. toggle-switch (1.04)
11. select (1.07)
12. badge (1.16)
13. dialog (2.01)
14. toast (2.05)
15. alert (2.07)
16. tabs (3.01)
17. form (3.13)
18. fieldset (3.12)
19. data-table (4.01)
20. card (4.02)
21. empty-state (4.09)

**Count:** 21 widgets → auto-generated list, detail, create, edit views for any concept.

### Milestone 2: Rich form controls

All affordance-table widgets for full interactor coverage:

22. slider (1.03)
23. radio-group (1.05)
24. radio-card (1.06)
25. combobox (1.08)
26. segmented-control (1.09)
27. checkbox-group (1.10)
28. multi-select (1.11)
29. combobox-multi (1.12)
30. chip-input (1.13)
31. stepper (1.14)
32. progress-bar (1.15)
33. date-picker (5.01)
34. date-range-picker (5.02)
35. color-picker (5.03)
36. file-upload (5.04)

**Count:** +15 (36 total) → every standard interactor type resolves to a concrete widget.

### Milestone 3: Application chrome

Navigation, layout, and feedback for full applications:

37–50. Remaining Tier 2 (popover, tooltip, alert-dialog, toast-manager, drawer, hover-card, context-menu) + remaining Tier 3 (toolbar, menu, breadcrumb, accordion, disclosure, pagination, sidebar, command-palette, navigation-menu)

**Count:** +14 (50 total) → complete application shell.

### Milestone 4: Data-intensive views

Data display widgets for dashboards and admin interfaces:

51–65. All Tier 4: list, card-grid, stat-card, kanban-board, calendar-view, timeline, data-list, chart, gauge, notification-item, view-toggle, skeleton, splitter, floating-toolbar, master-detail (via 6.16)

**Count:** +15 (65 total)

### Milestone 5: Complex inputs & composites

Specialized inputs and assembled patterns:

66–85. Remaining Tier 5 + Tier 6: rich-text-editor, mention-input, tree-select, formula-editor, range-slider, rating, pin-input, signature-pad, filter-builder, sort-builder, view-switcher, property-panel, schema-editor, notification-center, preference-matrix, permission-matrix, faceted-search, file-browser, queue-dashboard, diff-viewer

**Count:** +20 (85 total)

### Milestone 6: Domain composites

Full domain pattern implementations:

86–122. All Tier 7: block-editor, slash-menu, outliner, canvas, canvas-node, canvas-connector, workflow-editor, workflow-node, state-machine-diagram, automation-builder, graph-view, condition-builder, field-mapper, minimap, color-label-picker, drag-handle, inline-edit, step-indicator, image-gallery, markdown-preview, code-block, policy-editor, plugin-detail-page, token-input, cron-editor, backlink-panel, plugin-card, cache-dashboard

**Count:** +37 (122 total)

---

## Theme specs

Three `.theme` files created alongside Milestone 1:

| Theme | Description |
|-------|-------------|
| `light.theme` | Default light theme. Warm neutrals, oklch palette, WCAG AA contrast. |
| `dark.theme` | Dark variant extending light. Inverted surface. |
| `high-contrast.theme` | WCAG AAA compliance. Extends light with enhanced contrast ratios. |

---

## Validation criteria per widget

Every `.widget` file must pass:

1. **WidgetParser/parse** — grammatically valid, all sections well-formed
2. **WidgetParser/validate** — connect section covers all anatomy parts, a11y section covers all interactive parts
3. **Affordance extraction** — affordance section registers correctly
4. **WidgetGen/generate** — produces valid React component (Milestone 1 target)
5. **Conformance test** — invariants hold in generated component
6. **WCAG AA audit** — correct ARIA roles, keyboard navigation, focus management, contrast ratios
