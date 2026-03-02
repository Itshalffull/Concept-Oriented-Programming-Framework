// ============================================================
// Clef Surface Ink Widget — RadioCard
//
// Visual single-choice selection using rich card-style options
// for terminal. Each card renders inside a Box border with a
// radio indicator, label, and optional description. Arrow keys
// navigate between cards, space/enter selects. Maps the
// radio-card.widget anatomy (root, label, items, card,
// cardContent, cardLabel, cardDescription) to Ink Box/Text.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface RadioCardOption {
  label: string;
  value: string;
  description?: string;
}

// --------------- Props ---------------

export interface RadioCardProps {
  /** Currently selected value. */
  value?: string;
  /** Available card options. */
  options: RadioCardOption[];
  /** Disables all options when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the selected value changes. */
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export const RadioCard: React.FC<RadioCardProps> = ({
  value,
  options,
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
      if (!opt) return;
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

  return (
    <Box flexDirection="column">
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        const isHighlighted = isFocused && cursor === idx;
        const radio = isSelected ? '(\u25CF)' : '(\u25CB)';

        return (
          <Box
            key={opt.value}
            flexDirection="column"
            borderStyle={isHighlighted ? 'bold' : 'single'}
            borderColor={isSelected ? 'green' : isHighlighted ? 'cyan' : undefined}
            paddingX={1}
            marginBottom={idx < options.length - 1 ? 1 : 0}
          >
            <Box>
              <Text color={isSelected ? 'green' : 'gray'}>{radio} </Text>
              <Text bold={isSelected}>{opt.label}</Text>
            </Box>
            {opt.description && (
              <Box marginLeft={4}>
                <Text dimColor>{opt.description}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

RadioCard.displayName = 'RadioCard';
export default RadioCard;
