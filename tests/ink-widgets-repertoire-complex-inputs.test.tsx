// Clef Surface Ink Widgets — Complex Inputs Rendering Tests
//
// Validates terminal rendering output for all 12 complex-input
// widgets: ColorPicker, DatePicker, DateRangePicker, FileUpload,
// FormulaEditor, MentionInput, PinInput, RangeSlider, Rating,
// RichTextEditor, SignaturePad, TreeSelect.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

import { ColorPicker } from '../surface/widgets/ink/components/widgets/complex-inputs/ColorPicker';
import { DatePicker } from '../surface/widgets/ink/components/widgets/complex-inputs/DatePicker';
import { DateRangePicker } from '../surface/widgets/ink/components/widgets/complex-inputs/DateRangePicker';
import { FileUpload } from '../surface/widgets/ink/components/widgets/complex-inputs/FileUpload';
import { FormulaEditor } from '../surface/widgets/ink/components/widgets/complex-inputs/FormulaEditor';
import { MentionInput } from '../surface/widgets/ink/components/widgets/complex-inputs/MentionInput';
import { PinInput } from '../surface/widgets/ink/components/widgets/complex-inputs/PinInput';
import { RangeSlider } from '../surface/widgets/ink/components/widgets/complex-inputs/RangeSlider';
import { Rating } from '../surface/widgets/ink/components/widgets/complex-inputs/Rating';
import { RichTextEditor } from '../surface/widgets/ink/components/widgets/complex-inputs/RichTextEditor';
import { SignaturePad } from '../surface/widgets/ink/components/widgets/complex-inputs/SignaturePad';
import { TreeSelect } from '../surface/widgets/ink/components/widgets/complex-inputs/TreeSelect';

// ============================================================
// ColorPicker
// ============================================================

describe('ColorPicker', () => {
  it('renders default state with color display and presets', () => {
    const { lastFrame } = render(<ColorPicker />);
    const output = lastFrame();
    expect(output).toContain('Color:');
    expect(output).toContain('Presets:');
  });

  it('displays the controlled value hex string', () => {
    const { lastFrame } = render(<ColorPicker value="#ff0000" />);
    const output = lastFrame();
    expect(output).toContain('#ff0000');
    expect(output).toContain('Color:');
  });

  it('shows navigation hint when focused and not disabled', () => {
    const { lastFrame } = render(<ColorPicker isFocused />);
    const output = lastFrame();
    expect(output).toContain('navigate presets');
    expect(output).toContain('# edit hex');
  });

  it('does not show hint when disabled', () => {
    const { lastFrame } = render(<ColorPicker isFocused disabled />);
    const output = lastFrame();
    expect(output).not.toContain('navigate presets');
  });
});

// ============================================================
// DatePicker
// ============================================================

describe('DatePicker', () => {
  it('renders month header and day-of-week row', () => {
    const { lastFrame } = render(<DatePicker value="2026-03-15" />);
    const output = lastFrame();
    expect(output).toContain('March 2026');
    expect(output).toContain('Su');
    expect(output).toContain('Mo');
    expect(output).toContain('Fr');
  });

  it('displays the selected date in the footer', () => {
    const { lastFrame } = render(<DatePicker value="2026-03-15" />);
    const output = lastFrame();
    expect(output).toContain('Selected: 2026-03-15');
  });

  it('shows "none" when no value is provided', () => {
    const { lastFrame } = render(<DatePicker />);
    const output = lastFrame();
    expect(output).toContain('Selected: none');
  });
});

// ============================================================
// DateRangePicker
// ============================================================

describe('DateRangePicker', () => {
  it('renders start and end labels with default dashes', () => {
    const { lastFrame } = render(<DateRangePicker />);
    const output = lastFrame();
    expect(output).toContain('Start: ---');
    expect(output).toContain('End: ---');
    expect(output).toContain('Tab to switch');
  });

  it('displays provided start and end dates', () => {
    const { lastFrame } = render(
      <DateRangePicker startDate="2026-03-01" endDate="2026-03-15" />,
    );
    const output = lastFrame();
    expect(output).toContain('Start: 2026-03-01');
    expect(output).toContain('End: 2026-03-15');
  });

  it('renders two month calendars with short month names', () => {
    const { lastFrame } = render(
      <DateRangePicker startDate="2026-03-01" endDate="2026-04-10" />,
    );
    const output = lastFrame();
    expect(output).toContain('Mar 2026');
    expect(output).toContain('Apr 2026');
  });
});

// ============================================================
// FileUpload
// ============================================================

