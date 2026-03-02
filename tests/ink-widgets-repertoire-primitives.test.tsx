// ============================================================
// Ink Primitives Widget Rendering Tests
//
// Validates terminal rendering output for all 14 primitive
// widgets in the Clef Surface Ink widget library. Each widget
// is tested through ink-testing-library's render/lastFrame
// pipeline to assert correct terminal text output.
// ============================================================

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Avatar } from '../surface/widgets/ink/components/widgets/primitives/Avatar.js';
import { Button } from '../surface/widgets/ink/components/widgets/primitives/Button.js';
import { Checkbox } from '../surface/widgets/ink/components/widgets/primitives/Checkbox.js';
import { Chip } from '../surface/widgets/ink/components/widgets/primitives/Chip.js';
import { FocusTrap } from '../surface/widgets/ink/components/widgets/primitives/FocusTrap.js';
import { Icon } from '../surface/widgets/ink/components/widgets/primitives/Icon.js';
import { Label } from '../surface/widgets/ink/components/widgets/primitives/Label.js';
import { Portal } from '../surface/widgets/ink/components/widgets/primitives/Portal.js';
import { Presence } from '../surface/widgets/ink/components/widgets/primitives/Presence.js';
import { ScrollLock } from '../surface/widgets/ink/components/widgets/primitives/ScrollLock.js';
import { Separator } from '../surface/widgets/ink/components/widgets/primitives/Separator.js';
import { Spinner } from '../surface/widgets/ink/components/widgets/primitives/Spinner.js';
import { TextInput } from '../surface/widgets/ink/components/widgets/primitives/TextInput.js';
import { VisuallyHidden } from '../surface/widgets/ink/components/widgets/primitives/VisuallyHidden.js';
import { Text } from 'ink';

// ============================================================
// Avatar
// ============================================================

describe('Avatar', () => {
  it('renders initials from a single name', () => {
    const { lastFrame } = render(<Avatar name="Alice" />);
    expect(lastFrame()).toContain('A');
  });

  it('renders initials from a full name', () => {
    const { lastFrame } = render(<Avatar name="John Doe" />);
    expect(lastFrame()).toContain('JD');
  });

  it('renders fallback "?" when no name is provided', () => {
    const { lastFrame } = render(<Avatar />);
    expect(lastFrame()).toContain('?');
  });

  it('renders custom fallback text', () => {
    const { lastFrame } = render(<Avatar fallback="NA" />);
    expect(lastFrame()).toContain('NA');
  });

  it('applies size prop by varying box width', () => {
    const { lastFrame: frameSm } = render(<Avatar name="A" size="sm" />);
    const { lastFrame: frameLg } = render(<Avatar name="A" size="lg" />);
    // The lg frame should be wider than sm due to padding and width differences
    const smLen = frameSm()?.split('\n')[0]?.length ?? 0;
    const lgLen = frameLg()?.split('\n')[0]?.length ?? 0;
    expect(lgLen).toBeGreaterThan(smLen);
  });
});

// ============================================================
// Button
// ============================================================

describe('Button', () => {
  it('renders label text inside brackets', () => {
    const { lastFrame } = render(<Button>Submit</Button>);
    const frame = lastFrame();
    expect(frame).toContain('Submit');
    expect(frame).toContain('[');
    expect(frame).toContain(']');
  });

  it('shows a spinner character when loading', () => {
    const { lastFrame } = render(<Button loading>Save</Button>);
    const frame = lastFrame()!;
    // The spinner uses braille characters from SPINNER_FRAMES
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const hasSpinner = spinnerChars.some((ch) => frame.includes(ch));
    expect(hasSpinner).toBe(true);
  });

  it('shows dimmed text when disabled', () => {
    const { lastFrame } = render(<Button disabled>Click</Button>);
    // The component renders; disabled is communicated via dimColor.
    // We verify the label is still present.
    expect(lastFrame()).toContain('Click');
  });

  it('renders inverse text when focused with filled variant', () => {
    const { lastFrame } = render(<Button isFocused variant="filled">Go</Button>);
    // With isFocused + filled variant, text is rendered with inverse.
    // We verify the label is present (Ink inverse is a style attribute).
    expect(lastFrame()).toContain('Go');
  });
});

// ============================================================
// Checkbox
// ============================================================

