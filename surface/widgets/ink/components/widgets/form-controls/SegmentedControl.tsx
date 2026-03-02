// ============================================================
// Clef Surface Ink Widget — SegmentedControl
//
// Inline single-choice control displayed as a row of connected
// segments for terminal. The active segment is rendered with
// inverse colors to simulate a sliding indicator. Arrow keys
// navigate, space/enter selects. Maps the
// segmented-control.widget anatomy (root, items, item,
// itemLabel, indicator) to Ink Box/Text.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface SegmentedControlOption {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface SegmentedControlProps {
  /** Currently selected value. */
  value?: string;
  /** Available segment options (minimum 2). */
  options: SegmentedControlOption[];
  /** Size controlling padding. */
  size?: 'sm' | 'md' | 'lg';
  /** Disables the control when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the selected value changes. */
  onChange?: (value: string) => void;
}

// --------------- Size Mapping ---------------

const SIZE_PAD: Record<string, number> = {
  sm: 0,
  md: 1,
  lg: 2,
};

// --------------- Component ---------------

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  options,
  size = 'md',
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

      if (key.leftArrow) {
        setCursor((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      } else if (key.rightArrow) {
        setCursor((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      } else if (input === ' ' || key.return) {
        selectItem(cursor);
      }
    },
    { isActive: isFocused },
  );

  const pad = SIZE_PAD[size] || SIZE_PAD.md;
  const padding = ' '.repeat(pad);

  return (
    <Box>
      <Text color={disabled ? 'gray' : undefined}>[ </Text>
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        const isHighlighted = isFocused && cursor === idx;

        return (
          <React.Fragment key={opt.value}>
            {isSelected ? (
              <Text inverse bold color={disabled ? 'gray' : undefined}>
                {padding}{opt.label}{padding}
              </Text>
            ) : (
              <Text
                color={disabled ? 'gray' : undefined}
                underline={isHighlighted}
              >
                {padding}{opt.label}{padding}
              </Text>
            )}
            {idx < options.length - 1 && (
              <Text color={disabled ? 'gray' : 'gray'}> | </Text>
            )}
          </React.Fragment>
        );
      })}
      <Text color={disabled ? 'gray' : undefined}> ]</Text>
    </Box>
  );
};

SegmentedControl.displayName = 'SegmentedControl';
export default SegmentedControl;
