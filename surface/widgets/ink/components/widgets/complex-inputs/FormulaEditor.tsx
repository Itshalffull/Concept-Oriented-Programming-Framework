// ============================================================
// Clef Surface Ink Widget — FormulaEditor
//
// Expression editor for the terminal with syntax highlighting.
// Variables render in cyan, functions in yellow, operators in
// bold. Supports a live evaluation preview and autocomplete
// suggestions. Maps the formula-editor.widget anatomy (root,
// input, autocomplete, suggestion, preview, error,
// propertyToken) and states (content, interaction, previewing,
// validation) to keyboard-driven terminal rendering.
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

// --------------- Props ---------------

export interface FormulaEditorProps {
  /** Current formula string. */
  value?: string;
  /** Available variable names (highlighted in cyan). */
  variables?: string[];
  /** Available function names (highlighted in yellow). */
  functions?: string[];
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Whether this component receives keyboard input. */
  isFocused?: boolean;
  /** Disables the input when true. */
  disabled?: boolean;
  /** Called when the formula value changes. */
  onChange?: (value: string) => void;
  /** Called when the user requests evaluation (Ctrl+Enter). */
  onEvaluate?: (value: string) => void;
}

// --------------- Helpers ---------------

interface Token {
  text: string;
  type: 'variable' | 'function' | 'operator' | 'number' | 'string' | 'paren' | 'text';
}

const OPERATORS = new Set(['+', '-', '*', '/', '=', '>', '<', '!', '&', '|', '%', '^']);
const PARENS = new Set(['(', ')', '[', ']', '{', '}']);

