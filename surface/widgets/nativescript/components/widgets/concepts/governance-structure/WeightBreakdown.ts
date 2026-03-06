import { StackLayout, Label, GridLayout, FlexboxLayout } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * WeightBreakdown state machine
 * States: idle (initial), segmentHovered
 * ------------------------------------------------------------------------- */

export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent =
  | { type: 'HOVER_SEGMENT'; source: string }
  | { type: 'LEAVE' };

export function weightBreakdownReducer(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type WeightSourceType = 'token' | 'delegation' | 'reputation' | 'manual';

export interface WeightSource {
  label: string;
  weight: number;
  type: WeightSourceType;
}

const SOURCE_COLORS: Record<WeightSourceType, string> = {
  token: '#3b82f6',
  delegation: '#8b5cf6',
  reputation: '#10b981',
  manual: '#f59e0b',
};

function formatWeight(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function prepareSegments(sources: WeightSource[], totalWeight: number) {
  const sorted = [...sources].sort((a, b) => b.weight - a.weight);
  return sorted.map((source) => ({
    ...source,
    percent: totalWeight > 0 ? (source.weight / totalWeight) * 100 : 0,
  }));
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface WeightBreakdownProps {
  sources: WeightSource[];
  totalWeight: number;
  participant: string;
  variant?: 'bar' | 'donut';
  showLegend?: boolean;
  showTotal?: boolean;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createWeightBreakdown(props: WeightBreakdownProps): { view: StackLayout; dispose: () => void } {
  const {
    sources,
    totalWeight,
    participant,
    showLegend = true,
    showTotal = true,
  } = props;

  let state: WeightBreakdownState = 'idle';
  const disposers: (() => void)[] = [];

  function send(event: WeightBreakdownEvent) {
    state = weightBreakdownReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'weight-breakdown';
  root.automationText = `Weight breakdown for ${participant}: ${formatWeight(totalWeight)} total`;

  const segments = prepareSegments(sources, totalWeight);

  // Total weight display
  const totalLabel = new Label();
  totalLabel.className = 'weight-breakdown-total';
  totalLabel.text = formatWeight(totalWeight);
  totalLabel.automationText = `Total weight: ${formatWeight(totalWeight)}`;
  if (showTotal) {
    root.addChild(totalLabel);
  }

  // Bar chart area
  const chartRow = new FlexboxLayout();
  chartRow.className = 'weight-breakdown-chart';
  chartRow.flexDirection = 'row' as any;
  chartRow.height = 24;

  const segmentViews: { view: StackLayout; seg: ReturnType<typeof prepareSegments>[0] }[] = [];

  for (const seg of segments) {
    const segView = new StackLayout();
    segView.className = 'weight-breakdown-segment';
    segView.backgroundColor = SOURCE_COLORS[seg.type] as any;
    segView.width = { value: seg.percent, unit: '%' } as any;
    segView.height = 24;
    segView.automationText = `${seg.label}: ${formatWeight(seg.weight)} (${formatWeight(seg.percent)}%)`;

    const tapHandler = () => {
      send({ type: 'HOVER_SEGMENT', source: seg.label });
    };
    segView.on('tap', tapHandler);
    disposers.push(() => segView.off('tap', tapHandler));

    chartRow.addChild(segView);
    segmentViews.push({ view: segView, seg });
  }

  root.addChild(chartRow);

  // Legend
  const legendContainer = new StackLayout();
  legendContainer.className = 'weight-breakdown-legend';

  if (showLegend) {
    for (const seg of segments) {
      const legendItem = new FlexboxLayout();
      legendItem.className = 'weight-breakdown-legend-item';
      legendItem.flexDirection = 'row' as any;
      legendItem.alignItems = 'center' as any;
      legendItem.automationText = `${seg.label}: ${formatWeight(seg.percent)}%`;

      const swatch = new Label();
      swatch.className = 'weight-breakdown-legend-swatch';
      swatch.width = 12;
      swatch.height = 12;
      swatch.backgroundColor = SOURCE_COLORS[seg.type] as any;
      swatch.text = '';
      legendItem.addChild(swatch);

      const labelView = new Label();
      labelView.className = 'weight-breakdown-legend-label';
      labelView.text = `${seg.label} ${formatWeight(seg.percent)}% (${formatWeight(seg.weight)})`;
      legendItem.addChild(labelView);

      legendContainer.addChild(legendItem);
    }
    root.addChild(legendContainer);
  }

  // Tooltip area
  const tooltipLabel = new Label();
  tooltipLabel.className = 'weight-breakdown-tooltip';
  tooltipLabel.visibility = 'collapse' as any;
  root.addChild(tooltipLabel);

  function update() {
    if (state === 'segmentHovered') {
      tooltipLabel.visibility = 'visible' as any;
      const hoveredSeg = segments.find((s) => s.label === (lastHoveredSource ?? ''));
      if (hoveredSeg) {
        tooltipLabel.text = `${hoveredSeg.label} (${hoveredSeg.type}): ${formatWeight(hoveredSeg.weight)} - ${formatWeight(hoveredSeg.percent)}%`;
      }
    } else {
      tooltipLabel.visibility = 'collapse' as any;
    }
  }

  let lastHoveredSource: string | null = null;
  const originalSend = send;
  const wrappedSend = (event: WeightBreakdownEvent) => {
    if (event.type === 'HOVER_SEGMENT') {
      lastHoveredSource = event.source;
    } else if (event.type === 'LEAVE') {
      lastHoveredSource = null;
    }
    originalSend(event);
  };

  // Re-wire segment taps to use wrappedSend
  for (const { view: segView, seg } of segmentViews) {
    segView.off('tap');
    const tapHandler = () => {
      wrappedSend({ type: 'HOVER_SEGMENT', source: seg.label });
    };
    segView.on('tap', tapHandler);
  }

  // Add a tap on root to deselect
  const rootTapHandler = () => {
    wrappedSend({ type: 'LEAVE' });
  };
  root.on('tap', rootTapHandler);
  disposers.push(() => root.off('tap', rootTapHandler));

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createWeightBreakdown;
