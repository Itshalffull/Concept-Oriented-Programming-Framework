/* ------------------------------------------------------------------ */
/*  MultiSelect state machine                                          */
/* ------------------------------------------------------------------ */

export type OpenCloseState = 'closed' | 'open';
export type OpenCloseAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'BLUR' };

export function openCloseReducer(state: OpenCloseState, action: OpenCloseAction): OpenCloseState {
  switch (state) {
    case 'closed':
      if (action.type === 'OPEN' || action.type === 'TOGGLE') return 'open';
      return state;
    case 'open':
      if (action.type === 'CLOSE' || action.type === 'TOGGLE' || action.type === 'BLUR')
        return 'closed';
      return state;
    default:
      return state;
  }
}
