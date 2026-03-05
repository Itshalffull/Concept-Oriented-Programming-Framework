export type TraceTreeState = 'idle' | 'spanSelected';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN'; id: string }
  | { type: 'DESELECT' }
  | { type: 'EXPAND'; id: string }
  | { type: 'COLLAPSE'; id: string }
  | { type: 'FILTER'; spanType: string };

export function traceTreeReducer(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    case 'spanSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export interface TraceSpan {
  id: string;
  type: string;
  label: string;
  duration: number;
  tokens?: number | undefined;
  status: string;
  children?: TraceSpan[];
}

export interface TraceTreeProps {
  spans: TraceSpan[];
  rootLabel: string;
  totalDuration?: number | undefined;
  totalTokens?: number | undefined;
  selectedSpanId?: string | undefined;
  onSelectSpan?: (id: string | undefined) => void;
  expandedIds?: string[];
  visibleTypes?: string[];
  showMetrics?: boolean;
}

const SPAN_TYPE_LABELS: Record<string, string> = { llm: 'LLM', tool: 'Tool', chain: 'Chain', agent: 'Agent' };
const SPAN_TYPE_ICONS: Record<string, string> = { llm: '\uD83E\uDDE0', tool: '\u2699', chain: '\uD83D\uDD17', agent: '\uD83E\uDD16' };
const STATUS_ICONS: Record<string, string> = { success: '\u2713', running: '\u25CB', error: '\u2717', pending: '\u2022' };
const STATUS_COLORS: Record<string, string> = { success: '#22c55e', running: '#3b82f6', error: '#ef4444', pending: '#9ca3af' };

function findSpan(spans: TraceSpan[], id: string): TraceSpan | undefined {
  for (const span of spans) {
    if (span.id === id) return span;
    if (span.children?.length) { const found = findSpan(span.children, id); if (found) return found; }
  }
  return undefined;
}

interface SpanNodeProps {
  span: TraceSpan;
  depth: number;
  expandedSet: Set<string>;
  visibleSet: Set<string>;
  selectedId: string | undefined;
  showMetrics: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}

function SpanNode({ span, depth, expandedSet, visibleSet, selectedId, showMetrics, onToggleExpand, onSelect }: SpanNodeProps) {
  const hasChildren = !!(span.children?.length);
  const isExpanded = expandedSet.has(span.id);
  const isSelected = selectedId === span.id;
  const visibleChildren = span.children?.filter((c) => visibleSet.has(c.type)) ?? [];

  return (
    <View>
      <Pressable onPress={() => onSelect(span.id)} accessibilityRole="button"
        accessibilityLabel={`${span.type}: ${span.label} (${span.duration}ms)`}
        accessibilityState={{ selected: isSelected, expanded: hasChildren ? isExpanded : undefined }}
        style={[s.spanNode, isSelected && s.spanNodeSel, { paddingLeft: 8 + depth * 16 }]}>
        {hasChildren && (
          <Pressable onPress={() => onToggleExpand(span.id)} hitSlop={8}>
            <Text style={s.expandToggle}>{isExpanded ? '\u25BC' : '\u25B6'}</Text>
          </Pressable>
        )}
        <Text style={s.spanIcon}>{SPAN_TYPE_ICONS[span.type] ?? '\u25CF'}</Text>
        <Text style={s.spanLabel} numberOfLines={1}>{span.label}</Text>
        <Text style={s.spanDuration}>{`${span.duration}ms`}</Text>
        {showMetrics && span.tokens != null && <Text style={s.spanTokens}>{`${span.tokens} tok`}</Text>}
        <Text style={[s.spanStatus, { color: STATUS_COLORS[span.status] ?? '#9ca3af' }]}>
          {STATUS_ICONS[span.status] ?? '\u2022'}
        </Text>
      </Pressable>
      {hasChildren && isExpanded && visibleChildren.map((child) => (
        <SpanNode key={child.id} span={child} depth={depth + 1} expandedSet={expandedSet}
          visibleSet={visibleSet} selectedId={selectedId} showMetrics={showMetrics}
          onToggleExpand={onToggleExpand} onSelect={onSelect} />
      ))}
    </View>
  );
}

