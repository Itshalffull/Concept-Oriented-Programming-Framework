// ============================================================
// Clef Surface NativeScript Widget — Rating
//
// Star-based rating input with configurable scale.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface RatingProps {
  value?: number;
  defaultValue?: number;
  max?: number;
  half?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  label?: string;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function createRating(props: RatingProps): StackLayout {
  const {
    value: valueProp, defaultValue = 0, max = 5,
    half = false, disabled = false, readOnly = false,
    label, onChange, size = 'md',
  } = props;

  let currentValue = valueProp ?? defaultValue;
  const container = new StackLayout();
  container.className = `clef-widget-rating clef-size-${size}`;

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    container.addChild(lbl);
  }

  const starsRow = new StackLayout();
  starsRow.orientation = 'horizontal';
  starsRow.accessibilityRole = 'adjustable';
  starsRow.accessibilityLabel = label || 'Rating';
  starsRow.accessibilityValue = { now: String(currentValue), min: '0', max: String(max) };

  for (let i = 1; i <= max; i++) {
    const star = new Label();
    star.text = i <= currentValue ? '\u2605' : '\u2606';
    star.fontSize = size === 'lg' ? 28 : size === 'sm' ? 16 : 22;
    star.marginRight = 2;

    if (!disabled && !readOnly) {
      star.on('tap', () => {
        currentValue = i;
        onChange?.(i);
      });
    }
    starsRow.addChild(star);
  }
  container.addChild(starsRow);

  return container;
}

export default createRating;
