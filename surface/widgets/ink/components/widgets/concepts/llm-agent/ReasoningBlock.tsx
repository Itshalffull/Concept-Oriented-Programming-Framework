export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'STREAM_START' }
  | { type: 'COLLAPSE' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'expanded';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

export interface ReasoningBlockProps {
  content: string;
  collapsed: boolean;
  defaultExpanded?: boolean;
  showDuration?: boolean;
  streaming?: boolean;
  duration?: number;
  isFocused?: boolean;
}

export function ReasoningBlock({
  content,
  collapsed: collapsedProp,
  defaultExpanded = false,
  showDuration = false,
  streaming = false,
  duration,
  isFocused = false,
}: ReasoningBlockProps) {
  const initialState: ReasoningBlockState = streaming ? 'streaming' : defaultExpanded ? 'expanded' : 'collapsed';
  const [state, send] = useReducer(reasoningBlockReducer, initialState);

  useEffect(() => {
    if (streaming) send({ type: 'STREAM_START' });
    else if (state === 'streaming') send({ type: 'STREAM_END' });
  }, [streaming]);

  useEffect(() => {
    if (state === 'streaming' && content) send({ type: 'TOKEN' });
  }, [content]);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.return || input === ' ') {
      if (state === 'collapsed') send({ type: 'EXPAND' });
      else if (state === 'expanded') send({ type: 'COLLAPSE' });
    }
  });

  const summary = content.length > 60 ? content.slice(0, 60) + '...' : content;
  const isOpen = state === 'expanded' || state === 'streaming';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : 'gray'}>
      <Box>
        <Text color="magenta">{'\u{1F4AD}'} </Text>
        <Text color={isOpen ? 'white' : 'gray'}>
          {isOpen ? '\u25BC' : '\u25B6'}{' '}
        </Text>
        {state === 'streaming' ? (
          <Text color="yellow" bold>Thinking...</Text>
        ) : (
          <Text color="gray" bold>{isOpen ? 'Reasoning' : summary}</Text>
        )}
        {showDuration && duration !== undefined && (
          <Text color="gray"> ({(duration / 1000).toFixed(1)}s)</Text>
        )}
      </Box>

      {isOpen && (
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          {content.split('\n').map((line, i) => (
            <Text key={i} color="gray" wrap="wrap" dimColor>{line}</Text>
          ))}
          {state === 'streaming' && <Text color="yellow">{'\u2588'}</Text>}
        </Box>
      )}

      {isFocused && (
        <Text color="gray">[Enter] {isOpen ? 'Collapse' : 'Expand'}</Text>
      )}
    </Box>
  );
}

export default ReasoningBlock;