describe('Checkbox', () => {
  it('renders unchecked indicator [ ]', () => {
    const { lastFrame } = render(<Checkbox checked={false} />);
    expect(lastFrame()).toContain('[ ]');
  });

  it('renders checked indicator [x]', () => {
    const { lastFrame } = render(<Checkbox checked={true} />);
    expect(lastFrame()).toContain('[x]');
  });

  it('renders indeterminate indicator [-]', () => {
    const { lastFrame } = render(<Checkbox indeterminate />);
    expect(lastFrame()).toContain('[-]');
  });

  it('shows label text next to the checkbox', () => {
    const { lastFrame } = render(<Checkbox label="Accept terms" />);
    expect(lastFrame()).toContain('Accept terms');
  });

  it('shows asterisk for required fields', () => {
    const { lastFrame } = render(<Checkbox label="Required field" required />);
    expect(lastFrame()).toContain('*');
  });
});

// ============================================================
// Chip
// ============================================================

describe('Chip', () => {
  it('renders label inside parentheses for filled variant', () => {
    const { lastFrame } = render(<Chip label="Tag" />);
    const frame = lastFrame()!;
    expect(frame).toContain('Tag');
    expect(frame).toContain('(');
    expect(frame).toContain(')');
  });

  it('renders label inside brackets for outline variant', () => {
    const { lastFrame } = render(<Chip label="Tag" variant="outline" />);
    const frame = lastFrame()!;
    expect(frame).toContain('Tag');
    expect(frame).toContain('[');
    expect(frame).toContain(']');
  });

  it('shows remove indicator when removable', () => {
    const { lastFrame } = render(<Chip label="Removable" removable />);
    // The remove marker is the multiplication sign
    expect(lastFrame()).toContain('\u00d7');
  });

  it('does not show remove indicator when not removable', () => {
    const { lastFrame } = render(<Chip label="Static" />);
    expect(lastFrame()).not.toContain('\u00d7');
  });
});

// ============================================================
// FocusTrap
// ============================================================

describe('FocusTrap', () => {
  it('renders children transparently', () => {
    const { lastFrame } = render(
      <FocusTrap active>
        <Text>Trapped content</Text>
      </FocusTrap>,
    );
    expect(lastFrame()).toContain('Trapped content');
  });

  it('renders children even when inactive', () => {
    const { lastFrame } = render(
      <FocusTrap active={false}>
        <Text>Still visible</Text>
      </FocusTrap>,
    );
    expect(lastFrame()).toContain('Still visible');
  });
});

// ============================================================
// Icon
// ============================================================

describe('Icon', () => {
  it('renders checkmark for "check" icon', () => {
    const { lastFrame } = render(<Icon name="check" />);
    expect(lastFrame()).toContain('\u2713');
  });

  it('renders multiplication x for "close" icon', () => {
    const { lastFrame } = render(<Icon name="close" />);
    expect(lastFrame()).toContain('\u2715');
  });

  it('renders star glyph for "star" icon', () => {
    const { lastFrame } = render(<Icon name="star" />);
    expect(lastFrame()).toContain('\u2605');
  });

  it('renders fallback diamond for unknown icon name', () => {
    const { lastFrame } = render(<Icon name="nonexistent-icon" />);
    expect(lastFrame()).toContain('\u25C6');
  });

  it('renders label text for non-decorative icons', () => {
    const { lastFrame } = render(<Icon name="info" label="Information" decorative={false} />);
    expect(lastFrame()).toContain('Information');
  });

  it('does not render label for decorative icons', () => {
    const { lastFrame } = render(<Icon name="info" label="Hidden label" decorative />);
    expect(lastFrame()).not.toContain('Hidden label');
  });
});

// ============================================================
// Label
// ============================================================

describe('Label', () => {
  it('renders text content', () => {
    const { lastFrame } = render(<Label text="Username" />);
    expect(lastFrame()).toContain('Username');
  });

  it('shows asterisk when required', () => {
    const { lastFrame } = render(<Label text="Email" required />);
    const frame = lastFrame()!;
    expect(frame).toContain('Email');
    expect(frame).toContain('*');
  });

  it('does not show asterisk when not required', () => {
    const { lastFrame } = render(<Label text="Optional" />);
    expect(lastFrame()).not.toContain('*');
  });
});

// ============================================================
// Portal
// ============================================================

describe('Portal', () => {
  it('renders children directly in place', () => {
    const { lastFrame } = render(
      <Portal>
        <Text>Portal content</Text>
      </Portal>,
    );
    expect(lastFrame()).toContain('Portal content');
  });

  it('renders children even when disabled', () => {
    const { lastFrame } = render(
      <Portal disabled>
        <Text>Still here</Text>
      </Portal>,
    );
    expect(lastFrame()).toContain('Still here');
  });
});

