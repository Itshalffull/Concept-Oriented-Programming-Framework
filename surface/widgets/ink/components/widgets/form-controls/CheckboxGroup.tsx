// ============================================================
// Clef Surface Ink Widget — CheckboxGroup
//
// Multi-choice selection from a visible list of checkboxes
// for terminal. Renders [x]/[ ] indicators with arrow-key
// navigation and space to toggle. Maps the checkbox-group.widget
// anatomy (root, label, items, item, itemControl, itemLabel)
// to Ink Box/Text with useInput keyboard handling.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface CheckboxGroupOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface CheckboxGroupProps {
  /** Currently checked values. */
  value: string[];
  /** Available options. */
  options: CheckboxGroupOption[];
  /** Visible label describing the group. */
  label?: string;
  /** Layout direction. */
  orientation?: 'horizontal' | 'vertical';
  /** Disables all options when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the set of checked values changes. */
  onChange?: (values: string[]) => void;
}

// --------------- Component ---------------

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  value,
  options,
  label,
  orientation = 'vertical',
  disabled = false,
  isFocused = false,
  onChange,
}) => {
  const [cursor, setCursor] = useState(0);

  const toggle = useCallback(
    (idx: number) => {
      if (disabled || !onChange) return;
      const opt = options[idx];
      if (!opt || opt.disabled) return;

      const exists = value.includes(opt.value);
      const next = exists
        ? value.filter((v) => v !== opt.value)
        : [...value, opt.value];
      onChange(next);
    },
    [value, options, disabled, onChange],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.upArrow || key.leftArrow) {
        setCursor((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (key.downArrow || key.rightArrow) {
        setCursor((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (input === ' ') {
        toggle(cursor);
      }
    },
    { isActive: isFocused },
  );

  const isHorizontal = orientation === 'horizontal';

  return (
    <Box flexDirection="column">
      {label && (
        <Text bold>{label}</Text>
      )}
      <Box flexDirection={isHorizontal ? 'row' : 'column'} gap={isHorizontal ? 2 : 0}>
        {options.map((opt, idx) => {
          const checked = value.includes(opt.value);
          const isActive = isFocused && cursor === idx;
          const isDisabled = disabled || !!opt.disabled;
          const indicator = checked ? '[x]' : '[ ]';

          return (
            <Box key={opt.value}>
              {isActive && <Text color="cyan">{'\u276F'} </Text>}
              {!isActive && <Text>  </Text>}
              <Text
                color={isDisabled ? 'gray' : checked ? 'green' : undefined}
                dimColor={isDisabled}
              >
                {indicator}
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

CheckboxGroup.displayName = 'CheckboxGroup';
export default CheckboxGroup;
