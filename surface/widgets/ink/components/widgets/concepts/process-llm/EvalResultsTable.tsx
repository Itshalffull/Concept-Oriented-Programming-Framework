export type EvalResultsTableState = 'idle' | 'rowSelected';
export type EvalResultsTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
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

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface TestCase {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'error' | 'skip';
  score?: number;
  expected?: string;
  actual?: string;
  latency?: number;
}

const STATUS_DISPLAY: Record<string, { icon: string; color: string }> = {
  pass: { icon: '\u2713', color: 'green' },
  fail: { icon: '\u2717', color: 'red' },
  error: { icon: '\u26A0', color: 'yellow' },
  skip: { icon: '\u2298', color: 'gray' },
};

export interface EvalResultsTableProps {
  testCases: TestCase[];
  overallScore: number;
  passCount: number;
  failCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterStatus?: string | undefined;
  showExpected?: boolean;
  onSelectCase?: (id: string) => void;
  isFocused?: boolean;
}

export function EvalResultsTable({
  testCases,
  overallScore,
  passCount,
  failCount,
  filterStatus,
  showExpected = false,
  onSelectCase,
  isFocused = false,
}: EvalResultsTableProps) {
  const [state, send] = useReducer(evalResultsTableReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);

  const filtered = filterStatus
    ? testCases.filter(tc => tc.status === filterStatus)
    : testCases;

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(filtered.length - 1, prev + 1));
    }
    if (key.return) {
      const tc = filtered[cursorIndex];
      if (tc) {
        if (state === 'rowSelected') send({ type: 'DESELECT' });
        else {
          send({ type: 'SELECT_ROW' });
          onSelectCase?.(tc.id);
        }
      }
    }
    if (key.escape) send({ type: 'DESELECT' });
  });

  const scoreColor = overallScore >= 80 ? 'green' : overallScore >= 50 ? 'yellow' : 'red';
  const barWidth = 20;
  const passBar = Math.round((passCount / (passCount + failCount || 1)) * barWidth);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Text bold>Eval Results</Text>

      {/* Summary */}
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={scoreColor} bold>{overallScore}%</Text>
          <Text color="gray"> overall score</Text>
        </Box>
        <Box>
          <Text color="green">{'\u2588'.repeat(passBar)}</Text>
          <Text color="red">{'\u2588'.repeat(barWidth - passBar)}</Text>
          <Text color="gray"> {passCount}/{passCount + failCount}</Text>
        </Box>
        <Box>
          <Text color="green">{'\u2713'} {passCount} passed </Text>
          <Text color="red">{'\u2717'} {failCount} failed</Text>
        </Box>
      </Box>

      {/* Test cases */}
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" bold>
          {'  '}St  Name{' '.repeat(20)}Score  Latency
        </Text>
        <Text color="gray">{'\u2500'.repeat(50)}</Text>

        {filtered.map((tc, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const isSelected = i === cursorIndex && state === 'rowSelected';
          const { icon, color } = STATUS_DISPLAY[tc.status] ?? STATUS_DISPLAY.skip;

          return (
            <Box key={tc.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                <Text color={color}>{icon}  </Text>
                <Text bold={isSelected}>
                  {tc.name.padEnd(20).slice(0, 20)}
                </Text>
                <Text color={tc.score !== undefined && tc.score >= 80 ? 'green' : tc.score !== undefined && tc.score >= 50 ? 'yellow' : 'red'}>
                  {tc.score !== undefined ? `${tc.score}%`.padEnd(7) : '-'.padEnd(7)}
                </Text>
                <Text color="gray">
                  {tc.latency !== undefined ? `${tc.latency}ms` : '-'}
                </Text>
              </Box>
              {isSelected && showExpected && (
                <Box flexDirection="column" paddingLeft={4}>
                  {tc.expected && (
                    <Box>
                      <Text color="green">Expected: </Text>
                      <Text wrap="truncate">{tc.expected}</Text>
                    </Box>
                  )}
                  {tc.actual && (
                    <Box>
                      <Text color={tc.status === 'fail' ? 'red' : undefined}>Actual:   </Text>
                      <Text wrap="truncate">{tc.actual}</Text>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[{'\u2191\u2193'}] Nav [Enter] Details</Text>
        </Box>
      )}
    </Box>
  );
}

export default EvalResultsTable;
