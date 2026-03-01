/* ---------------------------------------------------------------------------
 * PreferenceMatrix reducer — extracted state machine
 * States: loading, saving, toggle
 * ------------------------------------------------------------------------- */

export interface PreferenceMatrixState {
  loading: 'idle' | 'loading' | 'error';
  saving: 'idle' | 'saving' | 'error';
  focusRow: number;
  focusCol: number;
}

export type PreferenceMatrixEvent =
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'NAVIGATE'; row: number; col: number };

export function preferenceMatrixReducer(
  state: PreferenceMatrixState,
  event: PreferenceMatrixEvent,
): PreferenceMatrixState {
  switch (event.type) {
    case 'LOAD':
      return { ...state, loading: 'loading' };
    case 'LOAD_COMPLETE':
      return { ...state, loading: 'idle' };
    case 'NAVIGATE':
      return { ...state, focusRow: event.row, focusCol: event.col };
    default:
      return state;
  }
}
