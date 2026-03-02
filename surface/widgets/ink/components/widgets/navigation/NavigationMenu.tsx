// ============================================================
// Clef Surface Ink Widget — NavigationMenu
//
// Top-level navigation bar for terminal display.
// Supports horizontal tabs or vertical list layout with
// an underlined active item. Arrow keys navigate between
// items. Maps navigation-menu.widget anatomy (root, list,
// item, trigger, link, content, indicator, viewport) to
// Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface NavigationMenuItem {
  id: string;
  label: string;
  href?: string;
  children?: NavigationMenuItem[];
}

// --------------- Props ---------------

export interface NavigationMenuProps {
  /** Navigation items. */
  items: NavigationMenuItem[];
  /** Layout orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** ID of the currently active item. */
  activeId?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when navigation occurs. */
  onNavigate?: (item: NavigationMenuItem) => void;
}

// --------------- Component ---------------

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  items,
  orientation = 'horizontal',
  activeId,
  isFocused = false,
  onNavigate,
}) => {
  const [focusIndex, setFocusIndex] = useState(() => {
    if (activeId) {
      const idx = items.findIndex((item) => item.id === activeId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  useInput(
    (_input, key) => {
      if (!isFocused || items.length === 0) return;

      const isNext = orientation === 'horizontal' ? key.rightArrow : key.downArrow;
      const isPrev = orientation === 'horizontal' ? key.leftArrow : key.upArrow;

      if (isNext) {
        setFocusIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (isPrev) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        const item = items[focusIndex];
        if (item) onNavigate?.(item);
      }
    },
    { isActive: isFocused },
  );

  const isHorizontal = orientation === 'horizontal';

  return (
    <Box flexDirection={isHorizontal ? 'row' : 'column'}>
      {items.map((item, index) => {
        const isActive = item.id === activeId;
        const isFocusedItem = isFocused && index === focusIndex;

        return (
          <Box key={item.id} marginRight={isHorizontal ? 2 : 0}>
            <Text
              bold={isActive || isFocusedItem}
              underline={isActive}
              color={isFocusedItem ? 'cyan' : isActive ? 'white' : 'gray'}
            >
              {item.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

NavigationMenu.displayName = 'NavigationMenu';
export default NavigationMenu;
