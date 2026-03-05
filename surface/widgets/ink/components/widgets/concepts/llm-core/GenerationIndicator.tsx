export type GenerationIndicatorState = 'idle' | 'generating' | 'complete' | 'error';
export type GenerationIndicatorEvent =
  | { type: 'START' }
  | { type: 'TOKEN' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function generationIndicatorReducer(state: GenerationIndicatorState, event: GenerationIndicatorEvent): GenerationIndicatorState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'generating';
      return state;
    case 'generating':
      if (event.type === 'TOKEN') return 'generating';
      if (event.type === 'COMPLETE') return 'complete';
      if (event.type === 'ERROR') return 'error';
      return state;
    case 'complete':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'START') return 'generating';
      return state;
    case 'error':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'generating';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useEffect, useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
const DOT_FRAMES = ['.  ', '.. ', '...', '   '];
const BAR_FRAMES = ['[=   ]', '[ =  ]', '[  = ]', '[   =]', '[  = ]', '[ =  ]'];

export interface GenerationIndicatorProps {
  status: string;
  model?: string | undefined;
  tokenCount?: number | undefined;
  showTokens?: boolean;
  showModel?: boolean;
  showElapsed?: boolean;
  variant?: 'dots' | 'spinner' | 'bar';
  elapsed?: number;
  error?: string;
  onRetry?: () => void;
  isFocused?: boolean;
}

export function GenerationIndicator({
  status,
  model,
  tokenCount,
  showTokens = true,
  showModel = true,
  showElapsed = false,
  variant = 'spinner',
  elapsed,
  error,
  onRetry,
  isFocused = false,
}: GenerationIndicatorProps) {
  const [state, send] = useReducer(generationIndicatorReducer, 'idle');
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (status === 'generating' && state !== 'generating') send({ type: 'START' });
    if (status === 'complete' && state !== 'complete') send({ type: 'COMPLETE' });
    if (status === 'error' && state !== 'error') send({ type: 'ERROR' });
  }, [status]);

  useEffect(() => {
    if (state === 'generating') {
      intervalRef.current = setInterval(() => {
        setFrame(prev => prev + 1);
      }, 120);
      return () => clearInterval(intervalRef.current);
    }
  }, [state]);

  useInput((input) => {
    if (!isFocused) return;
    if (input === 'r' && state === 'error') {
      send({ type: 'RETRY' });
      onRetry?.();
    }
  });

  const frames = variant === 'dots' ? DOT_FRAMES : variant === 'bar' ? BAR_FRAMES : SPINNER_FRAMES;
  const currentFrame = frames[frame % frames.length];

  if (state === 'idle') {
    return (
      <Box>
        <Text color="gray">{'\u25CB'} Ready</Text>
        {showModel && model && <Text color="gray"> [{model}]</Text>}
      </Box>
    );
  }

  if (state === 'complete') {
    return (
      <Box>
        <Text color="green">{'\u2713'} Complete</Text>
        {showTokens && tokenCount !== undefined && <Text color="gray"> {tokenCount} tokens</Text>}
        {showModel && model && <Text color="gray"> [{model}]</Text>}
        {showElapsed && elapsed !== undefined && <Text color="gray"> {(elapsed / 1000).toFixed(1)}s</Text>}
      </Box>
    );
  }

  if (state === 'error') {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="red">{'\u2717'} Error</Text>
          {error && <Text color="red"> {error}</Text>}
        </Box>
        {isFocused && <Text color="gray">[r]etry</Text>}
      </Box>
    );
  }

  return (
    <Box>
      <Text color="yellow">{currentFrame} </Text>
      <Text color="yellow">Generating</Text>
      {showTokens && tokenCount !== undefined && <Text color="gray"> {tokenCount} tokens</Text>}
      {showModel && model && <Text color="gray"> [{model}]</Text>}
      {showElapsed && elapsed !== undefined && <Text color="gray"> {(elapsed / 1000).toFixed(1)}s</Text>}
    </Box>
  );
}

export default GenerationIndicator;
