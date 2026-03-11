export type ToolInvocationState = 'collapsed' | 'hoveredCollapsed' | 'expanded' | 'pending' | 'running' | 'succeeded' | 'failed';
export type ToolInvocationEvent =
  | { type: 'EXPAND' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'COLLAPSE' }
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function toolInvocationReducer(state: ToolInvocationState, event: ToolInvocationEvent): ToolInvocationState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: '\u25CB', color: 'gray' },
  running: { icon: '\u25D4', color: 'yellow' },
  succeeded: { icon: '\u2713', color: 'green' },
  failed: { icon: '\u2717', color: 'red' },
  collapsed: { icon: '\u25B6', color: 'white' },
  hoveredCollapsed: { icon: '\u25B6', color: 'cyan' },
  expanded: { icon: '\u25BC', color: 'white' },
};

export interface ToolInvocationProps {
  toolName: string;
  arguments: string;
  result?: string | undefined;
  status: string;
  duration?: number | undefined;
  showArguments?: boolean;
  showResult?: boolean;
  defaultExpanded?: boolean;
  onRetry?: () => void;
  isFocused?: boolean;
}

export function ToolInvocation({
  toolName,
  arguments: args,
  result,
  status,
  duration,
  showArguments = true,
  showResult = true,
  defaultExpanded = false,
  onRetry,
  isFocused = false,
}: ToolInvocationProps) {
  const initialState: ToolInvocationState =
    status === 'running' ? 'running' :
    status === 'succeeded' ? 'succeeded' :
    status === 'failed' ? 'failed' :
    status === 'pending' ? 'pending' :
    defaultExpanded ? 'expanded' : 'collapsed';
  const [state, send] = useReducer(toolInvocationReducer, initialState);

  useEffect(() => {
    if (isFocused && state === 'collapsed') send({ type: 'HOVER' });
    if (!isFocused && state === 'hoveredCollapsed') send({ type: 'LEAVE' });
  }, [isFocused]);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.return || input === ' ') {
      if (state === 'collapsed' || state === 'hoveredCollapsed') send({ type: 'EXPAND' });
      else if (state === 'expanded') send({ type: 'COLLAPSE' });
    }
    if (input === 'r' && state === 'failed') {
      send({ type: 'RETRY' });
      onRetry?.();
    }
  });

  const { icon, color } = STATUS_ICONS[state] ?? STATUS_ICONS.pending;
  const isExpanded = state === 'expanded' || state === 'succeeded' || state === 'failed';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box>
        <Text color={color}>{icon} </Text>
        <Text color="magenta">{'\u2692'} </Text>
        <Text bold>{toolName}</Text>
        {duration !== undefined && <Text color="gray"> ({duration}ms)</Text>}
        {state === 'running' && <Text color="yellow"> running...</Text>}
      </Box>

      {isExpanded && showArguments && args && (
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          <Text color="gray" bold>Arguments:</Text>
          {args.split('\n').map((line, i) => (
            <Text key={i} color="gray">{line}</Text>
          ))}
        </Box>
      )}

      {isExpanded && showResult && result && (
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          <Text color={state === 'failed' ? 'red' : 'green'} bold>
            {state === 'failed' ? 'Error:' : 'Result:'}
          </Text>
          {result.split('\n').map((line, i) => (
            <Text key={i} wrap="wrap">{line}</Text>
          ))}
        </Box>
      )}

      {isFocused && state === 'failed' && (
        <Box marginTop={1}>
          <Text color="gray">[r]etry</Text>
        </Box>
      )}
    </Box>
  );
}

export default ToolInvocation;
