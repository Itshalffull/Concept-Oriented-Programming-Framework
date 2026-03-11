export type ConversationSidebarState = 'idle' | 'searching' | 'contextOpen';
export type ConversationSidebarEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT' }
  | { type: 'CONTEXT_MENU' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'CLOSE_CONTEXT' }
  | { type: 'ACTION' };

export function conversationSidebarReducer(state: ConversationSidebarState, event: ConversationSidebarEvent): ConversationSidebarState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT') return 'idle';
      if (event.type === 'CONTEXT_MENU') return 'contextOpen';
      return state;
    case 'searching':
      if (event.type === 'CLEAR_SEARCH') return 'idle';
      if (event.type === 'SELECT') return 'idle';
      return state;
    case 'contextOpen':
      if (event.type === 'CLOSE_CONTEXT') return 'idle';
      if (event.type === 'ACTION') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface ConversationSidebarProps {
  conversations: Array<{ id: string; title: string; preview?: string; model?: string; date?: string }>;
  selectedId?: string | undefined;
  groupBy?: 'date' | 'folder' | 'tag';
  showPreview?: boolean;
  showModel?: boolean;
  onSelect?: (id: string) => void;
  onNew?: () => void;
  onDelete?: (id: string) => void;
  isFocused?: boolean;
}

export function ConversationSidebar({
  conversations,
  selectedId,
  groupBy,
  showPreview = false,
  showModel = false,
  onSelect,
  onNew,
  onDelete,
  isFocused = false,
}: ConversationSidebarProps) {
  const [state, send] = useReducer(conversationSidebarReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'contextOpen') {
      if (input === 'd') {
        const conv = filtered[cursorIndex];
        if (conv) onDelete?.(conv.id);
        send({ type: 'ACTION' });
      }
      if (key.escape) send({ type: 'CLOSE_CONTEXT' });
      return;
    }

    if (state === 'searching') {
      if (key.escape) {
        send({ type: 'CLEAR_SEARCH' });
        setSearchQuery('');
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
        return;
      }
      if (key.return && filtered.length > 0) {
        send({ type: 'SELECT' });
        onSelect?.(filtered[cursorIndex]?.id ?? '');
        setSearchQuery('');
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery(prev => prev + input);
        return;
      }
    }

    if (input === '/' && state === 'idle') {
      send({ type: 'SEARCH' });
      setSearchQuery('');
      return;
    }

    if (input === 'x' && state === 'idle') {
      send({ type: 'CONTEXT_MENU' });
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(filtered.length - 1, prev + 1));
    }
    if (key.return && filtered[cursorIndex]) {
      send({ type: 'SELECT' });
      onSelect?.(filtered[cursorIndex].id);
    }
    if (input === 'n') onNew?.();
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Text bold>Conversations</Text>
        <Text color="gray">{conversations.length}</Text>
      </Box>

      {state === 'searching' && (
        <Box marginTop={1}>
          <Text color="cyan">{'\u{1F50D}'} </Text>
          <Text>{searchQuery || <Text color="gray">Search...</Text>}</Text>
          <Text color="cyan">{'\u2588'}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {filtered.map((conv, i) => {
          const isActive = conv.id === selectedId;
          const isCursor = i === cursorIndex && isFocused;
          return (
            <Box key={conv.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : isActive ? 'green' : 'white'}>
                  {isCursor ? '\u25B6 ' : isActive ? '\u25CF ' : '  '}
                </Text>
                <Text bold={isActive}>{conv.title}</Text>
                {showModel && conv.model && <Text color="gray"> [{conv.model}]</Text>}
              </Box>
              {showPreview && isCursor && conv.preview && (
                <Box paddingLeft={2}>
                  <Text color="gray" wrap="truncate">{conv.preview}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {state === 'contextOpen' && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow">
          <Text color="yellow">[d]elete [Esc] Cancel</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">
          [{'\u2191\u2193'}] Nav [Enter] Select [/] Search [n] New [x] Menu
        </Text>
      </Box>
    </Box>
  );
}

export default ConversationSidebar;
