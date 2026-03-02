// ============================================================
// Clef Surface Ink Widget — FilterBuilder
//
// Visual query builder for constructing compound filter
// expressions. Displays a list of filter rows each with field
// selector, operator selector, and value input. Supports
// adding and removing filter rows. Terminal rendering with
// keyboard-driven navigation.
// Maps filter-builder.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface FilterRow {
  field: string;
  operator: string;
  value: string;
}

export interface FieldDef {
  label: string;
  value: string;
}

export interface OperatorDef {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface FilterBuilderProps {
  /** Array of active filter rows. */
  filters: FilterRow[];
  /** Available fields for filtering. */
  fields: FieldDef[];
  /** Available comparison operators. */
  operators: OperatorDef[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new filter row. */
  onAdd?: () => void;
  /** Callback to remove a filter row by index. */
  onRemove?: (index: number) => void;
  /** Callback when a filter row changes. */
  onChange?: (index: number, filter: FilterRow) => void;
}

// --------------- Component ---------------

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  filters,
  fields,
  operators,
  isFocused = false,
  onAdd,
  onRemove,
  onChange,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  // Total items: filter rows + add button
  const totalItems = filters.length + 1;

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (focusIndex === filters.length) {
          // Add button
          onAdd?.();
        }
      } else if (key.delete || key.backspace) {
        if (focusIndex < filters.length) {
          onRemove?.(focusIndex);
          setFocusIndex((i) => Math.max(0, Math.min(i, filters.length - 2)));
        }
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
        <Text bold>Filter Builder</Text>
        <Text dimColor> ({filters.length} active)</Text>
      </Box>

      {/* Filter Rows */}
      {filters.map((filter, index) => {
        const focused = isFocused && index === focusIndex;
        const fieldLabel = fields.find((f) => f.value === filter.field)?.label || filter.field;
        const opLabel = operators.find((o) => o.value === filter.operator)?.label || filter.operator;

        return (
          <Box key={index} marginBottom={index < filters.length - 1 ? 0 : 0}>
            <Text color={focused ? 'cyan' : 'gray'}>
              {focused ? '\u25B6' : ' '}{' '}
            </Text>
            <Text bold={focused} color={focused ? 'cyan' : undefined}>
              [{fieldLabel} {'\u25BC'}]
            </Text>
            <Text> </Text>
            <Text bold={focused} color={focused ? 'cyan' : undefined}>
              [{opLabel} {'\u25BC'}]
            </Text>
            <Text> </Text>
            <Text bold={focused} color={focused ? 'cyan' : undefined}>
              [{filter.value || '...'}]
            </Text>
            <Text> </Text>
            <Text dimColor color={focused ? 'red' : 'gray'}>[x]</Text>
          </Box>
        );
      })}

      {filters.length === 0 && (
        <Text dimColor>No filters defined.</Text>
      )}

      {/* Add Filter Button */}
      <Box marginTop={1}>
        <Text
          bold={isFocused && focusIndex === filters.length}
          inverse={isFocused && focusIndex === filters.length}
          color={isFocused && focusIndex === filters.length ? 'green' : 'gray'}
        >
          [+ Add Filter]
        </Text>
      </Box>
    </Box>
  );
};

FilterBuilder.displayName = 'FilterBuilder';
export default FilterBuilder;
