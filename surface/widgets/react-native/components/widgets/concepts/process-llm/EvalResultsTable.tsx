export type EvalResultsTableState = 'idle' | 'rowSelected';
export type EvalResultsTableEvent =
  | { type: 'SELECT_ROW'; id?: string }
  | { type: 'SORT'; column?: string }
  | { type: 'FILTER'; status?: string }
  | { type: 'DESELECT' };

export function evalResultsTableReducer(state: EvalResultsTableState, event: EvalResultsTableEvent): EvalResultsTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
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

export interface EvalTestCase {
  id: string;
  input: string;
  expected: string;
  actual: string;
  score: number;
  pass: boolean;
  metrics?: Record<string, number>;
}

export interface EvalResultsTableProps {
  testCases: EvalTestCase[];
  overallScore: number;
  passCount: number;
  failCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string | undefined;
  showExpected?: boolean;
  onSelect?: (testCase: EvalTestCase) => void;
  children?: ReactNode;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function compareCases(a: EvalTestCase, b: EvalTestCase, key: string, order: 'asc' | 'desc'): number {
  let cmp = 0;
  switch (key) {
    case 'score': cmp = a.score - b.score; break;
    case 'status': cmp = (a.pass ? 1 : 0) - (b.pass ? 1 : 0); break;
    case 'input': cmp = a.input.localeCompare(b.input); break;
    case 'actual': cmp = a.actual.localeCompare(b.actual); break;
    case 'expected': cmp = a.expected.localeCompare(b.expected); break;
    default: cmp = 0;
  }
  return order === 'desc' ? -cmp : cmp;
}

const EvalResultsTable = forwardRef<View, EvalResultsTableProps>(function EvalResultsTable(
  {
    testCases,
    overallScore,
    passCount,
    failCount,
    sortBy: initialSortBy = 'score',
    sortOrder: initialSortOrder = 'desc',
    filterStatus: initialFilterStatus,
    showExpected = true,
    onSelect,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(evalResultsTableReducer, 'idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortByCol, setSortByCol] = useState(initialSortBy);
  const [sortOrd, setSortOrd] = useState<'asc' | 'desc'>(initialSortOrder);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(initialFilterStatus);

  const filteredCases = useMemo(() => {
    if (!activeFilter) return testCases;
    if (activeFilter === 'pass') return testCases.filter((tc) => tc.pass);
    if (activeFilter === 'fail') return testCases.filter((tc) => !tc.pass);
    return testCases;
  }, [testCases, activeFilter]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => compareCases(a, b, sortByCol, sortOrd));
  }, [filteredCases, sortByCol, sortOrd]);

  const handleSort = useCallback((column: string) => {
    if (sortByCol === column) setSortOrd((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortByCol(column); setSortOrd('desc'); }
    send({ type: 'SORT', column });
  }, [sortByCol]);

  const handleFilter = useCallback((status: string | undefined) => {
    setActiveFilter(status);
    send({ type: 'FILTER', status });
  }, []);

  const handleSelectRow = useCallback((tc: EvalTestCase) => {
    if (selectedId === tc.id) {
      setSelectedId(null);
      send({ type: 'DESELECT' });
    } else {
      setSelectedId(tc.id);
      send({ type: 'SELECT_ROW', id: tc.id });
      onSelect?.(tc);
    }
  }, [selectedId, onSelect]);

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    send({ type: 'DESELECT' });
  }, []);

  const sortIndicator = (col: string) => {
    if (sortByCol !== col) return '';
    return sortOrd === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const totalCount = passCount + failCount;
  const passPercent = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;
  const failPercent = totalCount > 0 ? 100 - passPercent : 0;

  const selectedCase = selectedId ? sortedCases.find((tc) => tc.id === selectedId) : null;

  const renderRow = useCallback(({ item: tc }: { item: EvalTestCase }) => {
    const isSelected = selectedId === tc.id;
    return (
      <Pressable
        onPress={() => handleSelectRow(tc)}
        accessibilityRole="none"
        accessibilityState={{ selected: isSelected }}
        style={[s.row, isSelected && s.rowSelected]}
      >
        <View style={s.rowContent}>
          <View style={[s.passBadge, { backgroundColor: tc.pass ? '#22c55e' : '#dc2626' }]}>
            <Text style={s.passBadgeText}>{tc.pass ? '\u2713' : '\u2717'}</Text>
          </View>
          <Text style={s.rowInput} numberOfLines={1}>{truncate(tc.input, 40)}</Text>
          <Text style={s.rowOutput} numberOfLines={1}>{truncate(tc.actual, 30)}</Text>
          <View style={s.scoreContainer}>
            <Text style={s.scoreValue}>{tc.score}</Text>
            <View style={s.scoreBarTrack}>
              <View style={[s.scoreBarFill, {
                width: `${Math.min(100, tc.score)}%` as any,
                backgroundColor: tc.pass ? '#22c55e' : '#dc2626',
              }]} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  }, [selectedId, handleSelectRow]);

  return (
    <View ref={ref} testID="eval-results-table" accessibilityRole="none" accessibilityLabel="Evaluation results" style={s.root}>
      {/* Summary */}
      <View style={s.summary}>
        <Text style={s.overallScore} accessibilityLabel={`Overall score: ${overallScore}%`}>{overallScore}%</Text>
        <View style={s.passFail}>
          <Text style={s.passText} accessibilityLabel={`${passCount} passed`}>{passCount} passed</Text>
          <Text style={s.failText} accessibilityLabel={`${failCount} failed`}>{failCount} failed</Text>
        </View>
        <View style={s.passFailBar} accessibilityRole="image" accessibilityLabel={`${passCount} passed, ${failCount} failed`}>
          <View style={[s.passSegment, { flex: passPercent || 0 }]} />
          <View style={[s.failSegment, { flex: failPercent || 0 }]} />
        </View>
      </View>

      {/* Filter buttons */}
      <View style={s.filterBar}>
        <Pressable onPress={() => handleFilter(undefined)} accessibilityRole="button" accessibilityState={{ selected: !activeFilter }}
          style={[s.filterChip, !activeFilter && s.filterChipActive]}>
          <Text style={[s.filterChipText, !activeFilter && s.filterChipTextActive]}>All ({testCases.length})</Text>
        </Pressable>
        <Pressable onPress={() => handleFilter(activeFilter === 'pass' ? undefined : 'pass')} accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'pass' }}
          style={[s.filterChip, activeFilter === 'pass' && s.filterChipActive]}>
          <Text style={[s.filterChipText, activeFilter === 'pass' && s.filterChipTextActive]}>Pass ({passCount})</Text>
        </Pressable>
        <Pressable onPress={() => handleFilter(activeFilter === 'fail' ? undefined : 'fail')} accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'fail' }}
          style={[s.filterChip, activeFilter === 'fail' && s.filterChipActive]}>
          <Text style={[s.filterChipText, activeFilter === 'fail' && s.filterChipTextActive]}>Fail ({failCount})</Text>
        </Pressable>
      </View>

