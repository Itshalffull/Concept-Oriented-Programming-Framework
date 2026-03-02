// ============================================================
// Clef Surface Ink Widget — ViewToggle
//
// Compact segmented control for switching between display modes
// such as grid, list, table, or calendar views. Renders as a
// radio group with icon-labelled options. Terminal adaptation:
// bracket-delimited toggle buttons with active state highlighting.
// See widget spec: repertoire/widgets/data-display/view-toggle.widget
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ViewOption {
  id: string;
  label: string;
  icon?: string;
}

// --------------- Props ---------------

export interface ViewToggleProps {
  /** Available view options. */
  views: ViewOption[];
  /** Currently active view ID. */
  activeView: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the active view changes. */
  onChange?: (viewId: string) => void;
}

// --------------- Component ---------------

export const ViewToggle: React.FC<ViewToggleProps> = ({
  views,
  activeView,
  isFocused = false,
  onChange,
}) => {
  const [focusIndex, setFocusIndex] = useState(() => {
    const idx = views.findIndex((v) => v.id === activeView);
    return idx >= 0 ? idx : 0;
  });

  const selectView = useCallback(
    (id: string) => {
      onChange?.(id);
    },
    [onChange],
  );

  useInput(
    (input, key) => {
      if (!isFocused || views.length === 0) return;

      if (key.leftArrow || key.upArrow) {
        setFocusIndex((i) => (i - 1 + views.length) % views.length);
      } else if (key.rightArrow || key.downArrow) {
        setFocusIndex((i) => (i + 1) % views.length);
      } else if (key.return || input === ' ') {
        const view = views[focusIndex];
        if (view) selectView(view.id);
      }
    },
    { isActive: isFocused },
  );

  if (views.length === 0) {
    return <Text dimColor>No views</Text>;
  }

  return (
    <Box>
      <Text>[</Text>
      {views.map((view, index) => {
        const isActive = view.id === activeView;
        const isItemFocused = isFocused && index === focusIndex;
        const separator = index < views.length - 1 ? ' | ' : '';

        return (
          <React.Fragment key={view.id}>
            <Text
              bold={isActive}
              color={isItemFocused ? 'cyan' : isActive ? 'green' : undefined}
              inverse={isItemFocused}
            >
              {view.icon ? `${view.icon} ` : ''}{view.label}
            </Text>
            {separator && <Text dimColor>{separator}</Text>}
          </React.Fragment>
        );
      })}
      <Text>]</Text>
    </Box>
  );
};

ViewToggle.displayName = 'ViewToggle';
export default ViewToggle;
