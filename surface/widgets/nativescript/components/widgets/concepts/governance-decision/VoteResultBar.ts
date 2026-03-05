export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'UNHOVER' };

export function voteResultBarReducer(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface VoteResultBarProps { [key: string]: unknown; }

export function createVoteResultBar(props: VoteResultBarProps) {
  let state: VoteResultBarState = 'idle';

  function send(type: string) {
    state = voteResultBarReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createVoteResultBar;
