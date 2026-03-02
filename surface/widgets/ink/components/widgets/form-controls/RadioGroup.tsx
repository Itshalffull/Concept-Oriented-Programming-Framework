// ============================================================
// Clef Surface Ink Widget — RadioGroup
//
// Single-choice selection from a visible list of radio options
// for terminal. All options render simultaneously with
// (filled)/(empty) circle indicators. Arrow keys navigate,
// space selects. Maps the radio-group.widget anatomy (root,
// label, items, item, itemControl, itemLabel) to Ink Box/Text.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface RadioGroupOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface RadioGroupProps {
  /** Currently selected value. */
  value?: string;
  /** Available radio options. */
  options: RadioGroupOption[];
  /** Visible label describing the group. */
  label?: string;
  /** Layout direction. */
  orientation?: 'horizontal' | 'vertical';
  /** Disables all options when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the selected value changes. */
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  options,
  label,
  orientation = 'vertical',
  disabled = false,
  isFocused = false,
  onChange,
}) => {
  const [cursor, setCursor] = useState(() => {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  });

  const selectItem = useCallback(
    (idx: number) => {
      if (disabled || !onChange) return;
      const opt = options[idx];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
    },
    [disabled, onChange, options],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.upArrow || key.leftArrow) {
        setCursor((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (key.downArrow || key.rightArrow) {
        setCursor((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (input === ' ' || key.return) {
        selectItem(cursor);
      }
    },
    { isActive: isFocused },
  );

  const isHorizontal = orientation === 'horizontal';

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box flexDirection={isHorizontal ? 'row' : 'column'} gap={isHorizontal ? 2 : 0}>
        {options.map((opt, idx) => {
          const isSelected = opt.value === value;
          const isActive = isFocused && cursor === idx;
          const isDisabled = disabled || !!opt.disabled;
          const radio = isSelected ? '(\u25CF)' : '(\u25CB)';

          return (
            <Box key={opt.value}>
              {isActive && <Text color="cyan">{'\u276F'} </Text>}
              {!isActive && <Text>  </Text>}
              <Text
                color={isDisabled ? 'gray' : isSelected ? 'green' : undefined}
                dimColor={isDisabled}
              >
                {radio}
              </Text>
              <Text
                color={isDisabled ? 'gray' : undefined}
                dimColor={isDisabled}
              >
                {' '}{opt.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

RadioGroup.displayName = 'RadioGroup';
export default RadioGroup;
