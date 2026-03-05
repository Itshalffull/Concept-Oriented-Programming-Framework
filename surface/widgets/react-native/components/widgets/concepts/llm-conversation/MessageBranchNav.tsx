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

import React, { forwardRef, useReducer, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface MessageBranchNavProps {
  currentIndex: number;
  totalBranches: number;
  showEdit?: boolean;
  compact?: boolean;
  onPrevBranch?: () => void;
  onNextBranch?: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

const MessageBranchNav = forwardRef<View, MessageBranchNavProps>(function MessageBranchNav(
  { currentIndex, totalBranches, showEdit = true, compact = false, onPrevBranch, onNextBranch, onEdit, onSave, onCancel },
  ref,
) {
  const [state, send] = useReducer(messageBranchNavReducer, 'viewing');

  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalBranches - 1;
  const displayIndex = currentIndex + 1;

  const handlePrev = useCallback(() => { if (isFirst) return; send({ type: 'PREV' }); onPrevBranch?.(); }, [isFirst, onPrevBranch]);
  const handleNext = useCallback(() => { if (isLast) return; send({ type: 'NEXT' }); onNextBranch?.(); }, [isLast, onNextBranch]);
  const handleEdit = useCallback(() => { send({ type: 'EDIT' }); onEdit?.(); }, [onEdit]);
  const handleSave = useCallback(() => { send({ type: 'SAVE' }); onSave?.(); }, [onSave]);
  const handleCancel = useCallback(() => { send({ type: 'CANCEL' }); onCancel?.(); }, [onCancel]);

  return (
    <View ref={ref} testID="message-branch-nav" accessibilityRole="none"
      accessibilityLabel={`Branch ${displayIndex} of ${totalBranches}`} style={s.root}>
      <Pressable onPress={handlePrev} accessibilityRole="button" accessibilityLabel="Previous version" disabled={isFirst}
        style={[s.navBtn, isFirst && s.disabled]}>
        <Text style={[s.navBtnText, isFirst && s.disabledText]}>{'\u25C0'}</Text>
      </Pressable>
      <Text style={s.indicator}>{displayIndex} / {totalBranches}</Text>
      <Pressable onPress={handleNext} accessibilityRole="button" accessibilityLabel="Next version" disabled={isLast}
        style={[s.navBtn, isLast && s.disabled]}>
        <Text style={[s.navBtnText, isLast && s.disabledText]}>{'\u25B6'}</Text>
      </Pressable>
      {showEdit && state === 'viewing' && (
        <Pressable onPress={handleEdit} accessibilityRole="button" accessibilityLabel="Edit and branch" style={s.editBtn}>
          <Text style={s.editBtnText}>{'\u270E'}</Text>
        </Pressable>
      )}
      {state === 'editing' && (
        <>
          <Pressable onPress={handleSave} accessibilityRole="button" accessibilityLabel="Save edit" style={s.saveBtn}>
            <Text style={s.saveBtnText}>{'\u2713'}</Text>
          </Pressable>
          <Pressable onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Cancel edit" style={s.cancelBtn}>
            <Text style={s.cancelBtnText}>{'\u2715'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { padding: 6 },
  navBtnText: { fontSize: 14 },
  disabled: { opacity: 0.3 },
  disabledText: { color: '#9ca3af' },
  indicator: { fontSize: 13, color: '#6b7280', minWidth: 48, textAlign: 'center' },
  editBtn: { padding: 6, marginLeft: 4 },
  editBtnText: { fontSize: 14 },
  saveBtn: { padding: 6, marginLeft: 4 },
  saveBtnText: { fontSize: 14, color: '#22c55e' },
  cancelBtn: { padding: 6 },
  cancelBtnText: { fontSize: 14, color: '#ef4444' },
});

MessageBranchNav.displayName = 'MessageBranchNav';
export { MessageBranchNav };
export default MessageBranchNav;
