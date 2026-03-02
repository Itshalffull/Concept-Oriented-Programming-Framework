// ============================================================
// Clef Surface Ink Widget — Spinner
//
// Indeterminate loading indicator for the terminal. Cycles
// through braille dot animation frames on an interval. An
// optional label is displayed alongside the spinning character.
//
// Adapts the spinner.widget spec: anatomy (root, track,
// indicator, label), states (spinning), and connect attributes
// (data-part, data-size, role, aria-busy, aria-label)
// to terminal rendering.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface SpinnerProps {
  /** Size of the spinner. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional text label next to the spinner. */
  label?: string;
  /** Whether the track (background circle) is visible (no-op in terminal). */
  trackVisible?: boolean;
  /** data-part attribute. */
  dataPart?: string;
}

// --------------- Animation Frames ---------------

const FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
// Braille spinner: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏

const INTERVAL: Record<string, number> = {
  sm: 100,
  md: 80,
  lg: 60,
};

// --------------- Component ---------------

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  trackVisible = true,
  dataPart,
}) => {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const ms = INTERVAL[size] ?? INTERVAL.md;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % FRAMES.length);
    }, ms);
    return () => clearInterval(interval);
  }, [size]);

  const frame = FRAMES[frameIndex];
  const isBold = size === 'lg';

  return (
    <Box>
      <Text bold={isBold} color="cyan">
        {frame}
      </Text>
      {label && (
        <Text>
          {' '}
          {label}
        </Text>
      )}
    </Box>
  );
};

Spinner.displayName = 'Spinner';
export default Spinner;
