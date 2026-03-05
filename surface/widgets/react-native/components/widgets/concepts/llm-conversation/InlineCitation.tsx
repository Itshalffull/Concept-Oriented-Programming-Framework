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

import React, { forwardRef, useCallback, useEffect, useReducer, type ReactNode } from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';

export interface InlineCitationProps {
  index: number;
  title: string;
  url?: string | undefined;
  excerpt?: string | undefined;
  size?: 'sm' | 'md';
  showPreviewOnHover?: boolean;
  children?: ReactNode;
}

const InlineCitation = forwardRef<View, InlineCitationProps>(function InlineCitation(
  { index, title, url, excerpt, size = 'sm', showPreviewOnHover = true, children },
  ref,
) {
  const [state, send] = useReducer(inlineCitationReducer, 'idle');

  const handleOpen = useCallback(() => {
    if (url) Linking.openURL(url).catch(() => {});
    send({ type: 'CLICK' });
  }, [url]);

  useEffect(() => {
    if (state === 'navigating') send({ type: 'NAVIGATE_COMPLETE' });
  }, [state]);

  return (
    <View ref={ref} testID="inline-citation" style={s.root}>
      <Pressable onPress={handleOpen}
        onPressIn={() => showPreviewOnHover && send({ type: 'HOVER' })}
        onPressOut={() => send({ type: 'LEAVE' })}
        accessibilityRole="link" accessibilityLabel={`Citation ${index}: ${title}`}>
        <Text style={[s.badge, size === 'md' && s.badgeMd]}>[{index}]</Text>
      </Pressable>
      {state === 'previewing' && (
        <View style={s.tooltip}>
          <Text style={s.tooltipTitle}>{title}</Text>
          {excerpt && <Text style={s.tooltipExcerpt}>{excerpt}</Text>}
          {url && <Text style={s.tooltipUrl} numberOfLines={1}>{url}</Text>}
        </View>
      )}
      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { position: 'relative' },
  badge: { fontSize: 10, color: '#2563eb', textDecorationLine: 'underline' },
  badgeMd: { fontSize: 12 },
  tooltip: { position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, padding: 8, minWidth: 180, maxWidth: 260, backgroundColor: '#1f2937', borderRadius: 6, zIndex: 10 },
  tooltipTitle: { fontSize: 13, fontWeight: '600', color: '#f9fafb', marginBottom: 2 },
  tooltipExcerpt: { fontSize: 12, color: '#d1d5db', marginBottom: 4 },
  tooltipUrl: { fontSize: 11, color: '#9ca3af' },
});

InlineCitation.displayName = 'InlineCitation';
export { InlineCitation };
export default InlineCitation;
