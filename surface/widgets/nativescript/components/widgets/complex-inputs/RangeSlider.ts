// ============================================================
// Clef Surface NativeScript Widget — RangeSlider
//
// Dual-thumb slider for selecting a value range.
// ============================================================

import { StackLayout, Label, Slider as NSSlider } from '@nativescript/core';

export interface RangeSliderProps {
  minValue?: number;
  maxValue?: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  onChange?: (range: { min: number; max: number }) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createRangeSlider(props: RangeSliderProps): StackLayout {
  const {
    minValue: minVal = 0, maxValue: maxVal = 100,
    min = 0, max = 100, step = 1,
    label, disabled = false, onChange, size = 'md',
  } = props;

  let currentMin = minVal;
  let currentMax = maxVal;
  const container = new StackLayout();
  container.className = `clef-widget-range-slider clef-size-${size}`;

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  const minSlider = new NSSlider();
  minSlider.minValue = min;
  minSlider.maxValue = max;
  minSlider.value = currentMin;
  minSlider.isEnabled = !disabled;
  minSlider.accessibilityLabel = 'Minimum value';
  minSlider.on('valueChange', (args) => {
    currentMin = Math.round(args.object.value / step) * step;
    rangeLabel.text = `${currentMin} - ${currentMax}`;
    onChange?.({ min: currentMin, max: currentMax });
  });
  container.addChild(minSlider);

  const maxSlider = new NSSlider();
  maxSlider.minValue = min;
  maxSlider.maxValue = max;
  maxSlider.value = currentMax;
  maxSlider.isEnabled = !disabled;
  maxSlider.accessibilityLabel = 'Maximum value';
  maxSlider.on('valueChange', (args) => {
    currentMax = Math.round(args.object.value / step) * step;
    rangeLabel.text = `${currentMin} - ${currentMax}`;
    onChange?.({ min: currentMin, max: currentMax });
  });
  container.addChild(maxSlider);

  const rangeLabel = new Label();
  rangeLabel.text = `${currentMin} - ${currentMax}`;
  rangeLabel.horizontalAlignment = 'center';
  rangeLabel.fontSize = 12;
  container.addChild(rangeLabel);

  return container;
}

export default createRangeSlider;
