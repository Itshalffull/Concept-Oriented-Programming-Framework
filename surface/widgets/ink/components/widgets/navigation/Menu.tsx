// ============================================================
// Clef Surface Ink Widget — Menu
//
// Dropdown command menu for terminal display.
// Renders a bordered list of actions with a cursor indicator,
// arrow key navigation, enter to select, and escape to close.
// Supports shortcuts, disabled items, and danger styling.
// Maps menu.widget anatomy (root, trigger, content, item,
// separator, etc.) to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}

// --------------- Props ---------------

export interface MenuProps {
  /** Menu action items. */
  items: MenuItem[];
  /** Whether the menu is visible. */
  open?: boolean;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is selected. */
  onSelect?: (item: MenuItem) => void;
  /** Callback when the menu is closed. */
  onClose?: () => void;
}

// --------------- Component ---------------

export const Menu: React.FC<MenuProps> = ({
  items,
  open = false,
  isFocused = false,
  onSelect,
  onClose,
}) => {
  const [highlightIndex, setHighlightIndex] = useState(0);

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
      if (!isFocused || !open || items.length === 0) return;

      if (key.escape) {
        onClose?.();
        return;
      }

      if (key.downArrow) {
        setHighlightIndex((i) => getNextEnabledIndex(i, 1));
      } else if (key.upArrow) {
        setHighlightIndex((i) => getNextEnabledIndex(i, -1));
      } else if (key.return || input === ' ') {
        const item = items[highlightIndex];
        if (item && !item.disabled) {
          onSelect?.(item);
        }
      }
    },
    { isActive: isFocused && open },
  );

  if (!open) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {items.map((item, index) => {
        const isHighlighted = index === highlightIndex;

        return (
          <Box key={item.id}>
            <Text color={isHighlighted ? 'cyan' : undefined}>
              {isHighlighted ? '\u276F' : ' '}{' '}
            </Text>
            <Text
              bold={isHighlighted}
              color={item.disabled ? 'gray' : item.danger ? 'red' : isHighlighted ? 'cyan' : undefined}
              dimColor={item.disabled}
              strikethrough={item.disabled}
            >
              {item.label}
            </Text>
            {item.shortcut && (
              <Text dimColor> {item.shortcut}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

Menu.displayName = 'Menu';
export default Menu;
