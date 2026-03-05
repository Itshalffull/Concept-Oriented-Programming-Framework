export type ChatMessageState = 'idle' | 'hovered' | 'streaming' | 'copied';
export type ChatMessageEvent =
  | { type: 'HOVER' }
  | { type: 'STREAM_START' }
  | { type: 'COPY' }
  | { type: 'LEAVE' }
  | { type: 'STREAM_END' }
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

import React, { useReducer, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

const ROLE_AVATARS: Record<string, string> = {
  user: '\u25CF',
  assistant: '\u25B6',
  system: '\u2699',
  tool: '\u2692',
};

const ROLE_COLORS: Record<string, string> = {
  user: 'cyan',
  assistant: 'green',
  system: 'yellow',
  tool: 'magenta',
};

export interface ChatMessageProps {
  role: string;
  content: string;
  timestamp: string;
  variant?: 'default' | 'compact' | 'bubble';
  showAvatar?: boolean;
  showTimestamp?: boolean;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  isFocused?: boolean;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  variant = 'default',
  showAvatar = true,
  showTimestamp = true,
  isStreaming = false,
  onCopy,
  onRegenerate,
  onEdit,
  isFocused = false,
}: ChatMessageProps) {
  const [state, send] = useReducer(chatMessageReducer, isStreaming ? 'streaming' : 'idle');

  useEffect(() => {
    if (isStreaming) send({ type: 'STREAM_START' });
    else send({ type: 'STREAM_END' });
  }, [isStreaming]);

  useEffect(() => {
    if (state === 'copied') {
      const timer = setTimeout(() => send({ type: 'COPY_TIMEOUT' }), 2000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const handleCopy = useCallback(() => {
    send({ type: 'COPY' });
    onCopy?.();
  }, [onCopy]);

  useInput((input, key) => {
    if (!isFocused) return;
    if (input === 'c') handleCopy();
    if (input === 'r' && onRegenerate && role === 'assistant') onRegenerate();
    if (input === 'e' && onEdit && role === 'user') onEdit();
  });

  const roleColor = ROLE_COLORS[role] ?? 'white';
  const avatar = ROLE_AVATARS[role] ?? role.charAt(0).toUpperCase();
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  if (variant === 'compact') {
    return (
      <Box>
        {showAvatar && <Text color={roleColor}>{avatar} </Text>}
        <Text color={roleColor} bold>{roleLabel}: </Text>
        <Text>{content}</Text>
        {state === 'streaming' && <Text color="yellow"> \u2588</Text>}
        {state === 'copied' && <Text color="green"> [Copied]</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? roleColor : undefined}>
      <Box>
        {showAvatar && <Text color={roleColor}>{avatar} </Text>}
        <Text color={roleColor} bold>{roleLabel}</Text>
        {showTimestamp && <Text color="gray"> {timestamp}</Text>}
        {state === 'copied' && <Text color="green"> [Copied]</Text>}
      </Box>
      <Box paddingLeft={showAvatar ? 2 : 0}>
        <Text wrap="wrap">{content}</Text>
        {state === 'streaming' && <Text color="yellow">{'\u2588'}</Text>}
      </Box>
      {isFocused && state !== 'streaming' && (
        <Box>
          <Text color="gray">
            [c]opy
            {onRegenerate && role === 'assistant' ? ' [r]egenerate' : ''}
            {onEdit && role === 'user' ? ' [e]dit' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ChatMessage;
