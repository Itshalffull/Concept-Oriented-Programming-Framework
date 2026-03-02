// ============================================================
// Clef Surface NativeScript Widget — SegmentedControl
//
// Segmented tab control for mutually exclusive option
// selection. Renders a horizontal row of tappable segments
// with the active segment highlighted.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Types ---------------

export interface SegmentOption {
  label: string;
  value: string;
  icon?: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface SegmentedControlProps {
  options?: SegmentOption[];
  value?: string;
  label?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  accentColor?: string;
  trackColor?: string;
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export function createSegmentedControl(props: SegmentedControlProps = {}): StackLayout {
  const {
    options = [],
    value: initialValue = '',
    label,
    fullWidth = true,
    disabled = false,
    accentColor = '#2196F3',
    trackColor = '#f3f4f6',
    onChange,
  } = props;

  let currentValue = initialValue || (options.length > 0 ? options[0].value : '');
  const segments: { value: string; view: StackLayout; textLabel: Label }[] = [];

  const container = new StackLayout();
  container.className = 'clef-segmented-control';

  if (label) {
    const titleLabel = new Label();
    titleLabel.text = label;
    titleLabel.className = 'clef-segmented-control-label';
    titleLabel.fontWeight = 'bold';
    titleLabel.marginBottom = 6;
    container.addChild(titleLabel);
  }

  // Segments track
  const track = new GridLayout();
  track.className = 'clef-segmented-control-track';
  track.backgroundColor = new Color(trackColor);
  track.borderRadius = 8;
  track.padding = 2;

  if (fullWidth && options.length > 0) {
    track.columns = options.map(() => '*').join(', ');
  } else {
    track.columns = options.map(() => 'auto').join(', ');
  }

  function updateSelection(): void {
    segments.forEach(({ value, view, textLabel }) => {
      const isSelected = value === currentValue;
      view.backgroundColor = isSelected ? new Color('#FFFFFF') : undefined;
      view.borderRadius = 6;
      textLabel.fontWeight = isSelected ? 'bold' : 'normal';
      textLabel.color = isSelected ? new Color(accentColor) : undefined;
    });
  }

  options.forEach((option, index) => {
    const segView = new StackLayout();
    segView.col = index;
    segView.className = 'clef-segmented-control-segment';
    segView.horizontalAlignment = 'center';
    segView.verticalAlignment = 'middle';
    segView.padding = '6 12';
    segView.opacity = option.disabled ? 0.5 : 1;

    const isSelected = option.value === currentValue;
    segView.backgroundColor = isSelected ? new Color('#FFFFFF') : undefined;
    segView.borderRadius = 6;

    const textLabel = new Label();
    textLabel.textAlignment = 'center';
    textLabel.fontSize = 13;
    textLabel.fontWeight = isSelected ? 'bold' : 'normal';
    textLabel.color = isSelected ? new Color(accentColor) : undefined;

    if (option.icon) {
      textLabel.text = `${option.icon} ${option.label}`;
    } else {
      textLabel.text = option.label;
    }

    segView.addChild(textLabel);
    segments.push({ value: option.value, view: segView, textLabel });

    if (!disabled && !option.disabled) {
      segView.on('tap', () => {
        currentValue = option.value;
        updateSelection();
        onChange?.(option.value);
      });
    }

    track.addChild(segView);
  });

  container.addChild(track);
  return container;
}

createSegmentedControl.displayName = 'SegmentedControl';
export default createSegmentedControl;
