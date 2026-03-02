// ============================================================
// Clef Surface Ink Widget — ViewSwitcher
//
// Multi-view toggle bar presenting available view modes as a
// horizontal tab strip. Active view is shown with inverse
// styling. Keyboard left/right navigation to switch views.
// Maps view-switcher.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ViewDef {
  id: string;
  label: string;
  icon?: string;
}

// --------------- Props ---------------

export interface ViewSwitcherProps {
  /** Array of available views. */
  views: ViewDef[];
  /** ID of the currently active view. */
  activeView: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the active view changes. */
  onChange?: (viewId: string) => void;
}

// --------------- Component ---------------

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views,
  activeView,
  isFocused = false,
  onChange,
}) => {
  const [focusIndex, setFocusIndex] = useState(() => {
    const idx = views.findIndex((v) => v.id === activeView);
    return idx >= 0 ? idx : 0;
  });

  useInput(
    (_input, key) => {
      if (!isFocused || views.length === 0) return;

      if (key.rightArrow) {
        setFocusIndex((i) => Math.min(i + 1, views.length - 1));
      } else if (key.leftArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return || _input === ' ') {
        const view = views[focusIndex];
        if (view) onChange?.(view.id);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box>
      <Text dimColor>[ </Text>
      {views.map((view, index) => {
        const isActive = view.id === activeView;
        const focused = isFocused && index === focusIndex;

        return (
          <Box key={view.id}>
            {index > 0 && <Text dimColor> | </Text>}
            <Text
              bold={isActive || focused}
              inverse={isActive}
              color={focused && !isActive ? 'cyan' : undefined}
              underline={focused && !isActive}
            >
              {view.icon ? `${view.icon} ` : ''}{view.label}
            </Text>
          </Box>
        );
      })}
      <Text dimColor> ]</Text>
    </Box>
  );
};

ViewSwitcher.displayName = 'ViewSwitcher';
export default ViewSwitcher;
