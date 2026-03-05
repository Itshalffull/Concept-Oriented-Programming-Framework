export type TraceTreeState = 'idle' | 'spanSelected' | 'ready' | 'fetching';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'FILTER' }
  | { type: 'DESELECT' }
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' };

export function traceTreeReducer(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'spanSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    case 'ready':
      if (event.type === 'LOAD') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface TraceSpan {
  id: string;
  label: string;
  type?: string;
  duration?: number;
  tokens?: number;
  status?: string;
  children?: TraceSpan[];
  depth?: number;
}

export interface TraceTreeProps {
  spans: TraceSpan[];
  rootLabel: string;
  totalDuration?: number | undefined;
  totalTokens?: number | undefined;
  selectedSpanId?: string | undefined;
  expandedIds?: Array<string>;
  visibleTypes?: Array<string>;
  showMetrics?: boolean;
  onSelectSpan?: (id: string) => void;
  isFocused?: boolean;
}

function flattenSpans(spans: TraceSpan[], depth = 0): Array<TraceSpan & { depth: number }> {
  const result: Array<TraceSpan & { depth: number }> = [];
  for (const span of spans) {
    result.push({ ...span, depth });
    if (span.children) {
      result.push(...flattenSpans(span.children, depth + 1));
    }
  }
  return result;
}

const TYPE_COLORS: Record<string, string> = {
  llm: 'green',
  tool: 'magenta',
  chain: 'cyan',
  agent: 'yellow',
};

const STATUS_ICONS: Record<string, string> = {
  success: '\u2713',
  error: '\u2717',
  running: '\u25D4',
  pending: '\u25CB',
};

export function TraceTree({
  spans,
  rootLabel,
  totalDuration,
  totalTokens,
  selectedSpanId,
  showMetrics = true,
  onSelectSpan,
  isFocused = false,
}: TraceTreeProps) {
  const [state, send] = useReducer(traceTreeReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);

  const flat = flattenSpans(spans);

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(flat.length - 1, prev + 1));
    }
    if (key.return) {
      const span = flat[cursorIndex];
      if (span) {
        if (state === 'spanSelected' && span.id === selectedSpanId) {
          send({ type: 'DESELECT' });
        } else {
          send({ type: 'SELECT_SPAN' });
          onSelectSpan?.(span.id);
        }
      }
    }
    if (key.escape) {
      send({ type: 'DESELECT' });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Text bold>{rootLabel}</Text>
        {showMetrics && (
          <Box>
            {totalDuration !== undefined && (
              <Text color="gray">{(totalDuration / 1000).toFixed(2)}s </Text>
            )}
            {totalTokens !== undefined && (
              <Text color="gray">{totalTokens} tokens</Text>
            )}
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {flat.map((span, i) => {
          const isSelected = span.id === selectedSpanId;
          const isCursor = i === cursorIndex && isFocused;
          const prefix = span.depth === 0 ? '' :
            ' '.repeat((span.depth - 1) * 2) + (i === flat.length - 1 ? '\u2514\u2500 ' : '\u251C\u2500 ');
          const typeColor = TYPE_COLORS[span.type ?? ''] ?? 'white';
          const statusIcon = STATUS_ICONS[span.status ?? ''] ?? '';

          return (
            <Box key={span.id}>
              <Text color={isCursor ? 'cyan' : undefined}>
                {isCursor ? '\u25B6 ' : '  '}
              </Text>
              <Text color="gray">{prefix}</Text>
              <Text color={statusIcon ? (span.status === 'error' ? 'red' : 'green') : undefined}>
                {statusIcon}{statusIcon ? ' ' : ''}
              </Text>
              <Text color={typeColor} bold={isSelected}>{span.label}</Text>
              {span.type && <Text color={typeColor}> [{span.type}]</Text>}
              {span.duration !== undefined && (
                <Text color="gray"> {span.duration}ms</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[{'\u2191\u2193'}] Navigate [Enter] Select [Esc] Deselect</Text>
        </Box>
      )}
    </Box>
  );
}

export default TraceTree;
