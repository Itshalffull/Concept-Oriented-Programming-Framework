/* ---------------------------------------------------------------------------
 * StatusGrid — Ink (terminal) implementation
 * Matrix grid displaying verification status for multiple properties
 * See widget spec: status-grid.widget
 * ------------------------------------------------------------------------- */

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

import React, { useReducer, useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type CellStatus = 'passed' | 'failed' | 'running' | 'pending' | 'timeout';

export interface StatusGridItem {
  id: string;
  name: string;
  status: CellStatus;
  duration?: number;
}

export type StatusFilterValue = 'all' | 'passed' | 'failed';

const STATUS_ICONS: Record<CellStatus, string> = {
  passed: '\u2713',
  failed: '\u2717',
  running: '\u25CF',
  pending: '\u25CB',
  timeout: '\u23F0',
};

const STATUS_COLORS: Record<CellStatus, string> = {
  passed: 'green',
  failed: 'red',
  running: 'cyan',
  pending: 'gray',
  timeout: 'yellow',
};

const STATUS_LABELS: Record<CellStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  running: 'Running',
  pending: 'Pending',
  timeout: 'Timeout',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface StatusGridProps {
  items: StatusGridItem[];
  columns?: number;
  showAggregates?: boolean;
  variant?: 'compact' | 'expanded';
  onCellSelect?: (item: StatusGridItem) => void;
  filterStatus?: StatusFilterValue;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function StatusGrid({
  items,
  columns = 4,
  showAggregates = true,
  variant = 'expanded',
  onCellSelect,
  filterStatus: initialFilter = 'all',
}: StatusGridProps) {
  const [state, send] = useReducer(statusGridReducer, 'idle');
  const [filter, setFilter] = useState<StatusFilterValue>(initialFilter);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  const totalCells = filteredItems.length;
  const actualCols = Math.min(columns, totalCells || 1);

  // Summary counts
  const counts = useMemo(() => {
    const c: Record<CellStatus, number> = { passed: 0, failed: 0, running: 0, pending: 0, timeout: 0 };
    for (const item of items) c[item.status]++;
    return c;
  }, [items]);

  const selectedItem = selectedIndex != null ? filteredItems[selectedIndex] : null;
  const isCompact = variant === 'compact';

  useInput((input, key) => {
    if (totalCells === 0) return;

    if (key.rightArrow) {
      setFocusIndex((i) => Math.min(i + 1, totalCells - 1));
    } else if (key.leftArrow) {
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (key.downArrow) {
      setFocusIndex((i) => Math.min(i + actualCols, totalCells - 1));
    } else if (key.upArrow) {
      setFocusIndex((i) => Math.max(i - actualCols, 0));
    } else if (key.return) {
      setSelectedIndex(focusIndex);
      send({ type: 'CLICK_CELL', row: Math.floor(focusIndex / actualCols), col: focusIndex % actualCols });
      if (filteredItems[focusIndex]) onCellSelect?.(filteredItems[focusIndex]);
    } else if (key.escape) {
      setSelectedIndex(null);
      send({ type: 'DESELECT' });
    } else if (input === 'f') {
      // Cycle filter
      const filters: StatusFilterValue[] = ['all', 'passed', 'failed'];
      const idx = filters.indexOf(filter);
      const next = filters[(idx + 1) % filters.length];
      setFilter(next);
      setFocusIndex(0);
      setSelectedIndex(null);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      <Box>
        <Text bold>Status Grid</Text>
        <Text dimColor> filter: {filter} (f to cycle)</Text>
      </Box>

      {/* Summary */}
      {showAggregates && (
        <Box>
          {counts.passed > 0 && <Text color="green">{counts.passed}\u2713 </Text>}
          {counts.failed > 0 && <Text color="red">{counts.failed}\u2717 </Text>}
          {counts.running > 0 && <Text color="cyan">{counts.running}\u25CF </Text>}
          {counts.pending > 0 && <Text dimColor>{counts.pending}\u25CB </Text>}
          {counts.timeout > 0 && <Text color="yellow">{counts.timeout}\u23F0 </Text>}
        </Box>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>

      {/* Grid rows */}
      {Array.from({ length: Math.ceil(totalCells / actualCols) }).map((_, rowIdx) => (
        <Box key={rowIdx}>
          {Array.from({ length: actualCols }).map((_, colIdx) => {
            const index = rowIdx * actualCols + colIdx;
            if (index >= totalCells) return null;
            const item = filteredItems[index];
            const isFocused = focusIndex === index;
            const isSelected = selectedIndex === index;

            if (isCompact) {
              return (
                <Box key={item.id} width={6}>
                  <Text
                    color={STATUS_COLORS[item.status]}
                    bold={isFocused}
                    inverse={isSelected}
                  >
                    {isFocused ? '\u25B6' : ' '}{STATUS_ICONS[item.status]}
                  </Text>
                </Box>
              );
            }

            return (
              <Box key={item.id} width={18}>
                <Text
                  color={STATUS_COLORS[item.status]}
                  bold={isFocused}
                  inverse={isSelected}
                >
                  {isFocused ? '\u25B6' : ' '}{STATUS_ICONS[item.status]} {item.name.slice(0, 12)}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Detail panel */}
      {state === 'cellSelected' && selectedItem && (
        <>
          <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>
          <Box flexDirection="column">
            <Box><Text bold>{selectedItem.name}</Text></Box>
            <Box>
              <Text color={STATUS_COLORS[selectedItem.status]}>
                {STATUS_ICONS[selectedItem.status]} {STATUS_LABELS[selectedItem.status]}
              </Text>
            </Box>
            {selectedItem.duration != null && (
              <Box><Text dimColor>Duration: {formatDuration(selectedItem.duration)}</Text></Box>
            )}
          </Box>
        </>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(45)}</Text></Box>
      <Box>
        <Text dimColor>\u2190\u2192\u2191\u2193 navigate  Enter select  f filter  Esc deselect</Text>
      </Box>
    </Box>
  );
}

export default StatusGrid;
