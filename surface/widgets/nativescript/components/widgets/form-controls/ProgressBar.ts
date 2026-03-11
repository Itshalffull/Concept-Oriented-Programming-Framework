// ============================================================
// Clef Surface NativeScript Widget — ProgressBar
//
// Determinate or indeterminate progress indicator with label
// and percentage display.
// ============================================================

import { StackLayout, Label, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  indeterminate?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

const VARIANT_COLORS: Record<string, string> = {
  default: '#3b82f6',
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
};

// --------------- Component ---------------

export function createProgressBar(props: ProgressBarProps): StackLayout {
  const {
    value = 0,
    max = 100,
    label,
    showPercent = false,
    indeterminate = false,
    variant = 'default',
  } = props;

  const pct = Math.min(100, Math.round((value / max) * 100));

  const container = new StackLayout();
  container.className = `clef-widget-progress-bar clef-variant-${variant}`;
  container.accessibilityRole = 'progressbar';
  container.accessibilityValue = { now: value, min: 0, max };

  if (label) {
    const headerRow = new StackLayout();
    headerRow.orientation = 'horizontal';
    headerRow.marginBottom = 4;

    const lbl = new Label();
    lbl.text = label;
    headerRow.addChild(lbl);

    if (showPercent && !indeterminate) {
      const pctLabel = new Label();
      pctLabel.text = `${pct}%`;
      pctLabel.horizontalAlignment = 'right';
      headerRow.addChild(pctLabel);
    }

    container.addChild(headerRow);
  }

  const track = new StackLayout();
  track.height = 8;
  track.borderRadius = 4;
  track.backgroundColor = new Color('#e5e7eb');
  track.className = 'clef-progress-track';

  const fill = new StackLayout();
  fill.height = 8;
  fill.borderRadius = 4;
  fill.backgroundColor = new Color(VARIANT_COLORS[variant] ?? VARIANT_COLORS.default);
  fill.width = indeterminate ? '50%' : `${pct}%`;
  fill.className = 'clef-progress-fill';

  track.addChild(fill);
  container.addChild(track);

  return container;
}

export default createProgressBar;
