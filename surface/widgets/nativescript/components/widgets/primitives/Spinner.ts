// ============================================================
// Clef Surface NativeScript Widget — Spinner
//
// Loading spinner indicator with configurable size and label.
// Wraps NativeScript ActivityIndicator.
// ============================================================

import { StackLayout, Label, ActivityIndicator } from '@nativescript/core';

// --------------- Props ---------------

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  busy?: boolean;
}

const SIZE_MAP: Record<string, number> = { sm: 16, md: 24, lg: 40 };

// --------------- Component ---------------

export function createSpinner(props: SpinnerProps): StackLayout {
  const { size = 'md', label, busy = true } = props;

  const dim = SIZE_MAP[size] ?? 24;
  const container = new StackLayout();
  container.className = 'clef-widget-spinner';
  container.horizontalAlignment = 'center';
  container.verticalAlignment = 'middle';
  container.accessibilityRole = 'progressbar';
  container.accessibilityLabel = label ?? 'Loading';

  const indicator = new ActivityIndicator();
  indicator.busy = busy;
  indicator.width = dim;
  indicator.height = dim;
  container.addChild(indicator);

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.horizontalAlignment = 'center';
    lbl.marginTop = 4;
    container.addChild(lbl);
  }

  return container;
}

export default createSpinner;
