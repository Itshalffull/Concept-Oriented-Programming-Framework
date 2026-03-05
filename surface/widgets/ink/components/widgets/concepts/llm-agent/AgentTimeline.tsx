export type AgentTimelineState = 'idle' | 'entrySelected' | 'interrupted' | 'inactive' | 'active';
export type AgentTimelineEvent =
  | { type: 'NEW_ENTRY' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'INTERRUPT' }
  | { type: 'DESELECT' }
  | { type: 'RESUME' }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' };

export function agentTimelineReducer(state: AgentTimelineState, event: AgentTimelineEvent): AgentTimelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'NEW_ENTRY') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      if (event.type === 'INTERRUPT') return 'interrupted';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'interrupted':
      if (event.type === 'RESUME') return 'idle';
      return state;
    case 'inactive':
      if (event.type === 'STREAM_START') return 'active';
      return state;
    case 'active':
      if (event.type === 'STREAM_END') return 'inactive';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface TimelineEntry {
  id: string;
  agent: string;
  content: string;
  type?: string;
  timestamp?: string;
  delegatedTo?: string;
}

export interface AgentTimelineProps {
  entries: TimelineEntry[];
  agentName: string;
  status: string;
  showDelegations?: boolean;
  autoScroll?: boolean;
  maxEntries?: number;
  onSelectEntry?: (id: string) => void;
  onResume?: () => void;
  isFocused?: boolean;
}

const AGENT_COLORS = ['cyan', 'green', 'yellow', 'magenta', 'blue', 'red'];

export function AgentTimeline({
  entries,
  agentName,
  status,
  showDelegations = true,
  maxEntries,
  onSelectEntry,
  onResume,
  isFocused = false,
}: AgentTimelineProps) {
  const [state, send] = useReducer(agentTimelineReducer, 'idle');
  const [cursorIndex, setCursorIndex] = useState(entries.length - 1);

  const visibleEntries = maxEntries ? entries.slice(-maxEntries) : entries;
  const agentColorMap = new Map<string, string>();
  let colorIdx = 0;
  const getAgentColor = (name: string) => {
    if (!agentColorMap.has(name)) {
      agentColorMap.set(name, AGENT_COLORS[colorIdx % AGENT_COLORS.length]);
      colorIdx++;
    }
    return agentColorMap.get(name)!;
  };

  const STATUS_MAP: Record<string, { icon: string; color: string }> = {
    running: { icon: '\u25B6', color: 'green' },
    idle: { icon: '\u25CF', color: 'gray' },
    interrupted: { icon: '\u26A0', color: 'yellow' },
    completed: { icon: '\u2713', color: 'green' },
    error: { icon: '\u2717', color: 'red' },
  };

  const statusInfo = STATUS_MAP[status] ?? STATUS_MAP.idle;

  useInput((input, key) => {
    if (!isFocused) return;
    if (key.upArrow || input === 'k') {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex(prev => Math.min(visibleEntries.length - 1, prev + 1));
    }
    if (key.return) {
      const entry = visibleEntries[cursorIndex];
      if (entry) {
        send({ type: 'SELECT_ENTRY' });
        onSelectEntry?.(entry.id);
      }
    }
    if (key.escape) send({ type: 'DESELECT' });
    if (input === 'r' && state === 'interrupted') {
      send({ type: 'RESUME' });
      onResume?.();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? 'cyan' : undefined}>
      <Box justifyContent="space-between">
        <Box>
          <Text color={statusInfo.color}>{statusInfo.icon} </Text>
          <Text bold>{agentName}</Text>
        </Box>
        <Text color={statusInfo.color}>{status}</Text>
      </Box>

      {state === 'interrupted' && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow">
          <Text color="yellow">{'\u26A0'} Agent interrupted </Text>
          {isFocused && <Text color="gray">[r]esume</Text>}
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {visibleEntries.map((entry, i) => {
          const isCursor = i === cursorIndex && isFocused;
          const agentColor = getAgentColor(entry.agent);
          return (
            <Box key={entry.id} flexDirection="column">
              <Box>
                <Text color={isCursor ? 'cyan' : 'gray'}>{isCursor ? '\u25B6 ' : '\u2502 '}</Text>
                <Text color={agentColor} bold>{entry.agent}</Text>
                {entry.timestamp && <Text color="gray"> {entry.timestamp}</Text>}
              </Box>
              <Box paddingLeft={2}>
                <Text color="gray">{'\u2502'} </Text>
                <Text wrap="wrap">{entry.content}</Text>
              </Box>
              {showDelegations && entry.delegatedTo && (
                <Box paddingLeft={2}>
                  <Text color="gray">{'\u2502'} </Text>
                  <Text color="yellow">{'\u2192'} Delegated to </Text>
                  <Text color={getAgentColor(entry.delegatedTo)} bold>{entry.delegatedTo}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray">[{'\u2191\u2193'}] Navigate [Enter] Select</Text>
        </Box>
      )}
    </Box>
  );
}

export default AgentTimeline;
