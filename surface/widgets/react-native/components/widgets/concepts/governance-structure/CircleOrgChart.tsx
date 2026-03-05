export type CircleOrgChartState = 'idle' | 'circleSelected';
export type CircleOrgChartEvent = | { type: 'SELECT_CIRCLE'; id: string } | { type: 'DESELECT' } | { type: 'EXPAND'; id: string } | { type: 'COLLAPSE'; id: string };

export function circleOrgChartReducer(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState {
  switch (state) {
    case 'idle': if (event.type === 'SELECT_CIRCLE') return 'circleSelected'; return state;
    case 'circleSelected': if (event.type === 'DESELECT') return 'idle'; if (event.type === 'SELECT_CIRCLE') return 'circleSelected'; return state;
    default: return state;
  }
}

import React, { forwardRef, useReducer, useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, FlatList, StyleSheet } from 'react-native';

export interface CircleMember { name: string; role: string; }
export interface Circle { id: string; name: string; purpose: string; parentId?: string; members: CircleMember[]; jurisdiction?: string; policies?: string[]; }

export interface CircleOrgChartProps {
  circles: Circle[]; selectedCircleId?: string; layout?: 'tree' | 'nested' | 'radial'; showPolicies?: boolean; showJurisdiction?: boolean; maxAvatars?: number;
  onSelectCircle?: (id: string | undefined) => void;
}

const CircleOrgChart = forwardRef<View, CircleOrgChartProps>(function CircleOrgChart(
  { circles, selectedCircleId: controlledId, showPolicies = false, showJurisdiction = false, maxAvatars = 3, onSelectCircle }, ref,
) {
  const [state, send] = useReducer(circleOrgChartReducer, 'idle');
  const [internalId, setInternalId] = useState<string | undefined>(controlledId);
  const selectedId = controlledId ?? internalId;
  const circleMap = useMemo(() => { const m = new Map<string, Circle>(); for (const c of circles) m.set(c.id, c); return m; }, [circles]);
  const roots = useMemo(() => circles.filter((c) => !c.parentId), [circles]);
  const childrenOf = useMemo(() => { const m = new Map<string, Circle[]>(); for (const c of circles) { const pid = c.parentId ?? '__root__'; if (!m.has(pid)) m.set(pid, []); m.get(pid)!.push(c); } return m; }, [circles]);

  const handleSelect = useCallback((id: string) => {
    const next = id === selectedId ? undefined : id;
    setInternalId(next); send(next ? { type: 'SELECT_CIRCLE', id: next } : { type: 'DESELECT' }); onSelectCircle?.(next);
  }, [selectedId, onSelectCircle]);

  const selectedCircle = selectedId ? circleMap.get(selectedId) : undefined;

  const renderCircle = (circle: Circle, depth: number): React.ReactNode => {
    const isSel = circle.id === selectedId;
    const children = childrenOf.get(circle.id) ?? [];
    const visibleMembers = circle.members.slice(0, maxAvatars);
    const extraCount = circle.members.length - maxAvatars;
    return (
      <View key={circle.id} style={{ paddingLeft: depth * 16 }}>
        <Pressable onPress={() => handleSelect(circle.id)} accessibilityRole="button" accessibilityState={{ selected: isSel }}
          accessibilityLabel={`${circle.name}: ${circle.purpose}`} style={[s.circle, isSel && s.circleSel]}>
          <Text style={s.circleName}>{circle.name}</Text>
          <Text style={s.purpose} numberOfLines={1}>{circle.purpose}</Text>
          {showJurisdiction && circle.jurisdiction && <Text style={s.jurisdiction}>{circle.jurisdiction}</Text>}
          <View style={s.avatarRow}>
            {visibleMembers.map((m, i) => <View key={i} style={s.avatar}><Text style={s.avatarText}>{m.name.charAt(0)}</Text></View>)}
            {extraCount > 0 && <Text style={s.extra}>+{extraCount}</Text>}
          </View>
          {showPolicies && circle.policies?.length ? (
            <View style={s.policyRow}>{circle.policies.map((p, i) => <Text key={i} style={s.policyBadge}>{p}</Text>)}</View>
          ) : null}
        </Pressable>
        {children.map((child) => renderCircle(child, depth + 1))}
      </View>
    );
  };

  return (
    <View ref={ref} testID="circle-org-chart" accessibilityRole="list" accessibilityLabel="Circle organization chart" style={s.root}>
      <ScrollView style={s.tree}>{roots.map((r) => renderCircle(r, 0))}</ScrollView>
      {selectedCircle && (
        <View style={s.detail}>
          <View style={s.detailHead}><Text style={s.detailTitle}>{selectedCircle.name}</Text>
            <Pressable onPress={() => handleSelect(selectedCircle.id)}><Text>{'\u2715'}</Text></Pressable></View>
          <Text style={s.detailPurpose}>{selectedCircle.purpose}</Text>
          {selectedCircle.jurisdiction && <Text>Jurisdiction: {selectedCircle.jurisdiction}</Text>}
          <Text style={s.memberTitle}>Members ({selectedCircle.members.length}):</Text>
          {selectedCircle.members.map((m, i) => <Text key={i} style={s.memberItem}>{m.name} - {m.role}</Text>)}
          {selectedCircle.policies?.length ? (<><Text style={s.memberTitle}>Policies:</Text>{selectedCircle.policies.map((p, i) => <Text key={i} style={s.memberItem}>{p}</Text>)}</>) : null}
        </View>)}
    </View>);
});

const s = StyleSheet.create({
  root: { flex: 1 }, tree: { flex: 1, padding: 8 },
  circle: { padding: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, marginBottom: 6 },
  circleSel: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  circleName: { fontSize: 14, fontWeight: '700' }, purpose: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  jurisdiction: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  avatarRow: { flexDirection: 'row', gap: 4, marginTop: 6, alignItems: 'center' },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: '600', color: '#4338ca' }, extra: { fontSize: 11, color: '#6b7280' },
  policyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  policyBadge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, color: '#6b7280' },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailTitle: { fontSize: 16, fontWeight: '700' }, detailPurpose: { fontSize: 13, color: '#4b5563', marginBottom: 8 },
  memberTitle: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 }, memberItem: { fontSize: 12, paddingLeft: 8, marginVertical: 1 },
});

CircleOrgChart.displayName = 'CircleOrgChart';
export { CircleOrgChart };
export default CircleOrgChart;
