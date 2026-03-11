export type MemoryInspectorState = 'viewing' | 'searching' | 'entrySelected' | 'deleting';
export type MemoryInspectorEvent =
  | { type: 'SWITCH_TAB' }
  | { type: 'SEARCH' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' }
  | { type: 'DELETE' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' };

export function memoryInspectorReducer(state: MemoryInspectorState, event: MemoryInspectorEvent): MemoryInspectorState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SWITCH_TAB') return 'viewing';
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'searching':
      if (event.type === 'CLEAR') return 'viewing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      if (event.type === 'DELETE') return 'deleting';
      return state;
    case 'deleting':
      if (event.type === 'CONFIRM') return 'viewing';
      if (event.type === 'CANCEL') return 'entrySelected';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  type?: string;
  timestamp?: string;
}

const TABS = ['working', 'episodic', 'semantic', 'procedural'] as const;

export interface MemoryInspectorProps {
  memoryType: string;
  entries: MemoryEntry[];
  workingMemory: MemoryEntry[];
  activeTab?: typeof TABS[number];
  showContext?: boolean;
  onDelete?: (id: string) => void;
  isFocused?: boolean;
}

export function MemoryInspector({
  entries,
  workingMemory,
  activeTab: initialTab = 'working',
  showContext = false,
  onDelete,
  isFocused = false,
}: MemoryInspectorProps) {
  const [state, send] = useReducer(memoryInspectorReducer, 'viewing');
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>(initialTab);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const currentEntries = activeTab === 'working' ? workingMemory : entries;
  const filtered = searchQuery
    ? currentEntries.filter(e => e.key.toLowerCase().includes(searchQuery.toLowerCase()))
    : currentEntries;

  useInput((input, key) => {
    if (!isFocused) return;

    if (state === 'deleting') {
      if (input === 'y') {
        const entry = filtered[cursorIndex];
        if (entry) onDelete?.(entry.id);
        send({ type: 'CONFIRM' });
      }
      if (input === 'n' || key.escape) send({ type: 'CANCEL' });
      return;
    }

    if (state === 'searching') {
      if (key.escape) {
        send({ type: 'CLEAR' });
        setSearchQuery('');
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.return) {
        setSearchQuery(prev => prev + input);
        return;
      }
      if (key.return) {
        send({ type: 'CLEAR' });
        return;
      }
    }

    if (input === '/' && state === 'viewing') {
      send({ type: 'SEARCH' });
      setSearchQuery('');
      return;
    }

    if (key.tab) {
      const idx = TABS.indexOf(activeTab);
      setActiveTab(TABS[(idx + 1) % TABS.length]);
      setCursorIndex(0);
      send({ type: 'SWITCH_TAB' });
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(filtered.length - 1, prev + 1));
    }
    if (key.return) {
      if (state === 'entrySelected') send({ type: 'DESELECT' });
      else {
        send({ type: 'SELECT_ENTRY' });
      }
    }
    if (key.escape) send({ type: 'DESELECT' });
    if (input === 'd' && state === 'entrySelected') send({ type: 'DELETE' });
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Text bold>Memory Inspector</Text>

      {/* Tabs */}
      <Box marginTop={1}>
        {TABS.map(tab => (
          <Box key={tab} marginRight={1}>
            <Text
              color={tab === activeTab ? 'cyan' : 'gray'}
              bold={tab === activeTab}
              underline={tab === activeTab}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Search */}
      {state === 'searching' && (
        <Box marginTop={1}>
          <Text color="cyan">{'\u{1F50D}'} </Text>
          <Text>{searchQuery}</Text>
          <Text color="cyan">{'\u2588'}</Text>
        </Box>
      )}

      {/* Entries */}
      <Box flexDirection="column" marginTop={1}>
        {filtered.length === 0 && (
          <Text color="gray">(no entries)</Text>
        )}
        {filtered.map((entry, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const isSelected = i === cursorIndex && state === 'entrySelected';

          return (
            <Box key={entry.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : undefined}>
                  {isCursor ? '\u25B6 ' : '  '}
                </Text>
                <Text color="yellow" bold>{entry.key}</Text>
                {entry.type && <Text color="gray"> ({entry.type})</Text>}
                <Text color="gray">: </Text>
                <Text wrap="truncate">
                  {isSelected ? entry.value : entry.value.slice(0, 40) + (entry.value.length > 40 ? '...' : '')}
                </Text>
              </Box>
              {isSelected && showContext && entry.timestamp && (
                <Box paddingLeft={4}>
                  <Text color="gray">Updated: {entry.timestamp}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Delete confirmation */}
      {state === 'deleting' && (
        <Box marginTop={1} borderStyle="single" borderColor="red">
          <Text color="red">Delete this entry? [y]es / [n]o</Text>
        </Box>
      )}

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">
            [Tab] Switch tab [{'\u2191\u2193'}] Nav [/] Search
            {state === 'entrySelected' ? ' [d]elete' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default MemoryInspector;
