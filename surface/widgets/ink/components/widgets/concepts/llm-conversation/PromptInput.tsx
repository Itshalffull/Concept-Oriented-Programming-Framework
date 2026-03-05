export type PromptInputState = 'empty' | 'composing' | 'submitting';
export type PromptInputEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'ATTACH' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_COMPLETE' }
  | { type: 'SUBMIT_ERROR' };

export function promptInputReducer(state: PromptInputState, event: PromptInputEvent): PromptInputState {
  switch (state) {
    case 'empty':
      if (event.type === 'INPUT') return 'composing';
      if (event.type === 'PASTE') return 'composing';
      if (event.type === 'ATTACH') return 'composing';
      return state;
    case 'composing':
      if (event.type === 'CLEAR') return 'empty';
      if (event.type === 'SUBMIT') return 'submitting';
      return state;
    case 'submitting':
      if (event.type === 'SUBMIT_COMPLETE') return 'empty';
      if (event.type === 'SUBMIT_ERROR') return 'composing';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface PromptInputProps {
  value: string;
  placeholder?: string;
  maxLength?: number | undefined;
  showModelSelector?: boolean;
  showAttach?: boolean;
  disabled?: boolean;
  onSubmit?: (value: string) => void;
  onChange?: (value: string) => void;
  isFocused?: boolean;
}

export function PromptInput({
  value: initialValue,
  placeholder = 'Type a message...',
  maxLength,
  showModelSelector = false,
  showAttach = false,
  disabled = false,
  onSubmit,
  onChange,
  isFocused = true,
}: PromptInputProps) {
  const [state, send] = useReducer(promptInputReducer, initialValue ? 'composing' : 'empty');
  const [value, setValue] = useState(initialValue);

  const handleSubmit = useCallback(() => {
    if (!value.trim() || state === 'submitting') return;
    send({ type: 'SUBMIT' });
    onSubmit?.(value.trim());
    setValue('');
    send({ type: 'SUBMIT_COMPLETE' });
  }, [value, state, onSubmit]);

  useInput((input, key) => {
    if (!isFocused || disabled) return;

    if (key.return) {
      handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setValue(prev => {
        const next = prev.slice(0, -1);
        if (next.length === 0) send({ type: 'CLEAR' });
        onChange?.(next);
        return next;
      });
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      if (maxLength && value.length >= maxLength) return;
      setValue(prev => {
        const next = prev + input;
        if (state === 'empty') send({ type: 'INPUT' });
        onChange?.(next);
        return next;
      });
    }
  });

  const charInfo = maxLength ? `${value.length}/${maxLength}` : `${value.length}`;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? 'cyan' : undefined}>
      <Box>
        <Text color="cyan">{'\u276F'} </Text>
        {value.length === 0 ? (
          <Text color="gray">{placeholder}</Text>
        ) : (
          <Text>{value}</Text>
        )}
        {isFocused && <Text color="cyan">{'\u2588'}</Text>}
      </Box>
      <Box justifyContent="space-between">
        <Box>
          {showAttach && <Text color="gray">[a]ttach </Text>}
          {showModelSelector && <Text color="gray">[m]odel </Text>}
        </Box>
        <Box>
          <Text color={maxLength && value.length > maxLength * 0.9 ? 'red' : 'gray'}>{charInfo}</Text>
          {state === 'composing' && <Text color="gray"> [Enter] Send</Text>}
          {state === 'submitting' && <Text color="yellow"> Sending...</Text>}
        </Box>
      </Box>
    </Box>
  );
}

export default PromptInput;
