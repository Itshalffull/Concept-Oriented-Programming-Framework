export type DelegationGraphState = 'browsing' | 'searching' | 'selected' | 'delegating' | 'undelegating';
export type DelegationGraphEvent = | { type: 'SEARCH' } | { type: 'SELECT_DELEGATE'; id?: string } | { type: 'SWITCH_VIEW' } | { type: 'CLEAR_SEARCH' } | { type: 'DESELECT' } | { type: 'DELEGATE' } | { type: 'UNDELEGATE' } | { type: 'DELEGATE_COMPLETE' } | { type: 'DELEGATE_ERROR' } | { type: 'UNDELEGATE_COMPLETE' } | { type: 'UNDELEGATE_ERROR' };

export function delegationGraphReducer(state: DelegationGraphState, event: DelegationGraphEvent): DelegationGraphState {
  switch (state) {
    case 'browsing': if (event.type === 'SEARCH') return 'searching'; if (event.type === 'SELECT_DELEGATE') return 'selected'; if (event.type === 'SWITCH_VIEW') return 'browsing'; return state;
    case 'searching': if (event.type === 'CLEAR_SEARCH') return 'browsing'; if (event.type === 'SELECT_DELEGATE') return 'selected'; return state;
    case 'selected': if (event.type === 'DESELECT') return 'browsing'; if (event.type === 'DELEGATE') return 'delegating'; if (event.type === 'UNDELEGATE') return 'undelegating'; return state;
    case 'delegating': if (event.type === 'DELEGATE_COMPLETE') return 'browsing'; if (event.type === 'DELEGATE_ERROR') return 'selected'; return state;
    case 'undelegating': if (event.type === 'UNDELEGATE_COMPLETE') return 'browsing'; if (event.type === 'UNDELEGATE_ERROR') return 'selected'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';

export interface Delegate { id: string; name: string; address?: string; votingPower: number; participation?: number; isDelegated?: boolean; }

export interface DelegationGraphProps {
  delegates: Delegate[]; currentDelegateId?: string; viewMode?: 'list' | 'graph'; sortBy?: 'power' | 'participation' | 'name';
  onDelegate?: (id: string) => void; onUndelegate?: (id: string) => void; onSelectDelegate?: (id: string | undefined) => void;
}

const DelegationGraph = forwardRef<View, DelegationGraphProps>(function DelegationGraph(
  { delegates, currentDelegateId, viewMode = 'list', sortBy: initialSort = 'power', onDelegate, onUndelegate, onSelectDelegate }, ref,
) {
  const [state, send] = useReducer(delegationGraphReducer, 'browsing');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState(initialSort);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const filteredDelegates = useMemo(() => {
    let list = search ? delegates.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())) : delegates;
    list = [...list].sort((a, b) => {
      if (sortBy === 'power') return b.votingPower - a.votingPower;
      if (sortBy === 'participation') return (b.participation ?? 0) - (a.participation ?? 0);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [delegates, search, sortBy]);

  const handleSelect = useCallback((id: string) => {
    const next = id === selectedId ? undefined : id;
    setSelectedId(next); send(next ? { type: 'SELECT_DELEGATE', id: next } : { type: 'DESELECT' }); onSelectDelegate?.(next);
  }, [selectedId, onSelectDelegate]);

  const selectedDelegate = selectedId ? delegates.find((d) => d.id === selectedId) : undefined;

  return (
    <View ref={ref} testID="delegation-graph" accessibilityRole="none" accessibilityLabel="Delegation graph" style={s.root}>
      <TextInput value={search} onChangeText={(t) => { setSearch(t); send(t ? { type: 'SEARCH' } : { type: 'CLEAR_SEARCH' }); }}
        placeholder="Search delegates..." style={s.searchInput} accessibilityLabel="Search delegates" />
      <View style={s.sortBar}>
        {(['power', 'participation', 'name'] as const).map((key) => (
          <Pressable key={key} onPress={() => setSortBy(key)} accessibilityRole="button" accessibilityState={{ selected: sortBy === key }}
            style={[s.sortBtn, sortBy === key && s.sortBtnActive]}><Text style={sortBy === key ? s.sortTextActive : s.sortText}>{key}</Text></Pressable>
        ))}
      </View>
      <FlatList data={filteredDelegates} keyExtractor={(d) => d.id} renderItem={({ item }) => {
        const isSel = item.id === selectedId; const isCurrent = item.id === currentDelegateId;
        return (
          <Pressable onPress={() => handleSelect(item.id)} accessibilityRole="button" accessibilityState={{ selected: isSel }}
            style={[s.delegate, isSel && s.delegateSel, isCurrent && s.delegateCurrent]}>
            <View style={s.delAvatar}><Text style={s.delAvatarText}>{item.name.charAt(0)}</Text></View>
            <View style={s.delInfo}><Text style={s.delName}>{item.name}{isCurrent ? ' (current)' : ''}</Text>
              <Text style={s.delPower}>Power: {item.votingPower}</Text></View>
            {item.participation != null && <Text style={s.delPart}>{item.participation}%</Text>}
          </Pressable>);
      }} style={s.list} />
      {selectedDelegate && (
        <View style={s.detail}>
          <Text style={s.detailTitle}>{selectedDelegate.name}</Text>
          <Text>Voting Power: {selectedDelegate.votingPower}</Text>
          {selectedDelegate.participation != null && <Text>Participation: {selectedDelegate.participation}%</Text>}
          {selectedDelegate.address && <Text style={s.address}>{selectedDelegate.address}</Text>}
          <View style={s.actionBar}>
            {!selectedDelegate.isDelegated && onDelegate && <Pressable onPress={() => { send({ type: 'DELEGATE' }); onDelegate(selectedDelegate.id); }}
              accessibilityRole="button" style={s.actionBtn}><Text style={s.actionText}>Delegate</Text></Pressable>}
            {selectedDelegate.isDelegated && onUndelegate && <Pressable onPress={() => { send({ type: 'UNDELEGATE' }); onUndelegate(selectedDelegate.id); }}
              accessibilityRole="button" style={[s.actionBtn, { backgroundColor: '#ef4444' }]}><Text style={s.actionText}>Undelegate</Text></Pressable>}
          </View>
        </View>)}
    </View>);
});

const s = StyleSheet.create({
  root: { flex: 1 }, searchInput: { margin: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8, fontSize: 13 },
  sortBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, marginBottom: 4 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  sortBtnActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' }, sortText: { fontSize: 12, textTransform: 'capitalize' }, sortTextActive: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  list: { flex: 1 }, delegate: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  delegateSel: { backgroundColor: '#dbeafe' }, delegateCurrent: { borderLeftWidth: 3, borderLeftColor: '#6366f1' },
  delAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  delAvatarText: { fontSize: 14, fontWeight: '600', color: '#4338ca' }, delInfo: { flex: 1 },
  delName: { fontSize: 13, fontWeight: '600' }, delPower: { fontSize: 11, color: '#6b7280' }, delPart: { fontSize: 12, color: '#6b7280' },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }, detailTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  address: { fontSize: 11, fontFamily: 'monospace', color: '#6b7280', marginTop: 4 },
  actionBar: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

DelegationGraph.displayName = 'DelegationGraph';
export { DelegationGraph };
export default DelegationGraph;
