// ============================================================
// Clef Surface Ink Widget — Stepper
//
// Compact increment/decrement control for terminal. Renders
// as [ - ] value [ + ] with keyboard controls. Arrow keys
// and +/- characters adjust the value within bounds. Maps
// the stepper.widget anatomy (root, label, decrementButton,
// value, incrementButton) to Ink Box/Text.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface StepperProps {
  /** Current value. */
  value: number;
  /** Minimum allowed value (default 0). */
  min?: number;
  /** Maximum allowed value (default 10). */
  max?: number;
  /** Increment/decrement step size (default 1). */
  step?: number;
  /** Visible label describing the stepper. */
  label?: string;
  /** Disables the stepper when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the value changes. */
  onChange?: (value: number) => void;
}

// --------------- Component ---------------

export const Stepper: React.FC<StepperProps> = ({
  value,
  min = 0,
  max = 10,
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

  const increment = useCallback(() => {
    if (disabled || !onChange) return;
    const next = clamp(value + step);
    if (next !== value) onChange(next);
  }, [disabled, onChange, value, step, clamp]);

  const decrement = useCallback(() => {
    if (disabled || !onChange) return;
    const next = clamp(value - step);
    if (next !== value) onChange(next);
  }, [disabled, onChange, value, step, clamp]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.upArrow || key.rightArrow || input === '+') {
        increment();
      } else if (key.downArrow || key.leftArrow || input === '-') {
        decrement();
      }
    },
    { isActive: isFocused },
  );

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box>
        <Text
          color={disabled || atMin ? 'gray' : 'cyan'}
          dimColor={disabled || atMin}
        >
          [ - ]
        </Text>
        <Text bold color={disabled ? 'gray' : undefined}>
          {' '}{value}{' '}
        </Text>
        <Text
          color={disabled || atMax ? 'gray' : 'cyan'}
          dimColor={disabled || atMax}
        >
          [ + ]
        </Text>
      </Box>
    </Box>
  );
};

Stepper.displayName = 'Stepper';
export default Stepper;
