// ============================================================
// Clef Surface Ink Widget — BacklinkPanel
//
// Incoming reference panel displaying pages or blocks linking
// to the current document. Shows linked references with source
// breadcrumb and context snippet, plus unlinked mentions that
// can be converted to links. Keyboard-driven arrow navigation,
// enter to select. Maps backlink-panel.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface Backlink {
  title: string;
  source: string;
  excerpt: string;
}

// --------------- Props ---------------

export interface BacklinkPanelProps {
  /** Array of backlink references. */
  backlinks: Backlink[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a backlink is selected via enter. */
  onSelect?: (backlink: Backlink) => void;
}

// --------------- Component ---------------

export const BacklinkPanel: React.FC<BacklinkPanelProps> = ({
  backlinks,
  isFocused = false,
  onSelect,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);

  const handleSelect = useCallback(
    (index: number) => {
      const backlink = backlinks[index];
      if (backlink) onSelect?.(backlink);
    },
    [backlinks, onSelect],
  );

  useInput(
    (_input, key) => {
      if (!isFocused || backlinks.length === 0) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, backlinks.length - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        handleSelect(focusIndex);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold>Backlinks</Text>
        <Text dimColor> ({backlinks.length})</Text>
      </Box>

      {backlinks.length === 0 && (
        <Text dimColor>No backlinks found.</Text>
      )}

      {backlinks.map((bl, index) => {
        const focused = isFocused && index === focusIndex;
        return (
          <Box key={`${bl.source}-${index}`} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={focused ? 'cyan' : 'gray'}>{'\u2192'} </Text>
              <Text bold={focused} color={focused ? 'cyan' : undefined}>
                {bl.title}
              </Text>
              <Text dimColor> ({bl.source})</Text>
            </Box>
            <Box marginLeft={3}>
              <Text dimColor wrap="truncate-end">{bl.excerpt}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

BacklinkPanel.displayName = 'BacklinkPanel';
export default BacklinkPanel;
