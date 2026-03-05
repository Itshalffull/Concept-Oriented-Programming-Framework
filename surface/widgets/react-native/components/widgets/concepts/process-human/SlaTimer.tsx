export type SlaTimerState = 'onTrack' | 'warning' | 'critical' | 'breached' | 'paused';
export type SlaTimerEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'BREACH' }
  | { type: 'RESUME' };

export function slaTimerReducer(state: SlaTimerState, event: SlaTimerEvent): SlaTimerState {
  switch (state) {
    case 'onTrack':
      if (event.type === 'TICK') return 'onTrack';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'BREACH') return 'breached';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'breached':
      if (event.type === 'TICK') return 'breached';
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'onTrack';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface SlaTimerProps {
  dueAt: string;
  status: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  showElapsed?: boolean;
}

export function SlaTimer(props: SlaTimerProps) {
  const [state, send] = useReducer(slaTimerReducer, 'onTrack');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Five-state countdown timer for service l"
      data-widget="sla-timer"
      data-state={state}
    >
      <Text>{/* Remaining time display */}</Text>
      <Text>{/* Current phase name */}</Text>
      <View>{/* progressBar: Elapsed progress bar with phase coloring */}</View>
      <Text>{/* Elapsed time since start */}</Text>
    </View>
  );
}

export default SlaTimer;
