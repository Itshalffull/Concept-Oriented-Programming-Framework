// ============================================================
// Clef Surface Ink Widget — ThemeSwitch
//
// Interactive theme selector rendered in the terminal using Ink.
// Displays available themes as a navigable list with the active
// theme highlighted. Uses useInput for keyboard navigation.
// ============================================================

import React, { useState, useCallback, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ThemeConfig } from '../../shared/types.js';

// --------------- Props ---------------

export interface ThemeSwitchProps {
  /** Available theme configurations. */
  themes: ThemeConfig[];
  /** Initially selected theme index. */
  initialIndex?: number;
  /** Callback when a theme is activated. */
  onSelect?: (theme: ThemeConfig, index: number) => void;
  /** Title displayed above the theme list. */
  title?: string;
  /** Whether this component is focused and receives input. */
  isFocused?: boolean;
  /** Accent color for highlight. */
  accentColor?: string;
  /** Whether to show theme priority numbers. */
  showPriority?: boolean;
}

// --------------- Component ---------------

export const ThemeSwitch: React.FC<ThemeSwitchProps> = ({
  themes: initialThemes,
  initialIndex = 0,
  onSelect,
  title = 'Theme Selector',
  isFocused = true,
  accentColor = '#00d4aa',
  showPriority = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [themes, setThemes] = useState(initialThemes);

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => Math.min(themes.length - 1, i + 1));
      } else if (key.return || input === ' ') {
        const updated = themes.map((t, i) => ({ ...t, active: i === selectedIndex }));
        setThemes(updated);
        onSelect?.(updated[selectedIndex], selectedIndex);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color={accentColor}>
        {title}
      </Text>
      <Text dimColor>{'─'.repeat(36)}</Text>

      {themes.map((theme, i) => {
        const isSelected = i === selectedIndex;
        const isActive = theme.active;

        let prefix: ReactNode;
        if (isSelected && isActive) {
          prefix = (
            <Text bold color={accentColor}>
              {'❯ ● '}
            </Text>
          );
        } else if (isSelected) {
          prefix = (
            <Text bold color="cyan">
              {'❯   '}
            </Text>
          );
        } else if (isActive) {
          prefix = (
            <Text color="green">{'  ● '}</Text>
          );
        } else {
          prefix = <Text dimColor>{'  ○ '}</Text>;
        }

        return (
          <Box key={theme.name}>
            {prefix}
            <Text bold={isSelected}>
              {theme.name}
            </Text>
            {showPriority && (
              <Text dimColor> (p:{theme.priority})</Text>
            )}
            {theme.base && (
              <Text dimColor> ← {theme.base}</Text>
            )}
            {isActive && (
              <Text color="green"> [active]</Text>
            )}
          </Box>
        );
      })}

      <Text dimColor>{'─'.repeat(36)}</Text>
      <Text dimColor> ↑/↓ navigate  ⏎ select</Text>
    </Box>
  );
};

ThemeSwitch.displayName = 'ThemeSwitch';
export default ThemeSwitch;
