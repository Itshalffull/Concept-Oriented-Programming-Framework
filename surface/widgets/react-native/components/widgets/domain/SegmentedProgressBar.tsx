export type SegmentedProgressBarState = 'idle' | 'animating' | 'segmentHovered';
export type SegmentedProgressBarEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'LEAVE' };

export function segmentedProgressBarReducer(state: SegmentedProgressBarState, event: SegmentedProgressBarEvent): SegmentedProgressBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

import React, { useReducer } from 'react';
import { View, Text, Pressable } from 'react-native';

export interface SegmentedProgressBarProps {
  segments: unknown[];
  total: number;
  showLegend?: boolean;
  showTotal?: boolean;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
}

export function SegmentedProgressBar(props: SegmentedProgressBarProps) {
  const [state, send] = useReducer(segmentedProgressBarReducer, 'idle');

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Horizontal progress bar divided into col"
      data-widget="segmented-progress-bar"
      data-state={state}
    >
      <View>{/* bar: Horizontal bar divided into segments */}</View>
      <View>{/* segment: Single colored segment */}</View>
      <Text>{/* Tooltip label with count and percentage */}</Text>
      <View>{/* legend: Optional color legend below the bar */}</View>
      <Text>{/* Total count display */}</Text>
    </View>
  );
}

export default SegmentedProgressBar;
