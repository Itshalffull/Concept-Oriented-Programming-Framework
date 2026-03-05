export type WeightBreakdownState = 'idle' | 'segmentHovered';
export type WeightBreakdownEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'LEAVE' };

export function weightBreakdownReducer(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      return state;
    case 'segmentHovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface WeightBreakdownProps { [key: string]: unknown; }

export function createWeightBreakdown(props: WeightBreakdownProps) {
  let state: WeightBreakdownState = 'idle';

  function send(type: string) {
    state = weightBreakdownReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createWeightBreakdown;
