/* ---------------------------------------------------------------------------
 * CoverageSourceView — Ink (terminal) implementation
 * Source code overlay showing formal verification coverage annotations
 * See widget spec: coverage-source-view.widget
 * ------------------------------------------------------------------------- */

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

import React, { useReducer, useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const GUTTER_CHARS: Record<string, { char: string; color: string }> = {
  covered: { char: '\u2588', color: 'green' },
  uncovered: { char: '\u2588', color: 'red' },
  partial: { char: '\u2593', color: 'yellow' },
};

const FILTER_OPTIONS: CoverageFilter[] = ['all', 'covered', 'uncovered', 'partial'];

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CoverageSourceViewProps {
  lines: CoverageLine[];
  summary: CoverageSummary;
  language?: string;
  showLineNumbers?: boolean;
  filterStatus?: CoverageFilter;
  onLineSelect?: (line: CoverageLine) => void;
  onFilterChange?: (filter: CoverageFilter) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function CoverageSourceView({
  lines,
  summary,
  language = 'typescript',
  showLineNumbers = true,
  filterStatus = 'all',
  onLineSelect,
  onFilterChange,
}: CoverageSourceViewProps) {
  const [state, send] = useReducer(coverageSourceViewReducer, 'idle');
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [focusedLineIndex, setFocusedLineIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<CoverageFilter>(filterStatus);

  const filteredLines = useMemo(() => {
    if (activeFilter === 'all') return lines;
    return lines.filter((l) => l.coverage === activeFilter);
  }, [lines, activeFilter]);

  const handleFilterChange = useCallback(
    (filter: CoverageFilter) => {
      setActiveFilter(filter);
      setFocusedLineIndex(0);
      setSelectedLineIndex(null);
      send({ type: 'FILTER', status: filter });
      onFilterChange?.(filter);
    },
    [onFilterChange],
  );

  const jumpToNextUncovered = useCallback(() => {
    const startIdx = focusedLineIndex + 1;
    for (let i = 0; i < filteredLines.length; i++) {
      const idx = (startIdx + i) % filteredLines.length;
      if (filteredLines[idx].coverage === 'uncovered') {
        setFocusedLineIndex(idx);
        send({ type: 'JUMP_UNCOVERED' });
        return;
      }
    }
  }, [focusedLineIndex, filteredLines]);

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusedLineIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setFocusedLineIndex((i) => Math.min(filteredLines.length - 1, i + 1));
    } else if (key.return) {
      setSelectedLineIndex(focusedLineIndex);
      const line = filteredLines[focusedLineIndex];
      if (line) onLineSelect?.(line);
    } else if (input === 'f') {
      const idx = FILTER_OPTIONS.indexOf(activeFilter);
      const next = FILTER_OPTIONS[(idx + 1) % FILTER_OPTIONS.length];
      handleFilterChange(next);
    } else if (input === 'g') {
      jumpToNextUncovered();
    }
  });

  // Determine visible window (terminal can't show all lines)
  const VISIBLE_LINES = 20;
  const windowStart = Math.max(0, Math.min(focusedLineIndex - Math.floor(VISIBLE_LINES / 2), filteredLines.length - VISIBLE_LINES));
  const windowEnd = Math.min(windowStart + VISIBLE_LINES, filteredLines.length);
  const visibleLines = filteredLines.slice(windowStart, windowEnd);

  const selectedLine = selectedLineIndex != null ? filteredLines[selectedLineIndex] : null;

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Summary */}
      <Box>
        <Text bold>Coverage: </Text>
        <Text color={summary.percentage >= 80 ? 'green' : summary.percentage >= 50 ? 'yellow' : 'red'}>
          {summary.percentage}%
        </Text>
        <Text dimColor> ({summary.coveredLines}/{summary.totalLines} lines)</Text>
      </Box>

      {/* Filter bar */}
      <Box>
        <Text dimColor>Filter: </Text>
        {FILTER_OPTIONS.map((f) => (
          <Text key={f} bold={activeFilter === f} color={activeFilter === f ? 'cyan' : undefined}>
            {f}{' '}
          </Text>
        ))}
        <Text dimColor>(f to cycle, g jump uncovered)</Text>
      </Box>

      <Box><Text dimColor>{'\u2500'.repeat(60)}</Text></Box>

      {/* Source lines */}
      {visibleLines.map((line, i) => {
        const globalIdx = windowStart + i;
        const isFocused = globalIdx === focusedLineIndex;
        const isSelected = globalIdx === selectedLineIndex;
        const gutter = line.coverage ? GUTTER_CHARS[line.coverage] : null;

        return (
          <Box key={line.number}>
            {/* Coverage gutter */}
            <Text color={gutter?.color ?? 'gray'}>
              {gutter?.char ?? ' '}
            </Text>

            {/* Line number */}
            {showLineNumbers && (
              <Text dimColor>
                {String(line.number).padStart(4, ' ')}
              </Text>
            )}

            {/* Focus indicator */}
            <Text>{isFocused ? '\u25B6' : ' '}</Text>

            {/* Source text */}
            <Text bold={isSelected} inverse={isSelected}>
              {line.text}
            </Text>
          </Box>
        );
      })}

      {/* Selected line details */}
      {selectedLine && (
        <>
          <Box><Text dimColor>{'\u2500'.repeat(60)}</Text></Box>
          <Box>
            <Text bold>Line {selectedLine.number}</Text>
            <Text> \u2014 </Text>
            <Text color={
              selectedLine.coverage === 'covered' ? 'green'
                : selectedLine.coverage === 'uncovered' ? 'red'
                  : selectedLine.coverage === 'partial' ? 'yellow'
                    : 'gray'
            }>
              {selectedLine.coverage
                ? selectedLine.coverage.charAt(0).toUpperCase() + selectedLine.coverage.slice(1)
                : 'Not executable'}
            </Text>
            {selectedLine.coveredBy && (
              <Text dimColor> (covered by: {selectedLine.coveredBy})</Text>
            )}
          </Box>
        </>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(60)}</Text></Box>
      <Box>
        <Text dimColor>\u2191\u2193 navigate  Enter select  f filter  g jump uncovered</Text>
      </Box>
    </Box>
  );
}

export default CoverageSourceView;