describe('FileUpload', () => {
  it('renders browse button and "No file selected" when empty', () => {
    const { lastFrame } = render(<FileUpload />);
    const output = lastFrame();
    expect(output).toContain('Browse...');
    expect(output).toContain('No file selected');
  });

  it('displays accept types and max size constraints', () => {
    const { lastFrame } = render(
      <FileUpload accept={['.png', '.jpg']} maxSize={5242880} />,
    );
    const output = lastFrame();
    expect(output).toContain('.png, .jpg');
    expect(output).toContain('max 5.0 MB');
  });

  it('lists files with names and sizes when provided', () => {
    const files = [
      { name: 'photo.png', size: 102400 },
      { name: 'doc.pdf', size: 2048 },
    ];
    const { lastFrame } = render(<FileUpload files={files} />);
    const output = lastFrame();
    expect(output).toContain('photo.png');
    expect(output).toContain('100.0 KB');
    expect(output).toContain('doc.pdf');
    expect(output).toContain('2.0 KB');
  });
});

// ============================================================
// FormulaEditor
// ============================================================

describe('FormulaEditor', () => {
  it('renders placeholder when value is empty', () => {
    const { lastFrame } = render(<FormulaEditor />);
    const output = lastFrame();
    expect(output).toContain('Enter formula...');
  });

  it('renders the formula value with the function prefix', () => {
    const { lastFrame } = render(
      <FormulaEditor value="price + tax" variables={['price', 'tax']} />,
    );
    const output = lastFrame();
    // The component renders a function prefix character
    expect(output).toContain('price');
    expect(output).toContain('tax');
  });

  it('shows hint text when focused', () => {
    const { lastFrame } = render(<FormulaEditor isFocused />);
    const output = lastFrame();
    expect(output).toContain('Tab autocomplete');
    expect(output).toContain('Enter evaluate');
    expect(output).toContain('Esc dismiss');
  });
});

// ============================================================
// MentionInput
// ============================================================

describe('MentionInput', () => {
  it('renders the prompt and placeholder when empty', () => {
    const { lastFrame } = render(<MentionInput />);
    const output = lastFrame();
    expect(output).toContain('>');
    expect(output).toContain('Type a message...');
  });

  it('renders the controlled text value', () => {
    const { lastFrame } = render(<MentionInput value="Hello @alice" />);
    const output = lastFrame();
    expect(output).toContain('Hello');
    expect(output).toContain('@alice');
  });

  it('uses a custom placeholder', () => {
    const { lastFrame } = render(<MentionInput placeholder="Mention someone..." />);
    const output = lastFrame();
    expect(output).toContain('Mention someone...');
  });
});

// ============================================================
// PinInput
// ============================================================

describe('PinInput', () => {
  it('renders empty pin cells with underscores', () => {
    const { lastFrame } = render(<PinInput length={4} />);
    const output = lastFrame();
    // Each empty cell renders as [ _ ]
    const underscoreCount = (output.match(/\[ _ \]/g) || []).length;
    expect(underscoreCount).toBe(4);
  });

  it('displays the entered digits in cells', () => {
    const { lastFrame } = render(<PinInput length={4} value="12" />);
    const output = lastFrame();
    expect(output).toContain('[ 1 ]');
    expect(output).toContain('[ 2 ]');
    // Remaining cells are empty
    const underscoreCount = (output.match(/\[ _ \]/g) || []).length;
    expect(underscoreCount).toBe(2);
  });

  it('masks digits when mask prop is true', () => {
    const { lastFrame } = render(<PinInput length={4} value="1234" mask />);
    const output = lastFrame();
    const maskedCount = (output.match(/\[ \* \]/g) || []).length;
    expect(maskedCount).toBe(4);
    expect(output).not.toContain('[ 1 ]');
  });
});

// ============================================================
// RangeSlider
// ============================================================

describe('RangeSlider', () => {
  it('renders track brackets and default value range', () => {
    const { lastFrame } = render(<RangeSlider />);
    const output = lastFrame();
    expect(output).toContain('[');
    expect(output).toContain(']');
    expect(output).toContain('0-100');
  });

  it('displays a label when provided', () => {
    const { lastFrame } = render(<RangeSlider label="Price Range" />);
    const output = lastFrame();
    expect(output).toContain('Price Range');
  });

  it('shows controlled low and high values', () => {
    const { lastFrame } = render(<RangeSlider low={20} high={80} />);
    const output = lastFrame();
    expect(output).toContain('20-80');
  });

  it('shows active thumb hint when focused', () => {
    const { lastFrame } = render(<RangeSlider isFocused />);
    const output = lastFrame();
    expect(output).toContain('Active:');
    expect(output).toContain('min');
    expect(output).toContain('Tab to switch');
  });
});

// ============================================================
// Rating
// ============================================================

