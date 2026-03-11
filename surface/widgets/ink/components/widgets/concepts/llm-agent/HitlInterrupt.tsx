export type HitlInterruptState = 'pending' | 'editing' | 'approving' | 'rejecting' | 'forking' | 'resolved';
export type HitlInterruptEvent =
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'MODIFY' }
  | { type: 'FORK' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' };

export function hitlInterruptReducer(state: HitlInterruptState, event: HitlInterruptEvent): HitlInterruptState {
  switch (state) {
    case 'pending':
      if (event.type === 'APPROVE') return 'approving';
      if (event.type === 'REJECT') return 'rejecting';
      if (event.type === 'MODIFY') return 'editing';
      if (event.type === 'FORK') return 'forking';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'pending';
      if (event.type === 'CANCEL') return 'pending';
      return state;
    case 'approving':
      if (event.type === 'COMPLETE') return 'resolved';
      if (event.type === 'ERROR') return 'pending';
      return state;
    case 'rejecting':
      if (event.type === 'COMPLETE') return 'resolved';
      return state;
    case 'forking':
      if (event.type === 'COMPLETE') return 'resolved';
      return state;
    default:
      return state;
  }
}

import React, { useReducer, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

export interface HitlInterruptProps {
  reason: string;
  state: string;
  status: string;
  showFork?: boolean;
  showStateEditor?: boolean;
  editorMode?: 'json' | 'form';
  onApprove?: () => void;
  onReject?: (reason?: string) => void;
  onFork?: () => void;
  isFocused?: boolean;
}

export function HitlInterrupt({
  reason,
  state: agentState,
  status,
  showFork = false,
  showStateEditor = false,
  onApprove,
  onReject,
  onFork,
  isFocused = false,
}: HitlInterruptProps) {
  const [machineState, send] = useReducer(hitlInterruptReducer, 'pending');

  const handleApprove = useCallback(() => {
    send({ type: 'APPROVE' });
    onApprove?.();
    send({ type: 'COMPLETE' });
  }, [onApprove]);

  const handleReject = useCallback(() => {
    send({ type: 'REJECT' });
    onReject?.();
    send({ type: 'COMPLETE' });
  }, [onReject]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (machineState === 'pending') {
      if (input === 'a') handleApprove();
      if (input === 'r') handleReject();
      if (input === 'e' && showStateEditor) send({ type: 'MODIFY' });
      if (input === 'f' && showFork) {
        send({ type: 'FORK' });
        onFork?.();
        send({ type: 'COMPLETE' });
      }
    }

    if (machineState === 'editing') {
      if (key.escape) send({ type: 'CANCEL' });
      if (key.return) send({ type: 'SAVE' });
    }
  });

  if (machineState === 'resolved') {
    return (
      <Box borderStyle="single" borderColor="green">
        <Text color="green">{'\u2713'} Interrupt resolved</Text>
      </Box>
    );
  }

  const borderColor =
    machineState === 'approving' ? 'green' :
    machineState === 'rejecting' ? 'red' :
    'yellow';

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={borderColor}>
      <Box>
        <Text color="yellow" bold>{'\u26A0'} Human Review Required</Text>
      </Box>

      <Box marginTop={1}>
        <Text bold>Reason: </Text>
        <Text wrap="wrap">{reason}</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Status: </Text>
        <Text>{status}</Text>
      </Box>

      {showStateEditor && machineState === 'editing' && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="cyan">
          <Text bold>Agent State:</Text>
          <Text color="gray" wrap="wrap">{agentState}</Text>
          <Text color="gray">[Enter] Save [Esc] Cancel</Text>
        </Box>
      )}

      {showStateEditor && machineState === 'pending' && (
        <Box marginTop={1}>
          <Text color="gray">State: </Text>
          <Text wrap="truncate">{agentState.slice(0, 60)}{agentState.length > 60 ? '...' : ''}</Text>
        </Box>
      )}

      {machineState === 'approving' && (
        <Box marginTop={1}>
          <Text color="green">Approving...</Text>
        </Box>
      )}

      {machineState === 'rejecting' && (
        <Box marginTop={1}>
          <Text color="red">Rejecting...</Text>
        </Box>
      )}

      {machineState === 'forking' && (
        <Box marginTop={1}>
          <Text color="cyan">Forking execution...</Text>
        </Box>
      )}

      {isFocused && machineState === 'pending' && (
        <Box marginTop={1}>
          <Text color="gray">
            [a]pprove [r]eject
            {showStateEditor ? ' [e]dit state' : ''}
            {showFork ? ' [f]ork' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default HitlInterrupt;
