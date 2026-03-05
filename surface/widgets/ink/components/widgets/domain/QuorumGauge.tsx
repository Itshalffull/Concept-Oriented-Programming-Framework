export type QuorumGaugeState = 'belowThreshold' | 'atThreshold' | 'aboveThreshold';
export type QuorumGaugeEvent =
  | { type: 'THRESHOLD_MET' }
  | { type: 'UPDATE' }
  | { type: 'EXCEED' }
  | { type: 'DROP_BELOW' };

export function quorumGaugeReducer(state: QuorumGaugeState, event: QuorumGaugeEvent): QuorumGaugeState {
  switch (state) {
    case 'belowThreshold':
      if (event.type === 'THRESHOLD_MET') return 'atThreshold';
      if (event.type === 'UPDATE') return 'belowThreshold';
      return state;
    case 'atThreshold':
      if (event.type === 'EXCEED') return 'aboveThreshold';
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      return state;
    case 'aboveThreshold':
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      if (event.type === 'UPDATE') return 'aboveThreshold';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { Box, Text } from 'ink';

export interface QuorumGaugeProps {
  current: number;
  threshold: number;
  total: number;
  variant?: "simple" | "dynamic" | "dual";
  showLabels?: boolean;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
}

export function QuorumGauge(props: QuorumGaugeProps) {
  const [state, send] = useReducer(quorumGaugeReducer, 'belowThreshold');

  return (
    <Box flexDirection="column" borderStyle="round" data-widget="quorum-gauge" data-state={state}>
      <Text bold>{/* Progress bar with a threshold marker sho */} QuorumGauge</Text>
      <Box><Text data-part="progress-bar">{/* Horizontal bar showing current participation */}</Text></Box>
      <Box><Text data-part="fill">{/* Filled portion of the progress bar */}</Text></Box>
      <Box><Text data-part="threshold-marker">{/* Vertical line marking the quorum threshold */}</Text></Box>
      <Box><Text data-part="current-label">{/* Current count or percentage label */}</Text></Box>
    </Box>
  );
}

export default QuorumGauge;
