export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent = | { type: 'SELECT_GUARD'; id?: string } | { type: 'GUARD_TRIP' } | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle': if (event.type === 'SELECT_GUARD') return 'guardSelected'; if (event.type === 'GUARD_TRIP') return 'idle'; return state;
    case 'guardSelected': if (event.type === 'DESELECT') return 'idle'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';

export interface Guard { id: string; name: string; status: 'passed' | 'failed' | 'bypassed' | 'pending'; condition?: string; description?: string; }

export interface GuardStatusPanelProps {
  guards: Guard[]; executionStatus?: string; showConditions?: boolean; onSelectGuard?: (id: string | undefined) => void;
}

const GUARD_ICONS: Record<string, string> = { passed: '\u2713', failed: '\u2717', bypassed: '\u21B7', pending: '\u25CB' };
const GUARD_COLORS: Record<string, string> = { passed: '#22c55e', failed: '#ef4444', bypassed: '#eab308', pending: '#9ca3af' };

const GuardStatusPanel = forwardRef<View, GuardStatusPanelProps>(function GuardStatusPanel(
  { guards, executionStatus = 'pending', showConditions = false, onSelectGuard }, ref,
) {
  const [state, send] = useReducer(guardStatusPanelReducer, 'idle');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const handleSelect = useCallback((id: string) => {
    const next = id === selectedId ? undefined : id;
    setSelectedId(next); send(next ? { type: 'SELECT_GUARD', id: next } : { type: 'DESELECT' }); onSelectGuard?.(next);
  }, [selectedId, onSelectGuard]);
  const allPassed = guards.every((g) => g.status === 'passed');
  const selectedGuard = selectedId ? guards.find((g) => g.id === selectedId) : undefined;

  return (
    <View ref={ref} testID="guard-status-panel" accessibilityRole="none" accessibilityLabel="Guard status panel" style={s.root}>
      <View style={s.header}><Text style={s.title}>Pre-execution Guards</Text>
        <Text style={[s.badge, { color: allPassed ? '#22c55e' : '#ef4444' }]}>{allPassed ? 'All Passed' : 'Issues Found'}</Text></View>
      <FlatList data={guards} keyExtractor={(g) => g.id} renderItem={({ item }) => (
        <Pressable onPress={() => handleSelect(item.id)} accessibilityRole="button" accessibilityState={{ selected: selectedId === item.id }}
          style={[s.guard, selectedId === item.id && s.guardSel]}>
          <Text style={[s.guardIcon, { color: GUARD_COLORS[item.status] }]}>{GUARD_ICONS[item.status]}</Text>
          <View style={s.guardInfo}><Text style={s.guardName}>{item.name}</Text>
            {showConditions && item.condition && <Text style={s.guardCond}>{item.condition}</Text>}</View>
          <Text style={[s.guardStatus, { color: GUARD_COLORS[item.status] }]}>{item.status}</Text>
        </Pressable>)} />
      {selectedGuard && (
        <View style={s.detail}><Text style={s.detailTitle}>{selectedGuard.name}</Text>
          <Text>Status: {selectedGuard.status}</Text>
          {selectedGuard.condition && <Text>Condition: {selectedGuard.condition}</Text>}
          {selectedGuard.description && <Text style={s.detailDesc}>{selectedGuard.description}</Text>}</View>)}
    </View>);
});

const s = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 14, fontWeight: '600' }, badge: { fontSize: 12, fontWeight: '600' },
  guard: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  guardSel: { backgroundColor: '#dbeafe' }, guardIcon: { fontSize: 16, marginRight: 8 },
  guardInfo: { flex: 1 }, guardName: { fontSize: 13, fontWeight: '600' }, guardCond: { fontSize: 11, color: '#6b7280', fontFamily: 'monospace' },
  guardStatus: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }, detailTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  detailDesc: { fontSize: 13, color: '#4b5563', marginTop: 4 },
});

GuardStatusPanel.displayName = 'GuardStatusPanel';
export { GuardStatusPanel };
export default GuardStatusPanel;