      {/* Column headers */}
      <View style={s.headerRow}>
        <Pressable onPress={() => handleSort('status')} style={s.headerStatus}>
          <Text style={s.headerText}>Status{sortIndicator('status')}</Text>
        </Pressable>
        <Pressable onPress={() => handleSort('input')} style={s.headerInput}>
          <Text style={s.headerText}>Input{sortIndicator('input')}</Text>
        </Pressable>
        <Pressable onPress={() => handleSort('actual')} style={s.headerOutput}>
          <Text style={s.headerText}>Output{sortIndicator('actual')}</Text>
        </Pressable>
        <Pressable onPress={() => handleSort('score')} style={s.headerScore}>
          <Text style={s.headerText}>Score{sortIndicator('score')}</Text>
        </Pressable>
      </View>

      {/* Rows */}
      <FlatList
        data={sortedCases}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        style={s.list}
        ListEmptyComponent={
          <View style={s.emptyRow}>
            <Text style={s.emptyText}>No test cases match the current filter</Text>
          </View>
        }
      />

      {/* Detail panel */}
      {state === 'rowSelected' && selectedCase && (
        <View style={s.detail}>
          <View style={s.detailHeader}>
            <View style={[s.detailBadge, { backgroundColor: selectedCase.pass ? '#22c55e' : '#dc2626' }]}>
              <Text style={s.detailBadgeText}>{selectedCase.pass ? '\u2713 Passed' : '\u2717 Failed'}</Text>
            </View>
            <Text style={s.detailScore}>Score: {selectedCase.score}</Text>
            <Pressable onPress={handleDeselect} accessibilityRole="button" accessibilityLabel="Close detail panel">
              <Text style={s.closeBtn}>{'\u2715'}</Text>
            </Pressable>
          </View>

          <Text style={s.sectionLabel}>Input</Text>
          <Text style={s.preBlock}>{selectedCase.input}</Text>

          <Text style={s.sectionLabel}>Model Output</Text>
          <Text style={s.preBlock}>{selectedCase.actual}</Text>

          <Text style={s.sectionLabel}>Expected Output</Text>
          <Text style={s.preBlock}>{selectedCase.expected}</Text>

          {selectedCase.actual !== selectedCase.expected && (
            <>
              <Text style={s.sectionLabel}>Diff</Text>
              <View style={s.diffBlock}>
                <Text style={s.diffExpected}>- {selectedCase.expected}</Text>
                <Text style={s.diffActual}>+ {selectedCase.actual}</Text>
              </View>
            </>
          )}

          {selectedCase.metrics && Object.keys(selectedCase.metrics).length > 0 && (
            <>
              <Text style={s.sectionLabel}>Metrics</Text>
              {Object.entries(selectedCase.metrics).map(([metric, value]) => (
                <View key={metric} style={s.metricItem}>
                  <Text style={s.metricName}>{metric}</Text>
                  <Text style={s.metricValue}>{value}</Text>
                  <View style={s.metricBarTrack}>
                    <View style={[s.metricBarFill, { width: `${Math.min(100, value)}%` as any }]} />
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12, flex: 1 },
  summary: { marginBottom: 12 },
  overallScore: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  passFail: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  passText: { fontSize: 13, color: '#22c55e', fontWeight: '600' },
  failText: { fontSize: 13, color: '#dc2626', fontWeight: '600' },
  passFailBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  passSegment: { backgroundColor: '#22c55e', height: 6 },
  failSegment: { backgroundColor: '#dc2626', height: 6 },
  filterBar: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db' },
  filterChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: '#fff' },
  headerRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#e5e7eb', paddingBottom: 6, marginBottom: 4 },
  headerText: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  headerStatus: { width: 36 },
  headerInput: { flex: 2, paddingHorizontal: 4 },
  headerOutput: { flex: 2, paddingHorizontal: 4 },
  headerScore: { flex: 1, paddingHorizontal: 4 },
  list: { flex: 1 },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowSelected: { backgroundColor: '#ede9fe' },
  rowContent: { flexDirection: 'row', alignItems: 'center' },
  passBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  passBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowInput: { flex: 2, fontSize: 12, paddingHorizontal: 4 },
  rowOutput: { flex: 2, fontSize: 12, color: '#6b7280', paddingHorizontal: 4 },
  scoreContainer: { flex: 1, paddingHorizontal: 4 },
  scoreValue: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  scoreBarTrack: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: 4, borderRadius: 2 },
  emptyRow: { padding: 16, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 13 },
  detail: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 8 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  detailBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  detailBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  detailScore: { fontSize: 13, fontWeight: '600', flex: 1 },
  closeBtn: { fontSize: 16, color: '#6b7280', padding: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 8, marginBottom: 4 },
  preBlock: { fontSize: 12, backgroundColor: '#f9fafb', padding: 8, borderRadius: 4, lineHeight: 18 },
  diffBlock: { backgroundColor: '#f9fafb', padding: 8, borderRadius: 4 },
  diffExpected: { fontSize: 12, color: '#dc2626', marginBottom: 2 },
  diffActual: { fontSize: 12, color: '#22c55e' },
  metricItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metricName: { fontSize: 12, fontWeight: '600', width: 80 },
  metricValue: { fontSize: 12, width: 30 },
  metricBarTrack: { flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
  metricBarFill: { height: 4, backgroundColor: '#6366f1', borderRadius: 2 },
});

EvalResultsTable.displayName = 'EvalResultsTable';
export { EvalResultsTable };
export default EvalResultsTable;
