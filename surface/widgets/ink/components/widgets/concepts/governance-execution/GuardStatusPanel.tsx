/* ---------------------------------------------------------------------------
 * GuardStatusPanel — Ink (terminal) implementation
 * Panel displaying pre-execution guards for governance actions
 * See widget spec: guard-status-panel.widget
 * ------------------------------------------------------------------------- */

export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent =
  | { type: 'SELECT_GUARD'; id?: string }
  | { type: 'GUARD_TRIP' }
  | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_GUARD') return 'guardSelected';
      if (event.type === 'GUARD_TRIP') return 'idle';
      return state;
    case 'guardSelected':
      if (event.type === 'DESELECT') return 'idle';
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

export type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';

export interface Guard {
  id?: string;
  name: string;
  description: string;
  status: GuardStatus;
  lastChecked?: string;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const STATUS_ICONS: Record<GuardStatus, string> = {
  passing: '\u2713',
  failing: '\u2717',
  pending: '\u25CB',
  bypassed: '\u2298',
};

const STATUS_COLORS: Record<GuardStatus, string> = {
  passing: 'green',
  failing: 'red',
  pending: 'yellow',
  bypassed: 'gray',
};

const STATUS_LABELS: Record<GuardStatus, string> = {
  passing: 'Passing',
  failing: 'Failing',
  pending: 'Pending',
  bypassed: 'Bypassed',
};

function formatLastChecked(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const seconds = Math.floor(Math.abs(diffMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface GuardStatusPanelProps {
  guards: Guard[];
  executionStatus: string;
  showConditions?: boolean;
  onGuardSelect?: (guard: Guard) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export function GuardStatusPanel({
  guards,
  executionStatus,
  showConditions = true,
  onGuardSelect,
}: GuardStatusPanelProps) {
  const [state, send] = useReducer(guardStatusPanelReducer, 'idle');
  const [focusIndex, setFocusIndex] = useState(0);
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);

  const passingCount = useMemo(() => guards.filter((g) => g.status === 'passing').length, [guards]);
  const hasBlockingGuards = useMemo(() => guards.some((g) => g.status === 'failing'), [guards]);

  const toggleGuard = useCallback((guard: Guard, index: number) => {
    const guardId = guard.id ?? guard.name;
    if (state === 'guardSelected' && selectedGuardId === guardId) {
      setSelectedGuardId(null);
      send({ type: 'DESELECT' });
    } else {
      setSelectedGuardId(guardId);
      setFocusIndex(index);
      send({ type: 'SELECT_GUARD', id: guardId });
      onGuardSelect?.(guard);
    }
  }, [state, selectedGuardId, onGuardSelect]);

  useInput((input, key) => {
    if (guards.length === 0) return;

    if (key.downArrow) {
      setFocusIndex((i) => Math.min(i + 1, guards.length - 1));
    } else if (key.upArrow) {
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (key.return) {
      if (guards[focusIndex]) {
        toggleGuard(guards[focusIndex], focusIndex);
      }
    } else if (key.escape) {
      if (state === 'guardSelected') {
        setSelectedGuardId(null);
        send({ type: 'DESELECT' });
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round">
      {/* Header */}
      <Box>
        <Text bold>Pre-execution Guards</Text>
        <Text> </Text>
        <Text dimColor>
          {passingCount} of {guards.length} passing
        </Text>
      </Box>

      {/* Blocking banner */}
      {hasBlockingGuards && (
        <Box>
          <Text color="red" bold>
            \u26A0 Execution is blocked by failing guards
          </Text>
        </Box>
      )}

      <Box><Text dimColor>{'\u2500'.repeat(40)}</Text></Box>

      {/* Guard list */}
      {guards.map((guard, index) => {
        const guardId = guard.id ?? guard.name;
        const isFocused = focusIndex === index;
        const isSelected = state === 'guardSelected' && selectedGuardId === guardId;

        return (
          <Box key={guardId} flexDirection="column">
            <Box>
              <Text>{isFocused ? '\u25B6 ' : '  '}</Text>
              <Text color={STATUS_COLORS[guard.status]}>
                {STATUS_ICONS[guard.status]}
              </Text>
              <Text bold={isSelected}> {guard.name}</Text>
              <Text> </Text>
              <Text color={STATUS_COLORS[guard.status]}>
                [{STATUS_LABELS[guard.status]}]
              </Text>
            </Box>

            {showConditions && (
              <Box>
                <Text dimColor>    {guard.description}</Text>
              </Box>
            )}

            {/* Expanded detail */}
            {isSelected && (
              <Box flexDirection="column" marginLeft={4}>
                <Text dimColor>Description: {guard.description}</Text>
                {guard.lastChecked && (
                  <Text dimColor>Last checked: {formatLastChecked(guard.lastChecked)}</Text>
                )}
              </Box>
            )}
          </Box>
        );
      })}

      {/* Navigation hints */}
      <Box><Text dimColor>{'\u2500'.repeat(40)}</Text></Box>
      <Box>
        <Text dimColor>\u2191\u2193 navigate  Enter select  Esc deselect</Text>
      </Box>
    </Box>
  );
}

export default GuardStatusPanel;
