export type ExpressionToggleInputState = 'fixed' | 'expression' | 'autocompleting';
export type ExpressionToggleInputEvent =
  | { type: 'TOGGLE' }
  | { type: 'INPUT' }
  | { type: 'SHOW_AC' }
  | { type: 'SELECT' }
  | { type: 'DISMISS' };

export function expressionToggleInputReducer(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState {
  switch (state) {
    case 'fixed':
      if (event.type === 'TOGGLE') return 'expression';
      if (event.type === 'INPUT') return 'fixed';
      return state;
    case 'expression':
      if (event.type === 'TOGGLE') return 'fixed';
      if (event.type === 'INPUT') return 'expression';
      if (event.type === 'SHOW_AC') return 'autocompleting';
      return state;
    case 'autocompleting':
      if (event.type === 'SELECT') return 'expression';
      if (event.type === 'DISMISS') return 'expression';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface ExpressionToggleInputProps {
  value: string;
  mode: string;
  fieldType?: 'text' | 'number' | 'boolean' | 'object';
  variables?: Array<string>;
  onChange?: (value: string) => void;
  onModeChange?: (mode: string) => void;
  isFocused?: boolean;
}

export function ExpressionToggleInput({
  value: initialValue,
  mode: initialMode,
  fieldType = 'text',
  variables = [],
  onChange,
  onModeChange,
  isFocused = false,
}: ExpressionToggleInputProps) {
  const [state, send] = useReducer(
    expressionToggleInputReducer,
    initialMode === 'expression' ? 'expression' : 'fixed'
  );
  const [value, setValue] = useState(initialValue);
  const [acIndex, setAcIndex] = useState(0);

  const matchingVars = state === 'autocompleting'
    ? variables.filter(v => v.toLowerCase().startsWith(value.split('.').pop()?.toLowerCase() ?? ''))
    : [];

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'autocompleting') {
      if (key.upArrow) {
        setAcIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setAcIndex(prev => Math.min(matchingVars.length - 1, prev + 1));
        return;
      }
      if (key.return || key.tab) {
        if (matchingVars[acIndex]) {
          const parts = value.split('.');
          parts[parts.length - 1] = matchingVars[acIndex];
          const newVal = parts.join('.');
          setValue(newVal);
          onChange?.(newVal);
        }
        send({ type: 'SELECT' });
        return;
      }
      if (key.escape) {
        send({ type: 'DISMISS' });
        return;
      }
    }

    if (key.tab && !key.shift) {
      send({ type: 'TOGGLE' });
      onModeChange?.(state === 'fixed' ? 'expression' : 'fixed');
      return;
    }

    if (key.backspace || key.delete) {
      setValue(prev => {
        const next = prev.slice(0, -1);
        onChange?.(next);
        return next;
      });
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue(prev => {
        const next = prev + input;
        send({ type: 'INPUT' });
        onChange?.(next);
        if (state === 'expression' && input === '.' && variables.length > 0) {
          send({ type: 'SHOW_AC' });
          setAcIndex(0);
        }
        return next;
      });
    }
  });

  const isExpr = state === 'expression' || state === 'autocompleting';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box>
        <Text color={isExpr ? 'magenta' : 'cyan'} bold>
          {isExpr ? 'fx ' : '\u270E '}
        </Text>
        <Text color="gray">({fieldType}) </Text>
        {isExpr ? (
          <Text color="magenta">{value || <Text color="gray">expression...</Text>}</Text>
        ) : (
          <Text>{value || <Text color="gray">value...</Text>}</Text>
        )}
        {isFocused && <Text color="cyan">{'\u2588'}</Text>}
      </Box>

      {state === 'autocompleting' && matchingVars.length > 0 && (
        <Box flexDirection="column" paddingLeft={3} borderStyle="single" borderColor="gray">
          {matchingVars.map((v, i) => (
            <Box key={v}>
              <Text color={i === acIndex ? 'cyan' : 'gray'}>
                {i === acIndex ? '\u25B6 ' : '  '}{v}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {isFocused && (
        <Box>
          <Text color="gray">[Tab] {isExpr ? 'Fixed' : 'Expression'} mode</Text>
        </Box>
      )}
    </Box>
  );
}

export default ExpressionToggleInput;
