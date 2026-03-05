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

import {
  forwardRef,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export interface SegmentedProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  segments: unknown[];
  total: number;
  showLegend?: boolean;
  showTotal?: boolean;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

const SegmentedProgressBar = forwardRef<HTMLDivElement, SegmentedProgressBarProps>(function SegmentedProgressBar(
  props,
  ref,
) {
  const [state, send] = useReducer(segmentedProgressBarReducer, 'idle');

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Horizontal progress bar divided into colored segments repres"
      data-surface-widget=""
      data-widget-name="segmented-progress-bar"
      data-part="root"
      data-state={state}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); send({ type: 'FOCUS_NEXT_SEGMENT' }); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); send({ type: 'FOCUS_PREV_SEGMENT' }); }
      }}
      tabIndex={0}
      {...props}
    >
        <div data-part="bar" data-state={state}>
          {/* Horizontal bar divided into segments */}
        </div>
        <div data-part="segment" data-state={state}>
          {/* Single colored segment */}
        </div>
        <span data-part="segment-label" data-state={state}>
          {/* Tooltip label with count and percentage */}
        </span>
        <div data-part="legend" data-state={state}>
          {/* Optional color legend below the bar */}
        </div>
        <span data-part="total-label" data-state={state}>
          {/* Total count display */}
        </span>
    </div>
  );
});

SegmentedProgressBar.displayName = 'SegmentedProgressBar';
export { SegmentedProgressBar };
export default SegmentedProgressBar;
