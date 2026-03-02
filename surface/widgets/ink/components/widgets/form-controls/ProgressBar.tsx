// ============================================================
// Clef Surface Ink Widget — ProgressBar
//
// Visual progress indicator for terminal. Renders a horizontal
// bar using filled (block) and empty (light shade) characters
// with an optional percentage readout. Maps the
// progress-bar.widget anatomy (root, track, fill, label,
// valueText) to Ink Box/Text.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface ProgressBarProps {
  /** Current progress value (0 to max). */
  value: number;
  /** Maximum value (default 100). */
  max?: number;
  /** Size controlling the bar width in characters. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label shown above the bar. */
  label?: string;
  /** Whether to display the percentage text. */
  showValue?: boolean;
}

// --------------- Size Mapping ---------------

const SIZE_WIDTH: Record<string, number> = {
  sm: 15,
  md: 25,
  lg: 40,
};

// --------------- Characters ---------------

const FILLED = '\u2588'; // Full block
const EMPTY = '\u2591';  // Light shade

// --------------- Component ---------------

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  label,
  showValue = true,
}) => {
  const barWidth = SIZE_WIDTH[size] || SIZE_WIDTH.md;
  const clamped = Math.max(0, Math.min(value, max));
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  const filledCount = Math.round((clamped / max) * barWidth);
  const emptyCount = barWidth - filledCount;

  const filledStr = FILLED.repeat(filledCount);
  const emptyStr = EMPTY.repeat(emptyCount);

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box>
        <Text color="green">[{filledStr}</Text>
        <Text dimColor>{emptyStr}]</Text>
        {showValue && (
          <Text> {percent}%</Text>
        )}
      </Box>
    </Box>
  );
};

ProgressBar.displayName = 'ProgressBar';
export default ProgressBar;
