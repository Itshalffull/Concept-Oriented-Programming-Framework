export type RunListTableState = 'idle' | 'rowSelected';
export type RunListTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'PAGE' }
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

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface RunItem {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'pending' | 'cancelled';
  startedAt: string;
  duration?: number;
  trigger?: string;
}

const STATUS_DISPLAY: Record<string, { icon: string; color: string }> = {
  running: { icon: '\u25B6', color: 'green' },
  completed: { icon: '\u2713', color: 'green' },
  failed: { icon: '\u2717', color: 'red' },
  pending: { icon: '\u25CB', color: 'gray' },
  cancelled: { icon: '\u23F9', color: 'gray' },
};

export interface RunListTableProps {
  runs: RunItem[];
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string | undefined;
  onSelectRun?: (id: string) => void;
  isFocused?: boolean;
}

export function RunListTable({
  runs,
  pageSize = 10,
  sortBy = 'startedAt',
  sortOrder = 'desc',
  filterStatus,
  onSelectRun,
  isFocused = false,
}: RunListTableProps) {
  const [state, send] = useReducer(runListTableReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [page, setPage] = useState(0);

  const filtered = filterStatus
    ? runs.filter(r => r.status === filterStatus)
    : runs;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageRuns = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(pageRuns.length - 1, prev + 1));
    }
    if (key.return) {
      const run = pageRuns[cursorIndex];
      if (run) {
        if (state === 'rowSelected') send({ type: 'DESELECT' });
        else {
          send({ type: 'SELECT_ROW' });
          onSelectRun?.(run.id);
        }
      }
    }
    if (key.escape) send({ type: 'DESELECT' });
    if (key.rightArrow && page < totalPages - 1) {
      setPage(prev => prev + 1);
      setCursorIndex(0);
      send({ type: 'PAGE' });
    }
    if (key.leftArrow && page > 0) {
      setPage(prev => prev - 1);
      setCursorIndex(0);
      send({ type: 'PAGE' });
    }
  });

  const COL_WIDTHS = { status: 3, name: 20, started: 12, duration: 8 };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Text bold>Process Runs</Text>

      {/* Header */}
      <Box marginTop={1}>
        <Text color="gray" bold>
          {'  '}St  {'Name'.padEnd(COL_WIDTHS.name)} {'Started'.padEnd(COL_WIDTHS.started)} Duration
        </Text>
      </Box>
      <Text color="gray">{'\u2500'.repeat(50)}</Text>

      {/* Rows */}
      {pageRuns.map((run, i) => {
        const isCursor = i === cursorIndex && isFocused;
        const isSelected = i === cursorIndex && state === 'rowSelected';
        const { icon, color } = STATUS_DISPLAY[run.status] ?? STATUS_DISPLAY.pending;

        return (
          <Box key={run.id}>
            <Text color={isCursor ? 'cyan' : undefined}>
              {isCursor ? '\u25B6 ' : '  '}
            </Text>
            <Text color={color}>{icon}  </Text>
            <Text bold={isSelected}>
              {run.name.padEnd(COL_WIDTHS.name).slice(0, COL_WIDTHS.name)}
            </Text>
            <Text color="gray"> {run.startedAt.padEnd(COL_WIDTHS.started).slice(0, COL_WIDTHS.started)}</Text>
            <Text color="gray">
              {run.duration !== undefined ? ` ${run.duration}ms` : ' -'}
            </Text>
          </Box>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box marginTop={1}>
          <Text color="gray">
            Page {page + 1}/{totalPages} [{'\u2190\u2192'}]
          </Text>
        </Box>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[{'\u2191\u2193'}] Nav [Enter] Select</Text>
        </Box>
      )}
    </Box>
  );
}

export default RunListTable;
