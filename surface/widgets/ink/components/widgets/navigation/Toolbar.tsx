// ============================================================
// Clef Surface Ink Widget — Toolbar
//
// Horizontal or vertical row of action controls for terminal.
// Renders as `[ B ] [ I ] [ U ]` with roving focus using
// arrow keys. Supports active, disabled, and focus states.
// Maps toolbar.widget anatomy (root, group, separator) with
// slotted items to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ToolbarItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  active?: boolean;
}

// --------------- Props ---------------

export interface ToolbarProps {
  /** Toolbar action items. */
  items: ToolbarItem[];
  /** Layout orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is selected. */
  onSelect?: (item: ToolbarItem) => void;
}

// --------------- Component ---------------

export const Toolbar: React.FC<ToolbarProps> = ({
  items,
  orientation = 'horizontal',
  isFocused = false,
  onSelect,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  const isHorizontal = orientation === 'horizontal';

  const getNextEnabledIndex = useCallback(
    (current: number, direction: 1 | -1): number => {
      let next = current + direction;
      while (next >= 0 && next < items.length) {
        if (!items[next]?.disabled) return next;
        next += direction;
      }
      return current;
    },
    [items],
  );

  useInput(
    (input, key) => {
      if (!isFocused || items.length === 0) return;

      const isNext = isHorizontal ? key.rightArrow : key.downArrow;
      const isPrev = isHorizontal ? key.leftArrow : key.upArrow;

      if (isNext) {
        setFocusIndex((i) => getNextEnabledIndex(i, 1));
      } else if (isPrev) {
        setFocusIndex((i) => getNextEnabledIndex(i, -1));
      } else if (key.return || input === ' ') {
        const item = items[focusIndex];
        if (item && !item.disabled) {
          onSelect?.(item);
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection={isHorizontal ? 'row' : 'column'}>
      {items.map((item, index) => {
        const isFocusedItem = isFocused && index === focusIndex;
        const display = item.icon || item.label;

        return (
          <Box key={item.id} marginRight={isHorizontal ? 1 : 0}>
            <Text
              color={
                item.disabled
                  ? 'gray'
                  : item.active
                    ? 'green'
                    : isFocusedItem
                      ? 'cyan'
                      : undefined
              }
              bold={item.active || isFocusedItem}
              dimColor={item.disabled}
              inverse={isFocusedItem}
            >
              [ {display} ]
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

Toolbar.displayName = 'Toolbar';
export default Toolbar;
