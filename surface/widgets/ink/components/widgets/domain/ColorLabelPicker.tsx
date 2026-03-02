// ============================================================
// Clef Surface Ink Widget — ColorLabelPicker
//
// Colored tag and label selector rendered in the terminal as a
// grid of colored swatches with labels. Arrow keys navigate the
// options, enter toggles selection. Supports multi-select and
// search filtering.
//
// Adapts the color-label-picker.widget spec: anatomy (root,
// trigger, panel, search, options, option, colorSwatch,
// optionLabel, createButton), states, and connect attributes.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface ColorLabel {
  name: string;
  hex: string;
}

// --------------- Props ---------------

export interface ColorLabelPickerProps {
  /** Currently selected label name. */
  value?: string;
  /** Available color labels. */
  colors: ColorLabel[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a color label is selected. */
  onChange?: (name: string) => void;
}

// --------------- Helpers ---------------

const HEX_TO_INK: Record<string, string> = {
  '#ff0000': 'red',
  '#00ff00': 'green',
  '#0000ff': 'blue',
  '#ffff00': 'yellow',
  '#ff00ff': 'magenta',
  '#00ffff': 'cyan',
  '#ffffff': 'white',
  '#808080': 'gray',
};

function hexToInkColor(hex: string): string | undefined {
  const lower = hex.toLowerCase();
  return HEX_TO_INK[lower];
}

// --------------- Component ---------------

export const ColorLabelPicker: React.FC<ColorLabelPickerProps> = ({
  value,
  colors,
  isFocused = false,
  onChange,
}) => {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return colors;
    const lower = filter.toLowerCase();
    return colors.filter((c) => c.name.toLowerCase().includes(lower));
  }, [colors, filter]);

  // Grid layout: 4 columns
  const columns = 4;

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.rightArrow) {
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (key.leftArrow) {
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (key.downArrow) {
        setHighlightIndex((i) => Math.min(i + columns, filtered.length - 1));
      } else if (key.upArrow) {
        setHighlightIndex((i) => Math.max(i - columns, 0));
      } else if (key.return) {
        const item = filtered[highlightIndex];
        if (item) onChange?.(item.name);
      } else if (key.backspace || key.delete) {
        setFilter((f) => f.slice(0, -1));
        setHighlightIndex(0);
      } else if (input && !key.ctrl && !key.meta) {
        setFilter((f) => f + input);
        setHighlightIndex(0);
      }
    },
    { isActive: isFocused },
  );

  // Break into rows
  const rows: ColorLabel[][] = [];
  for (let i = 0; i < filtered.length; i += columns) {
    rows.push(filtered.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? 'cyan' : 'gray'} paddingX={1}>
      {/* Filter */}
      {filter && (
        <Box marginBottom={1}>
          <Text color="cyan">Filter: </Text>
          <Text>{filter}</Text>
        </Box>
      )}

      {/* Color grid */}
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} gap={1}>
          {row.map((item) => {
            const globalIndex = filtered.indexOf(item);
            const isHighlighted = isFocused && globalIndex === highlightIndex;
            const isSelected = item.name === value;
            const inkColor = hexToInkColor(item.hex);

            return (
              <Box key={item.name} width={16}>
                <Text color={inkColor as any}>
                  {isSelected ? '\u2588' : '\u2591'}
                </Text>
                <Text
                  inverse={isHighlighted}
                  bold={isHighlighted || isSelected}
                  color={isHighlighted ? 'cyan' : undefined}
                >
                  {' '}{item.name}
                  {isSelected ? ' \u2713' : ''}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      {filtered.length === 0 && (
        <Text dimColor>No matching colors.</Text>
      )}
    </Box>
  );
};

ColorLabelPicker.displayName = 'ColorLabelPicker';
export default ColorLabelPicker;
