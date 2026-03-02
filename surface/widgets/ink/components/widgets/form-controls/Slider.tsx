// ============================================================
// Clef Surface Ink Widget — Slider
//
// Range input slider for terminal. Renders a horizontal track
// with a thumb indicator using line-drawing and circle
// characters. Left/right arrow keys adjust the value by step.
// Maps the slider.widget anatomy (root, label, track, range,
// thumb, output) to Ink Box/Text.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface SliderProps {
  /** Current slider value. */
  value: number;
  /** Minimum value (default 0). */
  min?: number;
  /** Maximum value (default 100). */
  max?: number;
  /** Step size for each key press (default 1). */
  step?: number;
  /** Visible label describing the slider. */
  label?: string;
  /** Disables the slider when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the value changes. */
  onChange?: (value: number) => void;
}

// --------------- Constants ---------------

const TRACK_WIDTH = 20;
const TRACK_CHAR = '\u2500';  // horizontal line
const THUMB_CHAR = '\u25CF';  // filled circle

// --------------- Component ---------------

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  label,
  disabled = false,
  isFocused = false,
  onChange,
}) => {
  const clamp = useCallback(
    (n: number): number => Math.max(min, Math.min(max, n)),
    [min, max],
  );

  const increase = useCallback(() => {
    if (disabled || !onChange) return;
    onChange(clamp(value + step));
  }, [disabled, onChange, value, step, clamp]);

  const decrease = useCallback(() => {
    if (disabled || !onChange) return;
    onChange(clamp(value - step));
  }, [disabled, onChange, value, step, clamp]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.rightArrow || key.upArrow) {
        increase();
      } else if (key.leftArrow || key.downArrow) {
        decrease();
      }
    },
    { isActive: isFocused },
  );

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const thumbPos = Math.round(ratio * (TRACK_WIDTH - 1));
  const percent = Math.round(ratio * 100);

  const beforeThumb = TRACK_CHAR.repeat(thumbPos);
  const afterThumb = TRACK_CHAR.repeat(TRACK_WIDTH - 1 - thumbPos);

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box>
        <Text color={disabled ? 'gray' : undefined}>
          [
        </Text>
        <Text color={disabled ? 'gray' : 'green'}>
          {beforeThumb}
        </Text>
        <Text color={disabled ? 'gray' : 'cyan'} bold>
          {THUMB_CHAR}
        </Text>
        <Text color={disabled ? 'gray' : undefined} dimColor>
          {afterThumb}
        </Text>
        <Text color={disabled ? 'gray' : undefined}>
          ]
        </Text>
        <Text> {percent}%</Text>
      </Box>
    </Box>
  );
};

Slider.displayName = 'Slider';
export default Slider;
