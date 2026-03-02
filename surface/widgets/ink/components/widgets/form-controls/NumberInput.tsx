// ============================================================
// Clef Surface Ink Widget — NumberInput
//
// Numeric input with increment/decrement controls for terminal.
// Renders as [ < 42 > ] with arrow keys to adjust the value.
// Respects min, max, and step constraints. Maps the
// number-input.widget anatomy (root, label, input,
// incrementButton, decrementButton) to Ink Box/Text.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface NumberInputProps {
  /** Current numeric value. */
  value: number;
  /** Minimum allowed value. */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** Increment/decrement step size. */
  step?: number;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Visible label describing the field. */
  label?: string;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the value changes. */
  onChange?: (value: number) => void;
}

// --------------- Component ---------------

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  min,
  max,
  step = 1,
  disabled = false,
  label,
  isFocused = false,
  onChange,
}) => {
  const clamp = useCallback(
    (n: number): number => {
      let result = n;
      if (min != null && result < min) result = min;
      if (max != null && result > max) result = max;
      return result;
    },
    [min, max],
  );

  const increment = useCallback(() => {
    if (disabled || !onChange) return;
    onChange(clamp(value + step));
  }, [disabled, onChange, value, step, clamp]);

  const decrement = useCallback(() => {
    if (disabled || !onChange) return;
    onChange(clamp(value - step));
  }, [disabled, onChange, value, step, clamp]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.rightArrow || key.upArrow) {
        increment();
      } else if (key.leftArrow || key.downArrow) {
        decrement();
      }
    },
    { isActive: isFocused },
  );

  const atMin = min != null && value <= min;
  const atMax = max != null && value >= max;

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box>
        <Text color={disabled || atMin ? 'gray' : 'cyan'}>
          {'['} {'\u25C4'}{' '}
        </Text>
        <Text bold color={disabled ? 'gray' : undefined}>
          {value}
        </Text>
        <Text color={disabled || atMax ? 'gray' : 'cyan'}>
          {' '}{'\u25BA'} {']'}
        </Text>
      </Box>
    </Box>
  );
};

NumberInput.displayName = 'NumberInput';
export default NumberInput;
