/* ------------------------------------------------------------------ */
/*  Badge state machine                                                */
/* ------------------------------------------------------------------ */

export type DisplayState = 'static' | 'dot';
export type DisplayAction = { type: 'SET_DOT' } | { type: 'SET_LABEL' };

export function displayReducer(_state: DisplayState, action: DisplayAction): DisplayState {
  switch (action.type) {
    case 'SET_DOT':
      return 'dot';
    case 'SET_LABEL':
      return 'static';
    default:
      return _state;
  }
}
