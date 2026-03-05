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

import React, { forwardRef, useReducer, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export interface StreamTextProps {
  content: string;
  streaming: boolean;
  onStop?: () => void;
  cursorStyle?: 'bar' | 'block' | 'underline';
}

const StreamText = forwardRef<View, StreamTextProps>(function StreamText(
  { content, streaming, onStop, cursorStyle = 'bar' },
  ref,
) {
  const [state, send] = useReducer(streamTextReducer, streaming ? 'streaming' : 'idle');
  const scrollRef = useRef<ScrollView>(null);
  const prevStreamingRef = useRef(streaming);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = streaming;
    if (streaming && !wasStreaming) send({ type: 'STREAM_START' });
    else if (!streaming && wasStreaming) send({ type: 'STREAM_END' });
  }, [streaming]);

  useEffect(() => {
    if (state === 'streaming' && content) send({ type: 'TOKEN' });
  }, [content, state]);

  useEffect(() => {
    if (state === 'streaming') scrollRef.current?.scrollToEnd({ animated: true });
  }, [content, state]);

  const handleStop = useCallback(() => {
    if (state !== 'streaming') return;
    send({ type: 'STOP' });
    onStop?.();
  }, [state, onStop]);

  const isStreaming = state === 'streaming';
  const cursorChar = cursorStyle === 'bar' ? '\u258C' : cursorStyle === 'block' ? '\u2588' : '\u2582';

  return (
    <View ref={ref} testID="stream-text" accessibilityRole="none" accessibilityLabel="Streaming response"
      accessibilityLiveRegion="polite" style={s.root}>
      <ScrollView ref={scrollRef} style={s.scroll}>
        <Text style={s.content}>
          {content}
          {isStreaming && <Text style={s.cursor}>{cursorChar}</Text>}
        </Text>
      </ScrollView>
      {isStreaming && (
        <Pressable onPress={handleStop} accessibilityRole="button" accessibilityLabel="Stop generation" style={s.stopBtn}>
          <Text style={s.stopBtnText}>Stop</Text>
        </Pressable>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { fontSize: 14, lineHeight: 22, padding: 12 },
  cursor: { color: '#6366f1' },
  stopBtn: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  stopBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

StreamText.displayName = 'StreamText';
export { StreamText };
export default StreamText;