describe('Rating', () => {
  it('renders the correct number of stars with count display', () => {
    const { lastFrame } = render(<Rating max={5} />);
    const output = lastFrame();
    expect(output).toContain('(0/5)');
    // All 5 stars should be empty (☆)
    const emptyStars = (output.match(/\u2606/g) || []).length;
    expect(emptyStars).toBe(5);
  });

  it('fills stars according to the value', () => {
    const { lastFrame } = render(<Rating value={3} max={5} />);
    const output = lastFrame();
    expect(output).toContain('(3/5)');
    const filledStars = (output.match(/\u2605/g) || []).length;
    expect(filledStars).toBe(3);
    const emptyStars = (output.match(/\u2606/g) || []).length;
    expect(emptyStars).toBe(2);
  });

  it('renders a label when provided', () => {
    const { lastFrame } = render(<Rating label="Quality" value={4} max={5} />);
    const output = lastFrame();
    expect(output).toContain('Quality');
    expect(output).toContain('(4/5)');
  });

  it('shows half-star when allowHalf is set', () => {
    const { lastFrame } = render(<Rating value={2.5} max={5} allowHalf />);
    const output = lastFrame();
    expect(output).toContain('(2.5/5)');
    // Should have 2 filled, 1 half, 2 empty
    const halfStars = (output.match(/\u00BD/g) || []).length;
    expect(halfStars).toBe(1);
  });
});

// ============================================================
// RichTextEditor
// ============================================================

describe('RichTextEditor', () => {
  it('renders placeholder when empty with toolbar', () => {
    const { lastFrame } = render(<RichTextEditor />);
    const output = lastFrame();
    expect(output).toContain('Start typing...');
    // Toolbar buttons
    expect(output).toContain('B');
    expect(output).toContain('I');
    expect(output).toContain('U');
    expect(output).toContain('H');
  });

  it('displays content with line numbers', () => {
    const { lastFrame } = render(<RichTextEditor value="Hello world" />);
    const output = lastFrame();
    expect(output).toContain('Hello world');
    // Line number prefix for line 1
    expect(output).toContain(' 1 ');
  });

  it('renders a label when provided', () => {
    const { lastFrame } = render(<RichTextEditor label="Notes" />);
    const output = lastFrame();
    expect(output).toContain('Notes');
  });

  it('shows line count and char count when focused', () => {
    const { lastFrame } = render(
      <RichTextEditor value={'Line one\nLine two'} isFocused />,
    );
    const output = lastFrame();
    expect(output).toContain('Line 1/2');
    expect(output).toContain('17 chars');
  });
});

// ============================================================
// SignaturePad
// ============================================================

describe('SignaturePad', () => {
  it('renders with default label and empty placeholder', () => {
    const { lastFrame } = render(<SignaturePad />);
    const output = lastFrame();
    expect(output).toContain('Signature');
    expect(output).toContain('[Draw signature here]');
    expect(output).toContain('Not signed');
  });

  it('renders with a custom label', () => {
    const { lastFrame } = render(<SignaturePad label="Your Signature" />);
    const output = lastFrame();
    expect(output).toContain('Your Signature');
  });

  it('shows clear button and hint when focused', () => {
    const { lastFrame } = render(<SignaturePad isFocused />);
    const output = lastFrame();
    expect(output).toContain('[ Clear ]');
    expect(output).toContain('Space draw');
    expect(output).toContain('c clear');
  });
});

// ============================================================
// TreeSelect
// ============================================================

describe('TreeSelect', () => {
  const sampleNodes = [
    {
      id: 'fruits',
      label: 'Fruits',
      children: [
        { id: 'apple', label: 'Apple' },
        { id: 'banana', label: 'Banana' },
      ],
    },
    {
      id: 'vegetables',
      label: 'Vegetables',
      children: [
        { id: 'carrot', label: 'Carrot' },
      ],
    },
  ];

  it('renders top-level nodes with collapsed indicators', () => {
    const { lastFrame } = render(<TreeSelect nodes={sampleNodes} />);
    const output = lastFrame();
    expect(output).toContain('Fruits');
    expect(output).toContain('Vegetables');
    // Collapsed indicator (right-pointing triangle)
    expect(output).toContain('\u25B6');
  });

  it('renders expanded children when expanded prop includes the parent', () => {
    const { lastFrame } = render(
      <TreeSelect nodes={sampleNodes} expanded={['fruits']} />,
    );
    const output = lastFrame();
    expect(output).toContain('Fruits');
    expect(output).toContain('Apple');
    expect(output).toContain('Banana');
    // Expanded indicator (down-pointing triangle)
    expect(output).toContain('\u25BC');
  });

  it('shows selection checkboxes with checked state for selected values', () => {
    const { lastFrame } = render(
      <TreeSelect
        nodes={sampleNodes}
        expanded={['fruits']}
        value="apple"
      />,
    );
    const output = lastFrame();
    expect(output).toContain('[x] Apple');
    expect(output).toContain('[ ] Banana');
  });

  it('renders "(empty tree)" when nodes array is empty', () => {
    const { lastFrame } = render(<TreeSelect nodes={[]} />);
    const output = lastFrame();
    expect(output).toContain('(empty tree)');
  });

  it('renders a label when provided', () => {
    const { lastFrame } = render(<TreeSelect nodes={sampleNodes} label="Categories" />);
    const output = lastFrame();
    expect(output).toContain('Categories');
  });
});
