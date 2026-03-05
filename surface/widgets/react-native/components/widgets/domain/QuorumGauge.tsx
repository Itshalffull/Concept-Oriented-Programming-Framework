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
import { View, Text, Pressable } from 'react-native';

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
    <View
      accessibilityRole="none"
      accessibilityLabel="Progress bar with a threshold marker sho"
      data-widget="quorum-gauge"
      data-state={state}
    >
      <View>{/* progressBar: Horizontal bar showing current participation */}</View>
      <View>{/* fill: Filled portion of the progress bar */}</View>
      <View>{/* thresholdMarker: Vertical line marking the quorum threshold */}</View>
      <Text>{/* Current count or percentage label */}</Text>
      <Text>{/* Threshold value label */}</Text>
    </View>
  );
}

export default QuorumGauge;
