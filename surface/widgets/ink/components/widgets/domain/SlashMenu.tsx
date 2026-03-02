// ============================================================
// Clef Surface Ink Widget — SlashMenu
//
// Filterable block-type palette triggered by "/" in a block
// editor, rendered in the terminal. Shows a "/" prefix with a
// filtered list of items below, arrow navigation to highlight,
// and enter to select.
//
// Adapts the slash-menu.widget spec: anatomy (root, input,
// groups, group, groupLabel, item, itemIcon, itemLabel,
// itemDescription), states, and connect attributes.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface SlashMenuItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
}

// --------------- Props ---------------

export interface SlashMenuProps {
  /** Current filter query. */
  query?: string;
  /** Available menu items. */
  items: SlashMenuItem[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is selected. */
  onSelect?: (item: SlashMenuItem) => void;
  /** Callback when the menu is closed. */
  onClose?: () => void;
}

// --------------- Component ---------------

export const SlashMenu: React.FC<SlashMenuProps> = ({
  query = '',
  items,
  isFocused = false,
  onSelect,
  onClose,
}) => {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [localQuery, setLocalQuery] = useState(query);

  const filtered = useMemo(() => {
    if (!localQuery) return items;
    const lower = localQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        (item.description && item.description.toLowerCase().includes(lower))
    );
  }, [items, localQuery]);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.escape) {
        onClose?.();
        return;
      }

      if (key.downArrow) {
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (key.upArrow) {
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        const item = filtered[highlightIndex];
        if (item) onSelect?.(item);
      } else if (key.backspace || key.delete) {
        setLocalQuery((q) => q.slice(0, -1));
        setHighlightIndex(0);
      } else if (input && !key.ctrl && !key.meta) {
        setLocalQuery((q) => q + input);
        setHighlightIndex(0);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="cyan">/ </Text>
        {localQuery ? (
          <Text>{localQuery}</Text>
        ) : (
          <Text dimColor>Filter...</Text>
        )}
      </Box>

      {/* Results */}
      {filtered.length === 0 ? (
        <Text dimColor>No matching commands.</Text>
      ) : (
        filtered.map((item, index) => {
          const isHighlighted = index === highlightIndex;

          return (
            <Box key={item.id}>
              <Text color={isHighlighted ? 'cyan' : undefined}>
                {isHighlighted ? '\u276F' : ' '}{' '}
              </Text>
              <Text bold={isHighlighted} color={isHighlighted ? 'cyan' : undefined}>
                {item.label}
              </Text>
              {item.description && (
                <Text dimColor> {item.description}</Text>
              )}
              {item.shortcut && (
                <Text dimColor color="yellow"> [{item.shortcut}]</Text>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
};

SlashMenu.displayName = 'SlashMenu';
export default SlashMenu;
