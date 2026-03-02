// ============================================================
// Clef Surface Ink Widget — Outliner
//
// Infinitely nested bullet-list outliner rendered in the terminal
// with indentation, collapse/expand toggles, and keyboard-driven
// navigation. Tab/Shift+Tab indent/outdent items.
//
// Adapts the outliner.widget spec: anatomy (root, breadcrumb,
// item, bullet, collapseToggle, content, children, dragHandle),
// states (expanded/collapsed, editing, zoom, drag), and connect
// attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface OutlinerItem {
  id: string;
  text: string;
  level: number;
  collapsed?: boolean;
}

// --------------- Props ---------------

export interface OutlinerProps {
  /** Flat list of outline items with nesting levels. */
  items: OutlinerItem[];
  /** ID of the currently selected item. */
  selectedId?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when an item is selected. */
  onSelect?: (id: string) => void;
  /** Callback to indent an item. */
  onIndent?: (id: string) => void;
  /** Callback to outdent an item. */
  onOutdent?: (id: string) => void;
  /** Callback to toggle collapse/expand. */
  onToggle?: (id: string) => void;
}

// --------------- Helpers ---------------

function getVisibleItems(items: OutlinerItem[]): OutlinerItem[] {
  const visible: OutlinerItem[] = [];
  let skipLevel = -1;

  for (const item of items) {
    if (skipLevel >= 0 && item.level > skipLevel) {
      continue;
    }
    skipLevel = -1;

    visible.push(item);

    if (item.collapsed) {
      skipLevel = item.level;
    }
  }

  return visible;
}

function hasChildren(items: OutlinerItem[], index: number): boolean {
  const item = items[index];
  if (!item || index >= items.length - 1) return false;
  return items[index + 1].level > item.level;
}

// --------------- Component ---------------

export const Outliner: React.FC<OutlinerProps> = ({
  items,
  selectedId,
  isFocused = false,
  onSelect,
  onIndent,
  onOutdent,
  onToggle,
}) => {
  const visibleItems = getVisibleItems(items);

  const [focusedIndex, setFocusedIndex] = useState(() => {
    if (selectedId) {
      const idx = visibleItems.findIndex((i) => i.id === selectedId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setFocusedIndex((i) => Math.min(i + 1, visibleItems.length - 1));
      } else if (key.upArrow) {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        const item = visibleItems[focusedIndex];
        if (item) onSelect?.(item.id);
      } else if (key.tab && !key.shift) {
        const item = visibleItems[focusedIndex];
        if (item) onIndent?.(item.id);
      } else if (key.tab && key.shift) {
        const item = visibleItems[focusedIndex];
        if (item) onOutdent?.(item.id);
      } else if (input === ' ') {
        const item = visibleItems[focusedIndex];
        if (item) onToggle?.(item.id);
      } else if (key.rightArrow) {
        // Expand
        const item = visibleItems[focusedIndex];
        if (item && item.collapsed) onToggle?.(item.id);
      } else if (key.leftArrow) {
        // Collapse
        const item = visibleItems[focusedIndex];
        if (item && !item.collapsed && hasChildren(items, items.indexOf(item))) {
          onToggle?.(item.id);
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {visibleItems.map((item, index) => {
        const isFocusedItem = isFocused && focusedIndex === index;
        const isSelected = item.id === selectedId;
        const indent = '  '.repeat(item.level);
        const itemHasChildren = hasChildren(items, items.indexOf(item));
        const collapseIcon = itemHasChildren
          ? item.collapsed ? '\u25B6 ' : '\u25BC '
          : '\u2022 ';

        return (
          <Box key={item.id}>
            <Text>
              {indent}
            </Text>
            <Text
              color={isFocusedItem ? 'cyan' : isSelected ? 'yellow' : 'gray'}
            >
              {collapseIcon}
            </Text>
            <Text
              inverse={isSelected}
              bold={isFocusedItem || isSelected}
              color={isFocusedItem ? 'cyan' : undefined}
            >
              {item.text}
            </Text>
          </Box>
        );
      })}

      {items.length === 0 && (
        <Text dimColor>New item...</Text>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Tab indent {'  '} Shift+Tab
            outdent {'  '} Space toggle {'  '} {'\u2190\u2192'} collapse/expand
          </Text>
        </Box>
      )}
    </Box>
  );
};

Outliner.displayName = 'Outliner';
export default Outliner;
