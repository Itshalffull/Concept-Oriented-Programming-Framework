export type StatCardState = { current: 'static' | 'up' | 'down' | 'neutral' };

export type StatCardAction =
  | { type: 'TREND_UP' }
  | { type: 'TREND_DOWN' }
  | { type: 'TREND_NEUTRAL' }
  | { type: 'TREND_CLEAR' };

export function statCardReducer(state: StatCardState, action: StatCardAction): StatCardState {
  switch (action.type) {
    case 'TREND_UP':
      return { current: 'up' };
    case 'TREND_DOWN':
      return { current: 'down' };
    case 'TREND_NEUTRAL':
      return { current: 'neutral' };
    case 'TREND_CLEAR':
      return { current: 'static' };
    default:
      return state;
  }
}

export const statCardInitialState: StatCardState = { current: 'static' };
