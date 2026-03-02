// ============================================================
// Clef Surface Ink Widget — SortBuilder
//
// Multi-column sort priority list with ascending/descending
// direction toggles and reorder capability. Each row displays
// a field name and direction indicator. Supports adding,
// removing, toggling direction, and reordering sort criteria.
// Maps sort-builder.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface SortRule {
  field: string;
  direction: 'ascending' | 'descending';
}

export interface SortFieldDef {
  label: string;
  value: string;
}

// --------------- Props ---------------

export interface SortBuilderProps {
  /** Array of current sort rules in priority order. */
  sorts: SortRule[];
  /** Available fields for sorting. */
  fields: SortFieldDef[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new sort rule. */
  onAdd?: () => void;
  /** Callback to remove a sort rule by index. */
  onRemove?: (index: number) => void;
  /** Callback when a sort rule changes. */
  onChange?: (index: number, sort: SortRule) => void;
  /** Callback to reorder sort rules. */
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

// --------------- Component ---------------

export const SortBuilder: React.FC<SortBuilderProps> = ({
  sorts,
  fields,
  isFocused = false,
  onAdd,
  onRemove,
  onChange,
  onReorder,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  // Items: sort rows + add button
  const totalItems = sorts.length + 1;

  const toggleDirection = useCallback(
    (index: number) => {
      const sort = sorts[index];
      if (!sort) return;
      onChange?.(index, {
        ...sort,
        direction: sort.direction === 'ascending' ? 'descending' : 'ascending',
      });
    },
    [sorts, onChange],
  );

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        if (key.shift && focusIndex < sorts.length) {
          // Shift+Down to move sort rule down
          if (focusIndex < sorts.length - 1) {
            onReorder?.(focusIndex, focusIndex + 1);
            setFocusIndex((i) => i + 1);
          }
        } else {
          setFocusIndex((i) => Math.min(i + 1, totalItems - 1));
        }
      } else if (key.upArrow) {
        if (key.shift && focusIndex < sorts.length) {
          // Shift+Up to move sort rule up
          if (focusIndex > 0) {
            onReorder?.(focusIndex, focusIndex - 1);
            setFocusIndex((i) => i - 1);
          }
        } else {
          setFocusIndex((i) => Math.max(i - 1, 0));
        }
      } else if (key.return || input === ' ') {
        if (focusIndex === sorts.length) {
          onAdd?.();
        } else {
          toggleDirection(focusIndex);
        }
      } else if (key.delete || key.backspace) {
        if (focusIndex < sorts.length) {
          onRemove?.(focusIndex);
          setFocusIndex((i) => Math.max(0, Math.min(i, sorts.length - 2)));
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
        <Text bold>Sort Builder</Text>
        <Text dimColor> ({sorts.length} rules)</Text>
      </Box>

      {/* Sort Rows */}
      {sorts.map((sort, index) => {
        const focused = isFocused && index === focusIndex;
        const fieldLabel = fields.find((f) => f.value === sort.field)?.label || sort.field;
        const dirIcon = sort.direction === 'ascending' ? '\u25B2' : '\u25BC';
        const dirLabel = sort.direction === 'ascending' ? 'ASC' : 'DESC';

        return (
          <Box key={`${sort.field}-${index}`}>
            <Text color={focused ? 'cyan' : 'gray'}>
              {focused ? '\u25B6' : ' '}{' '}
            </Text>
            <Text dimColor>{index + 1}. </Text>
            <Text bold={focused} color={focused ? 'cyan' : undefined}>
              {fieldLabel}
            </Text>
            <Text> </Text>
            <Text color={sort.direction === 'ascending' ? 'green' : 'yellow'}>
              {dirIcon} {dirLabel}
            </Text>
            {focused && (
              <Text dimColor> (enter=toggle, del=remove)</Text>
            )}
          </Box>
        );
      })}

      {sorts.length === 0 && (
        <Text dimColor>No sort rules defined.</Text>
      )}

      {/* Add Sort Button */}
      <Box marginTop={1}>
        <Text
          bold={isFocused && focusIndex === sorts.length}
          inverse={isFocused && focusIndex === sorts.length}
          color={isFocused && focusIndex === sorts.length ? 'green' : 'gray'}
        >
          [+ Add Sort]
        </Text>
      </Box>
    </Box>
  );
};

SortBuilder.displayName = 'SortBuilder';
export default SortBuilder;
