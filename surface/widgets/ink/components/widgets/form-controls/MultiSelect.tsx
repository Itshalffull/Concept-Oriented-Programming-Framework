// ============================================================
// Clef Surface Ink Widget — MultiSelect
//
// Dropdown multi-choice selector for terminal. Displays a list
// of options with [x]/[ ] checkbox indicators. Arrow keys
// navigate the list, space toggles selection. Maps the
// multi-select.widget anatomy (root, label, trigger, content,
// item, itemIndicator) to Ink Box/Text with useInput.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface MultiSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface MultiSelectProps {
  /** Currently selected values. */
  value: string[];
  /** Available options. */
  options: MultiSelectOption[];
  /** Visible label describing the field. */
  label?: string;
  /** Disables the entire control when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the set of selected values changes. */
  onChange?: (values: string[]) => void;
}

// --------------- Component ---------------

export const MultiSelect: React.FC<MultiSelectProps> = ({
  value,
  options,
  label,
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

      if (key.upArrow) {
        setCursor((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (key.downArrow) {
        setCursor((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (input === ' ') {
        toggle(cursor);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box flexDirection="column">
        {options.map((opt, idx) => {
          const checked = value.includes(opt.value);
          const isActive = isFocused && cursor === idx;
          const isDisabled = disabled || !!opt.disabled;
          const indicator = checked ? '[x]' : '[ ]';

          return (
            <Box key={opt.value}>
              <Text color={isActive ? 'cyan' : undefined}>
                {isActive ? '\u276F' : ' '}{' '}
              </Text>
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

MultiSelect.displayName = 'MultiSelect';
export default MultiSelect;
