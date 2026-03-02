// ============================================================
// Clef Surface Ink Widget — FloatingToolbar
//
// Contextual bubble toolbar for terminal display.
// Renders a horizontal bar of action items with roving
// focus using arrow keys. Displays as `[ B | I | U | S ]`
// with focus highlighting on the selected item.
// Maps floating-toolbar.widget anatomy (root, content)
// with slotted items to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface FloatingToolbarItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface FloatingToolbarProps {
  /** Toolbar action items. */
  items: FloatingToolbarItem[];
  /** Whether the toolbar is visible. */
  visible?: boolean;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is selected. */
  onSelect?: (item: FloatingToolbarItem) => void;
}

// --------------- Component ---------------

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  items,
  visible = true,
  isFocused = false,
  onSelect,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);

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
      if (!isFocused || !visible || items.length === 0) return;

      if (key.rightArrow) {
        setFocusIndex((i) => getNextEnabledIndex(i, 1));
      } else if (key.leftArrow) {
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

  if (!visible) return null;

  return (
    <Box borderStyle="round" borderColor="gray">
      {items.map((item, index) => {
        const isFocusedItem = isFocused && index === focusIndex;
        const display = item.icon || item.label;

        return (
          <Box key={item.id}>
            {index > 0 && <Text dimColor> | </Text>}
            <Text
              bold={isFocusedItem}
              color={item.disabled ? 'gray' : isFocusedItem ? 'cyan' : undefined}
              dimColor={item.disabled}
              inverse={isFocusedItem}
            >
              {' '}{display}{' '}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

FloatingToolbar.displayName = 'FloatingToolbar';
export default FloatingToolbar;
