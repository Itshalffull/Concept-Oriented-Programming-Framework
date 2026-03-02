// ============================================================
// Clef Surface Ink Widget — ContextMenu
//
// Contextual action menu rendered as a bordered list in the
// terminal. Supports keyboard navigation with arrow keys,
// Enter/Space to select, and Escape to close. Items can be
// disabled or marked as destructive (danger). Shortcut hints
// are right-aligned.
//
// Terminal adaptation: no right-click or pointer events;
// entirely keyboard-driven. Arrow keys wrap around.
// See widget spec: repertoire/widgets/feedback/context-menu.widget
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ContextMenuItem {
  /** Display label for the menu item. */
  label: string;
  /** Optional keyboard shortcut hint displayed right-aligned. */
  shortcut?: string;
  /** Whether this item is disabled (focusable but not activatable). */
  disabled?: boolean;
  /** Whether this item represents a destructive/dangerous action. */
  danger?: boolean;
}

// --------------- Props ---------------

export interface ContextMenuProps {
  /** Whether the context menu is open. */
  open?: boolean;
  /** List of menu items to display. */
  items: ContextMenuItem[];
  /** Whether this component is focused and receives keyboard input. */
  isFocused?: boolean;
  /** Callback fired when an item is selected, with the item index. */
  onSelect?: (index: number) => void;
  /** Callback fired when the menu is closed. */
  onClose?: () => void;
  /** Width of the menu in columns. */
  width?: number;
}

// --------------- Component ---------------

export const ContextMenu: React.FC<ContextMenuProps> = ({
  open = false,
  items,
  isFocused = true,
  onSelect,
  onClose,
  width = 30,
}) => {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useInput(
    (_input, key) => {
      if (key.escape) {
        onClose?.();
        return;
      }

      if (key.upArrow) {
        setHighlightedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
        return;
      }

      if (key.downArrow) {
        setHighlightedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
        return;
      }

      if (key.return) {
        const item = items[highlightedIndex];
        if (item && !item.disabled) {
          onSelect?.(highlightedIndex);
        }
        return;
      }
    },
    { isActive: isFocused && open },
  );

  if (!open || items.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      width={width}
      paddingX={0}
      paddingY={0}
    >
      {items.map((item, index) => {
        const isHighlighted = index === highlightedIndex;
        const innerWidth = width - 4; // account for border + padding

        let labelColor: string | undefined;
        if (item.disabled) {
          labelColor = 'gray';
        } else if (item.danger) {
          labelColor = 'red';
        }

        return (
          <Box key={`${item.label}-${index}`} paddingX={1}>
            {/* Selection indicator */}
            <Text color="cyan">{isHighlighted ? '\u276F ' : '  '}</Text>

            {/* Item label */}
            <Text
              bold={isHighlighted && !item.disabled}
              inverse={isHighlighted}
              color={labelColor}
              dimColor={item.disabled}
            >
              {item.label}
            </Text>

            {/* Spacer */}
            <Box flexGrow={1} />

            {/* Shortcut hint */}
            {item.shortcut && (
              <Text dimColor>{item.shortcut}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

ContextMenu.displayName = 'ContextMenu';
export default ContextMenu;
