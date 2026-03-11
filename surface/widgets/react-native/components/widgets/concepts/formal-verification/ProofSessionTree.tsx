export type ProofSessionTreeState = 'idle' | 'selected' | 'ready' | 'fetching';
export type ProofSessionTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'DESELECT' }
  | { type: 'LOAD_CHILDREN' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_ERROR' };

export function proofSessionTreeReducer(state: ProofSessionTreeState, event: ProofSessionTreeEvent): ProofSessionTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'ready':
      if (event.type === 'LOAD_CHILDREN') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      if (event.type === 'LOAD_ERROR') return 'ready';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useMemo, useReducer, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export interface ProofGoal {
  id: string;
  label: string;
  status: 'open' | 'proved' | 'failed' | 'skipped';
  tactic?: string;
  children?: ProofGoal[];
  progress?: number;
}

export interface ProofSessionTreeProps {
  goals: ProofGoal[];
  selectedId?: string | undefined;
  expandedIds?: string[];
  onSelectGoal?: (id: string | undefined) => void;
}

const STATUS_ICONS: Record<ProofGoal['status'], string> = {
  proved: '\u2713', failed: '\u2717', open: '\u25CB', skipped: '\u2298',
};
const STATUS_LABELS: Record<ProofGoal['status'], string> = {
  proved: 'Proved', failed: 'Failed', open: 'Open', skipped: 'Skipped',
};

function findGoal(goals: ProofGoal[], id: string): ProofGoal | undefined {
  for (const g of goals) {
    if (g.id === id) return g;
    if (g.children?.length) { const f = findGoal(g.children, id); if (f) return f; }
  }
  return undefined;
}

function countGoals(goals: ProofGoal[]): { total: number; proved: number } {
  let total = 0, proved = 0;
  function walk(nodes: ProofGoal[]) {
    for (const g of nodes) { total++; if (g.status === 'proved') proved++; if (g.children?.length) walk(g.children); }
  }
  walk(goals);
  return { total, proved };
}

interface GoalNodeProps {
  goal: ProofGoal;
  depth: number;
  expandedSet: Set<string>;
  selectedId: string | undefined;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}

function GoalNode({ goal, depth, expandedSet, selectedId, onToggleExpand, onSelect }: GoalNodeProps) {
  const hasChildren = !!(goal.children?.length);
  const isExpanded = expandedSet.has(goal.id);
  const isSelected = selectedId === goal.id;

  return (
    <View style={{ paddingLeft: depth * 20 }}>
      <Pressable
        onPress={() => onSelect(goal.id)}
        accessibilityRole="button"
        accessibilityLabel={`${goal.label} - ${STATUS_LABELS[goal.status]}`}
        accessibilityState={{ selected: isSelected }}
        style={[st.treeItem, isSelected && st.treeItemSelected]}
      >
        {hasChildren && (
          <Pressable onPress={() => onToggleExpand(goal.id)} accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Collapse' : 'Expand'} style={st.expandBtn}>
            <Text>{isExpanded ? '\u25BC' : '\u25B6'}</Text>
          </Pressable>
        )}
        {!hasChildren && <View style={st.expandPlaceholder} />}
        <Text style={[st.statusBadge, { color: goal.status === 'proved' ? '#22c55e' : goal.status === 'failed' ? '#ef4444' : '#6b7280' }]}>
          {STATUS_ICONS[goal.status]}
        </Text>
        <Text style={st.itemLabel}>{goal.label}</Text>
        {goal.progress != null && (
          <Text style={st.progressText}>{`${Math.round(goal.progress * 100)}%`}</Text>
        )}
      </Pressable>
      {hasChildren && isExpanded && goal.children!.map((child) => (
        <GoalNode key={child.id} goal={child} depth={depth + 1} expandedSet={expandedSet}
          selectedId={selectedId} onToggleExpand={onToggleExpand} onSelect={onSelect} />
      ))}
    </View>
  );
}

const ProofSessionTree = forwardRef<View, ProofSessionTreeProps>(function ProofSessionTree(
  { goals, selectedId: controlledSelectedId, expandedIds: controlledExpandedIds, onSelectGoal },
  ref,
) {
  const [, send] = useReducer(proofSessionTreeReducer, 'idle');
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(new Set(controlledExpandedIds ?? []));
  const expandedSet = controlledExpandedIds ? new Set(controlledExpandedIds) : internalExpandedIds;

  const { total, proved } = useMemo(() => countGoals(goals), [goals]);

  const handleSelect = useCallback((id: string) => {
    const nextId = id === selectedId ? undefined : id;
    setInternalSelectedId(nextId);
    onSelectGoal?.(nextId);
    send({ type: nextId ? 'SELECT' : 'DESELECT' });
  }, [selectedId, onSelectGoal]);

  const handleToggleExpand = useCallback((id: string) => {
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); send({ type: 'COLLAPSE' }); } else { next.add(id); send({ type: 'EXPAND' }); }
      return next;
    });
  }, []);

  const selectedGoal = selectedId ? findGoal(goals, selectedId) : undefined;
  const displayState: ProofSessionTreeState = selectedId ? 'selected' : 'idle';

  return (
    <View ref={ref} testID="proof-session-tree" accessibilityRole="list" accessibilityLabel="Proof session tree" style={st.root}>
      <View style={st.summary} accessibilityLiveRegion="polite">
        <Text style={st.summaryText}>{`${proved} of ${total} goals proved`}</Text>
      </View>

      <ScrollView style={st.tree}>
        {goals.map((goal) => (
          <GoalNode key={goal.id} goal={goal} depth={0} expandedSet={expandedSet}
            selectedId={selectedId} onToggleExpand={handleToggleExpand} onSelect={handleSelect} />
        ))}
      </ScrollView>

      {selectedGoal && (
        <View style={st.detail} accessibilityLabel="Goal details">
          <View style={st.detailHeader}>
            <Text style={st.detailStatus}>{STATUS_ICONS[selectedGoal.status]} {STATUS_LABELS[selectedGoal.status]}</Text>
            <Pressable onPress={() => { setInternalSelectedId(undefined); onSelectGoal?.(undefined); send({ type: 'DESELECT' }); }}
              accessibilityRole="button" accessibilityLabel="Close detail panel">
              <Text>{'\u2715'}</Text>
            </Pressable>
          </View>
          <Text style={st.detailField}><Text style={st.detailLabel}>Goal: </Text>{selectedGoal.label}</Text>
          <Text style={st.detailField}><Text style={st.detailLabel}>Status: </Text>{STATUS_ICONS[selectedGoal.status]} {STATUS_LABELS[selectedGoal.status]}</Text>
          {selectedGoal.tactic && <Text style={st.detailField}><Text style={st.detailLabel}>Tactic: </Text>{selectedGoal.tactic}</Text>}
          {selectedGoal.progress != null && <Text style={st.detailField}><Text style={st.detailLabel}>Progress: </Text>{`${Math.round(selectedGoal.progress * 100)}%`}</Text>}
          {selectedGoal.children && selectedGoal.children.length > 0 && (
            <Text style={st.detailField}><Text style={st.detailLabel}>Sub-goals: </Text>{selectedGoal.children.length} goals</Text>
          )}
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  root: { flex: 1 },
  summary: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  summaryText: { fontSize: 14, fontWeight: '600' },
  tree: { flex: 1 },
  treeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 4 },
  treeItemSelected: { backgroundColor: '#dbeafe' },
  expandBtn: { width: 24, alignItems: 'center' },
  expandPlaceholder: { width: 24 },
  statusBadge: { fontSize: 14, marginRight: 6 },
  itemLabel: { fontSize: 13, flex: 1 },
  progressText: { fontSize: 11, color: '#6b7280', marginLeft: 6 },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailStatus: { fontSize: 14, fontWeight: '600' },
  detailField: { fontSize: 13, marginVertical: 2 },
  detailLabel: { fontWeight: '600' },
});

ProofSessionTree.displayName = 'ProofSessionTree';
export { ProofSessionTree };
export default ProofSessionTree;
