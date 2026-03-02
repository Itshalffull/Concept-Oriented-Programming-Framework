// ============================================================
// Clef Surface Ink Widget — SchemaEditor
//
// Field type and validation builder for defining schemas.
// Displays a reorderable list of field rows each with a name,
// type indicator, and optional required badge. Supports adding
// and removing fields, with inline type display.
// Maps schema-editor.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface SchemaField {
  name: string;
  type: string;
  required?: boolean;
}

// --------------- Props ---------------

export interface SchemaEditorProps {
  /** Array of field definitions. */
  schema: SchemaField[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new field. */
  onAddField?: () => void;
  /** Callback to remove a field by index. */
  onRemoveField?: (index: number) => void;
  /** Callback when a field is updated. */
  onUpdateField?: (index: number, field: SchemaField) => void;
}

// --------------- Component ---------------

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  schema,
  isFocused = false,
  onAddField,
  onRemoveField,
  onUpdateField,
}) => {
  const [focusIndex, setFocusIndex] = useState(0);
  // Items: field rows + add button
  const totalItems = schema.length + 1;

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.downArrow) {
        setFocusIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (key.upArrow) {
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (key.return) {
        if (focusIndex === schema.length) {
          onAddField?.();
        }
      } else if (key.delete || key.backspace) {
        if (focusIndex < schema.length) {
          onRemoveField?.(focusIndex);
          setFocusIndex((i) => Math.max(0, Math.min(i, schema.length - 2)));
        }
      } else if (input === 'r' && focusIndex < schema.length) {
        // Toggle required
        const field = schema[focusIndex];
        if (field) {
          onUpdateField?.(focusIndex, { ...field, required: !field.required });
        }
      }
    },
    { isActive: isFocused },
  );

  const nameWidth = Math.max(16, ...schema.map((f) => f.name.length + 2));

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold>Schema Editor</Text>
        <Text dimColor> ({schema.length} fields)</Text>
      </Box>

      {/* Field Rows */}
      {schema.map((field, index) => {
        const focused = isFocused && index === focusIndex;
        return (
          <Box key={`${field.name}-${index}`}>
            <Text color={focused ? 'cyan' : undefined}>
              {focused ? '\u25B6' : ' '}{' '}
            </Text>
            <Box width={nameWidth}>
              <Text bold={focused} color={focused ? 'cyan' : undefined}>
                {field.name}
              </Text>
            </Box>
            <Text dimColor>: </Text>
            <Text color={focused ? 'cyan' : 'yellow'}>{field.type}</Text>
            {field.required && (
              <Text color="red" bold> [required]</Text>
            )}
            {focused && (
              <Text dimColor> (del=remove, r=toggle required)</Text>
            )}
          </Box>
        );
      })}

      {schema.length === 0 && (
        <Text dimColor>No fields defined.</Text>
      )}

      {/* Add Field Button */}
      <Box marginTop={1}>
        <Text
          bold={isFocused && focusIndex === schema.length}
          inverse={isFocused && focusIndex === schema.length}
          color={isFocused && focusIndex === schema.length ? 'green' : 'gray'}
        >
          [+ Add Field]
        </Text>
      </Box>
    </Box>
  );
};

SchemaEditor.displayName = 'SchemaEditor';
export default SchemaEditor;
