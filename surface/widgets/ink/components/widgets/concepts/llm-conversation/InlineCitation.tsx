export type InlineCitationState = 'idle' | 'previewing' | 'navigating';
export type InlineCitationEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'LEAVE' }
  | { type: 'NAVIGATE_COMPLETE' };

export function inlineCitationReducer(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'previewing';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'previewing':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

export interface InlineCitationProps {
  index: number;
  title: string;
  url?: string | undefined;
  excerpt?: string | undefined;
  size?: 'sm' | 'md';
  showPreviewOnHover?: boolean;
  isFocused?: boolean;
}

export function InlineCitation({
  index,
  title,
  url,
  excerpt,
  size = 'md',
  isFocused = false,
}: InlineCitationProps) {
  const [state, send] = useReducer(inlineCitationReducer, 'idle');

  useEffect(() => {
    if (isFocused && state === 'idle') send({ type: 'HOVER' });
    if (!isFocused && state === 'previewing') send({ type: 'LEAVE' });
  }, [isFocused]);

  useEffect(() => {
    if (state === 'navigating') {
      const timer = setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.return || input === ' ') send({ type: 'CLICK' });
  });

  if (state === 'idle' && !isFocused) {
    return <Text color="cyan">[{index}]</Text>;
  }

  if (state === 'navigating') {
    return (
      <Box>
        <Text color="cyan">[{index}]</Text>
        <Text color="yellow"> Opening...</Text>
      </Box>
    );
  }

  if (size === 'sm') {
    return (
      <Box>
        <Text color="cyan" bold>[{index}]</Text>
        <Text> {title}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan">
      <Box>
        <Text color="cyan" bold>[{index}] </Text>
        <Text bold>{title}</Text>
      </Box>
      {url && (
        <Box paddingLeft={2}>
          <Text color="blue" underline>{url}</Text>
        </Box>
      )}
      {excerpt && (
        <Box paddingLeft={2}>
          <Text color="gray" wrap="wrap">{'\u201C'}{excerpt}{'\u201D'}</Text>
        </Box>
      )}
      {isFocused && (
        <Text color="gray">[Enter] Open source</Text>
      )}
    </Box>
  );
}

export default InlineCitation;
