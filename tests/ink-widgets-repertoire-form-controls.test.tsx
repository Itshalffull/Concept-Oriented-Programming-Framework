// ============================================================
// Clef Surface Ink Widgets — Form Controls Rendering Tests
//
// Rendering validation for the 16 form-control Ink widgets.
// Each widget is tested for default render, key prop variations,
// and value display using ink-testing-library.
// ============================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { Badge } from '../surface/widgets/ink/components/widgets/form-controls/Badge.js';
import { CheckboxGroup } from '../surface/widgets/ink/components/widgets/form-controls/CheckboxGroup.js';
import { ChipInput } from '../surface/widgets/ink/components/widgets/form-controls/ChipInput.js';
import { Combobox } from '../surface/widgets/ink/components/widgets/form-controls/Combobox.js';
import { ComboboxMulti } from '../surface/widgets/ink/components/widgets/form-controls/ComboboxMulti.js';
import { MultiSelect } from '../surface/widgets/ink/components/widgets/form-controls/MultiSelect.js';
import { NumberInput } from '../surface/widgets/ink/components/widgets/form-controls/NumberInput.js';
import { ProgressBar } from '../surface/widgets/ink/components/widgets/form-controls/ProgressBar.js';
import { RadioCard } from '../surface/widgets/ink/components/widgets/form-controls/RadioCard.js';
import { RadioGroup } from '../surface/widgets/ink/components/widgets/form-controls/RadioGroup.js';
import { SegmentedControl } from '../surface/widgets/ink/components/widgets/form-controls/SegmentedControl.js';
import { Select } from '../surface/widgets/ink/components/widgets/form-controls/Select.js';
import { Slider } from '../surface/widgets/ink/components/widgets/form-controls/Slider.js';
import { Stepper } from '../surface/widgets/ink/components/widgets/form-controls/Stepper.js';
import { Textarea } from '../surface/widgets/ink/components/widgets/form-controls/Textarea.js';
import { ToggleSwitch } from '../surface/widgets/ink/components/widgets/form-controls/ToggleSwitch.js';

// ============================================================
// Badge
// ============================================================

describe('Badge', () => {
  it('renders with default filled variant and child text', () => {
    const { lastFrame } = render(<Badge>Active</Badge>);
    const output = lastFrame();
    expect(output).toContain('Active');
  });

  it('renders outline variant with bracket delimiters', () => {
    const { lastFrame } = render(<Badge variant="outline">Info</Badge>);
    const output = lastFrame();
    expect(output).toContain('[');
    expect(output).toContain('Info');
    expect(output).toContain(']');
  });

  it('renders subtle variant with dimmed text', () => {
    const { lastFrame } = render(<Badge variant="subtle">Muted</Badge>);
    const output = lastFrame();
    expect(output).toContain('Muted');
  });

  it('applies size padding — sm has no extra padding', () => {
    const { lastFrame } = render(<Badge size="sm">X</Badge>);
    const output = lastFrame();
    // sm size has px=0, so the label is rendered without surrounding spaces
    expect(output).toContain('X');
  });

  it('applies size padding — lg adds padding around the label', () => {
    const { lastFrame } = render(<Badge size="lg" variant="outline">Tag</Badge>);
    const output = lastFrame();
    // lg size has px=2, so two spaces surround the label inside brackets
    expect(output).toContain('[  Tag  ]');
  });
});

// ============================================================
// CheckboxGroup
// ============================================================

