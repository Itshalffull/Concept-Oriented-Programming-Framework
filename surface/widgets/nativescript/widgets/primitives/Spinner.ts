// ============================================================
// Clef Surface NativeScript Widget — Spinner
//
// NativeScript loading spinner using the native
// ActivityIndicator. Supports configurable size, color,
// and optional label text.
// ============================================================

import { StackLayout, ActivityIndicator, Label as NsLabel, Color } from '@nativescript/core';

// --------------- Props ---------------

export type SpinnerSize = 'small' | 'medium' | 'large';

const SIZE_MAP: Record<SpinnerSize, number> = {
  small: 20,
  medium: 36,
  large: 56,
};

export interface SpinnerProps {
  busy?: boolean;
  size?: SpinnerSize;
  color?: string;
  label?: string;
}

// --------------- Component ---------------

export function createSpinner(props: SpinnerProps = {}): StackLayout {
  const {
    busy = true,
    size = 'medium',
    color = '#6200EE',
    label,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-spinner';
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';

  const indicator = new ActivityIndicator();
  indicator.busy = busy;
  indicator.width = SIZE_MAP[size];
  indicator.height = SIZE_MAP[size];
  indicator.color = new Color(color);
  indicator.horizontalAlignment = 'center';
  indicator.className = 'clef-spinner__indicator';
  container.addChild(indicator);

  if (label) {
    const labelView = new NsLabel();
    labelView.text = label;
    labelView.fontSize = 12;
    labelView.color = new Color('#757575');
    labelView.textAlignment = 'center';
    labelView.horizontalAlignment = 'center';
    labelView.marginTop = 8;
    labelView.className = 'clef-spinner__label';
    container.addChild(labelView);
  }

  // Expose start/stop helpers
  const start = () => { indicator.busy = true; };
  const stop = () => { indicator.busy = false; };

  (container as any).__clefSpinner = { start, stop, indicator };

  return container;
}

createSpinner.displayName = 'Spinner';
export default createSpinner;