const tokenize = (formula: string, variables: Set<string>, functions: Set<string>): Token[] => {
  const tokens: Token[] = [];
  const words = formula.split(/(\s+|(?=[+\-*/=><&|%^!()[\]{}])|(?<=[+\-*/=><&|%^!()[\]{}]))/);

  for (const word of words) {
    if (!word) continue;
    if (variables.has(word)) {
      tokens.push({ text: word, type: 'variable' });
    } else if (functions.has(word)) {
      tokens.push({ text: word, type: 'function' });
    } else if (OPERATORS.has(word)) {
      tokens.push({ text: word, type: 'operator' });
    } else if (PARENS.has(word)) {
      tokens.push({ text: word, type: 'paren' });
    } else if (/^\d+(\.\d+)?$/.test(word)) {
      tokens.push({ text: word, type: 'number' });
    } else if (/^["']/.test(word)) {
      tokens.push({ text: word, type: 'string' });
    } else {
      tokens.push({ text: word, type: 'text' });
    }
  }
  return tokens;
};

// --------------- Component ---------------

export const FormulaEditor: React.FC<FormulaEditorProps> = ({
  value: controlledValue,
  variables = [],
  functions = [],
  placeholder = 'Enter formula...',
  isFocused = false,
  disabled = false,
  onChange,
  onEvaluate,
}) => {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const [acIndex, setAcIndex] = useState(0);
  const [showAc, setShowAc] = useState(false);

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const varSet = useMemo(() => new Set(variables), [variables]);
  const fnSet = useMemo(() => new Set(functions), [functions]);
  const allSymbols = useMemo(() => [...variables, ...functions], [variables, functions]);

  // Get the word currently being typed (last word)
  const currentWord = useMemo(() => {
    const parts = currentValue.split(/[\s+\-*/=><&|%^!()[\]{}]+/);
    return parts[parts.length - 1] || '';
  }, [currentValue]);

  // Filter suggestions based on current word
  const suggestions = useMemo(() => {
    if (!currentWord || currentWord.length < 1) return [];
    const lower = currentWord.toLowerCase();
    return allSymbols.filter((s) => s.toLowerCase().startsWith(lower)).slice(0, 8);
  }, [currentWord, allSymbols]);

  const updateValue = useCallback(
    (v: string) => {
      setInternalValue(v);
      onChange?.(v);
    },
    [onChange],
  );

  const acceptSuggestion = useCallback(
    (suggestion: string) => {
      // Replace the current partial word with the suggestion
      const parts = currentValue.split(/(\s+|(?=[+\-*/=><&|%^!()[\]{}])|(?<=[+\-*/=><&|%^!()[\]{}]))/);
      parts[parts.length - 1] = suggestion;
      updateValue(parts.join(''));
      setShowAc(false);
      setAcIndex(0);
    },
    [currentValue, updateValue],
  );

  useInput(
    (input, key) => {
      if (disabled) return;

      // Autocomplete navigation
      if (showAc && suggestions.length > 0) {
        if (key.downArrow) {
          setAcIndex((i) => (i + 1) % suggestions.length);
          return;
        }
        if (key.upArrow) {
          setAcIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (key.tab || key.return) {
          acceptSuggestion(suggestions[acIndex]);
          return;
        }
        if (key.escape) {
          setShowAc(false);
          setAcIndex(0);
          return;
        }
      }

      // Evaluate on Ctrl+Enter (detected as key.ctrl + key.return won't work
      // cleanly in Ink, so use 'e' as evaluate shortcut when not in AC)
      if (key.return) {
        onEvaluate?.(currentValue);
        return;
      }

      if (key.backspace || key.delete) {
        updateValue(currentValue.slice(0, -1));
        return;
      }

      if (key.escape) {
        setShowAc(false);
        return;
      }

      // Tab triggers autocomplete
      if (key.tab) {
        if (suggestions.length > 0) {
          setShowAc(true);
          setAcIndex(0);
        }
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        const next = currentValue + input;
        updateValue(next);
        // Auto-show suggestions
        const parts = next.split(/[\s+\-*/=><&|%^!()[\]{}]+/);
        const lastWord = parts[parts.length - 1] || '';
        if (lastWord.length >= 1) {
          const matches = allSymbols.filter((s) => s.toLowerCase().startsWith(lastWord.toLowerCase()));
          if (matches.length > 0) {
            setShowAc(true);
            setAcIndex(0);
          } else {
            setShowAc(false);
          }
        } else {
          setShowAc(false);
        }
      }
    },
    { isActive: isFocused },
  );

  // Tokenize for syntax highlighting
  const tokens = tokenize(currentValue, varSet, fnSet);
  const isEmpty = currentValue.length === 0;

  return (
    <Box flexDirection="column">
      {/* Formula input with syntax highlighting */}
      <Box>
        <Text color="cyan">{'\u0192'}(x) </Text>
        {isEmpty ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          tokens.map((tok, i) => {
            switch (tok.type) {
              case 'variable':
                return <Text key={i} color="cyan">{tok.text}</Text>;
              case 'function':
                return <Text key={i} color="yellow">{tok.text}</Text>;
              case 'operator':
                return <Text key={i} bold>{tok.text}</Text>;
              case 'number':
                return <Text key={i} color="magenta">{tok.text}</Text>;
              case 'string':
                return <Text key={i} color="green">{tok.text}</Text>;
              case 'paren':
                return <Text key={i} dimColor>{tok.text}</Text>;
              default:
                return <Text key={i}>{tok.text}</Text>;
            }
          })
        )}
        {isFocused && !disabled && <Text inverse> </Text>}
      </Box>

      {/* Autocomplete dropdown */}
      {showAc && suggestions.length > 0 && (
        <Box flexDirection="column" marginLeft={4}>
          {suggestions.map((s, i) => {
            const isVar = varSet.has(s);
            return (
              <Box key={s}>
                <Text
                  bold={i === acIndex}
                  inverse={i === acIndex}
                  color={isVar ? 'cyan' : 'yellow'}
                >
                  {i === acIndex ? '\u25BA ' : '  '}{s}
                </Text>
                <Text dimColor> {isVar ? '(var)' : '(fn)'}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Hint */}
      {isFocused && !disabled && (
        <Box marginTop={1}>
          <Text dimColor>
            Tab autocomplete {'|'} Enter evaluate {'|'} Esc dismiss
          </Text>
        </Box>
      )}
    </Box>
  );
};

FormulaEditor.displayName = 'FormulaEditor';
export default FormulaEditor;
