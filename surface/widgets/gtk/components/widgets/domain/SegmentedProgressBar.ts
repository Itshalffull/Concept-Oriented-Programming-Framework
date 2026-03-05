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

export interface SegmentedProgressBarProps { [key: string]: unknown; }

export function createSegmentedProgressBar(props: SegmentedProgressBarProps) {
  let state: SegmentedProgressBarState = 'idle';

  function send(type: string) {
    state = segmentedProgressBarReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createSegmentedProgressBar;
