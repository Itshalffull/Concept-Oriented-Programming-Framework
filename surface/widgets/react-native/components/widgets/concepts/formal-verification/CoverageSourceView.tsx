export type CoverageSourceViewState = 'idle' | 'lineHovered';
export type CoverageSourceViewEvent =
  | { type: 'HOVER_LINE'; lineIndex: number }
  | { type: 'FILTER'; status: CoverageFilter }
  | { type: 'JUMP_UNCOVERED' }
  | { type: 'LEAVE' }
  | { type: 'SELECT_LINE'; lineIndex: number }
  | { type: 'NAVIGATE'; direction: 'up' | 'down' };

export function coverageSourceViewReducer(state: CoverageSourceViewState, event: CoverageSourceViewEvent): CoverageSourceViewState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_LINE') return 'lineHovered';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'JUMP_UNCOVERED') return 'idle';
      return state;
    case 'lineHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { forwardRef, useReducer, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, FlatList, StyleSheet } from 'react-native';

export type CoverageStatus = 'covered' | 'uncovered' | 'partial' | null;
export type CoverageFilter = 'all' | 'covered' | 'uncovered' | 'partial';

export interface CoverageLine {
  number: number;
  text: string;
  coverage: CoverageStatus;
  coveredBy?: string;
}

export interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  percentage: number;
}

export interface CoverageSourceViewProps {
  lines: CoverageLine[];
  summary: CoverageSummary;
  language?: string;
  showLineNumbers?: boolean;
  filterStatus?: CoverageFilter;
  onLineSelect?: (line: CoverageLine) => void;
  onFilterChange?: (filter: CoverageFilter) => void;
}

const GUTTER_COLORS: Record<string, string> = {
  covered: '#22c55e',
  uncovered: '#ef4444',
  partial: '#eab308',
};

const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

const CoverageSourceView = forwardRef<View, CoverageSourceViewProps>(function CoverageSourceView(
  {
    lines,
    summary,
    language = 'typescript',
    showLineNumbers = true,
    filterStatus = 'all',
    onLineSelect,
    onFilterChange,
  },
  ref,
) {
  const [state, send] = useReducer(coverageSourceViewReducer, 'idle');
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<CoverageFilter>(filterStatus);

  useEffect(() => {
    setActiveFilter(filterStatus);
  }, [filterStatus]);

  const filteredLines = useMemo(() => {
    if (activeFilter === 'all') return lines;
    return lines.filter((l) => l.coverage === activeFilter);
  }, [lines, activeFilter]);

  const handleFilterChange = useCallback(
    (filter: CoverageFilter) => {
      setActiveFilter(filter);
      setSelectedLineIndex(null);
      send({ type: 'FILTER', status: filter });
      onFilterChange?.(filter);
    },
    [onFilterChange],
  );

  const handleLineSelect = useCallback(
    (index: number) => {
      setSelectedLineIndex(index);
      const line = filteredLines[index];
      if (line) onLineSelect?.(line);
    },
    [filteredLines, onLineSelect],
  );

  const selectedLine = selectedLineIndex !== null ? filteredLines[selectedLineIndex] : null;

  return (
    <View ref={ref} testID="coverage-source-view" accessibilityRole="none" accessibilityLabel="Coverage source view" style={styles.root}>
      {/* Summary header */}
      <View style={styles.summaryBar} accessibilityRole="summary" accessibilityLiveRegion="polite">
        <Text style={styles.summaryText}>
          Coverage: {summary.percentage}% ({summary.coveredLines}/{summary.totalLines} lines)
        </Text>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {FILTER_OPTIONS.map((filter) => (
          <Pressable
            key={filter}
            onPress={() => handleFilterChange(filter)}
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === filter }}
            accessibilityLabel={`Filter ${filter}`}
            style={[styles.filterButton, activeFilter === filter && styles.filterButtonActive]}
          >
            <Text style={[styles.filterButtonText, activeFilter === filter && styles.filterButtonTextActive]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Code area */}
      <FlatList
        data={filteredLines}
        keyExtractor={(item) => String(item.number)}
        renderItem={({ item, index }) => {
          const isSelected = selectedLineIndex === index;
          return (
            <Pressable
              onPress={() => handleLineSelect(index)}
              onPressIn={() => send({ type: 'HOVER_LINE', lineIndex: index })}
              onPressOut={() => send({ type: 'LEAVE' })}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Line ${item.number}, ${item.coverage ?? 'not executable'}`}
              style={[styles.lineRow, isSelected && styles.lineRowSelected]}
            >
              {/* Coverage gutter */}
              <View
                style={[
                  styles.coverageGutter,
                  { backgroundColor: item.coverage ? (GUTTER_COLORS[item.coverage] ?? 'transparent') : 'transparent' },
                ]}
              />

              {/* Line number */}
              {showLineNumbers && (
                <Text style={styles.lineNumber}>{item.number}</Text>
              )}

              {/* Source text */}
              <Text style={styles.sourceText} numberOfLines={1}>{item.text}</Text>
            </Pressable>
          );
        }}
        style={styles.codeArea}
      />

      {/* Selected line details */}
      {selectedLine && (
        <View style={styles.lineDetail}>
          <Text style={styles.lineDetailText}>
            <Text style={styles.lineDetailBold}>Line {selectedLine.number}</Text>
            {' — '}
            {selectedLine.coverage
              ? selectedLine.coverage.charAt(0).toUpperCase() + selectedLine.coverage.slice(1)
              : 'Not executable'}
            {selectedLine.coveredBy && ` (covered by: ${selectedLine.coveredBy})`}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  summaryBar: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  summaryText: { fontSize: 14, fontWeight: '600' },
  filterBar: { flexDirection: 'row', gap: 4, padding: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  filterButton: { paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4 },
  filterButtonActive: { backgroundColor: '#e0e7ff' },
  filterButtonText: { fontSize: 12 },
  filterButtonTextActive: { fontWeight: '600' },
  codeArea: { flex: 1 },
  lineRow: { flexDirection: 'row', alignItems: 'center', minHeight: 20 },
  lineRowSelected: { backgroundColor: '#dbeafe' },
  coverageGutter: { width: 4, alignSelf: 'stretch' },
  lineNumber: { width: 48, textAlign: 'right', paddingRight: 12, color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' },
  sourceText: { flex: 1, fontSize: 13, fontFamily: 'monospace', paddingRight: 12 },
  lineDetail: { padding: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  lineDetailText: { fontSize: 13 },
  lineDetailBold: { fontWeight: '700' },
});

CoverageSourceView.displayName = 'CoverageSourceView';
export { CoverageSourceView };
export default CoverageSourceView;
