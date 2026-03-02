// ============================================================
// Clef Surface Ink Widget — Sidebar
//
// Collapsible side panel with persistent navigation for
// terminal display. Renders a vertical list of navigation
// items with a right border, active indicators, and
// expandable nested groups. Supports full and collapsed modes.
// Maps sidebar.widget anatomy (root, header, content, footer,
// toggleButton, group, item, etc.) to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  children?: SidebarItem[];
}

// --------------- Props ---------------

export interface SidebarProps {
  /** Navigation items. */
  items: SidebarItem[];
  /** Whether the sidebar is collapsed to icon-only mode. */
  collapsed?: boolean;
  /** ID of the currently active item. */
  activeId?: string;
  /** Width in columns when expanded. */
  width?: number;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a navigation item is selected. */
  onNavigate?: (item: SidebarItem) => void;
  /** Callback when the collapse toggle is triggered. */
  onToggle?: () => void;
}

// --------------- Helpers ---------------

function flattenItems(items: SidebarItem[], expandedGroups: Set<string>): { item: SidebarItem; depth: number }[] {
  const result: { item: SidebarItem; depth: number }[] = [];
  for (const item of items) {
    result.push({ item, depth: 0 });
    if (item.children && expandedGroups.has(item.id)) {
      for (const child of item.children) {
        result.push({ item: child, depth: 1 });
      }
    }
  }
  return result;
}

// --------------- Component ---------------

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  collapsed = false,
  activeId,
  width = 24,
  isFocused = false,
  onNavigate,
  onToggle,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const flatItems = flattenItems(items, expandedGroups);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useInput(
    (input, key) => {
      if (!isFocused || flatItems.length === 0) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return || input === ' ') {
        const entry = flatItems[focusIndex];
        if (entry) {
          if (entry.item.children && entry.item.children.length > 0) {
            toggleGroup(entry.item.id);
          } else {
            onNavigate?.(entry.item);
          }
        }
      } else if (input === 'c' && onToggle) {
        onToggle();
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box
      flexDirection="column"
      width={collapsed ? 4 : width}
      borderStyle="single"
      borderRight
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderColor="gray"
    >
      {flatItems.map((entry, index) => {
        const { item, depth } = entry;
        const isActive = item.id === activeId;
        const isFocusedItem = isFocused && index === focusIndex;
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedGroups.has(item.id);

        if (collapsed) {
          return (
            <Box key={item.id}>
              <Text color={isActive ? 'cyan' : isFocusedItem ? 'yellow' : undefined}>
                {isActive ? '\u25B8' : ' '}{' '}
                {item.icon || item.label.charAt(0)}
              </Text>
            </Box>
          );
        }

        return (
          <Box key={item.id} marginLeft={depth * 2}>
            <Text color={isActive ? 'cyan' : isFocusedItem ? 'yellow' : undefined}>
              {isActive ? '\u25B8' : hasChildren ? (isExpanded ? '\u25BE' : '\u25B8') : ' '}{' '}
            </Text>
            <Text
              bold={isActive || isFocusedItem}
              color={isActive ? 'cyan' : isFocusedItem ? 'yellow' : undefined}
            >
              {item.icon ? `${item.icon} ` : ''}{item.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

Sidebar.displayName = 'Sidebar';
export default Sidebar;
