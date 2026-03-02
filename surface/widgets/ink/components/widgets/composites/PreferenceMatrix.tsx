// ============================================================
// Clef Surface Ink Widget — PreferenceMatrix
//
// Grouped preference grid with category headers and toggle
// controls for each preference item. Categories contain named
// preferences with their current values. Keyboard-driven
// navigation through grouped rows with toggle/select controls.
// Maps preference-matrix.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface Preference {
  key: string;
  label: string;
  type: 'toggle' | 'select';
  options?: string[];
}

export interface PreferenceCategory {
  name: string;
  preferences: Preference[];
}

// --------------- Props ---------------

export interface PreferenceMatrixProps {
  /** Array of preference categories with their items. */
  categories: PreferenceCategory[];
  /** Current preference values keyed by preference key. */
  values: Record<string, unknown>;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a preference value changes. */
  onChange?: (key: string, value: unknown) => void;
}

// --------------- Component ---------------

interface FlatPref {
  category: string;
  pref: Preference;
  isFirstInCategory: boolean;
}

export const PreferenceMatrix: React.FC<PreferenceMatrixProps> = ({
  categories,
  values,
  isFocused = false,
  onChange,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);

  // Flatten all preferences for linear navigation
  const flatPrefs: FlatPref[] = categories.flatMap((cat) =>
    cat.preferences.map((pref, i) => ({
      category: cat.name,
      pref,
      isFirstInCategory: i === 0,
    })),
  );

  const handleToggle = useCallback(
    (index: number) => {
      const item = flatPrefs[index];
      if (!item) return;

      const { pref } = item;
      const current = values[pref.key];

      if (pref.type === 'toggle') {
        onChange?.(pref.key, !current);
      } else if (pref.type === 'select' && pref.options && pref.options.length > 0) {
        const currentIdx = pref.options.indexOf(current as string);
        const nextIdx = (currentIdx + 1) % pref.options.length;
        onChange?.(pref.key, pref.options[nextIdx]);
      }
    },
    [flatPrefs, values, onChange],
  );

  useInput(
    (input, key) => {
      if (!isFocused || flatPrefs.length === 0) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, flatPrefs.length - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return || input === ' ') {
        handleToggle(focusIndex);
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
        <Text bold>Preferences</Text>
      </Box>

      {flatPrefs.map((item, index) => {
        const focused = isFocused && index === focusIndex;
        const val = values[item.pref.key];

        return (
          <Box key={item.pref.key} flexDirection="column">
            {/* Category Header */}
            {item.isFirstInCategory && (
              <Box marginTop={index > 0 ? 1 : 0}>
                <Text bold dimColor>{'\u2500\u2500'} {item.category} {'\u2500\u2500'}</Text>
              </Box>
            )}

            {/* Preference Row */}
            <Box>
              <Text color={focused ? 'cyan' : undefined}>
                {focused ? '\u25B6' : ' '}{' '}
              </Text>
              <Box width={24}>
                <Text bold={focused} color={focused ? 'cyan' : undefined}>
                  {item.pref.label}
                </Text>
              </Box>
              <Text>: </Text>
              {item.pref.type === 'toggle' ? (
                <Text color={val ? 'green' : 'red'}>
                  {val ? '[ON]' : '[OFF]'}
                </Text>
              ) : (
                <Text color={focused ? 'cyan' : undefined}>
                  [{String(val || item.pref.options?.[0] || '?')} {'\u25BC'}]
                </Text>
              )}
            </Box>
          </Box>
        );
      })}

      {flatPrefs.length === 0 && (
        <Text dimColor>No preferences.</Text>
      )}
    </Box>
  );
};

PreferenceMatrix.displayName = 'PreferenceMatrix';
export default PreferenceMatrix;
