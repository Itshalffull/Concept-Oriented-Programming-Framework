// ============================================================
// Clef Surface Ink Widget — ConditionBuilder
//
// Composable condition row builder for constructing filter and
// rule expressions rendered as a terminal-friendly tree of
// IF/AND/OR condition rows. Supports adding, removing, and
// navigating condition rows with keyboard.
//
// Adapts the condition-builder.widget spec: anatomy (root, rows,
// row, fieldSelector, operatorSelector, valueInput, removeButton,
// logicToggle, addButton), states, and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface Condition {
  field: string;
  operator: string;
  value: string;
  conjunction?: 'AND' | 'OR';
}

// --------------- Props ---------------

export interface ConditionBuilderProps {
  /** List of conditions. */
  conditions: Condition[];
  /** Available field names for selection. */
  fields?: string[];
  /** Available operators for selection. */
  operators?: string[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new condition. */
  onAdd?: () => void;
  /** Callback to remove a condition by index. */
  onRemove?: (index: number) => void;
  /** Callback when a condition changes. */
  onChange?: (index: number, condition: Condition) => void;
}

// --------------- Component ---------------

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  conditions,
  fields = [],
  operators = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'starts_with'],
  isFocused = false,
  onAdd,
  onRemove,
  onChange,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const totalItems = conditions.length + 1; // conditions + add button

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (selectedIndex >= conditions.length) {
          onAdd?.();
        }
      } else if (key.delete || key.backspace) {
        if (selectedIndex < conditions.length) {
          onRemove?.(selectedIndex);
          setSelectedIndex((i) => Math.max(i - 1, 0));
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {conditions.map((cond, index) => {
        const isSelected = isFocused && selectedIndex === index;
        const prefix = index === 0 ? 'IF  ' : `${cond.conjunction || 'AND'} `;

        return (
          <Box key={index}>
            <Text
              inverse={isSelected}
              bold={isSelected}
              color={isSelected ? 'cyan' : undefined}
            >
              {isSelected ? '\u276F ' : '  '}
              <Text color="yellow">{prefix}</Text>
              <Text bold>{cond.field}</Text>
              {' '}
              <Text color="magenta">{cond.operator}</Text>
              {' '}
              <Text>{cond.value}</Text>
            </Text>
            {isSelected && (
              <Text dimColor> [Del to remove]</Text>
            )}
          </Box>
        );
      })}

      <Box marginTop={conditions.length > 0 ? 0 : 0}>
        <Text
          inverse={isFocused && selectedIndex >= conditions.length}
          bold={isFocused && selectedIndex >= conditions.length}
          color="green"
        >
          {isFocused && selectedIndex >= conditions.length ? '\u276F ' : '  '}
          [+ Add Condition]
        </Text>
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text dimColor>
            {'\u2191\u2193'} navigate {'  '} Enter add {'  '} Del remove
          </Text>
        </Box>
      )}
    </Box>
  );
};

ConditionBuilder.displayName = 'ConditionBuilder';
export default ConditionBuilder;
