export type ChatMessageState = 'idle' | 'hovered' | 'streaming' | 'copied';
export type ChatMessageEvent =
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' }
  | { type: 'COPY' }
  | { type: 'COPY_TIMEOUT' };

export function chatMessageReducer(state: ChatMessageState, event: ChatMessageEvent): ChatMessageState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STREAM_START') return 'streaming';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'STREAM_END') return 'idle';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useEffect, useRef, useReducer, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const ROLE_AVATARS: Record<string, string> = { user: '\uD83D\uDC64', assistant: '\uD83E\uDD16', system: '\u2699\uFE0F', tool: '\uD83D\uDD27' };
const ROLE_LABELS: Record<string, string> = { user: 'User', assistant: 'Assistant', system: 'System', tool: 'Tool' };

export interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  variant?: 'default' | 'compact' | 'bubble';
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  children?: ReactNode;
}

const ChatMessage = forwardRef<View, ChatMessageProps>(function ChatMessage(
  { role: messageRole, content, timestamp, variant = 'default', showAvatar = true, showTimestamp = true,
    isStreaming = false, onCopy, onRegenerate, onEdit, children },
  ref,
) {
  const [state, send] = useReducer(chatMessageReducer, isStreaming ? 'streaming' : 'idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isStreaming) send({ type: 'STREAM_START' });
    else send({ type: 'STREAM_END' });
  }, [isStreaming]);

  useEffect(() => {
    if (state === 'copied') {
      timerRef.current = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      return () => clearTimeout(timerRef.current);
    }
  }, [state]);

  const handleCopy = useCallback(async () => {
    try { await Clipboard.setStringAsync(content); } catch { /* noop */ }
    send({ type: 'COPY' });
    onCopy?.();
  }, [content, onCopy]);

  const roleLabel = ROLE_LABELS[messageRole] ?? messageRole;
  const actionsVisible = !isStreaming;

  return (
    <Pressable ref={ref} testID="chat-message" accessibilityRole="none" accessibilityLabel={`${roleLabel} message`}
      onPressIn={() => send({ type: 'HOVER' })} onPressOut={() => send({ type: 'LEAVE' })}
      style={[s.root, messageRole === 'user' && s.rootUser]}>
      {showAvatar && (
        <View style={s.avatar}>
          <Text style={s.avatarText}>{ROLE_AVATARS[messageRole] ?? messageRole.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={s.bodyWrap}>
        <Text style={s.roleLabel}>{roleLabel}</Text>
        <View style={s.body}>
          {children ?? <Text style={s.content}>{content}</Text>}
          {isStreaming && <Text style={s.cursor}>{'\u258C'}</Text>}
        </View>
        {showTimestamp && <Text style={s.timestamp}>{timestamp}</Text>}
        {actionsVisible && (
          <View style={s.actions}>
            <Pressable onPress={handleCopy} accessibilityRole="button"
              accessibilityLabel={state === 'copied' ? 'Copied to clipboard' : 'Copy message'}>
              <Text style={s.actionBtn}>{state === 'copied' ? 'Copied!' : 'Copy'}</Text>
            </Pressable>
            {onRegenerate && messageRole === 'assistant' && (
              <Pressable onPress={onRegenerate} accessibilityRole="button" accessibilityLabel="Regenerate message">
                <Text style={s.actionBtn}>Regenerate</Text>
              </Pressable>
            )}
            {onEdit && messageRole === 'user' && (
              <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit message">
                <Text style={s.actionBtn}>Edit</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  root: { flexDirection: 'row', padding: 12, gap: 10 },
  rootUser: { backgroundColor: '#f9fafb' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16 },
  bodyWrap: { flex: 1 },
  roleLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 2 },
  body: { flexDirection: 'row', flexWrap: 'wrap' },
  content: { fontSize: 14, lineHeight: 22 },
  cursor: { color: '#6366f1', fontSize: 14 },
  timestamp: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  actionBtn: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
});

ChatMessage.displayName = 'ChatMessage';
export { ChatMessage };
export default ChatMessage;
