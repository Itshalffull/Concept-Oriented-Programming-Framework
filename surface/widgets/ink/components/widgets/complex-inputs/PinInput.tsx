// ============================================================
// Clef Surface Ink Widget — PinInput
//
// Segmented single-character input for verification codes and
// PINs in the terminal. Renders as [ _ ] [ 3 ] [ _ ] [ _ ]
// boxes with auto-advance on entry and optional mask display.
// Maps the pin-input.widget anatomy (root, label, input,
// separator) and states (completion, focus) to keyboard-driven
// terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface PinInputProps {
  /** Number of PIN cells. */
  length?: number;
  /** Current PIN value string. */
  value?: string;
  /** Whether to mask entered digits with asterisks. */
  mask?: boolean;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the value changes. */
  onChange?: (value: string) => void;
  /** Called when all cells are filled. */
  onComplete?: (value: string) => void;
  /** Whether to accept only numeric input. */
  numeric?: boolean;
}

// --------------- Component ---------------

export const PinInput: React.FC<PinInputProps> = ({
  length = 4,
  value: controlledValue,
  mask = false,
  disabled = false,
  isFocused = false,
  onChange,
  onComplete,
  numeric = true,
}) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const [cursorPos, setCursorPos] = useState(0);

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
      // Set cursor to end of current input or first empty
      const nextEmpty = controlledValue.length < length ? controlledValue.length : length - 1;
      setCursorPos(nextEmpty);
    }
  }, [controlledValue, length]);

  const updateValue = useCallback(
    (v: string) => {
      const clamped = v.slice(0, length);
      setInternalValue(clamped);
      onChange?.(clamped);
      if (clamped.length === length) {
        onComplete?.(clamped);
      }
    },
    [length, onChange, onComplete],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      // Arrow navigation
      if (key.leftArrow) {
        setCursorPos((p) => Math.max(0, p - 1));
        return;
      }
      if (key.rightArrow) {
        setCursorPos((p) => Math.min(length - 1, p + 1));
        return;
      }

      // Backspace: clear current cell and move back
      if (key.backspace || key.delete) {
        const chars = currentValue.split('');
        if (cursorPos < chars.length) {
          chars.splice(cursorPos, 1);
        } else if (chars.length > 0) {
          chars.pop();
        }
        const next = chars.join('');
        updateValue(next);
        setCursorPos((p) => Math.max(0, p - 1));
        return;
      }

      // Character input
      if (input && !key.ctrl && !key.meta && !key.escape && !key.return) {
        const isValid = numeric ? /^[0-9]$/.test(input) : /^[a-zA-Z0-9]$/.test(input);
        if (!isValid) return;

        const chars = currentValue.split('');
        // Replace or insert at cursor position
        chars[cursorPos] = input;
        // Fill any gaps with empty strings
        for (let i = 0; i < cursorPos; i++) {
          if (!chars[i]) chars[i] = ' ';
        }
        const next = chars.join('').slice(0, length);
        updateValue(next.replace(/ /g, ''));
        // The value without spaces might shift things, so recalculate
        const cleanNext = next.replace(/ /g, '');
        updateValue(cleanNext);

        // Auto-advance
        if (cursorPos < length - 1) {
          setCursorPos(cursorPos + 1);
        }
      }
    },
    { isActive: isFocused },
  );

  // Build the cell display
  const cells: string[] = [];
  for (let i = 0; i < length; i++) {
    const ch = currentValue[i];
    if (ch) {
      cells.push(mask ? '*' : ch);
    } else {
      cells.push('_');
    }
  }

  return (
    <Box>
      {cells.map((cell, i) => {
        const isCursor = i === cursorPos && isFocused;
        const isFilled = cell !== '_';
        return (
          <Box key={i}>
            <Text
              bold={isCursor || isFilled}
              inverse={isCursor && !disabled}
              dimColor={disabled}
            >
              {'[ '}
              {cell}
              {' ]'}
            </Text>
            {i < length - 1 && <Text> </Text>}
          </Box>
        );
      })}
    </Box>
  );
};

PinInput.displayName = 'PinInput';
export default PinInput;
