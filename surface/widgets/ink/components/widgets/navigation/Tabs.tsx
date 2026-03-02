// ============================================================
// Clef Surface Ink Widget — Tabs
//
// Tabbed content switcher for terminal display.
// Renders a horizontal tab strip like `[ Tab1 | Tab2 | Tab3 ]`
// with inverse styling for the active tab, arrow keys to
// navigate, and child content below. Maps tabs.widget anatomy
// (root, list, trigger, content, indicator) to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface TabsProps {
  /** Tab definitions. */
  tabs: TabItem[];
  /** ID of the currently active tab. */
  activeId?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the active tab changes. */
  onChange?: (tabId: string) => void;
  /** Content panels (rendered for the active tab). */
  children?: React.ReactNode;
}

// --------------- Component ---------------

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeId,
  isFocused = false,
  onChange,
  children,
}) => {
  const [focusIndex, setFocusIndex] = useState(() => {
    if (activeId) {
      const idx = tabs.findIndex((t) => t.id === activeId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const getNextEnabledIndex = useCallback(
    (current: number, direction: 1 | -1): number => {
      let next = current + direction;
      while (next >= 0 && next < tabs.length) {
        if (!tabs[next]?.disabled) return next;
        next += direction;
      }
      return current;
    },
    [tabs],
  );

  useInput(
    (_input, key) => {
      if (!isFocused || tabs.length === 0) return;

      if (key.rightArrow) {
        setFocusIndex((i) => {
          const next = getNextEnabledIndex(i, 1);
          const tab = tabs[next];
          if (tab) onChange?.(tab.id);
          return next;
        });
      } else if (key.leftArrow) {
        setFocusIndex((i) => {
          const next = getNextEnabledIndex(i, -1);
          const tab = tabs[next];
          if (tab) onChange?.(tab.id);
          return next;
        });
      } else if (key.return) {
        const tab = tabs[focusIndex];
        if (tab && !tab.disabled) {
          onChange?.(tab.id);
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {/* Tab strip */}
      <Box>
        <Text>[ </Text>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          const isFocusedTab = isFocused && index === focusIndex;

          return (
            <Box key={tab.id}>
              {index > 0 && <Text> | </Text>}
              <Text
                bold={isActive}
                inverse={isActive}
                color={tab.disabled ? 'gray' : isFocusedTab ? 'cyan' : undefined}
                dimColor={tab.disabled}
              >
                {tab.label}
              </Text>
            </Box>
          );
        })}
        <Text> ]</Text>
      </Box>

      {/* Content panel */}
      {children && (
        <Box marginTop={1}>
          {children}
        </Box>
      )}
    </Box>
  );
};

Tabs.displayName = 'Tabs';
export default Tabs;
