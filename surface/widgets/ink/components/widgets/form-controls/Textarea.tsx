// ============================================================
// Clef Surface Ink Widget — Textarea
//
// Multi-line text input area for terminal. Renders within a
// bordered Box with cursor support. Handles character input,
// newlines via enter, and backspace for deletion. Maps the
// textarea.widget anatomy (root, label, textarea, charCount)
// to Ink Box/Text with useInput keyboard handling.
// ============================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface TextareaProps {
  /** Current text value. */
  value: string;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Number of visible rows (default 3). */
  rows?: number;
  /** Disables the textarea when true. */
  disabled?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Called when the text value changes. */
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export const Textarea: React.FC<TextareaProps> = ({
  value,
  placeholder = '',
  rows = 3,
  disabled = false,
  isFocused = false,
  onChange,
}) => {
  const [cursorRow, setCursorRow] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);

  const lines = value.split('\n');

  const updateValue = useCallback(
    (newLines: string[], newRow: number, newCol: number) => {
      if (disabled || !onChange) return;
      onChange(newLines.join('\n'));
      setCursorRow(newRow);
      setCursorCol(newCol);
    },
    [disabled, onChange],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.return) {
        // Insert newline at cursor position
        const currentLine = lines[cursorRow] || '';
        const before = currentLine.slice(0, cursorCol);
        const after = currentLine.slice(cursorCol);
        const newLines = [...lines];
        newLines.splice(cursorRow, 1, before, after);
        updateValue(newLines, cursorRow + 1, 0);
      } else if (key.backspace || key.delete) {
        if (cursorCol > 0) {
          // Delete character before cursor
          const currentLine = lines[cursorRow] || '';
          const newLine = currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
          const newLines = [...lines];
          newLines[cursorRow] = newLine;
          updateValue(newLines, cursorRow, cursorCol - 1);
        } else if (cursorRow > 0) {
          // Merge with previous line
          const prevLine = lines[cursorRow - 1] || '';
          const currentLine = lines[cursorRow] || '';
          const newLines = [...lines];
          newLines.splice(cursorRow - 1, 2, prevLine + currentLine);
          updateValue(newLines, cursorRow - 1, prevLine.length);
        }
      } else if (key.upArrow) {
        if (cursorRow > 0) {
          const newRow = cursorRow - 1;
          const lineLen = (lines[newRow] || '').length;
          setCursorRow(newRow);
          setCursorCol(Math.min(cursorCol, lineLen));
        }
      } else if (key.downArrow) {
        if (cursorRow < lines.length - 1) {
          const newRow = cursorRow + 1;
          const lineLen = (lines[newRow] || '').length;
          setCursorRow(newRow);
          setCursorCol(Math.min(cursorCol, lineLen));
        }
      } else if (key.leftArrow) {
        if (cursorCol > 0) {
          setCursorCol(cursorCol - 1);
        } else if (cursorRow > 0) {
          const newRow = cursorRow - 1;
          setCursorRow(newRow);
          setCursorCol((lines[newRow] || '').length);
        }
      } else if (key.rightArrow) {
        const lineLen = (lines[cursorRow] || '').length;
        if (cursorCol < lineLen) {
          setCursorCol(cursorCol + 1);
        } else if (cursorRow < lines.length - 1) {
          setCursorRow(cursorRow + 1);
          setCursorCol(0);
        }
      } else if (!key.ctrl && !key.meta && input && input.length === 1) {
        // Insert character at cursor position
        const currentLine = lines[cursorRow] || '';
        const newLine = currentLine.slice(0, cursorCol) + input + currentLine.slice(cursorCol);
        const newLines = [...lines];
        newLines[cursorRow] = newLine;
        updateValue(newLines, cursorRow, cursorCol + 1);
      }
    },
    { isActive: isFocused },
  );

  const isEmpty = value.length === 0;
  const displayLines: string[] = isEmpty
    ? [placeholder]
    : lines;

  // Pad to requested row count
  while (displayLines.length < rows) {
    displayLines.push('');
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : undefined}
      paddingX={1}
    >
      {displayLines.slice(0, Math.max(rows, lines.length)).map((line, idx) => {
        const isCurrentRow = isFocused && idx === cursorRow && !isEmpty;
        const displayLine = line || ' ';

        if (isCurrentRow && !disabled) {
          // Show cursor in current line
          const safeCol = Math.min(cursorCol, line.length);
          const before = line.slice(0, safeCol);
          const cursorChar = line[safeCol] || ' ';
          const after = line.slice(safeCol + 1);

          return (
            <Box key={idx}>
              <Text>{before}</Text>
              <Text inverse color="cyan">{cursorChar}</Text>
              <Text>{after}</Text>
            </Box>
          );
        }

        return (
          <Text
            key={idx}
            dimColor={isEmpty}
          >
            {displayLine}
          </Text>
        );
      })}
    </Box>
  );
};

Textarea.displayName = 'Textarea';
export default Textarea;
