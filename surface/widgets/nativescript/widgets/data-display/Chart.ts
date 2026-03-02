// ============================================================
// Clef Surface NativeScript Widget — Chart
//
// Data visualization placeholder supporting bar, line, and pie
// chart types. Renders chart frames with labeled axes, data
// bars, and legends using NativeScript primitives.
// ============================================================

import { StackLayout, GridLayout, Label, ContentView, Color } from '@nativescript/core';

// --------------- Types ---------------

export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

// --------------- Props ---------------

export interface ChartProps {
  type?: ChartType;
  data?: ChartDataPoint[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  showValues?: boolean;
  axisColor?: string;
  defaultColors?: string[];
}

// --------------- Defaults ---------------

const DEFAULT_COLORS = [
  '#1976D2', '#388E3C', '#F57C00', '#D32F2F',
  '#7B1FA2', '#0097A7', '#FBC02D', '#455A64',
];

// --------------- Component ---------------

export function createChart(props: ChartProps = {}): StackLayout {
  const {
    type = 'bar',
    data = [],
    title,
    height = 200,
    showLegend = true,
    showValues = true,
    axisColor = '#E0E0E0',
    defaultColors = DEFAULT_COLORS,
  } = props;

  const container = new StackLayout();
  container.className = `clef-chart clef-chart-${type}`;
  container.padding = 12;

  // --- Title ---
  if (title) {
    const titleLabel = new Label();
    titleLabel.text = title;
    titleLabel.className = 'clef-chart-title';
    titleLabel.fontWeight = 'bold';
    titleLabel.fontSize = 16;
    titleLabel.marginBottom = 12;
    container.addChild(titleLabel);
  }

  if (data.length === 0) {
    const emptyLabel = new Label();
    emptyLabel.text = 'No data available';
    emptyLabel.opacity = 0.5;
    emptyLabel.horizontalAlignment = 'center';
    emptyLabel.height = height;
    emptyLabel.verticalAlignment = 'middle';
    container.addChild(emptyLabel);
    return container;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (type === 'bar') {
    // --- Bar Chart ---
    const chartArea = new GridLayout();
    chartArea.className = 'clef-chart-bar-area';
    chartArea.height = height;
    const colDefs = data.map(() => '*').join(', ');
    chartArea.columns = colDefs;
    chartArea.rows = '*, auto';
    chartArea.borderBottomWidth = 2;
    chartArea.borderBottomColor = axisColor;

    data.forEach((point, i) => {
      const barColor = point.color || defaultColors[i % defaultColors.length];
      const barHeight = Math.round((point.value / maxValue) * (height - 30));

      const barColumn = new StackLayout();
      barColumn.verticalAlignment = 'bottom';
      barColumn.horizontalAlignment = 'center';
      barColumn.padding = '0 4';

      if (showValues) {
        const valueLabel = new Label();
        valueLabel.text = `${point.value}`;
        valueLabel.fontSize = 10;
        valueLabel.horizontalAlignment = 'center';
        valueLabel.marginBottom = 2;
        barColumn.addChild(valueLabel);
      }

      const bar = new ContentView();
      bar.height = barHeight;
      bar.width = 32;
      bar.borderRadius = 4;
      bar.backgroundColor = barColor as any;
      barColumn.addChild(bar);

      GridLayout.setColumn(barColumn, i);
      GridLayout.setRow(barColumn, 0);
      chartArea.addChild(barColumn);

      const axisLabel = new Label();
      axisLabel.text = point.label;
      axisLabel.fontSize = 10;
      axisLabel.horizontalAlignment = 'center';
      axisLabel.marginTop = 4;
      GridLayout.setColumn(axisLabel, i);
      GridLayout.setRow(axisLabel, 1);
      chartArea.addChild(axisLabel);
    });

    container.addChild(chartArea);
  } else if (type === 'line') {
    // --- Line Chart (placeholder with data points) ---
    const chartArea = new GridLayout();
    chartArea.className = 'clef-chart-line-area';
    chartArea.height = height;
    const colDefs = data.map(() => '*').join(', ');
    chartArea.columns = colDefs;
    chartArea.rows = '*, auto';
    chartArea.borderBottomWidth = 2;
    chartArea.borderBottomColor = axisColor;

    data.forEach((point, i) => {
      const dotColor = point.color || defaultColors[0];
      const dotY = Math.round((1 - point.value / maxValue) * (height - 40));

      const dotColumn = new StackLayout();
      dotColumn.verticalAlignment = 'top';
      dotColumn.horizontalAlignment = 'center';
      dotColumn.marginTop = dotY;

      if (showValues) {
        const valueLabel = new Label();
        valueLabel.text = `${point.value}`;
        valueLabel.fontSize = 10;
        valueLabel.horizontalAlignment = 'center';
        valueLabel.marginBottom = 2;
        dotColumn.addChild(valueLabel);
      }

      const dot = new ContentView();
      dot.width = 10;
      dot.height = 10;
      dot.borderRadius = 5;
      dot.backgroundColor = dotColor as any;
      dotColumn.addChild(dot);

      GridLayout.setColumn(dotColumn, i);
      GridLayout.setRow(dotColumn, 0);
      chartArea.addChild(dotColumn);

      const axisLabel = new Label();
      axisLabel.text = point.label;
      axisLabel.fontSize = 10;
      axisLabel.horizontalAlignment = 'center';
      axisLabel.marginTop = 4;
      GridLayout.setColumn(axisLabel, i);
      GridLayout.setRow(axisLabel, 1);
      chartArea.addChild(axisLabel);
    });

    container.addChild(chartArea);
  } else if (type === 'pie') {
    // --- Pie Chart (legend-based placeholder) ---
    const pieArea = new StackLayout();
    pieArea.className = 'clef-chart-pie-area';
    pieArea.horizontalAlignment = 'center';
    pieArea.height = height;

    const total = data.reduce((sum, d) => sum + d.value, 0);

    const piePlaceholder = new ContentView();
    piePlaceholder.width = height * 0.6;
    piePlaceholder.height = height * 0.6;
    piePlaceholder.borderRadius = (height * 0.6) / 2;
    piePlaceholder.backgroundColor = (data[0]?.color || defaultColors[0]) as any;
    piePlaceholder.borderWidth = 3;
    piePlaceholder.borderColor = '#FFFFFF';
    piePlaceholder.horizontalAlignment = 'center';
    pieArea.addChild(piePlaceholder);

    const pieLabel = new Label();
    pieLabel.text = `Total: ${total}`;
    pieLabel.fontSize = 12;
    pieLabel.fontWeight = 'bold';
    pieLabel.horizontalAlignment = 'center';
    pieLabel.marginTop = 8;
    pieArea.addChild(pieLabel);

    container.addChild(pieArea);
  }

  // --- Legend ---
  if (showLegend) {
    const legend = new StackLayout();
    legend.className = 'clef-chart-legend';
    legend.marginTop = 12;

    data.forEach((point, i) => {
      const legendRow = new GridLayout();
      legendRow.columns = 'auto, *';
      legendRow.marginBottom = 4;

      const swatch = new ContentView();
      swatch.width = 12;
      swatch.height = 12;
      swatch.borderRadius = 2;
      swatch.backgroundColor = (point.color || defaultColors[i % defaultColors.length]) as any;
      swatch.verticalAlignment = 'middle';
      GridLayout.setColumn(swatch, 0);
      legendRow.addChild(swatch);

      const legendLabel = new Label();
      legendLabel.text = `  ${point.label}: ${point.value}`;
      legendLabel.fontSize = 12;
      legendLabel.verticalAlignment = 'middle';
      GridLayout.setColumn(legendLabel, 1);
      legendRow.addChild(legendLabel);

      legend.addChild(legendRow);
    });

    container.addChild(legend);
  }

  return container;
}

createChart.displayName = 'Chart';
export default createChart;
