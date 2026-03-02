// ============================================================
// Clef Surface Ink Widget — TextInput
//
// Single-line text entry field for the terminal. When focused,
// displays a blinking cursor indicator. Captures keyboard input
// character-by-character and forwards the value through the
// onChange callback.
//
// Adapts the text-input.widget spec: anatomy (root, label,
// input, description, error, prefix, suffix, clearButton),
// states (empty, filled, idle, focused, valid, invalid,
// disabled, readOnly), and connect attributes (data-part,
// data-state, data-focus, value, placeholder) to terminal
// rendering.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface TextInputProps {
  /** Current value of the text field (controlled). */
  value?: string;
  /** Placeholder text shown when the value is empty. */
  placeholder?: string;
  /** Whether the text input is disabled. */
  disabled?: boolean;
  /** Whether the text input is read-only. */
  readOnly?: boolean;
  /** Whether this input has focus and receives keyboard input. */
  isFocused?: boolean;
  /** Callback when the value changes. */
  onChange?: (value: string) => void;
  /** Callback when Enter is pressed. */
  onSubmit?: (value: string) => void;
  /** Optional label text above the input. */
  label?: string;
  /** Whether the field is required. */
  required?: boolean;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
}

// --------------- Component ---------------

export const TextInput: React.FC<TextInputProps> = ({
  value: controlledValue,
  placeholder = '',
  disabled = false,
  readOnly = false,
  isFocused = false,
  onChange,
  onSubmit,
  label,
  required = false,
  dataPart,
  dataState,
}) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const updateValue = useCallback(
    (next: string) => {
      setInternalValue(next);
      onChange?.(next);
    },
    [onChange],
  );

  useInput(
    (input, key) => {
      if (disabled || readOnly) return;

      if (key.return) {
        onSubmit?.(currentValue);
        return;
      }

      if (key.backspace || key.delete) {
        updateValue(currentValue.slice(0, -1));
        return;
      }

      // Ignore control sequences
      if (key.ctrl || key.meta || key.escape) return;
      // Ignore arrow keys and tab
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.tab) return;

      if (input) {
        updateValue(currentValue + input);
      }
    },
    { isActive: isFocused },
  );

  const isEmpty = currentValue.length === 0;
  const cursorChar = '\u2588'; // full block cursor

  const resolvedState = dataState ?? (disabled ? 'disabled' : readOnly ? 'readonly' : 'default');

  return (
    <Box flexDirection="column">
      {label && (
        <Box>
          <Text dimColor={disabled}>{label}</Text>
          {required && <Text color="red"> *</Text>}
        </Box>
      )}
      <Box>
        <Text dimColor={disabled}>
          {isEmpty && !isFocused ? (
            <Text dimColor>{placeholder}</Text>
          ) : (
            <>
              {currentValue}
              {isFocused && !disabled && (
                <Text inverse> </Text>
              )}
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
};

TextInput.displayName = 'TextInput';
export default TextInput;
