export type ExecutionOverlayState = 'idle' | 'live' | 'suspended' | 'completed' | 'failed' | 'cancelled' | 'replay';
export type ExecutionOverlayEvent =
  | { type: 'START' }
  | { type: 'LOAD_REPLAY' }
  | { type: 'STEP_ADVANCE' }
  | { type: 'COMPLETE' }
  | { type: 'FAIL' }
  | { type: 'SUSPEND' }
  | { type: 'CANCEL' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'RETRY' }
  | { type: 'REPLAY_STEP' }
  | { type: 'REPLAY_END' };

export function executionOverlayReducer(state: ExecutionOverlayState, event: ExecutionOverlayEvent): ExecutionOverlayState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'live';
      if (event.type === 'LOAD_REPLAY') return 'replay';
      return state;
    case 'live':
      if (event.type === 'STEP_ADVANCE') return 'live';
      if (event.type === 'COMPLETE') return 'completed';
      if (event.type === 'FAIL') return 'failed';
      if (event.type === 'SUSPEND') return 'suspended';
      if (event.type === 'CANCEL') return 'cancelled';
      return state;
    case 'suspended':
      if (event.type === 'RESUME') return 'live';
      if (event.type === 'CANCEL') return 'cancelled';
      return state;
    case 'completed':
      if (event.type === 'RESET') return 'idle';
      return state;
    case 'failed':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'live';
      return state;
    case 'cancelled':
      if (event.type === 'RESET') return 'idle';
      return state;
    case 'replay':
      if (event.type === 'REPLAY_STEP') return 'replay';
      if (event.type === 'REPLAY_END') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface ExecutionOverlayProps {
  status: string;
  activeStep?: string | undefined;
  startedAt?: string | undefined;
  endedAt?: string | undefined;
  mode?: "live" | "replay" | "static";
  showControls?: boolean;
  showElapsed?: boolean;
  animateFlow?: boolean;
}

export function ExecutionOverlay(props: ExecutionOverlayProps) {
  const [state, send] = useReducer(executionOverlayReducer, 'idle');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Runtime state overlay for process execut"
      data-widget="execution-overlay"
      data-state={state}
    >
      <View>{/* nodeOverlay: Per-node status highlight (colored border or background) */}</View>
      <View>{/* activeMarker: Pulsing indicator on the currently executing step */}</View>
      <View>{/* flowAnimation: Animated dots or dashes along active edges */}</View>
      <View>{/* statusBar: Bottom bar showing run status, elapsed time, and controls */}</View>
      <View>{/* controlButtons: Suspend, resume, and cancel action buttons */}</View>
    </View>
  );
}

export default ExecutionOverlay;
