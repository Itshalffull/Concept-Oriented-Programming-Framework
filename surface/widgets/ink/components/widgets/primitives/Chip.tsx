// ============================================================
// Clef Surface Ink Widget — Chip
//
// Compact interactive tag element for the terminal. Renders as
// ( label ) for filled or [ label ] for outline. When removable,
// appends a dismiss marker. Supports selection toggle and focus.
//
// Adapts the chip.widget spec: anatomy (root, label,
// deleteButton, icon), states (idle, selected, hovered, focused,
// removed, deletable, disabled), and connect attributes
// (data-part, data-state, data-disabled) to terminal rendering.
// ============================================================

import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface ChipProps {
  /** Text content of the chip. */
  label?: string;
  /** Visual variant. */
  variant?: 'filled' | 'outline';
  /** Size affecting internal padding. */
  size?: 'sm' | 'md';
  /** Whether the chip can be removed. */
  removable?: boolean;
  /** Whether the chip is disabled. */
  disabled?: boolean;
  /** Whether the chip is selected. */
  selected?: boolean;
  /** Whether this chip has focus. */
  isFocused?: boolean;
  /** Callback when the remove action is triggered. */
  onRemove?: () => void;
  /** Callback when the chip is selected/deselected. */
  onSelect?: () => void;
  /** data-part attribute. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
  /** data-variant attribute override. */
  dataVariant?: string;
}

// --------------- Component ---------------

export const Chip: React.FC<ChipProps> = ({
  label = '',
  variant = 'filled',
  size = 'md',
  removable = false,
  disabled = false,
  selected = false,
  isFocused = false,
  onRemove,
  onSelect,
  dataPart,
  dataState,
  dataVariant,
}) => {
  const handleRemove = useCallback(() => {
    if (disabled) return;
    onRemove?.();
  }, [disabled, onRemove]);

  const handleSelect = useCallback(() => {
    if (disabled) return;
    onSelect?.();
  }, [disabled, onSelect]);

  useInput(
    (input, key) => {
      if (disabled) return;
      if (key.return || input === ' ') {
        handleSelect();
      } else if ((key.delete || key.backspace) && removable) {
        handleRemove();
      }
    },
    { isActive: isFocused },
  );

  const pad = size === 'sm' ? '' : ' ';
  const isOutline = variant === 'outline';

  const openBracket = isOutline ? '[ ' : '( ';
  const closeBracket = isOutline ? ' ]' : ' )';
  const removeMarker = removable ? ' \u00d7' : '';

  const resolvedState = dataState ?? (selected ? 'selected' : 'idle');

  return (
    <Box>
      <Text
        bold={isFocused || selected}
        dimColor={disabled}
        inverse={isFocused && !disabled}
      >
        {openBracket}
        {pad}
        {label}
        {removeMarker}
        {pad}
        {closeBracket}
      </Text>
    </Box>
  );
};

Chip.displayName = 'Chip';
export default Chip;
