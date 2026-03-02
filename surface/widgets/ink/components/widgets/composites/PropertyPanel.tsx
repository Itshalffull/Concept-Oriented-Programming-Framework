// ============================================================
// Clef Surface Ink Widget — PropertyPanel
//
// Click-to-edit property list panel displaying typed property
// rows with Name: Value format. Editable properties support
// inline editing via enter key. Bordered panel with title and
// keyboard navigation through property rows.
// Maps property-panel.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface Property {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  value: unknown;
  editable?: boolean;
}

// --------------- Props ---------------

export interface PropertyPanelProps {
  /** Array of property definitions. */
  properties: Property[];
  /** Panel title. */
  title?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when a property value changes. */
  onChange?: (name: string, value: unknown) => void;
}

// --------------- Component ---------------

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  properties,
  title = 'Properties',
  isFocused = false,
  onChange,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleEdit = useCallback(
    (index: number) => {
      const prop = properties[index];
      if (!prop || !prop.editable) return;

      if (prop.type === 'boolean') {
        // Toggle boolean directly
        onChange?.(prop.name, !prop.value);
      } else {
        // Enter edit mode (in terminal, we toggle for simplicity)
        setEditingIndex(index);
      }
    },
    [properties, onChange],
  );

  useInput(
    (input, key) => {
      if (!isFocused || properties.length === 0) return;

      if (editingIndex !== null) {
        // In edit mode, escape exits
        if (key.escape || key.return) {
          setEditingIndex(null);
        }
        return;
      }

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, properties.length - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        handleEdit(focusIndex);
      }
    },
    { isActive: isFocused },
  );

  const labelWidth = Math.max(12, ...properties.map((p) => p.name.length + 2));

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>{title}</Text>
      </Box>

      {/* Property Rows */}
      {properties.map((prop, index) => {
        const focused = isFocused && index === focusIndex;
        const editing = editingIndex === index;
        const valueStr = prop.type === 'boolean'
          ? (prop.value ? 'true' : 'false')
          : String(prop.value ?? '');

        return (
          <Box key={prop.name}>
            <Text color={focused ? 'cyan' : undefined}>
              {focused ? '\u25B6' : ' '}{' '}
            </Text>
            <Box width={labelWidth}>
              <Text bold={focused} color={focused ? 'cyan' : undefined}>
                {prop.name}
              </Text>
            </Box>
            <Text dimColor>: </Text>
            <Text
              bold={editing}
              color={
                editing
                  ? 'yellow'
                  : prop.type === 'boolean'
                    ? prop.value ? 'green' : 'red'
                    : focused ? 'cyan' : undefined
              }
              inverse={editing}
            >
              {valueStr}
            </Text>
            {prop.editable && focused && !editing && (
              <Text dimColor> (enter to edit)</Text>
            )}
            {!prop.editable && focused && (
              <Text dimColor> (read-only)</Text>
            )}
          </Box>
        );
      })}

      {properties.length === 0 && (
        <Text dimColor>No properties.</Text>
      )}
    </Box>
  );
};

PropertyPanel.displayName = 'PropertyPanel';
export default PropertyPanel;
