// ============================================================
// Clef Surface Compose Widgets — Form Controls Barrel Index
//
// Documents all form control Compose components for the Clef
// Surface Android/Compose adapter. Each widget maps a Clef
// widget spec (repertoire/widgets/form-controls/*.widget) to
// an interactive Jetpack Compose component using Material 3
// design system components.
//
// Unlike TypeScript/Ink barrel exports, Kotlin uses package-
// level visibility. All composables in this package are
// accessible via:
//
//   import clef.surface.compose.components.widgets.formcontrols.*
//
// --------------- Widget Inventory ---------------
//
// --- Display ---
// Badge.kt           — Compact status indicator or count display
// ProgressBar.kt     — Visual progress indicator with track/fill
//
// --- Selection: Multi-Choice ---
// CheckboxGroup.kt   — Multi-choice list of checkboxes
// MultiSelect.kt     — Dropdown multi-choice selector with checkboxes
// ComboboxMulti.kt   — Searchable multi-choice selector with chips
//
// --- Selection: Single-Choice ---
// RadioGroup.kt      — Single-choice list of radio buttons
// RadioCard.kt       — Single-choice with rich card-style options
// Select.kt          — Dropdown single-choice selector
// Combobox.kt        — Searchable single-choice selector
// SegmentedControl.kt — Inline row of connected segment buttons
//
// --- Input: Text ---
// ChipInput.kt       — Free-form multi-value input with removable chips
// Textarea.kt        — Multi-line text input area
//
// --- Input: Numeric ---
// NumberInput.kt     — Numeric input with +/- controls and validation
// Slider.kt          — Range input slider with thumb and track
// Stepper.kt         — Compact increment/decrement control
//
// --- Toggle ---
// ToggleSwitch.kt    — Binary on/off switch control
// ============================================================

package clef.surface.compose.components.widgets.formcontrols
