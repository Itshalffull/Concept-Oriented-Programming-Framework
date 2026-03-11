export type AgentTimelineState = 'idle' | 'entrySelected' | 'interrupted' | 'inactive' | 'active';
export type AgentTimelineEvent = | { type: 'NEW_ENTRY' } | { type: 'SELECT_ENTRY'; id?: string } | { type: 'INTERRUPT' } | { type: 'DESELECT' } | { type: 'RESUME' } | { type: 'STREAM_START' } | { type: 'STREAM_END' };
export function agentTimelineReducer(state: AgentTimelineState, event: AgentTimelineEvent): AgentTimelineState {
  switch (state) {
    case 'idle': if (event.type === 'NEW_ENTRY') return 'idle'; if (event.type === 'SELECT_ENTRY') return 'entrySelected'; if (event.type === 'INTERRUPT') return 'interrupted'; return state;
    case 'entrySelected': if (event.type === 'DESELECT') return 'idle'; if (event.type === 'SELECT_ENTRY') return 'entrySelected'; return state;
    case 'interrupted': if (event.type === 'RESUME') return 'idle'; return state;
    case 'inactive': if (event.type === 'STREAM_START') return 'active'; return state;
    case 'active': if (event.type === 'STREAM_END') return 'inactive'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';

export type TimelineEntryType = 'thinking' | 'tool_call' | 'tool_result' | 'response' | 'error' | 'delegation';
export interface TimelineEntry { id: string; type: TimelineEntryType; content: string; timestamp: string; agentName?: string; duration?: number; expanded?: boolean; }

export interface AgentTimelineProps {
  entries: TimelineEntry[]; agentName?: string; status?: string; showDelegations?: boolean; autoScroll?: boolean; maxEntries?: number;
  onSelectEntry?: (id: string | undefined) => void; filterTypes?: TimelineEntryType[];
}

const TYPE_ICONS: Record<TimelineEntryType, string> = { thinking: '\uD83D\uDCA1', tool_call: '\uD83D\uDD27', tool_result: '\uD83D\uDCE5', response: '\uD83D\uDCAC', error: '\u26A0\uFE0F', delegation: '\uD83D\uDD04' };

const AgentTimeline = forwardRef<View, AgentTimelineProps>(function AgentTimeline(
  { entries, agentName = 'Agent', status = 'idle', autoScroll = true, maxEntries, onSelectEntry, filterTypes }, ref,
) {
  const [state, send] = useReducer(agentTimelineReducer, 'idle');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList>(null);

  const visibleEntries = React.useMemo(() => {
    let list = filterTypes ? entries.filter((e) => filterTypes.includes(e.type)) : entries;
    if (maxEntries) list = list.slice(-maxEntries);
    return list;
  }, [entries, filterTypes, maxEntries]);

  useEffect(() => { if (autoScroll && listRef.current && visibleEntries.length > 0) { listRef.current.scrollToEnd({ animated: true }); } }, [visibleEntries.length, autoScroll]);

  const handleSelect = useCallback((id: string) => {
    const next = id === selectedId ? undefined : id;
    setSelectedId(next); send(next ? { type: 'SELECT_ENTRY', id: next } : { type: 'DESELECT' }); onSelectEntry?.(next);
  }, [selectedId, onSelectEntry]);

  const toggleExpand = useCallback((id: string) => { setExpandedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);
  const selectedEntry = selectedId ? visibleEntries.find((e) => e.id === selectedId) : undefined;

  return (
    <View ref={ref} testID="agent-timeline" accessibilityRole="list" accessibilityLabel={`${agentName} timeline`} style={s.root}>
      <View style={s.header}><Text style={s.agentName}>{agentName}</Text><Text style={s.status}>{status}</Text></View>
      <FlatList ref={listRef} data={visibleEntries} keyExtractor={(e) => e.id} style={s.timeline} renderItem={({ item }) => {
        const isSel = item.id === selectedId; const isExpanded = expandedIds.has(item.id);
        return (
          <Pressable onPress={() => handleSelect(item.id)} onLongPress={() => toggleExpand(item.id)} accessibilityRole="button" accessibilityState={{ selected: isSel, expanded: isExpanded }}
            style={[s.entry, isSel && s.entrySel, item.type === 'error' && s.entryError]}>
            <Text style={s.typeIcon}>{TYPE_ICONS[item.type]}</Text>
            <View style={s.entryBody}>
              <View style={s.entryHead}>{item.agentName && <Text style={s.entryAgent}>{item.agentName}</Text>}<Text style={s.typeBadge}>{item.type}</Text>
                <Text style={s.entryTs}>{new Date(item.timestamp).toLocaleTimeString()}</Text></View>
              <Text style={s.entryContent} numberOfLines={isExpanded ? undefined : 2}>{item.content}</Text>
              {item.duration != null && <Text style={s.entryDur}>{item.duration}ms</Text>}
            </View>
          </Pressable>);
      }} />
      {selectedEntry && (
        <View style={s.detail}><Text style={s.detailTitle}>{TYPE_ICONS[selectedEntry.type]} {selectedEntry.type}</Text>
          <Text style={s.detailContent}>{selectedEntry.content}</Text>
          <Text style={s.detailTs}>{new Date(selectedEntry.timestamp).toLocaleString()}</Text>
          {selectedEntry.duration != null && <Text>Duration: {selectedEntry.duration}ms</Text>}</View>)}
    </View>);
});

const s = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  agentName: { fontSize: 14, fontWeight: '600' }, status: { fontSize: 12, color: '#6b7280', textTransform: 'capitalize' },
  timeline: { flex: 1 }, entry: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  entrySel: { backgroundColor: '#dbeafe' }, entryError: { backgroundColor: '#fef2f2' },
  typeIcon: { fontSize: 16, marginRight: 8, marginTop: 2 }, entryBody: { flex: 1 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  entryAgent: { fontSize: 12, fontWeight: '600' }, typeBadge: { fontSize: 10, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, color: '#6b7280' },
  entryTs: { fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }, entryContent: { fontSize: 13, lineHeight: 18 }, entryDur: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }, detailTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  detailContent: { fontSize: 13, lineHeight: 20, marginVertical: 4 }, detailTs: { fontSize: 12, color: '#9ca3af' },
});

AgentTimeline.displayName = 'AgentTimeline';
export { AgentTimeline };
export default AgentTimeline;
