// ============================================================
// Clef Surface NativeScript Widget — Slider
//
// Value slider using NativeScript's native Slider component.
// Displays a label, the current value, and an optional range
// indicator. Supports min, max, step constraints.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Slider as NSSlider,
  Color,
} from '@nativescript/core';

// --------------- Props ---------------

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  showRange?: boolean;
  disabled?: boolean;
  accentColor?: string;
  onChange?: (value: number) => void;
}

// --------------- Component ---------------

export function createSlider(props: SliderProps = {}): StackLayout {
  const {
    value: initialValue = 0,
    min = 0,
    max = 100,
    step = 1,
    label,
    showValue = true,
    showRange = true,
    disabled = false,
    accentColor = '#2196F3',
    onChange,
  } = props;

  let currentValue = Math.max(min, Math.min(max, initialValue));

  const container = new StackLayout();
  container.className = 'clef-slider';
  container.opacity = disabled ? 0.5 : 1;

  // Header row: label + value
  if (label || showValue) {
    const headerRow = new GridLayout();
    headerRow.columns = '*, auto';
    headerRow.marginBottom = 4;

    if (label) {
      const titleLabel = new Label();
      titleLabel.col = 0;
      titleLabel.text = label;
      titleLabel.className = 'clef-slider-label';
      titleLabel.fontWeight = 'bold';
      headerRow.addChild(titleLabel);
    }

    const valueLabel = new Label();
    valueLabel.col = 1;
    valueLabel.text = String(currentValue);
    valueLabel.className = 'clef-slider-value';
    valueLabel.fontSize = 13;
    valueLabel.color = new Color(accentColor);
    headerRow.addChild(valueLabel);

    container.addChild(headerRow);

    // Native slider
    const slider = new NSSlider();
    slider.className = 'clef-slider-track';
    slider.minValue = min;
    slider.maxValue = max;
    slider.value = currentValue;
    slider.isEnabled = !disabled;

    slider.on('valueChange', () => {
      let newValue = slider.value;
      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }
      newValue = Math.max(min, Math.min(max, newValue));
      currentValue = newValue;
      valueLabel.text = String(Math.round(newValue * 100) / 100);
      onChange?.(newValue);
    });

    container.addChild(slider);
  } else {
    const slider = new NSSlider();
    slider.className = 'clef-slider-track';
    slider.minValue = min;
    slider.maxValue = max;
    slider.value = currentValue;
    slider.isEnabled = !disabled;

    slider.on('valueChange', () => {
      let newValue = slider.value;
      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }
      currentValue = Math.max(min, Math.min(max, newValue));
      onChange?.(currentValue);
    });

    container.addChild(slider);
  }

  // Range labels
  if (showRange) {
    const rangeRow = new GridLayout();
    rangeRow.columns = '*, *';
    rangeRow.marginTop = 2;

    const minLabel = new Label();
    minLabel.col = 0;
    minLabel.text = String(min);
    minLabel.fontSize = 11;
    minLabel.opacity = 0.5;
    rangeRow.addChild(minLabel);

    const maxLabel = new Label();
    maxLabel.col = 1;
    maxLabel.text = String(max);
    maxLabel.fontSize = 11;
    maxLabel.opacity = 0.5;
    maxLabel.textAlignment = 'right';
    rangeRow.addChild(maxLabel);

    container.addChild(rangeRow);
  }

  return container;
}

createSlider.displayName = 'Slider';
export default createSlider;
