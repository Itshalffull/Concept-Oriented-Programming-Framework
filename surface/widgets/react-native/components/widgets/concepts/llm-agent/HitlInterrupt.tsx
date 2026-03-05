export type HitlInterruptState = 'pending' | 'editing' | 'approving' | 'rejecting' | 'forking';
export type HitlInterruptEvent = | { type: 'APPROVE' } | { type: 'REJECT' } | { type: 'MODIFY' } | { type: 'FORK' } | { type: 'SAVE' } | { type: 'CANCEL' } | { type: 'COMPLETE' } | { type: 'ERROR' };
export function hitlInterruptReducer(state: HitlInterruptState, event: HitlInterruptEvent): HitlInterruptState {
  switch (state) {
    case 'pending': if (event.type === 'APPROVE') return 'approving'; if (event.type === 'REJECT') return 'rejecting'; if (event.type === 'MODIFY') return 'editing'; if (event.type === 'FORK') return 'forking'; return state;
    case 'editing': if (event.type === 'SAVE' || event.type === 'CANCEL') return 'pending'; return state;
    case 'approving': if (event.type === 'COMPLETE') return 'pending'; if (event.type === 'ERROR') return 'pending'; return state;
    case 'rejecting': if (event.type === 'COMPLETE') return 'pending'; return state;
    case 'forking': if (event.type === 'COMPLETE') return 'pending'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';

export interface HitlInterruptProps {
  reason: string; agentState?: string; status?: string; showFork?: boolean; showStateEditor?: boolean; editorMode?: 'json' | 'form';
  onApprove?: () => void; onReject?: (reason?: string) => void; onModify?: (state: string) => void; onFork?: () => void;
}

const HitlInterrupt = forwardRef<View, HitlInterruptProps>(function HitlInterrupt(
  { reason, agentState = '', status = 'pending', showFork = false, showStateEditor = false, onApprove, onReject, onModify, onFork }, ref,
) {
  const [state, send] = useReducer(hitlInterruptReducer, 'pending');
  const [editState, setEditState] = useState(agentState);
  const [contextInput, setContextInput] = useState('');

  return (
    <View ref={ref} testID="hitl-interrupt" accessibilityRole="alert" accessibilityLabel="Human-in-the-loop interrupt" style={s.root}>
      <View style={s.header}><Text style={s.icon}>{'\u26A0\uFE0F'}</Text><Text style={s.title}>Action Required</Text><Text style={s.badge}>{state}</Text></View>
      <Text style={s.reason}>{reason}</Text>
      {showStateEditor && state === 'editing' && (
        <View style={s.editor}><Text style={s.editorLabel}>Agent State:</Text>
          <TextInput value={editState} onChangeText={setEditState} multiline style={s.editorInput} accessibilityLabel="Edit agent state" />
          <View style={s.editorBtns}>
            <Pressable onPress={() => { send({ type: 'SAVE' }); onModify?.(editState); }} accessibilityRole="button" style={s.saveBtn}><Text style={s.saveBtnText}>Save</Text></Pressable>
            <Pressable onPress={() => { setEditState(agentState); send({ type: 'CANCEL' }); }} accessibilityRole="button"><Text style={s.cancelText}>Cancel</Text></Pressable>
          </View></View>)}
      <TextInput value={contextInput} onChangeText={setContextInput} placeholder="Add context..." style={s.contextInput} accessibilityLabel="Additional context" />
      <View style={s.actions}>
        <Pressable onPress={() => { send({ type: 'APPROVE' }); onApprove?.(); }} accessibilityRole="button" style={[s.actionBtn, { backgroundColor: '#22c55e' }]}><Text style={s.actionText}>Approve</Text></Pressable>
        <Pressable onPress={() => { send({ type: 'REJECT' }); onReject?.(contextInput || undefined); }} accessibilityRole="button" style={[s.actionBtn, { backgroundColor: '#ef4444' }]}><Text style={s.actionText}>Reject</Text></Pressable>
        {showStateEditor && <Pressable onPress={() => send({ type: 'MODIFY' })} accessibilityRole="button" style={[s.actionBtn, { backgroundColor: '#eab308' }]}><Text style={s.actionText}>Modify</Text></Pressable>}
        {showFork && <Pressable onPress={() => { send({ type: 'FORK' }); onFork?.(); }} accessibilityRole="button" style={[s.actionBtn, { backgroundColor: '#8b5cf6' }]}><Text style={s.actionText}>Fork</Text></Pressable>}
      </View>
    </View>);
});

const s = StyleSheet.create({
  root: { padding: 12, borderWidth: 1, borderColor: '#eab308', borderRadius: 8, backgroundColor: '#fffbeb' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }, icon: { fontSize: 18 },
  title: { fontSize: 14, fontWeight: '700', flex: 1 }, badge: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, textTransform: 'capitalize' },
  reason: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  editor: { marginBottom: 8 }, editorLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  editorInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8, fontFamily: 'monospace', fontSize: 12, minHeight: 80, textAlignVertical: 'top' },
  editorBtns: { flexDirection: 'row', gap: 8, marginTop: 6 }, saveBtn: { backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' }, cancelText: { color: '#6b7280', fontSize: 12, paddingVertical: 4 },
  contextInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8, fontSize: 13, marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4 }, actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

HitlInterrupt.displayName = 'HitlInterrupt';
export { HitlInterrupt };
export default HitlInterrupt;
