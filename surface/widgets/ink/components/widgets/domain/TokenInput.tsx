// ============================================================
// Clef Surface Ink Widget — TokenInput
//
// Token pill input rendered in the terminal as parenthesized
// tokens followed by a text input area with suggestion dropdown.
// Tokens can be removed via backspace, and suggestions appear
// when typing.
//
// Adapts the token-input.widget spec: anatomy (root, label,
// typeIcon, removeButton), states (static, hovered, focused,
// selected, removed), and connect attributes.
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface TokenInputProps {
  /** Currently added tokens. */
  tokens: string[];
  /** Available suggestions for autocompletion. */
  suggestions?: string[];
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
  /** Callback to add a new token. */
  onAdd?: (token: string) => void;
  /** Callback to remove a token. */
  onRemove?: (token: string) => void;
}

// --------------- Component ---------------

export const TokenInput: React.FC<TokenInputProps> = ({
  tokens,
  suggestions = [],
  isFocused = false,
  onAdd,
  onRemove,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return [];
    const lower = inputValue.toLowerCase();
    return suggestions.filter(
      (s) => s.toLowerCase().includes(lower) && !tokens.includes(s)
    );
  }, [suggestions, inputValue, tokens]);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.return) {
        if (showSuggestions && filteredSuggestions.length > 0) {
          const selected = filteredSuggestions[suggestionIndex];
          if (selected) {
            onAdd?.(selected);
            setInputValue('');
            setShowSuggestions(false);
            setSuggestionIndex(0);
          }
        } else if (inputValue.trim()) {
          onAdd?.(inputValue.trim());
          setInputValue('');
          setShowSuggestions(false);
        }
      } else if (key.escape) {
        setShowSuggestions(false);
        setInputValue('');
      } else if (key.backspace || key.delete) {
        if (inputValue.length > 0) {
          const next = inputValue.slice(0, -1);
          setInputValue(next);
          setShowSuggestions(next.length > 0);
          setSuggestionIndex(0);
        } else if (tokens.length > 0) {
          // Remove last token
          const lastToken = tokens[tokens.length - 1];
          if (lastToken) onRemove?.(lastToken);
        }
      } else if (key.downArrow && showSuggestions) {
        setSuggestionIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
      } else if (key.upArrow && showSuggestions) {
        setSuggestionIndex((i) => Math.max(i - 1, 0));
      } else if (input && !key.ctrl && !key.meta) {
        const next = inputValue + input;
        setInputValue(next);
        setShowSuggestions(true);
        setSuggestionIndex(0);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column">
      {/* Token row + input */}
      <Box flexWrap="wrap">
        {tokens.map((token) => (
          <Box key={token} marginRight={1}>
            <Text color="cyan">(</Text>
            <Text bold>{token}</Text>
            <Text color="cyan">)</Text>
          </Box>
        ))}
        <Box>
          <Text>[</Text>
          <Text>{inputValue || (isFocused ? '' : '...')}</Text>
          {isFocused && <Text color="cyan">{'\u2588'}</Text>}
          <Text>]</Text>
        </Box>
      </Box>

      {/* Suggestions dropdown */}
      {isFocused && showSuggestions && filteredSuggestions.length > 0 && (
        <Box flexDirection="column" marginTop={0} paddingLeft={2} borderStyle="single" borderColor="gray">
          {filteredSuggestions.slice(0, 5).map((suggestion, index) => {
            const isHighlighted = index === suggestionIndex;
            return (
              <Box key={suggestion}>
                <Text
                  inverse={isHighlighted}
                  bold={isHighlighted}
                  color={isHighlighted ? 'cyan' : undefined}
                >
                  {isHighlighted ? '\u276F ' : '  '}
                  {suggestion}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

TokenInput.displayName = 'TokenInput';
export default TokenInput;
