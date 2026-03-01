/* ------------------------------------------------------------------ */
/*  ProgressBar state machine                                          */
/* ------------------------------------------------------------------ */

export type ModeState = 'indeterminate' | 'determinate' | 'complete';
export type ModeAction =
  | { type: 'SET_VALUE' }
  | { type: 'CLEAR_VALUE' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

export function modeReducer(_state: ModeState, action: ModeAction): ModeState {
  switch (action.type) {
    case 'SET_VALUE':
      return 'determinate';
    case 'CLEAR_VALUE':
      return 'indeterminate';
    case 'COMPLETE':
      return 'complete';
    case 'RESET':
      return 'indeterminate';
    default:
      return _state;
  }
}