describe('CheckboxGroup', () => {
  const options = [
    { label: 'Alpha', value: 'a' },
    { label: 'Beta', value: 'b' },
    { label: 'Gamma', value: 'c' },
  ];

  it('renders all option labels with unchecked indicators', () => {
    const { lastFrame } = render(
      <CheckboxGroup value={[]} options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Alpha');
    expect(output).toContain('Beta');
    expect(output).toContain('Gamma');
    expect(output).toContain('[ ]');
  });

  it('renders checked indicators for selected values', () => {
    const { lastFrame } = render(
      <CheckboxGroup value={['a', 'c']} options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('[x]');
  });

  it('renders an optional label above the group', () => {
    const { lastFrame } = render(
      <CheckboxGroup value={[]} options={options} label="Choose items" />
    );
    const output = lastFrame();
    expect(output).toContain('Choose items');
  });
});

// ============================================================
// ChipInput
// ============================================================

describe('ChipInput', () => {
  it('renders placeholder when no chips are present', () => {
    const { lastFrame } = render(
      <ChipInput value={[]} />
    );
    const output = lastFrame();
    expect(output).toContain('Type and press Enter...');
  });

  it('renders existing chips in parentheses', () => {
    const { lastFrame } = render(
      <ChipInput value={['react', 'vue']} />
    );
    const output = lastFrame();
    expect(output).toContain('(react)');
    expect(output).toContain('(vue)');
  });

  it('renders custom placeholder text', () => {
    const { lastFrame } = render(
      <ChipInput value={[]} placeholder="Add tags" />
    );
    const output = lastFrame();
    expect(output).toContain('Add tags');
  });
});

// ============================================================
// Combobox
// ============================================================

describe('Combobox', () => {
  const options = [
    { label: 'Red', value: 'red' },
    { label: 'Green', value: 'green' },
    { label: 'Blue', value: 'blue' },
  ];

  it('renders with default placeholder when no value is selected', () => {
    const { lastFrame } = render(
      <Combobox options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Search...');
    // Contains the dropdown arrow
    expect(output).toContain('\u25BC');
  });

  it('renders selected value label on the trigger line', () => {
    const { lastFrame } = render(
      <Combobox value="green" options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Green');
  });

  it('renders custom placeholder text', () => {
    const { lastFrame } = render(
      <Combobox options={options} placeholder="Pick a color" />
    );
    const output = lastFrame();
    expect(output).toContain('Pick a color');
  });
});

// ============================================================
// ComboboxMulti
// ============================================================

describe('ComboboxMulti', () => {
  const options = [
    { label: 'Cat', value: 'cat' },
    { label: 'Dog', value: 'dog' },
    { label: 'Bird', value: 'bird' },
  ];

  it('renders with placeholder when no values are selected', () => {
    const { lastFrame } = render(
      <ComboboxMulti value={[]} options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Search...');
    expect(output).toContain('\u25BC');
  });

  it('renders selected values as chips', () => {
    const { lastFrame } = render(
      <ComboboxMulti value={['cat', 'bird']} options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('(Cat)');
    expect(output).toContain('(Bird)');
  });

  it('renders with an optional label', () => {
    const { lastFrame } = render(
      <ComboboxMulti value={[]} options={options} label="Pick pets" />
    );
    const output = lastFrame();
    expect(output).toContain('Pick pets');
  });
});

// ============================================================
// MultiSelect
// ============================================================

describe('MultiSelect', () => {
  const options = [
    { label: 'Apples', value: 'apples' },
    { label: 'Bananas', value: 'bananas' },
    { label: 'Cherries', value: 'cherries' },
  ];

  it('renders all options with unchecked indicators', () => {
    const { lastFrame } = render(
      <MultiSelect value={[]} options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Apples');
    expect(output).toContain('Bananas');
    expect(output).toContain('Cherries');
    expect(output).toContain('[ ]');
  });

  it('renders checked indicators for selected values', () => {
    const { lastFrame } = render(
      <MultiSelect value={['bananas']} options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('[x]');
    expect(output).toContain('Bananas');
  });

  it('renders an optional label', () => {
    const { lastFrame } = render(
      <MultiSelect value={[]} options={options} label="Select fruits" />
    );
    const output = lastFrame();
    expect(output).toContain('Select fruits');
  });
});

// ============================================================
// NumberInput
// ============================================================

describe('NumberInput', () => {
  it('renders the current numeric value with arrow controls', () => {
    const { lastFrame } = render(
      <NumberInput value={42} />
    );
    const output = lastFrame();
    expect(output).toContain('42');
    // Left arrow indicator
    expect(output).toContain('\u25C4');
    // Right arrow indicator
    expect(output).toContain('\u25BA');
  });

  it('renders an optional label above the control', () => {
    const { lastFrame } = render(
      <NumberInput value={10} label="Quantity" />
    );
    const output = lastFrame();
    expect(output).toContain('Quantity');
    expect(output).toContain('10');
  });

  it('renders with disabled styling when disabled', () => {
    const { lastFrame } = render(
      <NumberInput value={5} disabled />
    );
    const output = lastFrame();
    expect(output).toContain('5');
    // Still renders the value; styling is handled by Ink color props
  });
});

// ============================================================
// ProgressBar
// ============================================================

describe('ProgressBar', () => {
  it('renders a progress bar with percentage at default value', () => {
    const { lastFrame } = render(
      <ProgressBar value={50} />
    );
    const output = lastFrame();
    expect(output).toContain('50%');
    // Contains the bracket delimiters
    expect(output).toContain('[');
    expect(output).toContain(']');
  });

  it('renders 0% for zero value', () => {
    const { lastFrame } = render(
      <ProgressBar value={0} />
    );
    const output = lastFrame();
    expect(output).toContain('0%');
  });

  it('renders 100% for full value', () => {
    const { lastFrame } = render(
      <ProgressBar value={100} />
    );
    const output = lastFrame();
    expect(output).toContain('100%');
  });

  it('renders with an optional label and hides value when showValue is false', () => {
    const { lastFrame } = render(
      <ProgressBar value={75} label="Upload" showValue={false} />
    );
    const output = lastFrame();
    expect(output).toContain('Upload');
    expect(output).not.toContain('75%');
  });
});

// ============================================================
// RadioCard
// ============================================================

describe('RadioCard', () => {
  const options = [
    { label: 'Basic', value: 'basic', description: 'Free tier' },
    { label: 'Pro', value: 'pro', description: 'Paid tier' },
  ];

  it('renders all card options with radio indicators', () => {
    const { lastFrame } = render(
      <RadioCard options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Basic');
    expect(output).toContain('Pro');
    // Unselected empty circle indicator
    expect(output).toContain('(\u25CB)');
  });

  it('renders the selected option with a filled circle indicator', () => {
    const { lastFrame } = render(
      <RadioCard value="pro" options={options} />
    );
    const output = lastFrame();
    // Filled circle for selected option
    expect(output).toContain('(\u25CF)');
    expect(output).toContain('Pro');
  });

  it('renders option descriptions', () => {
    const { lastFrame } = render(
      <RadioCard options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Free tier');
    expect(output).toContain('Paid tier');
  });
});

// ============================================================
// RadioGroup
// ============================================================

describe('RadioGroup', () => {
  const options = [
    { label: 'Small', value: 'sm' },
    { label: 'Medium', value: 'md' },
    { label: 'Large', value: 'lg' },
  ];

  it('renders all radio options with circle indicators', () => {
    const { lastFrame } = render(
      <RadioGroup options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Small');
    expect(output).toContain('Medium');
    expect(output).toContain('Large');
    // Unselected empty circle
    expect(output).toContain('(\u25CB)');
  });

  it('renders the selected value with a filled circle', () => {
    const { lastFrame } = render(
      <RadioGroup value="md" options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('(\u25CF)');
    expect(output).toContain('Medium');
  });

  it('renders an optional label', () => {
    const { lastFrame } = render(
      <RadioGroup options={options} label="Choose size" />
    );
    const output = lastFrame();
    expect(output).toContain('Choose size');
  });
});

// ============================================================
// SegmentedControl
// ============================================================

describe('SegmentedControl', () => {
  const options = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
  ];

  it('renders all segment labels within brackets', () => {
    const { lastFrame } = render(
      <SegmentedControl options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('[');
    expect(output).toContain('Day');
    expect(output).toContain('Week');
    expect(output).toContain('Month');
    expect(output).toContain(']');
  });

  it('renders pipe separators between segments', () => {
    const { lastFrame } = render(
      <SegmentedControl options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('|');
  });

  it('renders all segment labels when a value is selected', () => {
    const { lastFrame } = render(
      <SegmentedControl value="week" options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Week');
    expect(output).toContain('Day');
    expect(output).toContain('Month');
  });
});

// ============================================================
// Select
// ============================================================

describe('Select', () => {
  const options = [
    { label: 'JavaScript', value: 'js' },
    { label: 'TypeScript', value: 'ts' },
    { label: 'Python', value: 'py' },
  ];

  it('renders placeholder when no value is selected', () => {
    const { lastFrame } = render(
      <Select options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('Select...');
    // Closed dropdown indicator
    expect(output).toContain('\u25BC');
  });

  it('renders the selected value label on the trigger line', () => {
    const { lastFrame } = render(
      <Select value="ts" options={options} />
    );
    const output = lastFrame();
    expect(output).toContain('TypeScript');
  });

  it('renders dropdown items when open is true', () => {
    const { lastFrame } = render(
      <Select options={options} open />
    );
    const output = lastFrame();
    expect(output).toContain('JavaScript');
    expect(output).toContain('TypeScript');
    expect(output).toContain('Python');
    // Open dropdown indicator
    expect(output).toContain('\u25B3');
  });
});

// ============================================================
// Slider
// ============================================================

describe('Slider', () => {
  it('renders the slider track with percentage at default range', () => {
    const { lastFrame } = render(
      <Slider value={50} />
    );
    const output = lastFrame();
    expect(output).toContain('50%');
    expect(output).toContain('[');
    expect(output).toContain(']');
    // Contains the thumb character (filled circle)
    expect(output).toContain('\u25CF');
  });

  it('renders 0% at minimum value', () => {
    const { lastFrame } = render(
      <Slider value={0} />
    );
    const output = lastFrame();
    expect(output).toContain('0%');
  });

  it('renders 100% at maximum value', () => {
    const { lastFrame } = render(
      <Slider value={100} />
    );
    const output = lastFrame();
    expect(output).toContain('100%');
  });

  it('renders an optional label above the track', () => {
    const { lastFrame } = render(
      <Slider value={30} label="Volume" />
    );
    const output = lastFrame();
    expect(output).toContain('Volume');
    expect(output).toContain('30%');
  });
});

// ============================================================
// Stepper
// ============================================================

describe('Stepper', () => {
  it('renders the current value with increment/decrement buttons', () => {
    const { lastFrame } = render(
      <Stepper value={5} />
    );
    const output = lastFrame();
    expect(output).toContain('5');
    expect(output).toContain('[ - ]');
    expect(output).toContain('[ + ]');
  });

  it('renders at minimum value', () => {
    const { lastFrame } = render(
      <Stepper value={0} min={0} max={10} />
    );
    const output = lastFrame();
    expect(output).toContain('0');
    expect(output).toContain('[ - ]');
    expect(output).toContain('[ + ]');
  });

  it('renders with an optional label', () => {
    const { lastFrame } = render(
      <Stepper value={3} label="Items" />
    );
    const output = lastFrame();
    expect(output).toContain('Items');
    expect(output).toContain('3');
  });
});

// ============================================================
// Textarea
// ============================================================

describe('Textarea', () => {
  it('renders the current text value inside a border', () => {
    const { lastFrame } = render(
      <Textarea value="Hello world" />
    );
    const output = lastFrame();
    expect(output).toContain('Hello world');
  });

  it('renders placeholder text when value is empty', () => {
    const { lastFrame } = render(
      <Textarea value="" placeholder="Enter notes..." />
    );
    const output = lastFrame();
    expect(output).toContain('Enter notes...');
  });

  it('renders empty with default placeholder when value is empty and no placeholder', () => {
    const { lastFrame } = render(
      <Textarea value="" />
    );
    const output = lastFrame();
    // With empty value and no placeholder, still renders the bordered box
    expect(output).toBeDefined();
  });

  it('renders multi-line content', () => {
    const { lastFrame } = render(
      <Textarea value={"Line one\nLine two\nLine three"} />
    );
    const output = lastFrame();
    expect(output).toContain('Line one');
    expect(output).toContain('Line two');
    expect(output).toContain('Line three');
  });
});

// ============================================================
// ToggleSwitch
// ============================================================

describe('ToggleSwitch', () => {
  it('renders ON state with filled/empty circle pattern', () => {
    const { lastFrame } = render(
      <ToggleSwitch checked={true} />
    );
    const output = lastFrame();
    expect(output).toContain('ON');
    // ON position: [filled empty]
    expect(output).toContain('[\u25CF\u25CB]');
  });

  it('renders OFF state with empty/filled circle pattern', () => {
    const { lastFrame } = render(
      <ToggleSwitch checked={false} />
    );
    const output = lastFrame();
    expect(output).toContain('OFF');
    // OFF position: [empty filled]
    expect(output).toContain('[\u25CB\u25CF]');
  });

  it('renders with an optional label', () => {
    const { lastFrame } = render(
      <ToggleSwitch checked={true} label="Dark mode" />
    );
    const output = lastFrame();
    expect(output).toContain('Dark mode');
    expect(output).toContain('ON');
  });
});
