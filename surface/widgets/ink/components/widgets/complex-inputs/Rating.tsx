// ============================================================
// Clef Surface Ink Widget — Rating
//
// Star-based rating input for the terminal. Renders as
// filled/empty/half stars (e.g. ★★★☆☆). Arrow keys adjust
// the value, supporting whole and half-star precision. Maps
// the rating.widget anatomy (root, item, icon) and states
// (item, interaction) to keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface RatingProps {
  /** Current rating value. */
  value?: number;
  /** Maximum number of stars. */
  max?: number;
  /** Whether to allow half-star increments. */
  allowHalf?: boolean;
  /** Disables the rating when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Visible label. */
  label?: string;
  /** Called when the rating value changes. */
  onChange?: (value: number) => void;
}

// --------------- Constants ---------------

const STAR_FILLED = '\u2605';  // ★
const STAR_HALF = '\u00BD';    // ½ (visual approximation)
const STAR_EMPTY = '\u2606';   // ☆

// --------------- Component ---------------

export const Rating: React.FC<RatingProps> = ({
  value: controlledValue,
  max = 5,
  allowHalf = false,
  disabled = false,
  isFocused = false,
  label,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? 0);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;
  const displayValue = hoverValue !== null ? hoverValue : currentValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const step = allowHalf ? 0.5 : 1;

  const setValue = useCallback(
    (v: number) => {
      if (disabled) return;
      const clamped = Math.min(max, Math.max(0, v));
      setInternalValue(clamped);
      onChange?.(clamped);
    },
    [disabled, max, onChange],
  );

  useInput(
    (_input, key) => {
      if (disabled) return;

      if (key.rightArrow || key.upArrow) {
        setValue(currentValue + step);
      } else if (key.leftArrow || key.downArrow) {
        setValue(currentValue - step);
      }
    },
    { isActive: isFocused },
  );

  // Build star display
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= max; i++) {
    let icon: string;
    let color: string | undefined;

    if (displayValue >= i) {
      icon = STAR_FILLED;
      color = 'yellow';
    } else if (allowHalf && displayValue >= i - 0.5) {
      icon = STAR_HALF;
      color = 'yellow';
    } else {
      icon = STAR_EMPTY;
      color = undefined;
    }

    stars.push(
      <Text
        key={i}
        color={disabled ? 'gray' : color}
        bold={displayValue >= i}
        dimColor={disabled}
      >
        {icon}
      </Text>,
    );
  }

  return (
    <Box>
      {label && (
        <Text dimColor={disabled} bold>
          {label}{' '}
        </Text>
      )}
      {stars}
      <Text dimColor={disabled}>
        {' '}({displayValue}/{max})
      </Text>
      {isFocused && !disabled && (
        <Text dimColor>
          {' '}{'\u2190\u2192'}
        </Text>
      )}
    </Box>
  );
};

Rating.displayName = 'Rating';
export default Rating;
