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
import { Box, Text } from 'ink';

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
    <Box flexDirection="column" borderStyle="round" data-widget="segmented-progress-bar" data-state={state}>
      <Text bold>{/* Horizontal progress bar divided into col */} SegmentedProgressBar</Text>
      <Box><Text data-part="bar">{/* Horizontal bar divided into segments */}</Text></Box>
      <Box><Text data-part="segment">{/* Single colored segment */}</Text></Box>
      <Box><Text data-part="segment-label">{/* Tooltip label with count and percentage */}</Text></Box>
      <Box><Text data-part="legend">{/* Optional color legend below the bar */}</Text></Box>
    </Box>
  );
}

export default SegmentedProgressBar;
