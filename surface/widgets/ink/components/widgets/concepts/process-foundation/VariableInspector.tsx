export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT_VAR' }
  | { type: 'ADD_WATCH' }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function variableInspectorReducer(state: VariableInspectorState, event: VariableInspectorEvent): VariableInspectorState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      if (event.type === 'ADD_WATCH') return 'idle';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    case 'varSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface Variable {
  name: string;
  value: string;
  type?: string;
  watched?: boolean;
}

export interface VariableInspectorProps {
  variables: Variable[];
  runStatus: string;
  showTypes?: boolean;
  showWatch?: boolean;
  expandDepth?: number;
  onWatch?: (name: string) => void;
  isFocused?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  string: 'green',
  number: 'yellow',
  boolean: 'magenta',
  object: 'cyan',
  array: 'cyan',
  null: 'gray',
  undefined: 'gray',
};

export function VariableInspector({
  variables,
  runStatus,
  showTypes = true,
  showWatch = false,
  onWatch,
  isFocused = false,
}: VariableInspectorProps) {
  const [state, send] = useReducer(variableInspectorReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery
    ? variables.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : variables;

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'filtering') {
      if (key.escape) {
        send({ type: 'CLEAR' });
        setSearchQuery('');
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
        return;
      }
      if (key.return) {
        send({ type: 'CLEAR' });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery(prev => prev + input);
        return;
      }
    }

    if (input === '/' && state === 'idle') {
      send({ type: 'SEARCH' });
      setSearchQuery('');
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(filtered.length - 1, prev + 1));
    }
    if (key.return) {
      if (state === 'varSelected') send({ type: 'DESELECT' });
      else send({ type: 'SELECT_VAR' });
    }
    if (key.escape) send({ type: 'DESELECT' });
    if (input === 'w' && showWatch) {
      const v = filtered[cursorIndex];
      if (v) {
        send({ type: 'ADD_WATCH' });
        onWatch?.(v.name);
      }
    }
  });

  const statusColor = runStatus === 'running' ? 'green' : runStatus === 'failed' ? 'red' : 'gray';

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Text bold>Variables</Text>
        <Text color={statusColor}>{runStatus}</Text>
      </Box>

      {state === 'filtering' && (
        <Box marginTop={1}>
          <Text color="cyan">{'\u{1F50D}'} </Text>
          <Text>{searchQuery}</Text>
          <Text color="cyan">{'\u2588'}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {filtered.length === 0 && (
          <Text color="gray">(no variables)</Text>
        )}
        {filtered.map((v, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const isSelected = i === cursorIndex && state === 'varSelected';
          const typeColor = TYPE_COLORS[v.type ?? ''] ?? 'white';

          return (
            <Box key={v.name} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                {v.watched && <Text color="yellow">{'\u2605'} </Text>}
                <Text bold>{v.name}</Text>
                {showTypes && v.type && (
                  <Text color={typeColor}> ({v.type})</Text>
                )}
                <Text color="gray">: </Text>
                <Text wrap={isSelected ? 'wrap' : 'truncate'}>
                  {isSelected ? v.value : v.value.slice(0, 50) + (v.value.length > 50 ? '...' : '')}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">
            [{'\u2191\u2193'}] Nav [/] Search [Enter] Expand
            {showWatch ? ' [w]atch' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default VariableInspector;
