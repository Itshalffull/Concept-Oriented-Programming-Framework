// ============================================================
// Clef Surface NativeScript Widget — RangeSlider
//
// Dual-thumb range slider for selecting a value range within
// a min/max bound. Displays two sliders (low/high), numeric
// labels for the current range, tick marks at configurable
// step intervals, and an optional histogram overlay.
//
// Adapts the range-slider.widget spec: anatomy (root, track,
// thumbLow, thumbHigh, label, tickMark), states (idle,
// dragging, disabled), and connect attributes to NativeScript
// Slider controls and layout containers.
// ============================================================

import {
  StackLayout,
  GridLayout,
  Label,
  Slider,
  ContentView,
} from '@nativescript/core';

// --------------- Props ---------------

export interface RangeSliderProps {
  min?: number;
  max?: number;
  lowValue?: number;
  highValue?: number;
  step?: number;
  showLabels?: boolean;
  showTicks?: boolean;
  unit?: string;
  enabled?: boolean;
  onRangeChange?: (low: number, high: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a NativeScript range slider with two thumb controls,
 * value labels, tick mark display, and a visual range bar
 * between the low and high values.
 */
export function createRangeSlider(props: RangeSliderProps = {}): StackLayout {
  const {
    min = 0,
    max = 100,
    lowValue: initLow = 25,
    highValue: initHigh = 75,
    step = 1,
    showLabels = true,
    showTicks = true,
    unit = '',
    enabled = true,
    onRangeChange,
  } = props;

  let low = Math.max(min, initLow);
  let high = Math.min(max, initHigh);

  const container = new StackLayout();
  container.className = 'clef-widget-range-slider';
  container.padding = 8;

  // -- Range value display --
  const valueRow = new GridLayout();
  valueRow.columns = 'auto, *, auto';
  valueRow.rows = 'auto';
  valueRow.marginBottom = 8;

  const lowLabel = new Label();
  lowLabel.fontSize = 16;
  lowLabel.fontWeight = 'bold';
  lowLabel.col = 0;

  const rangeLabel = new Label();
  rangeLabel.fontSize = 12;
  rangeLabel.horizontalAlignment = 'center';
  rangeLabel.verticalAlignment = 'middle';
  rangeLabel.opacity = 0.6;
  rangeLabel.col = 1;

  const highLabel = new Label();
  highLabel.fontSize = 16;
  highLabel.fontWeight = 'bold';
  highLabel.horizontalAlignment = 'right';
  highLabel.col = 2;

  function updateLabels(): void {
    const fmt = (v: number) => unit ? `${v}${unit}` : String(v);
    lowLabel.text = fmt(low);
    highLabel.text = fmt(high);
    rangeLabel.text = `Range: ${fmt(high - low)}`;
  }

  valueRow.addChild(lowLabel);
  valueRow.addChild(rangeLabel);
  valueRow.addChild(highLabel);

  if (showLabels) {
    container.addChild(valueRow);
  }

  // -- Visual range bar --
  const trackContainer = new GridLayout();
  trackContainer.columns = '*';
  trackContainer.rows = 'auto';
  trackContainer.height = 8;
  trackContainer.borderRadius = 4;
  trackContainer.backgroundColor = '#E0E0E0' as any;
  trackContainer.marginBottom = 4;

  const rangeFill = new ContentView();
  rangeFill.height = 8;
  rangeFill.borderRadius = 4;
  rangeFill.backgroundColor = '#2196F3' as any;

  function updateRangeBar(): void {
    const totalRange = max - min;
    if (totalRange <= 0) return;
    const leftPct = ((low - min) / totalRange) * 100;
    const widthPct = ((high - low) / totalRange) * 100;
    rangeFill.marginLeft = leftPct;
    rangeFill.width = widthPct;
  }

  trackContainer.addChild(rangeFill);
  container.addChild(trackContainer);

  // -- Low value slider --
  const lowSliderLabel = new Label();
  lowSliderLabel.text = 'Low';
  lowSliderLabel.fontSize = 11;
  lowSliderLabel.opacity = 0.6;
  container.addChild(lowSliderLabel);

  const lowSlider = new Slider();
  lowSlider.minValue = min;
  lowSlider.maxValue = max;
  lowSlider.value = low;
  lowSlider.isEnabled = enabled;
  lowSlider.marginBottom = 8;

  lowSlider.on('valueChange', () => {
    let newLow = Math.round(lowSlider.value / step) * step;
    if (newLow >= high) newLow = high - step;
    if (newLow < min) newLow = min;
    low = newLow;
    lowSlider.value = low;
    updateLabels();
    updateRangeBar();
    if (onRangeChange) onRangeChange(low, high);
  });

  container.addChild(lowSlider);

  // -- High value slider --
  const highSliderLabel = new Label();
  highSliderLabel.text = 'High';
  highSliderLabel.fontSize = 11;
  highSliderLabel.opacity = 0.6;
  container.addChild(highSliderLabel);

  const highSlider = new Slider();
  highSlider.minValue = min;
  highSlider.maxValue = max;
  highSlider.value = high;
  highSlider.isEnabled = enabled;
  highSlider.marginBottom = 8;

  highSlider.on('valueChange', () => {
    let newHigh = Math.round(highSlider.value / step) * step;
    if (newHigh <= low) newHigh = low + step;
    if (newHigh > max) newHigh = max;
    high = newHigh;
    highSlider.value = high;
    updateLabels();
    updateRangeBar();
    if (onRangeChange) onRangeChange(low, high);
  });

  container.addChild(highSlider);

  // -- Tick marks --
  if (showTicks) {
    const tickRow = new GridLayout();
    const tickCount = Math.floor((max - min) / step);
    const displayedTicks = Math.min(tickCount + 1, 11);
    const tickStep = (max - min) / (displayedTicks - 1);

    tickRow.columns = Array(displayedTicks).fill('*').join(', ');
    tickRow.rows = 'auto';
    tickRow.marginBottom = 4;

    for (let i = 0; i < displayedTicks; i++) {
      const tickVal = Math.round(min + i * tickStep);
      const tick = new Label();
      tick.text = String(tickVal);
      tick.fontSize = 9;
      tick.opacity = 0.5;
      tick.horizontalAlignment = 'center';
      tick.col = i;
      tickRow.addChild(tick);
    }

    container.addChild(tickRow);
  }

  // -- Min/Max labels --
  const boundsRow = new GridLayout();
  boundsRow.columns = '*, *';
  boundsRow.rows = 'auto';

  const minLabel = new Label();
  minLabel.text = `Min: ${min}${unit}`;
  minLabel.fontSize = 10;
  minLabel.opacity = 0.4;
  minLabel.col = 0;
  boundsRow.addChild(minLabel);

  const maxLabel = new Label();
  maxLabel.text = `Max: ${max}${unit}`;
  maxLabel.fontSize = 10;
  maxLabel.opacity = 0.4;
  maxLabel.horizontalAlignment = 'right';
  maxLabel.col = 1;
  boundsRow.addChild(maxLabel);

  container.addChild(boundsRow);

  updateLabels();
  updateRangeBar();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createRangeSlider.displayName = 'RangeSlider';
export default createRangeSlider;
