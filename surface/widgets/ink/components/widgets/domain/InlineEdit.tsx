// ============================================================
// Clef Surface Ink Widget — InlineEdit
//
// Click-to-edit inline text display rendered in the terminal.
// Shows value as plain text when not editing, switches to a
// bordered input field when editing. Enter confirms, Escape
// cancels and reverts.
//
// Adapts the inline-edit.widget spec: anatomy (root, display,
// displayText, editButton, input, confirmButton, cancelButton),
// states (displaying, focused, editing), and connect attributes.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface InlineEditProps {
  /** Current text value. */
  value: string;
  /** Whether currently in editing mode. */
  editing?: boolean;
  /** Placeholder text when value is empty. */
  placeholder?: string;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback when the value changes during editing. */
  onChange?: (value: string) => void;
  /** Callback when editing is confirmed. */
  onSubmit?: (value: string) => void;
  /** Callback when editing is cancelled. */
  onCancel?: () => void;
}

// --------------- Component ---------------

export const InlineEdit: React.FC<InlineEditProps> = ({
  value,
  editing: editingProp = false,
  placeholder = 'Click to edit',
  isFocused = false,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const [isEditing, setIsEditing] = useState(editingProp);
  const [editValue, setEditValue] = useState(value);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (!isEditing) {
        // Display mode
        if (key.return || input === 'e') {
          setIsEditing(true);
          setEditValue(value);
        }
      } else {
        // Editing mode
        if (key.return) {
          onSubmit?.(editValue);
          setIsEditing(false);
        } else if (key.escape) {
          setEditValue(value);
          onCancel?.();
          setIsEditing(false);
        } else if (key.backspace || key.delete) {
          const next = editValue.slice(0, -1);
          setEditValue(next);
          onChange?.(next);
        } else if (input && !key.ctrl && !key.meta) {
          const next = editValue + input;
          setEditValue(next);
          onChange?.(next);
        }
      }
    },
    { isActive: isFocused },
  );

  if (isEditing) {
    return (
      <Box>
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text>
            {editValue || <Text dimColor>{placeholder}</Text>}
            <Text color="cyan">{'\u2588'}</Text>
          </Text>
        </Box>
        <Text dimColor> Enter confirm | Esc cancel</Text>
      </Box>
    );
  }

  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <Box>
      <Text
        bold={isFocused}
        dimColor={isEmpty}
        underline={isFocused}
        color={isFocused ? 'cyan' : undefined}
      >
        {displayValue}
      </Text>
      {isFocused && (
        <Text dimColor> [Enter to edit]</Text>
      )}
    </Box>
  );
};

InlineEdit.displayName = 'InlineEdit';
export default InlineEdit;
