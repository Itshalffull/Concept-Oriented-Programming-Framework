// ============================================================
// Clef Surface Ink Widget — Combobox
//
// Searchable single-choice selector for terminal. Combines a
// text input with a filtered dropdown list below. As the user
// types, options are filtered in real time. Maps the
// combobox.widget anatomy (root, label, input, content, item)
// to Ink Box/Text with useInput keyboard handling.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ComboboxOption {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface ComboboxProps {
  /** Currently selected value. */
  value?: string;
  /** Available options. */
  options: ComboboxOption[];
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Visible label describing the field. */
  label?: string;
  /** Disables the combobox when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the selected value changes. */
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  options,
  placeholder = 'Search...',
  label,
  disabled = false,
  isFocused = false,
  onChange,
}) => {
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const filtered = useMemo(() => {
    if (!inputText) return options;
    const lower = inputText.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, inputText]);

  const selectItem = useCallback(
    (idx: number) => {
      if (disabled || !onChange) return;
      const opt = filtered[idx];
      if (!opt) return;
      onChange(opt.value);
      setInputText('');
      setIsOpen(false);
      setCursor(0);
    },
    [disabled, onChange, filtered],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        if (isOpen && filtered.length > 0) {
          selectItem(cursor);
        } else {
          setIsOpen(true);
        }
      } else if (key.escape) {
        setIsOpen(false);
        setInputText('');
        setCursor(0);
      } else if (key.upArrow) {
        if (isOpen) {
          setCursor((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        }
      } else if (key.downArrow) {
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setCursor((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        }
      } else if (key.backspace || key.delete) {
        setInputText((prev) => prev.slice(0, -1));
        setIsOpen(true);
        setCursor(0);
      } else if (!key.ctrl && !key.meta && input && input.length === 1) {
        setInputText((prev) => prev + input);
        setIsOpen(true);
        setCursor(0);
      }
    },
    { isActive: isFocused },
  );

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label
    : undefined;

  const displayText = isOpen
    ? inputText
    : selectedLabel || '';

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}

      {/* Input line */}
      <Box>
        <Text color={isOpen ? 'cyan' : undefined}>
          {'\u25BC'}{' '}
        </Text>
        {displayText ? (
          <Text>{displayText}</Text>
        ) : (
          <Text dimColor>{placeholder}</Text>
        )}
        {isFocused && isOpen && <Text color="cyan">_</Text>}
      </Box>

      {/* Dropdown list */}
      {isOpen && (
        <Box flexDirection="column" marginLeft={2}>
          {filtered.length === 0 ? (
            <Text dimColor>No results found</Text>
          ) : (
            filtered.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = cursor === idx;

              return (
                <Box key={opt.value}>
                  <Text color={isHighlighted ? 'cyan' : undefined}>
                    {isHighlighted ? '\u276F' : ' '}{' '}
                  </Text>
                  <Text
                    bold={isSelected}
                    color={isSelected ? 'green' : undefined}
                  >
                    {opt.label}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>
      )}
    </Box>
  );
};

Combobox.displayName = 'Combobox';
export default Combobox;
