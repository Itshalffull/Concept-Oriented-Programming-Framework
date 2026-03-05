export type StreamTextState = 'idle' | 'streaming' | 'complete' | 'stopped';
export type StreamTextEvent =
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' }
  | { type: 'STOP' };

export function streamTextReducer(state: StreamTextState, event: StreamTextEvent): StreamTextState {
  switch (state) {
    case 'idle':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'complete';
      if (event.type === 'STOP') return 'stopped';
      return state;
    case 'complete':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'stopped':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface StreamTextProps {
  content: string;
  streaming: boolean;
  renderMarkdown?: boolean;
  cursorStyle?: 'bar' | 'block' | 'underline';
  smoothScroll?: boolean;
  onStop?: () => void;
  isFocused?: boolean;
}

const CURSOR_CHARS: Record<string, string> = {
  bar: '\u2502',
  block: '\u2588',
  underline: '_',
};

export function StreamText({
  content,
  streaming,
  renderMarkdown = true,
  cursorStyle = 'bar',
  onStop,
  isFocused = false,
}: StreamTextProps) {
  const [state, send] = useReducer(streamTextReducer, streaming ? 'streaming' : 'idle');
  const prevStreamingRef = useRef(streaming);

  useEffect(() => {
    const was = prevStreamingRef.current;
    prevStreamingRef.current = streaming;
    if (streaming && !was) send({ type: 'STREAM_START' });
    else if (!streaming && was) send({ type: 'STREAM_END' });
  }, [streaming]);

  useEffect(() => {
    if (state === 'streaming' && content) send({ type: 'TOKEN' });
  }, [content, state]);

  const handleStop = useCallback(() => {
    if (state !== 'streaming') return;
    send({ type: 'STOP' });
    onStop?.();
  }, [state, onStop]);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.escape || input === 'q') handleStop();
  });

  const isActive = state === 'streaming';
  const cursor = CURSOR_CHARS[cursorStyle] ?? CURSOR_CHARS.bar;

  return (
    <Box flexDirection="column">
      <Box>
        <Text wrap="wrap">
          {content}
          {isActive && <Text color="yellow">{cursor}</Text>}
        </Text>
      </Box>
      {isActive && (
        <Box marginTop={1}>
          <Text color="red">[Esc] Stop generation</Text>
        </Box>
      )}
      {state === 'stopped' && (
        <Box marginTop={1}>
          <Text color="yellow">\u23F9 Generation stopped</Text>
        </Box>
      )}
      {state === 'complete' && (
        <Box marginTop={1}>
          <Text color="green">\u2713 Complete</Text>
        </Box>
      )}
    </Box>
  );
}

export default StreamText;
