// ============================================================
// Clef Surface NativeScript Widget — ProgressBar
//
// Linear progress indicator showing a percentage-filled bar.
// Supports determinate and indeterminate modes, custom colors,
// and optional percentage label display.
// ============================================================

import { StackLayout, GridLayout, Label, Color } from '@nativescript/core';

// --------------- Props ---------------

export interface ProgressBarProps {
  value?: number;
  maxValue?: number;
  indeterminate?: boolean;
  label?: string;
  showPercent?: boolean;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  borderRadius?: number;
}

// --------------- Component ---------------

export function createProgressBar(props: ProgressBarProps = {}): StackLayout {
  const {
    value = 0,
    maxValue = 100,
    indeterminate = false,
    label,
    showPercent = true,
    height = 8,
    trackColor = '#e5e7eb',
    fillColor = '#2196F3',
    borderRadius = 4,
  } = props;

  const percent = maxValue > 0 ? Math.max(0, Math.min(100, (value / maxValue) * 100)) : 0;

  const container = new StackLayout();
  container.className = 'clef-progress-bar';

  // Label row
  if (label || showPercent) {
    const labelRow = new GridLayout();
    labelRow.columns = '*, auto';
    labelRow.marginBottom = 4;

    if (label) {
      const textLabel = new Label();
      textLabel.col = 0;
      textLabel.text = label;
      textLabel.className = 'clef-progress-bar-label';
      textLabel.fontSize = 13;
      labelRow.addChild(textLabel);
    }

    if (showPercent && !indeterminate) {
      const percentLabel = new Label();
      percentLabel.col = 1;
      percentLabel.text = `${Math.round(percent)}%`;
      percentLabel.className = 'clef-progress-bar-percent';
      percentLabel.fontSize = 12;
      percentLabel.opacity = 0.7;
      labelRow.addChild(percentLabel);
    }

    container.addChild(labelRow);
  }

  // Track
  const track = new StackLayout();
  track.className = 'clef-progress-bar-track';
  track.height = height;
  track.backgroundColor = new Color(trackColor);
  track.borderRadius = borderRadius;

  // Fill
  const fill = new StackLayout();
  fill.className = 'clef-progress-bar-fill';
  fill.height = height;
  fill.backgroundColor = new Color(fillColor);
  fill.borderRadius = borderRadius;
  fill.horizontalAlignment = 'left';

  if (indeterminate) {
    fill.width = '30%' as any;
    fill.opacity = 0.7;
  } else {
    fill.width = `${percent}%` as any;
  }

  track.addChild(fill);
  container.addChild(track);

  return container;
}

createProgressBar.displayName = 'ProgressBar';
export default createProgressBar;
