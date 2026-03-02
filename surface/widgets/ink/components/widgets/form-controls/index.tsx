// ============================================================
// Clef Surface Ink Widgets — Form Controls Barrel Export
//
// Re-exports all form control Ink React components for the
// Clef Surface terminal adapter. Each widget maps a Clef
// widget spec (repertoire/widgets/form-controls/*.widget)
// to an interactive terminal component using the Ink React
// rendering framework with keyboard-driven interaction.
// ============================================================

// --- Display ---
export { Badge } from './Badge.js';
export type { BadgeProps } from './Badge.js';

export { ProgressBar } from './ProgressBar.js';
export type { ProgressBarProps } from './ProgressBar.js';

// --- Selection: Multi-Choice ---
export { CheckboxGroup } from './CheckboxGroup.js';
export type { CheckboxGroupProps, CheckboxGroupOption } from './CheckboxGroup.js';

export { MultiSelect } from './MultiSelect.js';
export type { MultiSelectProps, MultiSelectOption } from './MultiSelect.js';

export { ComboboxMulti } from './ComboboxMulti.js';
export type { ComboboxMultiProps, ComboboxMultiOption } from './ComboboxMulti.js';

// --- Selection: Single-Choice ---
export { RadioGroup } from './RadioGroup.js';
export type { RadioGroupProps, RadioGroupOption } from './RadioGroup.js';

export { RadioCard } from './RadioCard.js';
export type { RadioCardProps, RadioCardOption } from './RadioCard.js';

export { Select } from './Select.js';
export type { SelectProps, SelectOption } from './Select.js';

export { Combobox } from './Combobox.js';
export type { ComboboxProps, ComboboxOption } from './Combobox.js';

export { SegmentedControl } from './SegmentedControl.js';
export type { SegmentedControlProps, SegmentedControlOption } from './SegmentedControl.js';

// --- Input: Text ---
export { ChipInput } from './ChipInput.js';
export type { ChipInputProps } from './ChipInput.js';

export { Textarea } from './Textarea.js';
export type { TextareaProps } from './Textarea.js';

// --- Input: Numeric ---
export { NumberInput } from './NumberInput.js';
export type { NumberInputProps } from './NumberInput.js';

export { Slider } from './Slider.js';
export type { SliderProps } from './Slider.js';

export { Stepper } from './Stepper.js';
export type { StepperProps } from './Stepper.js';

// --- Toggle ---
export { ToggleSwitch } from './ToggleSwitch.js';
export type { ToggleSwitchProps } from './ToggleSwitch.js';
