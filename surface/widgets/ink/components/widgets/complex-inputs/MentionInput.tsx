// ============================================================
// Clef Surface Ink Widget — MentionInput
//
// Trigger-character autocomplete input for the terminal. When
// the trigger character (default "@") is typed, a dropdown of
// matching mentions appears. Arrow keys navigate suggestions,
// enter/tab to select. Maps the mention-input.widget anatomy
// (root, input, suggestions, suggestion, suggestionLabel,
// mentionChip) and states (trigger, focus, navigation) to
// keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Types ---------------

export interface Mention {
  /** Unique identifier. */
  id: string;
  /** Display label. */
  label: string;
}

// --------------- Props ---------------

export interface MentionInputProps {
  /** Current input value. */
  value?: string;
  /** Available mention targets. */
  mentions?: Mention[];
  /** Character that triggers the mention dropdown (default "@"). */
  trigger?: string;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Called when the value changes. */
  onChange?: (value: string) => void;
}

// --------------- Component ---------------

export const MentionInput: React.FC<MentionInputProps> = ({
  value: controlledValue,
  mentions = [],
  trigger = '@',
  placeholder = 'Type a message...',
  isFocused = false,
  disabled = false,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const [suggesting, setSuggesting] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const filteredMentions = useMemo(() => {
    if (!suggesting || query.length === 0) return mentions.slice(0, 10);
    const lower = query.toLowerCase();
    return mentions
      .filter((m) => m.label.toLowerCase().includes(lower))
      .slice(0, 10);
  }, [suggesting, query, mentions]);

  const updateValue = useCallback(
    (v: string) => {
      setInternalValue(v);
      onChange?.(v);
    },
    [onChange],
  );

  const insertMention = useCallback(
    (mention: Mention) => {
      // Replace trigger + query with the mention chip text
      const triggerStart = currentValue.lastIndexOf(trigger);
      if (triggerStart >= 0) {
        const before = currentValue.slice(0, triggerStart);
        const after = `${trigger}${mention.label} `;
        updateValue(before + after);
      } else {
        updateValue(currentValue + `${trigger}${mention.label} `);
      }
      setSuggesting(false);
      setQuery('');
      setSelectedIdx(0);
    },
    [currentValue, trigger, updateValue],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      // Suggestion navigation
      if (suggesting && filteredMentions.length > 0) {
        if (key.downArrow) {
          setSelectedIdx((i) => (i + 1) % filteredMentions.length);
          return;
        }
        if (key.upArrow) {
          setSelectedIdx((i) => (i - 1 + filteredMentions.length) % filteredMentions.length);
          return;
        }
        if (key.return || key.tab) {
          insertMention(filteredMentions[selectedIdx]);
          return;
        }
        if (key.escape) {
          setSuggesting(false);
          setQuery('');
          setSelectedIdx(0);
          return;
        }
      }

      // Backspace
      if (key.backspace || key.delete) {
        const next = currentValue.slice(0, -1);
        updateValue(next);
        if (suggesting) {
          if (query.length > 0) {
            setQuery((q) => q.slice(0, -1));
          } else {
            setSuggesting(false);
          }
        }
        return;
      }

      if (key.return) return;

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        const next = currentValue + input;
        updateValue(next);

        if (input === trigger) {
          setSuggesting(true);
          setQuery('');
          setSelectedIdx(0);
        } else if (suggesting) {
          if (input === ' ') {
            setSuggesting(false);
            setQuery('');
          } else {
            setQuery((q) => q + input);
            setSelectedIdx(0);
          }
        }
      }
    },
    { isActive: isFocused },
  );

  // Render the value with mention highlights
  const renderValue = () => {
    if (currentValue.length === 0) {
      return <Text dimColor>{placeholder}</Text>;
    }

    // Split on trigger pattern and highlight mentions
    const parts: React.ReactNode[] = [];
    const regex = new RegExp(`(${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w+)`, 'g');
    let lastIndex = 0;
    let match;

    const str = currentValue;
    const re = new RegExp(regex);
    while ((match = re.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<Text key={`t-${lastIndex}`}>{str.slice(lastIndex, match.index)}</Text>);
      }
      parts.push(
        <Text key={`m-${match.index}`} color="cyan" bold>
          {match[0]}
        </Text>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < str.length) {
      parts.push(<Text key={`t-${lastIndex}`}>{str.slice(lastIndex)}</Text>);
    }

    return <>{parts}</>;
  };

  return (
    <Box flexDirection="column">
      {/* Input line */}
      <Box>
        <Text dimColor={disabled}>{'> '}</Text>
        {renderValue()}
        {isFocused && !disabled && <Text inverse> </Text>}
      </Box>

      {/* Suggestions dropdown */}
      {suggesting && filteredMentions.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {filteredMentions.map((m, i) => (
            <Box key={m.id}>
              <Text
                bold={i === selectedIdx}
                inverse={i === selectedIdx}
                color="cyan"
              >
                {i === selectedIdx ? '\u25BA ' : '  '}{trigger}{m.label}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* No results */}
      {suggesting && filteredMentions.length === 0 && (
        <Box marginLeft={2} marginTop={1}>
          <Text dimColor>No matches for "{query}"</Text>
        </Box>
      )}
    </Box>
  );
};

MentionInput.displayName = 'MentionInput';
export default MentionInput;
