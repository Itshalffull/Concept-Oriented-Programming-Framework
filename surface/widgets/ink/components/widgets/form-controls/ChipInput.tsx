// ============================================================
// Clef Surface Ink Widget — ChipInput
//
// Free-form multi-value input that creates removable chips
// from typed text in the terminal. Shows chips as (tag1) (tag2)
// followed by an inline text input area. Enter adds a chip,
// backspace on empty input removes the last chip. Maps the
// chip-input.widget anatomy to Ink Box/Text with useInput.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface ChipInputProps {
  /** Current list of chip values. */
  value: string[];
  /** Placeholder text when no chips and no input. */
  placeholder?: string;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when a new chip is added. */
  onAdd?: (chip: string) => void;
  /** Called when a chip is removed by index. */
  onRemove?: (index: number) => void;
}

// --------------- Component ---------------

export const ChipInput: React.FC<ChipInputProps> = ({
  value,
  placeholder = 'Type and press Enter...',
  disabled = false,
  isFocused = false,
  onAdd,
  onRemove,
}) => {
  const [inputText, setInputText] = useState('');

  const addChip = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || disabled || !onAdd) return;
    if (value.includes(trimmed)) {
      setInputText('');
      return;
    }
    onAdd(trimmed);
    setInputText('');
  }, [inputText, disabled, onAdd, value]);

  const removeLastChip = useCallback(() => {
    if (disabled || !onRemove || value.length === 0) return;
    onRemove(value.length - 1);
  }, [disabled, onRemove, value]);

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        addChip();
      } else if (key.backspace || key.delete) {
        if (inputText.length === 0) {
          removeLastChip();
        } else {
          setInputText((prev) => prev.slice(0, -1));
        }
      } else if (key.escape) {
        setInputText('');
      } else if (!key.ctrl && !key.meta && input && input.length === 1) {
        setInputText((prev) => prev + input);
      }
    },
    { isActive: isFocused },
  );

  const showPlaceholder = value.length === 0 && inputText.length === 0;

  return (
    <Box>
      {/* Chips */}
      {value.map((chip, idx) => (
        <Box key={`${chip}-${idx}`} marginRight={1}>
          <Text color="cyan">({chip})</Text>
        </Box>
      ))}

      {/* Input area */}
      <Box>
        {showPlaceholder ? (
          <Text dimColor>[{placeholder}]</Text>
        ) : (
          <Text>
            [{inputText}
            {isFocused && !disabled ? (
              <Text color="cyan">_</Text>
            ) : null}
            ]
          </Text>
        )}
      </Box>
    </Box>
  );
};

ChipInput.displayName = 'ChipInput';
export default ChipInput;
