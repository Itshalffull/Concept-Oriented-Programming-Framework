// ============================================================
// Clef Surface Ink Widget — Chart
//
// Data visualisation container rendering bar, line, and pie
// charts in the terminal. Terminal adaptation: ASCII bar charts
// using block characters, sparkline for line charts, and
// text-based percentage breakdown for pie charts.
// See widget spec: repertoire/widgets/data-display/chart.widget
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Types ---------------

export interface ChartDataPoint {
  label: string;
  value: number;
}

// --------------- Props ---------------

export interface ChartProps {
  /** Chart type to render. */
  type: 'bar' | 'line' | 'pie';
  /** Data points to display. */
  data: ChartDataPoint[];
  /** Maximum width for the chart area (in characters). */
  width?: number;
  /** Maximum height for the chart area (in rows). */
  height?: number;
  /** Optional title displayed above the chart. */
  title?: string;
}

// --------------- Bar Chart ---------------

const BLOCK_FULL = '\u2588';     // █
const BLOCK_LIGHT = '\u2591';    // ░

function renderBarChart(
  data: ChartDataPoint[],
  maxWidth: number,
): React.ReactNode {
  if (data.length === 0) return <Text dimColor>No data</Text>;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxLabelLen = Math.max(...data.map((d) => d.label.length), 1);
  const barSpace = Math.max(maxWidth - maxLabelLen - 10, 10);

  return (
    <Box flexDirection="column">
      {data.map((d, i) => {
        const filled = Math.round((d.value / maxValue) * barSpace);
        const empty = barSpace - filled;
        const label = d.label.padEnd(maxLabelLen, ' ');

        return (
          <Box key={`bar-${i}`}>
            <Text dimColor>{label} </Text>
            <Text color="cyan">
              {BLOCK_FULL.repeat(filled)}
            </Text>
            <Text dimColor>
              {BLOCK_LIGHT.repeat(empty)}
            </Text>
            <Text> {d.value}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// --------------- Line Chart (Sparkline) ---------------

const SPARK_CHARS = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

function renderLineChart(data: ChartDataPoint[]): React.ReactNode {
  if (data.length === 0) return <Text dimColor>No data</Text>;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const sparkline = values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    })
    .join('');

  return (
    <Box flexDirection="column">
      <Text color="cyan">{sparkline}</Text>
      <Box>
        {data.map((d, i) => (
          <Box key={`label-${i}`} width={Math.max(2, Math.ceil(d.label.length * 1.2))}>
            <Text dimColor>{d.label.charAt(0)}</Text>
          </Box>
        ))}
      </Box>
      <Box>
        <Text dimColor>min: {min}  max: {max}</Text>
      </Box>
    </Box>
  );
}

// --------------- Pie Chart (Text Percentages) ---------------

const PIE_COLORS: string[] = ['cyan', 'green', 'yellow', 'magenta', 'blue', 'red', 'white'];

function renderPieChart(data: ChartDataPoint[]): React.ReactNode {
  if (data.length === 0) return <Text dimColor>No data</Text>;

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <Box flexDirection="column">
      {data.map((d, i) => {
        const pct = ((d.value / total) * 100).toFixed(1);
        const barLen = Math.round((d.value / total) * 20);
        const color = PIE_COLORS[i % PIE_COLORS.length];

        return (
          <Box key={`pie-${i}`}>
            <Text color={color}>{BLOCK_FULL.repeat(barLen)}</Text>
            <Text> {d.label} ({pct}%)</Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>Total: {total}</Text>
      </Box>
    </Box>
  );
}

// --------------- Component ---------------

export const Chart: React.FC<ChartProps> = ({
  type,
  data,
  width = 40,
  height: _height,
  title,
}) => {
  let content: React.ReactNode;

  switch (type) {
    case 'bar':
      content = renderBarChart(data, width);
      break;
    case 'line':
      content = renderLineChart(data);
      break;
    case 'pie':
      content = renderPieChart(data);
      break;
    default:
      content = <Text dimColor>Unknown chart type: {type}</Text>;
  }

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}
      {content}
    </Box>
  );
};

Chart.displayName = 'Chart';
export default Chart;