const TraceTree = forwardRef<View, TraceTreeProps>(function TraceTree(
  { spans, rootLabel, totalDuration, totalTokens, selectedSpanId: controlledSelectedId, onSelectSpan,
    expandedIds: controlledExpandedIds, visibleTypes: controlledVisibleTypes, showMetrics = true },
  ref,
) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(controlledSelectedId);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const state: TraceTreeState = selectedId ? 'spanSelected' : 'idle';

  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(new Set(controlledExpandedIds ?? []));
  const expandedSet = controlledExpandedIds ? new Set(controlledExpandedIds) : internalExpandedIds;

  const [internalVisibleTypes, setInternalVisibleTypes] = useState<Set<string>>(
    new Set(controlledVisibleTypes ?? ['llm', 'tool', 'chain', 'agent']),
  );
  const visibleSet = controlledVisibleTypes ? new Set(controlledVisibleTypes) : internalVisibleTypes;

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    function walk(nodes: TraceSpan[]) { for (const s of nodes) { types.add(s.type); if (s.children?.length) walk(s.children); } }
    walk(spans);
    return Array.from(types);
  }, [spans]);

  const handleSelect = useCallback((id: string) => {
    const nextId = id === selectedId ? undefined : id;
    setInternalSelectedId(nextId);
    onSelectSpan?.(nextId);
  }, [selectedId, onSelectSpan]);

  const handleToggleExpand = useCallback((id: string) => {
    setInternalExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const handleToggleFilter = useCallback((spanType: string) => {
    setInternalVisibleTypes((prev) => { const next = new Set(prev); if (next.has(spanType)) next.delete(spanType); else next.add(spanType); return next; });
  }, []);

  const visibleSpans = spans.filter((sp) => visibleSet.has(sp.type));
  const selectedSpan = selectedId ? findSpan(spans, selectedId) : undefined;

  return (
    <View ref={ref} testID="trace-tree" accessibilityRole="none" accessibilityLabel="Execution trace" style={s.root}>
      <View style={s.header}>
        <Text style={s.rootLabel}>{rootLabel}</Text>
        {showMetrics && totalDuration != null && <Text style={s.metric}>{`${totalDuration}ms`}</Text>}
        {showMetrics && totalTokens != null && <Text style={s.metric}>{`${totalTokens} tokens`}</Text>}
      </View>
      <View style={s.filterBar}>
        {availableTypes.map((spanType) => (
          <Pressable key={spanType} onPress={() => handleToggleFilter(spanType)}
            accessibilityRole="button" accessibilityState={{ checked: visibleSet.has(spanType) }}
            style={[s.filterBtn, visibleSet.has(spanType) && s.filterBtnActive]}>
            <Text style={visibleSet.has(spanType) ? s.filterTextActive : s.filterText}>
              {SPAN_TYPE_LABELS[spanType] ?? spanType}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={s.tree}>
        {visibleSpans.map((span) => (
          <SpanNode key={span.id} span={span} depth={0} expandedSet={expandedSet}
            visibleSet={visibleSet} selectedId={selectedId} showMetrics={showMetrics}
            onToggleExpand={handleToggleExpand} onSelect={handleSelect} />
        ))}
      </ScrollView>
      {selectedSpan && (
        <View style={s.detail}>
          <View style={s.detailHeader}>
            <Text style={s.detailType}>
              {SPAN_TYPE_ICONS[selectedSpan.type] ?? '\u25CF'} {SPAN_TYPE_LABELS[selectedSpan.type] ?? selectedSpan.type}
            </Text>
            <Pressable onPress={() => { setInternalSelectedId(undefined); onSelectSpan?.(undefined); }}>
              <Text>{'\u2715'}</Text>
            </Pressable>
          </View>
          <View style={s.detailField}><Text style={s.detailLabel}>Label</Text><Text style={s.detailValue}>{selectedSpan.label}</Text></View>
          <View style={s.detailField}>
            <Text style={s.detailLabel}>Status</Text>
            <Text style={[s.detailValue, { color: STATUS_COLORS[selectedSpan.status] ?? '#6b7280' }]}>
              {STATUS_ICONS[selectedSpan.status] ?? '\u2022'} {selectedSpan.status}
            </Text>
          </View>
          <View style={s.detailField}><Text style={s.detailLabel}>Duration</Text><Text style={s.detailValue}>{`${selectedSpan.duration}ms`}</Text></View>
          {selectedSpan.tokens != null && (
            <View style={s.detailField}><Text style={s.detailLabel}>Tokens</Text><Text style={s.detailValue}>{selectedSpan.tokens}</Text></View>
          )}
          {selectedSpan.children && selectedSpan.children.length > 0 && (
            <View style={s.detailField}><Text style={s.detailLabel}>Children</Text><Text style={s.detailValue}>{selectedSpan.children.length} spans</Text></View>
          )}
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  rootLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  metric: { fontSize: 12, color: '#6b7280' },
  filterBar: { flexDirection: 'row', gap: 4, padding: 8 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  filterBtnActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  filterText: { fontSize: 12, color: '#6b7280' },
  filterTextActive: { fontSize: 12, fontWeight: '600', color: '#6366f1' },
  tree: { flex: 1 },
  spanNode: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  spanNodeSel: { backgroundColor: '#dbeafe' },
  expandToggle: { fontSize: 10, color: '#6b7280', width: 14 },
  spanIcon: { fontSize: 14 },
  spanLabel: { fontSize: 13, flex: 1 },
  spanDuration: { fontSize: 11, color: '#6b7280' },
  spanTokens: { fontSize: 11, color: '#9ca3af' },
  spanStatus: { fontSize: 14 },
  detail: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailType: { fontSize: 14, fontWeight: '600' },
  detailField: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  detailLabel: { fontSize: 12, color: '#6b7280', width: 70 },
  detailValue: { fontSize: 12, flex: 1 },
});

TraceTree.displayName = 'TraceTree';
export { TraceTree };
export default TraceTree;