// ============================================================
// Presence
// ============================================================

describe('Presence', () => {
  it('shows children when present is true', () => {
    const { lastFrame } = render(
      <Presence present>
        <Text>Visible</Text>
      </Presence>,
    );
    expect(lastFrame()).toContain('Visible');
  });

  it('hides children when present is false', () => {
    const { lastFrame } = render(
      <Presence present={false}>
        <Text>Hidden</Text>
      </Presence>,
    );
    // When not present, the component returns null, producing empty output
    expect(lastFrame()).not.toContain('Hidden');
  });

  it('shows children when forceMount is true even if not present', () => {
    const { lastFrame } = render(
      <Presence present={false} forceMount>
        <Text>Force mounted</Text>
      </Presence>,
    );
    expect(lastFrame()).toContain('Force mounted');
  });
});

// ============================================================
// ScrollLock
// ============================================================

describe('ScrollLock', () => {
  it('renders nothing (returns null)', () => {
    const { lastFrame } = render(<ScrollLock active />);
    // ScrollLock is a no-op in terminal, returns null
    expect(lastFrame()).toBe('');
  });

  it('renders nothing when inactive', () => {
    const { lastFrame } = render(<ScrollLock active={false} />);
    expect(lastFrame()).toBe('');
  });
});

// ============================================================
// Separator
// ============================================================

describe('Separator', () => {
  it('renders a horizontal line of box-drawing characters', () => {
    const { lastFrame } = render(<Separator orientation="horizontal" width={10} />);
    const frame = lastFrame()!;
    // Horizontal char is U+2500 (─)
    expect(frame).toContain('\u2500');
    // Should contain 10 repetitions
    expect(frame).toContain('\u2500'.repeat(10));
  });

  it('renders a vertical line character', () => {
    const { lastFrame } = render(<Separator orientation="vertical" />);
    // Vertical char is U+2502 (│)
    expect(lastFrame()).toContain('\u2502');
  });

  it('defaults to horizontal orientation', () => {
    const { lastFrame } = render(<Separator />);
    expect(lastFrame()).toContain('\u2500');
  });
});

// ============================================================
// Spinner
// ============================================================

describe('Spinner', () => {
  it('renders a braille spinner frame', () => {
    const { lastFrame } = render(<Spinner />);
    const frame = lastFrame()!;
    const spinnerFrames = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
    const hasFrame = spinnerFrames.some((ch) => frame.includes(ch));
    expect(hasFrame).toBe(true);
  });

  it('renders label text alongside the spinner', () => {
    const { lastFrame } = render(<Spinner label="Loading..." />);
    expect(lastFrame()).toContain('Loading...');
  });

  it('renders without label when none provided', () => {
    const { lastFrame } = render(<Spinner />);
    const frame = lastFrame()!;
    // Should not contain extra text beyond the spinner character
    expect(frame).not.toContain('Loading');
  });
});

// ============================================================
// TextInput
// ============================================================

describe('TextInput', () => {
  it('renders placeholder text when value is empty and not focused', () => {
    const { lastFrame } = render(<TextInput placeholder="Type here..." />);
    expect(lastFrame()).toContain('Type here...');
  });

  it('renders current value', () => {
    const { lastFrame } = render(<TextInput value="hello world" />);
    expect(lastFrame()).toContain('hello world');
  });

  it('renders label when provided', () => {
    const { lastFrame } = render(<TextInput label="Name" placeholder="Enter name" />);
    expect(lastFrame()).toContain('Name');
  });

  it('shows asterisk for required fields with a label', () => {
    const { lastFrame } = render(<TextInput label="Email" required />);
    const frame = lastFrame()!;
    expect(frame).toContain('Email');
    expect(frame).toContain('*');
  });
});

// ============================================================
// VisuallyHidden
// ============================================================

describe('VisuallyHidden', () => {
  it('renders nothing visible for children', () => {
    const { lastFrame } = render(
      <VisuallyHidden>
        <Text>Screen reader only</Text>
      </VisuallyHidden>,
    );
    // Returns null in terminal, so output is empty
    expect(lastFrame()).toBe('');
  });

  it('renders nothing visible for text prop', () => {
    const { lastFrame } = render(<VisuallyHidden text="Hidden text" />);
    expect(lastFrame()).toBe('');
  });
});
