// ============================================================
// Clef Surface NativeScript Widget — SegmentedControl
//
// Horizontal set of mutually exclusive toggle segments.
// Acts as a compact alternative to radio buttons.
// ============================================================

import { StackLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface SegmentedControlSegment {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  segments: SegmentedControlSegment[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createSegmentedControl(props: SegmentedControlProps): StackLayout {
  const {
    segments = [],
    value,
    defaultValue,
    disabled = false,
    size = 'md',
    onChange,
  } = props;

  let selected = value ?? defaultValue ?? segments[0]?.value ?? '';

  const container = new StackLayout();
  container.className = `clef-widget-segmented-control clef-size-${size}`;
  container.orientation = 'horizontal';
  container.borderRadius = 6;
  container.borderWidth = 1;
  container.borderColor = new Color('#d1d5db');

  for (const seg of segments) {
    const isSelected = selected === seg.value;
    const isDisabled = disabled || !!seg.disabled;

    const btn = new Button();
    btn.text = seg.label;
    btn.className = `clef-segment${isSelected ? ' clef-segment-active' : ''}`;
    btn.isEnabled = !isDisabled;
    if (isSelected) {
      btn.backgroundColor = new Color('#3b82f6');
      btn.color = new Color('#ffffff');
    }

    if (!isDisabled) {
      btn.on('tap', () => {
        selected = seg.value;
        onChange?.(selected);
      });
    }

    container.addChild(btn);
  }

  return container;
}

export default createSegmentedControl;
