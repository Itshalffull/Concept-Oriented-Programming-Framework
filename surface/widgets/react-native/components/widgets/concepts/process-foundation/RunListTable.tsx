export type RunListTableState = 'idle' | 'rowSelected';
export type RunListTableEvent =
  | { type: 'SELECT_ROW'; id?: string }
  | { type: 'SORT'; column?: string }
  | { type: 'FILTER'; status?: string }
  | { type: 'PAGE'; page?: number }
  | { type: 'DESELECT' };

export function runListTableReducer(state: RunListTableState, event: RunListTableEvent): RunListTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'PAGE') return 'idle';
      return state;
    case 'rowSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useCallback, useMemo, useReducer, useState, type ReactNode } from 'react';
import { View, Text, Pressable, FlatList, ScrollView, StyleSheet } from 'react-native';

export interface ProcessRun {
  id: string;
  processName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';
  startedAt: string;
  duration?: string;
  outcome?: 'success' | 'failure' | 'cancelled' | 'pending';
}

export interface RunListTableProps {
  runs: ProcessRun[];
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string | undefined;
  onSelect?: (run: ProcessRun) => void;
  onCancel?: (id: string) => void;
  children?: ReactNode;
}

const STATUS_ORDER: Record<string, number> = { running: 0, pending: 1, completed: 2, failed: 3, cancelled: 4 };
const STATUS_LABELS: Record<string, string> = { running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', pending: 'Pending' };
const ALL_STATUSES = ['running', 'pending', 'completed', 'failed', 'cancelled'] as const;

const STATUS_COLORS: Record<string, string> = {
  running: '#3b82f6',
  pending: '#f59e0b',
  completed: '#22c55e',
  failed: '#dc2626',
  cancelled: '#6b7280',
};

function outcomeIcon(outcome: string | undefined): string {
  switch (outcome) {
    case 'success': return '\u2713';
    case 'failure': return '\u2717';
    case 'cancelled': return '\u2014';
    default: return '\u25CB';
  }
}

function compareRuns(a: ProcessRun, b: ProcessRun, key: string, order: 'asc' | 'desc'): number {
  let cmp = 0;
  switch (key) {
    case 'processName': cmp = a.processName.localeCompare(b.processName); break;
    case 'status': cmp = (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5); break;
    case 'startedAt': cmp = a.startedAt.localeCompare(b.startedAt); break;
    case 'duration': cmp = (a.duration ?? '').localeCompare(b.duration ?? ''); break;
    default: cmp = 0;
  }
  return order === 'desc' ? -cmp : cmp;
}

const COLUMNS = ['status', 'processName', 'startedAt', 'duration', 'outcome'] as const;
const COLUMN_LABELS: Record<string, string> = { status: 'Status', processName: 'Process', startedAt: 'Started', duration: 'Duration', outcome: 'Outcome' };

const RunListTable = forwardRef<View, RunListTableProps>(function RunListTable(
  {
    runs,
    pageSize = 20,
    sortBy: initialSortBy = 'startedAt',
    sortOrder: initialSortOrder = 'desc',
    filterStatus: initialFilterStatus,
    onSelect,
    onCancel,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(runListTableReducer, 'idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortByCol, setSortByCol] = useState(initialSortBy);
  const [sortOrd, setSortOrd] = useState<'asc' | 'desc'>(initialSortOrder);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(initialFilterStatus);
  const [currentPage, setCurrentPage] = useState(0);

  const filteredRuns = useMemo(() => {
    if (!activeFilter) return runs;
    return runs.filter((r) => r.status === activeFilter);
  }, [runs, activeFilter]);

  const sortedRuns = useMemo(() => {
    return [...filteredRuns].sort((a, b) => compareRuns(a, b, sortByCol, sortOrd));
  }, [filteredRuns, sortByCol, sortOrd]);

  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / pageSize));
  const pageRuns = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedRuns.slice(start, start + pageSize);
  }, [sortedRuns, currentPage, pageSize]);

  const handleSort = useCallback((column: string) => {
    if (sortByCol === column) setSortOrd((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortByCol(column); setSortOrd('asc'); }
    send({ type: 'SORT', column });
  }, [sortByCol]);

  const handleFilter = useCallback((status: string | undefined) => {
    setActiveFilter(status);
    setCurrentPage(0);
    send({ type: 'FILTER', status });
  }, []);

  const handleSelectRow = useCallback((run: ProcessRun) => {
    setSelectedId(run.id);
    send({ type: 'SELECT_ROW', id: run.id });
    onSelect?.(run);
  }, [onSelect]);

  const sortIndicator = (col: string) => {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const renderRow = useCallback(({ item: run }: { item: ProcessRun }) => {
    const isSelected = selectedId === run.id;
    return (
      <Pressable
        onPress={() => handleSelectRow(run)}
        accessibilityRole="none"
        accessibilityState={{ selected: isSelected }}
        style={[s.row, isSelected && s.rowSelected]}
      >
        <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[run.status] ?? '#9ca3af' }]} />
        <Text style={s.cellStatus} accessibilityLabel={`Status: ${run.status}`}>{STATUS_LABELS[run.status] ?? run.status}</Text>
        <Text style={s.cellName} numberOfLines={1}>{run.processName}</Text>
        <Text style={s.cellTime}>{run.startedAt}</Text>
        <Text style={s.cellDuration}>{run.duration ?? '\u2014'}</Text>
        <Text style={s.cellOutcome} accessibilityLabel={`Outcome: ${run.outcome ?? 'pending'}`}>{outcomeIcon(run.outcome)}</Text>
      </Pressable>
    );
  }, [selectedId, handleSelectRow]);

  return (
    <View ref={ref} testID="run-list-table" accessibilityRole="none" accessibilityLabel="Process runs" style={s.root}>
      {/* Filter bar */}
      <ScrollView horizontal style={s.filterBar} showsHorizontalScrollIndicator={false}>
        <Pressable
          onPress={() => handleFilter(undefined)}
          accessibilityRole="button"
          accessibilityState={{ selected: !activeFilter }}
          style={[s.filterChip, !activeFilter && s.filterChipActive]}
        >
          <Text style={[s.filterChipText, !activeFilter && s.filterChipTextActive]}>All ({runs.length})</Text>
        </Pressable>
        {ALL_STATUSES.map((st) => {
          const count = runs.filter((r) => r.status === st).length;
          if (count === 0) return null;
          return (
            <Pressable
              key={st}
              onPress={() => handleFilter(activeFilter === st ? undefined : st)}
              accessibilityRole="button"
              accessibilityState={{ selected: activeFilter === st }}
              style={[s.filterChip, activeFilter === st && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, activeFilter === st && s.filterChipTextActive]}>
                {STATUS_LABELS[st]} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Column headers */}
      <View style={s.headerRow}>
        {COLUMNS.map((col) => (
          <Pressable key={col} onPress={() => handleSort(col)} accessibilityRole="button" style={s.headerCell}>
            <Text style={s.headerText}>{COLUMN_LABELS[col]}{sortIndicator(col)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Rows */}
      <FlatList
        data={pageRuns}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        style={s.listContainer}
        ListEmptyComponent={
          <View style={s.emptyRow}>
            <Text style={s.emptyText}>No runs match the current filter</Text>
          </View>
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={s.pagination}>
          <Pressable
            onPress={() => { setCurrentPage((p) => Math.max(0, p - 1)); }}
            disabled={currentPage === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            style={[s.pageButton, currentPage === 0 && s.pageButtonDisabled]}
          >
            <Text style={s.pageButtonText}>{'\u2190'}</Text>
          </Pressable>
          <Text style={s.pageInfo}>Page {currentPage + 1} of {totalPages}</Text>
          <Pressable
            onPress={() => { setCurrentPage((p) => Math.min(totalPages - 1, p + 1)); }}
            disabled={currentPage >= totalPages - 1}
            accessibilityRole="button"
            accessibilityLabel="Next page"
            style={[s.pageButton, currentPage >= totalPages - 1 && s.pageButtonDisabled]}
          >
            <Text style={s.pageButtonText}>{'\u2192'}</Text>
          </Pressable>
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12, flex: 1 },
  filterBar: { flexDirection: 'row', marginBottom: 8, maxHeight: 36 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', marginRight: 6 },
  filterChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: '#fff' },
  headerRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#e5e7eb', paddingBottom: 6, marginBottom: 4 },
  headerCell: { flex: 1, paddingHorizontal: 2 },
  headerText: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  listContainer: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowSelected: { backgroundColor: '#ede9fe' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  cellStatus: { flex: 1, fontSize: 12, fontWeight: '600' },
  cellName: { flex: 2, fontSize: 13 },
  cellTime: { flex: 1.5, fontSize: 11, color: '#6b7280' },
  cellDuration: { flex: 1, fontSize: 11, color: '#6b7280' },
  cellOutcome: { width: 24, textAlign: 'center', fontSize: 14 },
  emptyRow: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 13 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  pageButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 4 },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { fontSize: 16 },
  pageInfo: { fontSize: 13, color: '#6b7280' },
});

RunListTable.displayName = 'RunListTable';
export { RunListTable };
export default RunListTable;
