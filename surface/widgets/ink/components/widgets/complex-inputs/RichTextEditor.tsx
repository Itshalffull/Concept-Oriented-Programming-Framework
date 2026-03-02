// ============================================================
// Clef Surface Ink Widget — RichTextEditor
//
// Multi-line text editing surface for the terminal with a
// formatting toolbar. Shows [ B | I | U | H ] controls at
// top and a text area below. Supports basic markdown-style
// shortcuts for bold, italic, underline, and headings. Maps
// the rich-text-editor.widget anatomy (root, toolbar, editor,
// placeholder) and states (content, interaction, slashCommand)
// to keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface RichTextEditorProps {
  /** Current text content (plain text in terminal context). */
  value?: string;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Whether to show the formatting toolbar. */
  toolbar?: boolean;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Disables the editor when true. */
  disabled?: boolean;
  /** Visible label. */
  label?: string;
  /** Called when the content changes. */
  onChange?: (value: string) => void;
}

// --------------- Types ---------------

type FormatAction = 'bold' | 'italic' | 'underline' | 'heading';

// --------------- Component ---------------

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value: controlledValue,
  placeholder = 'Start typing...',
  toolbar = true,
  isFocused = false,
  disabled = false,
  label,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const [cursorLine, setCursorLine] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Set<FormatAction>>(new Set());

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const lines = currentValue.split('\n');
  const isEmpty = currentValue.length === 0;

  const updateValue = useCallback(
    (v: string) => {
      setInternalValue(v);
      onChange?.(v);
    },
    [onChange],
  );

  const toggleFormat = useCallback(
    (format: FormatAction) => {
      setActiveFormats((prev) => {
        const next = new Set(prev);
        if (next.has(format)) {
          next.delete(format);
        } else {
          next.add(format);
        }
        return next;
      });

      // Insert markdown markers
      const markers: Record<FormatAction, string> = {
        bold: '**',
        italic: '_',
        underline: '__',
        heading: '# ',
      };
      const marker = markers[format];
      if (format === 'heading') {
        // Prefix current line with heading marker
        const ls = currentValue.split('\n');
        if (ls[cursorLine].startsWith('# ')) {
          ls[cursorLine] = ls[cursorLine].slice(2);
        } else {
          ls[cursorLine] = marker + ls[cursorLine];
        }
        updateValue(ls.join('\n'));
      } else {
        updateValue(currentValue + marker);
      }
    },
    [currentValue, cursorLine, updateValue],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      // Newline
      if (key.return) {
        updateValue(currentValue + '\n');
        setCursorLine((l) => l + 1);
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
        if (currentValue.length > 0) {
          const lastChar = currentValue[currentValue.length - 1];
          updateValue(currentValue.slice(0, -1));
          if (lastChar === '\n') {
            setCursorLine((l) => Math.max(0, l - 1));
          }
        }
        return;
      }

      // Navigate lines with up/down
      if (key.upArrow) {
        setCursorLine((l) => Math.max(0, l - 1));
        return;
      }
      if (key.downArrow) {
        setCursorLine((l) => Math.min(lines.length - 1, l + 1));
        return;
      }

      // Escape clears formatting state
      if (key.escape) {
        setActiveFormats(new Set());
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        updateValue(currentValue + input);
      }
    },
    { isActive: isFocused },
  );

  const formatButtons: { key: string; format: FormatAction; label: string }[] = [
    { key: 'B', format: 'bold', label: 'B' },
    { key: 'I', format: 'italic', label: 'I' },
    { key: 'U', format: 'underline', label: 'U' },
    { key: 'H', format: 'heading', label: 'H' },
  ];

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}

      {/* Toolbar */}
      {toolbar && (
        <Box>
          <Text dimColor={disabled}>{'[ '}</Text>
          {formatButtons.map((btn, idx) => (
            <React.Fragment key={btn.key}>
              <Text
                bold={activeFormats.has(btn.format)}
                inverse={activeFormats.has(btn.format)}
                dimColor={disabled}
              >
                {btn.label}
              </Text>
              {idx < formatButtons.length - 1 && (
                <Text dimColor={disabled}> {'|'} </Text>
              )}
            </React.Fragment>
          ))}
          <Text dimColor={disabled}>{' ]'}</Text>
        </Box>
      )}

      {/* Editor area */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={isFocused && !disabled ? 'cyan' : 'gray'}
        paddingX={1}
        minHeight={5}
      >
        {isEmpty ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          lines.map((line, i) => {
            const isCurrentLine = i === cursorLine && isFocused;
            // Basic syntax highlighting for markdown
            const isHeading = line.startsWith('# ');
            const hasBold = /\*\*.+\*\*/.test(line);
            const hasItalic = /_.+_/.test(line) && !hasBold;

            return (
              <Box key={i}>
                <Text dimColor>{String(i + 1).padStart(2, ' ')} </Text>
                <Text
                  bold={isHeading || hasBold || isCurrentLine}
                  italic={hasItalic}
                  color={isHeading ? 'cyan' : undefined}
                  inverse={isCurrentLine && !disabled}
                >
                  {line || ' '}
                </Text>
              </Box>
            );
          })
        )}
        {isFocused && !disabled && <Text inverse> </Text>}
      </Box>

      {/* Status bar */}
      {isFocused && !disabled && (
        <Box>
          <Text dimColor>
            Line {cursorLine + 1}/{lines.length} {'|'} {currentValue.length} chars
          </Text>
        </Box>
      )}
    </Box>
  );
};

RichTextEditor.displayName = 'RichTextEditor';
export default RichTextEditor;
