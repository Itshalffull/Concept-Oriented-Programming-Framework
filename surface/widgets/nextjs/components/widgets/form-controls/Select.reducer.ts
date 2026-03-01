/* ------------------------------------------------------------------ */
/*  Select state machines                                              */
/* ------------------------------------------------------------------ */

export type OpenCloseState = 'closed' | 'open';
export type OpenCloseAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'SELECT' };

export function openCloseReducer(state: OpenCloseState, action: OpenCloseAction): OpenCloseState {
  switch (state) {
    case 'closed':
      if (action.type === 'OPEN' || action.type === 'TOGGLE') return 'open';
      return state;
    case 'open':
      if (action.type === 'CLOSE' || action.type === 'TOGGLE' || action.type === 'SELECT')
        return 'closed';
      return state;
    default:
      return state;
  }
}

export type FocusState = 'idle' | 'focused';
export type FocusAction = { type: 'FOCUS' } | { type: 'BLUR' };

export function focusReducer(_state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case 'FOCUS':
      return 'focused';
    case 'BLUR':
      return 'idle';
    default:
      return _state;
  }
}
