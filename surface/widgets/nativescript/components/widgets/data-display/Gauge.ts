// ============================================================
// Clef Surface NativeScript Widget — Gauge
//
// Circular or linear gauge with value and threshold display.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface GaugeThresholds { warning?: number; critical?: number; }

export interface GaugeProps {
  value?: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  thresholds?: GaugeThresholds;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function createGauge(props: GaugeProps): StackLayout {
  const {
    value = 0, min = 0, max = 100, label = '',
    unit = '', thresholds, showValue = true, size = 'md',
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-gauge clef-size-${size}`;
  container.horizontalAlignment = 'center';
  container.accessibilityRole = 'progressbar';
  container.accessibilityValue = { now: String(value), min: String(min), max: String(max) };

  if (label) {
    const lbl = new Label();
    lbl.text = label;
    lbl.horizontalAlignment = 'center';
    container.addChild(lbl);
  }

  if (showValue) {
    const valueLabel = new Label();
    valueLabel.text = `${value}${unit}`;
    valueLabel.fontSize = 24;
    valueLabel.fontWeight = 'bold';
    valueLabel.horizontalAlignment = 'center';
    container.addChild(valueLabel);
  }

  const percent = Math.round(((value - min) / (max - min)) * 100);
  const percentLabel = new Label();
  percentLabel.text = `${percent}%`;
  percentLabel.horizontalAlignment = 'center';
  percentLabel.opacity = 0.6;
  container.addChild(percentLabel);

  return container;
}

export default createGauge;
