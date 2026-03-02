// ============================================================
// Clef Surface Ink Widget — CommandPalette
//
// Modal search overlay for rapid command execution in terminal.
// Provides keyboard-driven search input at top, filtered results
// below with arrow key navigation, enter to select, escape to
// close. Maps command-palette.widget anatomy (root, backdrop,
// input, list, group, item, etc.) to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface CommandPaletteItem {
  id: string;
  label: string;
  shortcut?: string;
  group?: string;
}

// --------------- Props ---------------

export interface CommandPaletteProps {
  /** Whether the palette is visible. */
  open?: boolean;
  /** Current search query. */
  query?: string;
  /** Available command items. */
  items: CommandPaletteItem[];
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the search query changes. */
  onQueryChange?: (query: string) => void;
  /** Callback when an item is selected. */
  onSelect?: (item: CommandPaletteItem) => void;
  /** Callback when the palette is closed. */
  onClose?: () => void;
}

// --------------- Component ---------------

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open = false,
  query = '',
  items,
  placeholder = 'Type a command...',
  isFocused = false,
  onQueryChange,
  onSelect,
  onClose,
}) => {
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(lower));
  }, [items, query]);

  // Group items by their group property
  const groups = useMemo(() => {
    const map = new Map<string, CommandPaletteItem[]>();
    for (const item of filtered) {
      const group = item.group || '';
      const arr = map.get(group) || [];
      arr.push(item);
      map.set(group, arr);
    }
    return map;
  }, [filtered]);

  const handleSelect = useCallback(
    (index: number) => {
      const item = filtered[index];
      if (item) {
        onSelect?.(item);
      }
    },
    [filtered, onSelect],
  );

  useInput(
    (input, key) => {
      if (!isFocused || !open) return;

      if (key.escape) {
        onClose?.();
        return;
      }

      if (key.downArrow) {
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (key.upArrow) {
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        handleSelect(highlightIndex);
      } else if (key.backspace || key.delete) {
        const next = query.slice(0, -1);
        onQueryChange?.(next);
        setHighlightIndex(0);
      } else if (input && !key.ctrl && !key.meta) {
        const next = query + input;
        onQueryChange?.(next);
        setHighlightIndex(0);
      }
    },
    { isActive: isFocused && open },
  );

  if (!open) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="cyan">{'\u276F'} </Text>
        {query ? (
          <Text>{query}</Text>
        ) : (
          <Text dimColor>{placeholder}</Text>
        )}
      </Box>

      {/* Results */}
      {filtered.length === 0 ? (
        <Box>
          <Text dimColor>No results found.</Text>
        </Box>
      ) : (
        Array.from(groups.entries()).map(([group, groupItems]) => (
          <Box key={group} flexDirection="column">
            {group && (
              <Box marginBottom={0}>
                <Text dimColor bold>{group}</Text>
              </Box>
            )}
            {groupItems.map((item) => {
              const globalIndex = filtered.indexOf(item);
              const isHighlighted = globalIndex === highlightIndex;
              return (
                <Box key={item.id}>
                  <Text color={isHighlighted ? 'cyan' : undefined}>
                    {isHighlighted ? '\u276F' : ' '}{' '}
                  </Text>
                  <Text bold={isHighlighted} color={isHighlighted ? 'cyan' : undefined}>
                    {item.label}
                  </Text>
                  {item.shortcut && (
                    <Text dimColor> {item.shortcut}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
        ))
      )}
    </Box>
  );
};

CommandPalette.displayName = 'CommandPalette';
export default CommandPalette;
