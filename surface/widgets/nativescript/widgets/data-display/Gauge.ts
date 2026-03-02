// ============================================================
// Clef Surface NativeScript Widget — Gauge
//
// Circular or linear gauge indicator for displaying progress
// or metric values. Renders value arc/bar, label, and min/max
// bounds using NativeScript layout primitives.
// ============================================================

import { StackLayout, GridLayout, Label, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export type GaugeVariant = 'circular' | 'linear';

export interface GaugeSegment {
  threshold: number;
  color: string;
  label?: string;
}

// --------------- Props ---------------

export interface GaugeProps {
  value?: number;
  min?: number;
  max?: number;
  variant?: GaugeVariant;
  label?: string;
  unit?: string;
  size?: number;
  trackColor?: string;
  fillColor?: string;
  segments?: GaugeSegment[];
  showValue?: boolean;
  showMinMax?: boolean;
  thickness?: number;
}

// --------------- Helpers ---------------

function getSegmentColor(value: number, segments: GaugeSegment[], fallback: string): string {
  if (segments.length === 0) return fallback;
  const sorted = [...segments].sort((a, b) => a.threshold - b.threshold);
  let color = fallback;
  for (const seg of sorted) {
    if (value >= seg.threshold) {
      color = seg.color;
    }
  }
  return color;
}

// --------------- Component ---------------

export function createGauge(props: GaugeProps = {}): StackLayout {
  const {
    value = 0,
    min = 0,
    max = 100,
    variant = 'circular',
    label,
    unit = '',
    size = 120,
    trackColor = '#E0E0E0',
    fillColor = '#1976D2',
    segments = [],
    showValue = true,
    showMinMax = true,
    thickness = 8,
  } = props;

  const container = new StackLayout();
  container.className = `clef-gauge clef-gauge-${variant}`;
  container.horizontalAlignment = 'center';
  container.padding = 8;

  const clampedValue = Math.max(min, Math.min(max, value));
  const percentage = ((clampedValue - min) / (max - min)) * 100;
  const activeColor = getSegmentColor(clampedValue, segments, fillColor);

  if (variant === 'circular') {
    // --- Circular Gauge ---
    const circleContainer = new GridLayout();
    circleContainer.className = 'clef-gauge-circle';
    circleContainer.width = size;
    circleContainer.height = size;
    circleContainer.horizontalAlignment = 'center';

    // Track (full circle background)
    const track = new ContentView();
    track.width = size;
    track.height = size;
    track.borderRadius = size / 2;
    track.borderWidth = thickness;
    track.borderColor = trackColor;
    track.backgroundColor = 'transparent' as any;
    circleContainer.addChild(track);

    // Fill arc represented as an overlay indicator
    const arcIndicator = new ContentView();
    const arcSize = size - thickness * 2;
    arcIndicator.width = arcSize;
    arcIndicator.height = arcSize;
    arcIndicator.borderRadius = arcSize / 2;
    arcIndicator.borderWidth = thickness;
    arcIndicator.borderColor = activeColor;
    arcIndicator.backgroundColor = 'transparent' as any;
    arcIndicator.opacity = percentage / 100;
    arcIndicator.horizontalAlignment = 'center';
    arcIndicator.verticalAlignment = 'middle';
    circleContainer.addChild(arcIndicator);

    // Center value
    if (showValue) {
      const valueStack = new StackLayout();
      valueStack.horizontalAlignment = 'center';
      valueStack.verticalAlignment = 'middle';

      const valueLabel = new Label();
      valueLabel.text = `${Math.round(clampedValue)}${unit}`;
      valueLabel.className = 'clef-gauge-value';
      valueLabel.fontWeight = 'bold';
      valueLabel.fontSize = size * 0.18;
      valueLabel.color = new Color(activeColor);
      valueLabel.horizontalAlignment = 'center';
      valueStack.addChild(valueLabel);

      const percentLabel = new Label();
      percentLabel.text = `${Math.round(percentage)}%`;
      percentLabel.fontSize = size * 0.1;
      percentLabel.opacity = 0.6;
      percentLabel.horizontalAlignment = 'center';
      valueStack.addChild(percentLabel);

      circleContainer.addChild(valueStack);
    }

    container.addChild(circleContainer);

  } else {
    // --- Linear Gauge ---
    const linearContainer = new StackLayout();
    linearContainer.className = 'clef-gauge-linear';
    linearContainer.width = size;
    linearContainer.horizontalAlignment = 'center';

    if (showValue) {
      const valueRow = new GridLayout();
      valueRow.columns = '*, auto';
      valueRow.marginBottom = 4;

      if (label) {
        const labelText = new Label();
        labelText.text = label;
        labelText.fontSize = 13;
        labelText.verticalAlignment = 'middle';
        GridLayout.setColumn(labelText, 0);
        valueRow.addChild(labelText);
      }

      const valueLabel = new Label();
      valueLabel.text = `${Math.round(clampedValue)}${unit}`;
      valueLabel.fontWeight = 'bold';
      valueLabel.fontSize = 14;
      valueLabel.color = new Color(activeColor);
      valueLabel.horizontalAlignment = 'right';
      valueLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(valueLabel, 1);
      valueRow.addChild(valueLabel);

      linearContainer.addChild(valueRow);
    }

    // Track bar
    const trackBar = new StackLayout();
    trackBar.height = thickness;
    trackBar.borderRadius = thickness / 2;
    trackBar.backgroundColor = trackColor as any;

    // Fill bar
    const fillBar = new ContentView();
    fillBar.height = thickness;
    fillBar.borderRadius = thickness / 2;
    fillBar.backgroundColor = activeColor as any;
    fillBar.width = (percentage / 100) * size;
    fillBar.horizontalAlignment = 'left';
    trackBar.addChild(fillBar);

    linearContainer.addChild(trackBar);

    // Min/Max labels
    if (showMinMax) {
      const boundsRow = new GridLayout();
      boundsRow.columns = '*, *';
      boundsRow.marginTop = 2;

      const minLabel = new Label();
      minLabel.text = `${min}`;
      minLabel.fontSize = 10;
      minLabel.opacity = 0.5;
      minLabel.horizontalAlignment = 'left';
      GridLayout.setColumn(minLabel, 0);
      boundsRow.addChild(minLabel);

      const maxLabel = new Label();
      maxLabel.text = `${max}`;
      maxLabel.fontSize = 10;
      maxLabel.opacity = 0.5;
      maxLabel.horizontalAlignment = 'right';
      GridLayout.setColumn(maxLabel, 1);
      boundsRow.addChild(maxLabel);

      linearContainer.addChild(boundsRow);
    }

    container.addChild(linearContainer);
  }

  // --- Label (below circular) ---
  if (label && variant === 'circular') {
    const gaugeLabel = new Label();
    gaugeLabel.text = label;
    gaugeLabel.className = 'clef-gauge-label';
    gaugeLabel.fontSize = 13;
    gaugeLabel.horizontalAlignment = 'center';
    gaugeLabel.marginTop = 8;
    container.addChild(gaugeLabel);
  }

  // --- Segment legend ---
  if (segments.length > 0) {
    const legend = new GridLayout();
    legend.className = 'clef-gauge-legend';
    const segCols = segments.map(() => 'auto').join(', ');
    legend.columns = segCols;
    legend.marginTop = 8;
    legend.horizontalAlignment = 'center';

    segments.forEach((seg, i) => {
      const segRow = new GridLayout();
      segRow.columns = 'auto, auto';
      segRow.margin = '0 6';

      const dot = new ContentView();
      dot.width = 8;
      dot.height = 8;
      dot.borderRadius = 4;
      dot.backgroundColor = seg.color as any;
      dot.verticalAlignment = 'middle';
      GridLayout.setColumn(dot, 0);
      segRow.addChild(dot);

      const segLabel = new Label();
      segLabel.text = ` ${seg.label || `${seg.threshold}+`}`;
      segLabel.fontSize = 10;
      segLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(segLabel, 1);
      segRow.addChild(segLabel);

      GridLayout.setColumn(segRow, i);
      legend.addChild(segRow);
    });

    container.addChild(legend);
  }

  return container;
}

createGauge.displayName = 'Gauge';
export default createGauge;
