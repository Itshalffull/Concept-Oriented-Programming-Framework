// ============================================================
// Clef Surface Ink Widget — MasterDetail
//
// Split-view layout with a scrollable master list on the left
// and a detail content panel on the right separated by a
// vertical divider. Selecting an item displays its details.
// Supports keyboard navigation and empty state.
// Maps master-detail.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface MasterItem {
  id: string;
  label: string;
  description?: string;
}

// --------------- Props ---------------

export interface MasterDetailProps {
  /** Array of items for the master list. */
  items: MasterItem[];
  /** ID of the currently selected item. */
  selectedId?: string;
  /** Detail content rendered in the right pane. */
  children?: ReactNode;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is selected from the list. */
  onSelect?: (item: MasterItem) => void;
}

// --------------- Component ---------------

export const MasterDetail: React.FC<MasterDetailProps> = ({
  items,
  selectedId,
  children,
  isFocused = false,
  onSelect,
}) => {
  const [focusIndex, setFocusIndex] = useState(() => {
    const idx = items.findIndex((it) => it.id === selectedId);
    return idx >= 0 ? idx : 0;
  });

  const handleSelect = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) onSelect?.(item);
    },
    [items, onSelect],
  );

  useInput(
    (_input, key) => {
      if (!isFocused || items.length === 0) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        handleSelect(focusIndex);
      }
    },
    { isActive: isFocused },
  );

  const selectedItem = items.find((it) => it.id === selectedId);

  return (
    <Box
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
    >
      {/* Master Pane */}
      <Box flexDirection="column" width={30} paddingX={1}>
        <Box marginBottom={1}>
          <Text bold>Items</Text>
          <Text dimColor> ({items.length})</Text>
        </Box>
        {items.map((item, index) => {
          const focused = isFocused && index === focusIndex;
          const selected = item.id === selectedId;
          return (
            <Box key={item.id}>
              <Text
                bold={focused || selected}
                color={focused ? 'cyan' : selected ? 'green' : undefined}
                inverse={selected && !focused}
              >
                {focused ? '\u25B6' : selected ? '\u25CF' : ' '} {item.label}
              </Text>
            </Box>
          );
        })}
        {items.length === 0 && <Text dimColor>No items.</Text>}
      </Box>

      {/* Divider */}
      <Box flexDirection="column" width={1}>
        {Array.from({ length: Math.max(items.length + 2, 5) }, (_, i) => (
          <Text key={i} dimColor>{'\u2502'}</Text>
        ))}
      </Box>

      {/* Detail Pane */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {selectedItem ? (
          <>
            <Box marginBottom={1}>
              <Text bold>{selectedItem.label}</Text>
            </Box>
            {selectedItem.description && (
              <Box marginBottom={1}>
                <Text>{selectedItem.description}</Text>
              </Box>
            )}
            {children}
          </>
        ) : (
          <Box>
            <Text dimColor>Select an item from the list to view details.</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

MasterDetail.displayName = 'MasterDetail';
export default MasterDetail;
