export type MemoryInspectorState = 'viewing' | 'searching' | 'entrySelected' | 'deleting';
export type MemoryInspectorEvent = | { type: 'SWITCH_TAB' } | { type: 'SEARCH' } | { type: 'SELECT_ENTRY'; id?: string } | { type: 'CLEAR' } | { type: 'DESELECT' } | { type: 'DELETE' } | { type: 'CONFIRM' } | { type: 'CANCEL' };
export function memoryInspectorReducer(state: MemoryInspectorState, event: MemoryInspectorEvent): MemoryInspectorState {
  switch (state) {
    case 'viewing': if (event.type === 'SWITCH_TAB') return 'viewing'; if (event.type === 'SEARCH') return 'searching'; if (event.type === 'SELECT_ENTRY') return 'entrySelected'; return state;
    case 'searching': if (event.type === 'CLEAR') return 'viewing'; if (event.type === 'SELECT_ENTRY') return 'entrySelected'; return state;
    case 'entrySelected': if (event.type === 'DESELECT') return 'viewing'; if (event.type === 'DELETE') return 'deleting'; return state;
    case 'deleting': if (event.type === 'CONFIRM') return 'viewing'; if (event.type === 'CANCEL') return 'entrySelected'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';

export type MemoryTab = 'working' | 'episodic' | 'semantic' | 'procedural';
export interface MemoryEntry { id: string; key: string; value: string; type: MemoryTab; context?: string; timestamp?: string; }

export interface MemoryInspectorProps {
  entries: MemoryEntry[]; activeTab?: MemoryTab; showContext?: boolean;
  onSelectEntry?: (id: string | undefined) => void; onDeleteEntry?: (id: string) => void;
}

const TABS: MemoryTab[] = ['working', 'episodic', 'semantic', 'procedural'];

const MemoryInspector = forwardRef<View, MemoryInspectorProps>(function MemoryInspector(
  { entries, activeTab: initialTab = 'working', showContext = false, onSelectEntry, onDeleteEntry }, ref,
) {
  const [state, send] = useReducer(memoryInspectorReducer, 'viewing');
  const [tab, setTab] = useState<MemoryTab>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const filteredEntries = useMemo(() => {
    let list = entries.filter((e) => e.type === tab);
    if (search) list = list.filter((e) => e.key.toLowerCase().includes(search.toLowerCase()) || e.value.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [entries, tab, search]);

  const handleSelect = useCallback((id: string) => {
    const next = id === selectedId ? undefined : id;
    setSelectedId(next); send(next ? { type: 'SELECT_ENTRY', id: next } : { type: 'DESELECT' }); onSelectEntry?.(next);
  }, [selectedId, onSelectEntry]);

  const selectedEntry = selectedId ? entries.find((e) => e.id === selectedId) : undefined;

  return (
    <View ref={ref} testID="memory-inspector" accessibilityRole="none" accessibilityLabel="Memory inspector" style={s.root}>
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => { setTab(t); send({ type: 'SWITCH_TAB' }); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
            style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={search} onChangeText={(t) => { setSearch(t); send(t ? { type: 'SEARCH' } : { type: 'CLEAR' }); }}
        placeholder="Search entries..." style={s.searchInput} accessibilityLabel="Search memory entries" />
      <FlatList data={filteredEntries} keyExtractor={(e) => e.id} style={s.list} renderItem={({ item }) => {
        const isSel = item.id === selectedId;
        return (
          <Pressable onPress={() => handleSelect(item.id)} accessibilityRole="button" accessibilityState={{ selected: isSel }}
            style={[s.entry, isSel && s.entrySel]}>
            <Text style={s.key}>{item.key}</Text>
            <Text style={s.value} numberOfLines={2}>{item.value}</Text>
            {showContext && item.context && <Text style={s.context} numberOfLines={1}>{item.context}</Text>}
          </Pressable>);
      }} />
      {selectedEntry && (
        <View style={s.detail}>
          <View style={s.detailHead}><Text style={s.detailTitle}>{selectedEntry.key}</Text>
            <Pressable onPress={() => handleSelect(selectedEntry.id)}><Text>{'\u2715'}</Text></Pressable></View>
          <Text style={s.detailValue}>{selectedEntry.value}</Text>
          {selectedEntry.context && <Text style={s.detailContext}>Context: {selectedEntry.context}</Text>}
          {selectedEntry.timestamp && <Text style={s.detailTs}>{new Date(selectedEntry.timestamp).toLocaleString()}</Text>}
          {state === 'deleting' ? (
            <View style={s.confirmBar}><Text>Delete this entry?</Text>
              <Pressable onPress={() => { send({ type: 'CONFIRM' }); onDeleteEntry?.(selectedEntry.id); setSelectedId(undefined); }} style={s.delBtn}><Text style={s.delBtnText}>Confirm</Text></Pressable>
              <Pressable onPress={() => send({ type: 'CANCEL' })}><Text style={s.cancelText}>Cancel</Text></Pressable></View>
          ) : onDeleteEntry && <Pressable onPress={() => send({ type: 'DELETE' })} accessibilityRole="button" style={s.delBtn}><Text style={s.delBtnText}>Delete</Text></Pressable>}
        </View>)}
    </View>);
});

const s = StyleSheet.create({
  root: { flex: 1 }, tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' }, tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { fontSize: 12, textTransform: 'capitalize', color: '#6b7280' }, tabTextActive: { color: '#6366f1', fontWeight: '600' },
  searchInput: { margin: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, padding: 8, fontSize: 13 },
  list: { flex: 1 }, entry: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }, entrySel: { backgroundColor: '#dbeafe' },
  key: { fontSize: 13, fontWeight: '600', fontFamily: 'monospace' }, value: { fontSize: 12, color: '#4b5563', marginTop: 2 }, context: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }, detailHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailTitle: { fontSize: 14, fontWeight: '600', fontFamily: 'monospace' }, detailValue: { fontSize: 13, lineHeight: 20 },
  detailContext: { fontSize: 12, color: '#6b7280', marginTop: 4 }, detailTs: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  confirmBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  delBtn: { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, marginTop: 8 },
  delBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' }, cancelText: { color: '#6b7280', fontSize: 12 },
});

MemoryInspector.displayName = 'MemoryInspector';
export { MemoryInspector };
export default MemoryInspector;
