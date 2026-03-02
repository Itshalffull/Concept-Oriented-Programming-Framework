// ============================================================
// Clef Surface Ink Widget — List
//
// Vertical list displaying a collection of items with optional
// selection, icons, and descriptions. Supports keyboard
// navigation with roving focus. Terminal adaptation: vertical
// list with cursor indicator, dimColor for descriptions.
// See widget spec: repertoire/widgets/data-display/list.widget
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ListItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

// --------------- Props ---------------

export interface ListProps {
  /** Array of items to display. */
  items: ListItem[];
  /** Whether items are selectable. */
  selectable?: boolean;
  /** Currently selected item ID. */
  selectedId?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is selected. */
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

export const List: React.FC<ListProps> = ({
  items,
  selectable = false,
  selectedId,
  isFocused = false,
  onSelect,
}) => {
  const [focusIndex, setFocusIndex] = useState(() => {
    if (selectedId) {
      const idx = items.findIndex((item) => item.id === selectedId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const handleSelect = useCallback(
    (id: string) => {
      if (!selectable) return;
      onSelect?.(id);
    },
    [selectable, onSelect],
  );

  useInput(
    (input, key) => {
      if (!isFocused || items.length === 0) return;

      if (key.upArrow) {
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setFocusIndex((i) => Math.min(items.length - 1, i + 1));
      } else if (key.return || input === ' ') {
        const item = items[focusIndex];
        if (item) handleSelect(item.id);
      }
    },
    { isActive: isFocused },
  );

  if (items.length === 0) {
    return <Text dimColor>No items</Text>;
  }

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isItemFocused = isFocused && index === focusIndex;
        const isSelected = item.id === selectedId;

        return (
          <Box key={item.id} flexDirection="column">
            <Box>
              {/* Cursor indicator */}
              <Text color={isItemFocused ? 'cyan' : undefined}>
                {isItemFocused ? '\u276F ' : '  '}
              </Text>

              {/* Icon */}
              {item.icon && (
                <Text>{item.icon} </Text>
              )}

              {/* Label */}
              <Text
                bold={isSelected}
                color={isItemFocused ? 'cyan' : isSelected ? 'green' : undefined}
              >
                {item.label}
              </Text>

              {/* Selection marker */}
              {selectable && isSelected && (
                <Text color="green"> \u2714</Text>
              )}
            </Box>

            {/* Description */}
            {item.description && (
              <Box marginLeft={isItemFocused ? 4 : 4}>
                <Text dimColor>{item.description}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

List.displayName = 'List';
export default List;
