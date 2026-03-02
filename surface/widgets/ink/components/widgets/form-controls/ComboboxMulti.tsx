// ============================================================
// Clef Surface Ink Widget — ComboboxMulti
//
// Searchable multi-choice selector for terminal. Combines a
// text input with a filtered dropdown list of checkboxes.
// Selected values appear as chips above the input. Maps the
// combobox-multi.widget anatomy (root, label, chipList, chip,
// input, content, item) to Ink Box/Text with useInput.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ComboboxMultiOption {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface ComboboxMultiProps {
  /** Currently selected values. */
  value: string[];
  /** Available options. */
  options: ComboboxMultiOption[];
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Visible label describing the field. */
  label?: string;
  /** Disables the combobox when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the set of selected values changes. */
  onChange?: (values: string[]) => void;
}

// --------------- Component ---------------

export const ComboboxMulti: React.FC<ComboboxMultiProps> = ({
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

  const toggleItem = useCallback(
    (idx: number) => {
      if (disabled || !onChange) return;
      const opt = filtered[idx];
      if (!opt) return;

      const exists = value.includes(opt.value);
      const next = exists
        ? value.filter((v) => v !== opt.value)
        : [...value, opt.value];
      onChange(next);
    },
    [disabled, onChange, filtered, value],
  );

  const removeLastChip = useCallback(() => {
    if (disabled || !onChange || value.length === 0) return;
    onChange(value.slice(0, -1));
  }, [disabled, onChange, value]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        if (isOpen && filtered.length > 0) {
          toggleItem(cursor);
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
        if (inputText.length === 0) {
          removeLastChip();
        } else {
          setInputText((prev) => prev.slice(0, -1));
          setCursor(0);
        }
      } else if (!key.ctrl && !key.meta && input && input.length === 1) {
        setInputText((prev) => prev + input);
        setIsOpen(true);
        setCursor(0);
      }
    },
    { isActive: isFocused },
  );

  const labelOf = (val: string): string =>
    options.find((o) => o.value === val)?.label || val;

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}

      {/* Selected chips */}
      {value.length > 0 && (
        <Box flexWrap="wrap">
          {value.map((v, idx) => (
            <Box key={`${v}-${idx}`} marginRight={1}>
              <Text color="cyan">({labelOf(v)})</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Input line */}
      <Box>
        <Text color={isOpen ? 'cyan' : undefined}>
          {'\u25BC'}{' '}
        </Text>
        {inputText ? (
          <Text>{inputText}</Text>
        ) : (
          <Text dimColor>{value.length === 0 ? placeholder : ''}</Text>
        )}
        {isFocused && isOpen && <Text color="cyan">_</Text>}
      </Box>

      {/* Dropdown list with checkboxes */}
      {isOpen && (
        <Box flexDirection="column" marginLeft={2}>
          {filtered.length === 0 ? (
            <Text dimColor>No results found</Text>
          ) : (
            filtered.map((opt, idx) => {
              const isChecked = value.includes(opt.value);
              const isHighlighted = cursor === idx;
              const indicator = isChecked ? '[x]' : '[ ]';

              return (
                <Box key={opt.value}>
                  <Text color={isHighlighted ? 'cyan' : undefined}>
                    {isHighlighted ? '\u276F' : ' '}{' '}
                  </Text>
                  <Text color={isChecked ? 'green' : undefined}>
                    {indicator}
                  </Text>
                  <Text> {opt.label}</Text>
                </Box>
              );
            })
          )}
        </Box>
      )}
    </Box>
  );
};

ComboboxMulti.displayName = 'ComboboxMulti';
export default ComboboxMulti;
