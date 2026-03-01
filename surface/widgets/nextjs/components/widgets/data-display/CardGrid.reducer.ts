export type CardGridState = { current: 'static' | 'loading' | 'empty' };

export type CardGridAction =
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_COMPLETE_EMPTY' }
  | { type: 'DATA_EMPTY' }
  | { type: 'DATA_AVAILABLE' };

export function cardGridReducer(state: CardGridState, action: CardGridAction): CardGridState {
  switch (state.current) {
    case 'static':
      if (action.type === 'LOAD') return { current: 'loading' };
      if (action.type === 'DATA_EMPTY') return { current: 'empty' };
      return state;
    case 'loading':
      if (action.type === 'LOAD_COMPLETE') return { current: 'static' };
      if (action.type === 'LOAD_COMPLETE_EMPTY') return { current: 'empty' };
      return state;
    case 'empty':
      if (action.type === 'LOAD') return { current: 'loading' };
      if (action.type === 'DATA_AVAILABLE') return { current: 'static' };
      return state;
    default:
      return state;
  }
}

export const cardGridInitialState: CardGridState = { current: 'static' };
