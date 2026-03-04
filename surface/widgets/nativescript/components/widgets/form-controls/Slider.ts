// ============================================================
// Clef Surface NativeScript Widget — Slider
//
// Range slider input for numeric value selection with min,
// max, step constraints and optional label display.
// ============================================================

import { StackLayout, Label, Slider as NSSlider } from '@nativescript/core';

// --------------- Props ---------------

export interface SliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  showValue?: boolean;
  onChange?: (value: number) => void;
}

// --------------- Component ---------------

export function createSlider(props: SliderProps): StackLayout {
  const {
    value = 0,
    min = 0,
    max = 100,
    step = 1,
    label,
    disabled = false,
    showValue = false,
    onChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-slider';

  if (label) {
    const headerRow = new StackLayout();
    headerRow.orientation = 'horizontal';
    headerRow.marginBottom = 4;

    const lbl = new Label();
    lbl.text = label;
    headerRow.addChild(lbl);

    if (showValue) {
      const valLabel = new Label();
      valLabel.text = String(value);
      valLabel.horizontalAlignment = 'right';
      headerRow.addChild(valLabel);
    }

    container.addChild(headerRow);
  }

  const slider = new NSSlider();
  slider.value = value;
  slider.minValue = min;
  slider.maxValue = max;
  slider.isEnabled = !disabled;
  slider.className = 'clef-slider-track';
  slider.accessibilityRole = 'adjustable';
  slider.accessibilityValue = { now: value, min, max };

  slider.on('valueChange', (args: any) => {
    const raw = args.object.value;
    const stepped = Math.round(raw / step) * step;
    onChange?.(stepped);
  });

  container.addChild(slider);
  return container;
}

export default createSlider;
