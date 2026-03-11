export type MessageBranchNavState = 'viewing' | 'editing';
export type MessageBranchNavEvent =
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'EDIT' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function messageBranchNavReducer(state: MessageBranchNavState, event: MessageBranchNavEvent): MessageBranchNavState {
  switch (state) {
    case 'viewing':
      if (event.type === 'PREV') return 'viewing';
      if (event.type === 'NEXT') return 'viewing';
      if (event.type === 'EDIT') return 'editing';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface MessageBranchNavProps {
  currentIndex: number;
  totalBranches: number;
  showEdit?: boolean;
  compact?: boolean;
  onNavigate?: (index: number) => void;
  onEdit?: () => void;
  onSave?: () => void;
  isFocused?: boolean;
}

export function MessageBranchNav({
  currentIndex,
  totalBranches,
  showEdit = false,
  compact = false,
  onNavigate,
  onEdit,
  onSave,
  isFocused = false,
}: MessageBranchNavProps) {
  const [state, send] = useReducer(messageBranchNavReducer, 'viewing');

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      send({ type: 'PREV' });
      onNavigate?.(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < totalBranches - 1) {
      send({ type: 'NEXT' });
      onNavigate?.(currentIndex + 1);
    }
  }, [currentIndex, totalBranches, onNavigate]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'viewing') {
      if (key.leftArrow || input === 'h') goPrev();
      if (key.rightArrow || input === 'l') goNext();
      if (input === 'e' && showEdit) {
        send({ type: 'EDIT' });
        onEdit?.();
      }
    }

    if (state === 'editing') {
      if (key.return) {
        send({ type: 'SAVE' });
        onSave?.();
      }
      if (key.escape) send({ type: 'CANCEL' });
    }
  });

  if (totalBranches <= 1 && !showEdit) return null;

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < totalBranches - 1;

  if (state === 'editing') {
    return (
      <Box>
        <Text color="yellow">[Editing branch] </Text>
        <Text color="gray">[Enter] Save [Esc] Cancel</Text>
      </Box>
    );
  }

  if (compact) {
    return (
      <Box>
        <Text color={canPrev ? 'cyan' : 'gray'}>{'\u25C0'}</Text>
        <Text> {currentIndex + 1}/{totalBranches} </Text>
        <Text color={canNext ? 'cyan' : 'gray'}>{'\u25B6'}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={canPrev ? 'cyan' : 'gray'}>{'\u25C0'} prev </Text>
      <Text bold>{currentIndex + 1}</Text>
      <Text color="gray"> / {totalBranches}</Text>
      <Text color={canNext ? 'cyan' : 'gray'}> next {'\u25B6'}</Text>
      {showEdit && <Text color="gray"> [e]dit</Text>}
    </Box>
  );
}

export default MessageBranchNav;
