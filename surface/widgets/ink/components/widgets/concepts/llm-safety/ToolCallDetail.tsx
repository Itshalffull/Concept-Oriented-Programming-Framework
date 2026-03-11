export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent =
  | { type: 'EXPAND_ARGS' }
  | { type: 'EXPAND_RESULT' }
  | { type: 'RETRY' }
  | { type: 'RETRY_COMPLETE' }
  | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_ARGS') return 'idle';
      if (event.type === 'EXPAND_RESULT') return 'idle';
      if (event.type === 'RETRY') return 'retrying';
      return state;
    case 'retrying':
      if (event.type === 'RETRY_COMPLETE') return 'idle';
      if (event.type === 'RETRY_ERROR') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface ToolCallDetailProps {
  toolName: string;
  arguments: string;
  result?: string | undefined;
  timing?: number | undefined;
  tokenUsage?: number | undefined;
  error?: string | undefined;
  showTiming?: boolean;
  showTokens?: boolean;
  onRetry?: () => void;
  isFocused?: boolean;
}

export function ToolCallDetail({
  toolName,
  arguments: args,
  result,
  timing,
  tokenUsage,
  error,
  showTiming = true,
  showTokens = false,
  onRetry,
  isFocused = false,
}: ToolCallDetailProps) {
  const [state, send] = useReducer(toolCallDetailReducer, 'idle');
  const [showArgs, setShowArgs] = useState(true);
  const [showResult, setShowResult] = useState(true);

  useInput((input, key) => {
    if (!isFocused) return;
    if (input === 'a') {
      setShowArgs(prev => !prev);
      send({ type: 'EXPAND_ARGS' });
    }
    if (input === 'o') {
      setShowResult(prev => !prev);
      send({ type: 'EXPAND_RESULT' });
    }
    if (input === 'r' && error) {
      send({ type: 'RETRY' });
      onRetry?.();
      send({ type: 'RETRY_COMPLETE' });
    }
  });

  const hasError = !!error;
  const statusIcon = hasError ? '\u2717' : '\u2713';
  const statusColor = hasError ? 'red' : 'green';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Box>
          <Text color={statusColor}>{statusIcon} </Text>
          <Text bold>{toolName}</Text>
        </Box>
        <Box>
          {showTiming && timing !== undefined && <Text color="gray">{timing}ms </Text>}
          {showTokens && tokenUsage !== undefined && <Text color="gray">{tokenUsage} tok</Text>}
        </Box>
      </Box>

      {/* Arguments */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="gray">{showArgs ? '\u25BC' : '\u25B6'} Arguments</Text>
        </Box>
        {showArgs && (
          <Box paddingLeft={2}>
            {args.split('\n').map((line, i) => (
              <Text key={i} color="gray">{line}</Text>
            ))}
          </Box>
        )}
      </Box>

      {/* Result / Error */}
      {(result || error) && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={hasError ? 'red' : 'gray'}>
              {showResult ? '\u25BC' : '\u25B6'} {hasError ? 'Error' : 'Result'}
            </Text>
          </Box>
          {showResult && (
            <Box paddingLeft={2} flexDirection="column">
              {(error || result || '').split('\n').map((line, i) => (
                <Text key={i} color={hasError ? 'red' : undefined} wrap="wrap">{line}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {state === 'retrying' && (
        <Box marginTop={1}>
          <Text color="yellow">Retrying...</Text>
        </Box>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">
            [a]rgs [o]utput
            {error ? ' [r]etry' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ToolCallDetail;
