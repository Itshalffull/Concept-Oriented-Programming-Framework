// ============================================================
// Clef Surface NativeScript Widget — Chart
//
// Data visualization chart with series and axis configuration.
// ============================================================

import { StackLayout, Label } from '@nativescript/core';

export interface ChartDataPoint { x: number | string; y: number; }
export interface ChartSeries { name: string; data: ChartDataPoint[]; color?: string; type?: string; }

export interface ChartProps {
  series: ChartSeries[];
  type?: 'line' | 'bar' | 'area' | 'pie' | 'scatter';
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  loading?: boolean;
  ariaLabel?: string;
}

export function createChart(props: ChartProps): StackLayout {
  const {
    series, type = 'line', title, xAxisLabel, yAxisLabel,
    showLegend = true, showGrid = true, height = 300,
    loading = false, ariaLabel = 'Chart',
  } = props;

  const container = new StackLayout();
  container.className = `clef-widget-chart clef-type-${type}`;
  container.height = height;
  container.accessibilityRole = 'image';
  container.accessibilityLabel = ariaLabel;

  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.fontWeight = 'bold';
    titleLabel.horizontalAlignment = 'center';
    container.addChild(titleLabel);
  }

  if (loading) {
    const loadingLabel = new Label();
    loadingLabel.text = 'Loading chart...';
    loadingLabel.horizontalAlignment = 'center';
    container.addChild(loadingLabel);
  } else {
    const placeholder = new Label();
    placeholder.text = `[${type} chart: ${series.length} series]`;
    placeholder.horizontalAlignment = 'center';
    placeholder.verticalAlignment = 'middle';
    container.addChild(placeholder);
  }

  if (showLegend && series.length > 0) {
    const legend = new StackLayout();
    legend.orientation = 'horizontal';
    legend.horizontalAlignment = 'center';
    for (const s of series) {
      const legendItem = new Label();
      legendItem.text = `\u25CF ${s.name}`;
      legendItem.marginRight = 12;
      legendItem.fontSize = 12;
      legend.addChild(legendItem);
    }
    container.addChild(legend);
  }
  return container;
}

export default createChart;
