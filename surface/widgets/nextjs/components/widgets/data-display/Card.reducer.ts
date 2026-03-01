export type CardState = { current: 'idle' | 'hovered' | 'focused' | 'pressed' };

export type CardAction =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'PRESS' }
  | { type: 'RELEASE' }
  | { type: 'ACTIVATE' };

export function cardReducer(state: CardState, action: CardAction): CardState {
  switch (state.current) {
    case 'idle':
      if (action.type === 'HOVER') return { current: 'hovered' };
      if (action.type === 'FOCUS') return { current: 'focused' };
      if (action.type === 'PRESS') return { current: 'pressed' };
      return state;
    case 'hovered':
      if (action.type === 'UNHOVER') return { current: 'idle' };
      if (action.type === 'PRESS') return { current: 'pressed' };
      if (action.type === 'FOCUS') return { current: 'focused' };
      return state;
    case 'focused':
      if (action.type === 'BLUR') return { current: 'idle' };
      if (action.type === 'PRESS') return { current: 'pressed' };
      return state;
    case 'pressed':
      if (action.type === 'RELEASE') return { current: 'idle' };
      if (action.type === 'ACTIVATE') return { current: 'idle' };
      return state;
    default:
      return state;
  }
}

export const cardInitialState: CardState = { current: 'idle' };
