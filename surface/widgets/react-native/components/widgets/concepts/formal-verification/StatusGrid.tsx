export type StatusGridState = 'idle' | 'cellHovered' | 'cellSelected';
export type StatusGridEvent =
  | { type: 'HOVER_CELL'; row: number; col: number }
  | { type: 'CLICK_CELL'; row: number; col: number }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'LEAVE_CELL' }
  | { type: 'DESELECT' }
  | { type: 'FOCUS_NEXT_COL' }
  | { type: 'FOCUS_PREV_COL' }
  | { type: 'FOCUS_NEXT_ROW' }
  | { type: 'FOCUS_PREV_ROW' };

export function statusGridReducer(state: StatusGridState, event: StatusGridEvent): StatusGridState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_CELL') return 'cellHovered';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'cellHovered':
      if (event.type === 'LEAVE_CELL') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    case 'cellSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'CLICK_CELL') return 'cellSelected';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useMemo, useReducer, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

export type CellStatus = 'passed' | 'failed' | 'running' | 'pending' | 'timeout';
export interface StatusGridItem { id: string; name: string; status: CellStatus; duration?: number; }
export type StatusFilterValue = 'all' | 'passed' | 'failed';

export interface StatusGridProps {
  items: StatusGridItem[];
  columns?: number;
  showAggregates?: boolean;
  variant?: 'compact' | 'expanded';
  onCellSelect?: (item: StatusGridItem) => void;
  filterStatus?: StatusFilterValue;
}

const STATUS_COLORS: Record<CellStatus, string> = {
  passed: '#22c55e', failed: '#ef4444', running: '#3b82f6', pending: '#9ca3af', timeout: '#f97316',
};
const STATUS_LABELS: Record<CellStatus, string> = {
  passed: 'Passed', failed: 'Failed', running: 'Running', pending: 'Pending', timeout: 'Timeout',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const StatusGrid = forwardRef<View, StatusGridProps>(function StatusGrid(
  { items, columns = 4, showAggregates = true, variant = 'expanded', onCellSelect, filterStatus: initialFilter = 'all' },
  ref,
) {
  const [state, send] = useReducer(statusGridReducer, 'idle');
  const [filter, setFilter] = useState<StatusFilterValue>(initialFilter);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isCompact = variant === 'compact';

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<CellStatus, number> = { passed: 0, failed: 0, running: 0, pending: 0, timeout: 0 };
    for (const item of items) c[item.status]++;
    return c;
  }, [items]);

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (counts.passed > 0) parts.push(`${counts.passed} passed`);
    if (counts.failed > 0) parts.push(`${counts.failed} failed`);
    if (counts.running > 0) parts.push(`${counts.running} running`);
    if (counts.pending > 0) parts.push(`${counts.pending} pending`);
    if (counts.timeout > 0) parts.push(`${counts.timeout} timeout`);
    return parts.join(', ');
  }, [counts]);

  const selectedItem = selectedIndex != null ? filteredItems[selectedIndex] : null;

  const handleCellClick = useCallback((index: number) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    setSelectedIndex(index);
    send({ type: 'CLICK_CELL', row, col });
    if (filteredItems[index]) onCellSelect?.(filteredItems[index]);
  }, [columns, filteredItems, onCellSelect]);

  const handleFilterClick = useCallback((value: StatusFilterValue) => {
    setFilter(value);
    setSelectedIndex(null);
    send({ type: 'FILTER' } as StatusGridEvent);
  }, []);

  return (
    <View ref={ref} testID="status-grid" accessibilityRole="grid" accessibilityLabel="Verification status matrix" style={st.root}>
      {showAggregates && (
        <View style={st.summaryRow} accessibilityLiveRegion="polite">
          <Text style={[st.summaryText, isCompact && { fontSize: 12 }]}>{summaryText}</Text>
        </View>
      )}

      <View style={st.filterBar} accessibilityRole="toolbar" accessibilityLabel="Filter verification results">
        {(['all', 'passed', 'failed'] as const).map((value) => (
          <Pressable key={value} onPress={() => handleFilterClick(value)} accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            style={[st.filterBtn, filter === value && st.filterBtnActive, isCompact && { paddingHorizontal: 8, paddingVertical: 2 }]}>
            <Text style={[st.filterBtnText, filter === value && st.filterBtnTextActive, isCompact && { fontSize: 11 }]}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[st.grid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {filteredItems.map((item, index) => {
          const isSelected = selectedIndex === index;
          return (
            <Pressable key={item.id} onPress={() => handleCellClick(index)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}: ${STATUS_LABELS[item.status]}${item.duration != null ? `, ${formatDuration(item.duration)}` : ''}`}
              accessibilityState={{ selected: isSelected }}
              style={[st.cell, { width: `${100 / columns}%` as any }, isSelected && st.cellSelected, isCompact && { padding: 4, minHeight: 32 }]}>
              <View style={[st.indicator, { backgroundColor: STATUS_COLORS[item.status] }, isCompact && { width: 10, height: 10 }]} />
              <Text style={[st.cellLabel, isCompact && { fontSize: 10 }]} numberOfLines={1}>{item.name}</Text>
              {!isCompact && item.duration != null && <Text style={st.cellDuration}>{formatDuration(item.duration)}</Text>}
            </Pressable>
          );
        })}
      </View>

      {state === 'cellSelected' && selectedItem && (
        <View style={st.detailPanel} accessibilityLabel={`Details for ${selectedItem.name}`}>
          <Text style={st.detailName}>{selectedItem.name}</Text>
          <View style={st.detailRow}>
            <View style={[st.detailDot, { backgroundColor: STATUS_COLORS[selectedItem.status] }]} />
            <Text>Status: {STATUS_LABELS[selectedItem.status]}</Text>
          </View>
          {selectedItem.duration != null && <Text style={st.detailDuration}>Duration: {formatDuration(selectedItem.duration)}</Text>}
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  root: { flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  summaryText: { fontSize: 14 },
  filterBar: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  filterBtnActive: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  filterBtnText: { fontSize: 13 },
  filterBtnTextActive: { fontWeight: '600' },
  grid: { paddingVertical: 4 },
  cell: { padding: 8, minHeight: 48, alignItems: 'flex-start', justifyContent: 'center' },
  cellSelected: { borderWidth: 2, borderColor: '#6366f1', borderRadius: 4 },
  indicator: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
  cellLabel: { fontSize: 12, lineHeight: 14 },
  cellDuration: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  detailPanel: { padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6 },
  detailName: { fontWeight: '600', marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  detailDot: { width: 10, height: 10, borderRadius: 5 },
  detailDuration: { color: '#6b7280' },
});

StatusGrid.displayName = 'StatusGrid';
export { StatusGrid };
export default StatusGrid;
