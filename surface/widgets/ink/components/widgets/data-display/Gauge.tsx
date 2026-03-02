// ============================================================
// Clef Surface Ink Widget — Gauge
//
// Circular or arc-shaped progress indicator displaying a numeric
// score against a defined range. Terminal adaptation: horizontal
// bar gauge with filled/empty block characters and percentage,
// approximating an arc display as [████░░░░] 75%.
// See widget spec: repertoire/widgets/data-display/gauge.widget
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface GaugeProps {
  /** Current value (0-100 by default). */
  value: number;
  /** Minimum value. */
  min?: number;
  /** Maximum value. */
  max?: number;
  /** Size controlling bar width. */
  size?: 'sm' | 'md' | 'lg';
  /** Descriptive label for the gauge. */
  label?: string;
  /** Whether to show the numeric value. */
  showValue?: boolean;
  /** Color for the filled portion. */
  color?: string;
}

// --------------- Helpers ---------------

const SIZE_WIDTHS: Record<string, number> = {
  sm: 10,
  md: 20,
  lg: 40,
};

const BLOCK_FULL = '\u2588';   // █
const BLOCK_EMPTY = '\u2591';  // ░

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// --------------- Component ---------------

export const Gauge: React.FC<GaugeProps> = ({
  value,
  min = 0,
  max = 100,
  size = 'md',
  label,
  showValue = true,
  color = 'green',
}) => {
  const barWidth = SIZE_WIDTHS[size] ?? SIZE_WIDTHS.md;
  const clamped = clamp(value, min, max);
  const range = max - min || 1;
  const percentage = ((clamped - min) / range) * 100;
  const filled = Math.round((percentage / 100) * barWidth);
  const empty = barWidth - filled;

  // Determine color based on value thresholds
  let displayColor = color;
  if (percentage >= 80) {
    displayColor = 'green';
  } else if (percentage >= 50) {
    displayColor = 'yellow';
  } else if (percentage >= 25) {
    displayColor = color;
  } else {
    displayColor = 'red';
  }

  return (
    <Box flexDirection="column">
      {/* Label */}
      {label && (
        <Text dimColor>{label}</Text>
      )}

      {/* Gauge bar */}
      <Box>
        <Text>[</Text>
        <Text color={displayColor}>
          {BLOCK_FULL.repeat(filled)}
        </Text>
        <Text dimColor>
          {BLOCK_EMPTY.repeat(empty)}
        </Text>
        <Text>]</Text>
        {showValue && (
          <Text> {Math.round(percentage)}%</Text>
        )}
      </Box>

      {/* Value detail */}
      {showValue && (
        <Text dimColor>
          {clamped} of {max}
        </Text>
      )}
    </Box>
  );
};

Gauge.displayName = 'Gauge';
export default Gauge;
