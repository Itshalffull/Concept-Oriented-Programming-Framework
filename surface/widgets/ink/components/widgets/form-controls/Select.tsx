// ============================================================
// Clef Surface Ink Widget — Select
//
// Dropdown single-choice selector for terminal. Shows a trigger
// line with the selected value and a dropdown arrow. When open,
// displays a list below with a cursor indicator. Arrow keys
// navigate, enter selects, escape closes. Maps the
// select.widget anatomy (root, label, trigger, valueDisplay,
// indicator, content, item, itemIndicator) to Ink Box/Text.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface SelectProps {
  /** Currently selected value. */
  value?: string;
  /** Available options. */
  options: SelectOption[];
  /** Placeholder text when no value is selected. */
  placeholder?: string;
  /** Visible label describing the field. */
  label?: string;
  /** Disables the select when true. */
  disabled?: boolean;
  /** Controls whether the dropdown is open. */
  open?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the selected value changes. */
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export const Select: React.FC<SelectProps> = ({
  value,
  options,
  placeholder = 'Select...',
  label,
  disabled = false,
  open: controlledOpen,
  isFocused = false,
  onChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const idx = options.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  });

  const isOpen = controlledOpen != null ? controlledOpen : internalOpen;

  const selectItem = useCallback(
    (idx: number) => {
      if (disabled || !onChange) return;
      const opt = options[idx];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
      setInternalOpen(false);
    },
    [disabled, onChange, options],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        if (isOpen) {
          selectItem(cursor);
        } else {
          setInternalOpen(true);
        }
      } else if (key.escape) {
        setInternalOpen(false);
      } else if (key.upArrow) {
        if (isOpen) {
          setCursor((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
      } else if (key.downArrow) {
        if (!isOpen) {
          setInternalOpen(true);
        } else {
          setCursor((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
      } else if (input === ' ') {
        if (!isOpen) {
          setInternalOpen(true);
        } else {
          selectItem(cursor);
        }
      }
    },
    { isActive: isFocused },
  );

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label
    : undefined;

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}

      {/* Trigger line */}
      <Box>
        <Text color={isOpen ? 'cyan' : undefined}>
          {isOpen ? '\u25B3' : '\u25BC'}{' '}
        </Text>
        {selectedLabel ? (
          <Text>{selectedLabel}</Text>
        ) : (
          <Text dimColor>{placeholder}</Text>
        )}
      </Box>

      {/* Dropdown list */}
      {isOpen && (
        <Box flexDirection="column" marginLeft={2}>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = cursor === idx;
            const isDisabled = disabled || !!opt.disabled;

            return (
              <Box key={opt.value}>
                <Text color={isHighlighted ? 'cyan' : undefined}>
                  {isHighlighted ? '\u276F' : ' '}{' '}
                </Text>
                <Text
                  bold={isSelected}
                  color={isDisabled ? 'gray' : isSelected ? 'green' : undefined}
                  dimColor={isDisabled}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <Text color="green"> {'\u2713'}</Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

Select.displayName = 'Select';
export default Select;
