export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'TOGGLE' }
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND' || event.type === 'TOGGLE') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE' || event.type === 'TOGGLE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'collapsed';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useReducer } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface ReasoningBlockProps {
  content: string;
  collapsed: boolean;
  onToggle?: () => void;
  defaultExpanded?: boolean;
  showDuration?: boolean;
  streaming?: boolean;
  duration?: number | undefined;
}

const ReasoningBlock = forwardRef<View, ReasoningBlockProps>(function ReasoningBlock(
  { content, collapsed, onToggle, defaultExpanded = false, showDuration = true, streaming = false, duration },
  ref,
) {
  const initialState: ReasoningBlockState = streaming ? 'streaming' : defaultExpanded ? 'expanded' : 'collapsed';
  const [state, send] = useReducer(reasoningBlockReducer, initialState);

  useEffect(() => {
    if (streaming && state !== 'streaming') send({ type: 'STREAM_START' });
    if (!streaming && state === 'streaming') send({ type: 'STREAM_END' });
  }, [streaming, state]);

  const isBodyVisible = state === 'expanded' || state === 'streaming';

  const handleToggle = useCallback(() => {
    if (state === 'streaming') return;
    send({ type: 'TOGGLE' });
    onToggle?.();
  }, [state, onToggle]);

  const headerText = state === 'streaming' ? 'Thinking...' : 'Reasoning';

  return (
    <View ref={ref} testID="reasoning-block" accessibilityRole="none" accessibilityLabel="Model reasoning" style={s.root}>
      <Pressable onPress={handleToggle} accessibilityRole="button" accessibilityLabel="Toggle reasoning details"
        accessibilityState={{ expanded: isBodyVisible }} style={s.header}>
        <Text style={s.icon} aria-hidden>{'\uD83E\uDDE0'}</Text>
        <Text style={s.headerText}>{headerText}</Text>
        {showDuration && state !== 'streaming' && duration != null && (
          <Text style={s.duration}>{`${duration}ms`}</Text>
        )}
      </Pressable>
      {isBodyVisible && (
        <View accessibilityRole="none" accessibilityLabel="Reasoning content" style={s.body}>
          <Text style={s.content}>{content}</Text>
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  icon: { fontSize: 18 },
  headerText: { fontSize: 14, fontWeight: '600', flex: 1 },
  duration: { fontSize: 12, color: '#6b7280' },
  body: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  content: { fontSize: 13, lineHeight: 20 },
});

ReasoningBlock.displayName = 'ReasoningBlock';
export { ReasoningBlock };
export default ReasoningBlock;
