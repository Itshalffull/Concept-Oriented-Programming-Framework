/* ---------------------------------------------------------------------------
 * CronEditor state machine
 * Main: simple (initial), advanced
 * Validation (parallel): valid (initial), invalid
 * ------------------------------------------------------------------------- */

export interface CronState {
  mode: 'simple' | 'advanced';
  validation: 'valid' | 'invalid';
}

export type CronEvent =
  | { type: 'SWITCH_ADVANCED' }
  | { type: 'SWITCH_SIMPLE' }
  | { type: 'CHANGE' }
  | { type: 'INVALIDATE' }
  | { type: 'REVALIDATE' };

export function cronReducer(state: CronState, event: CronEvent): CronState {
  switch (event.type) {
    case 'SWITCH_ADVANCED':
      return { ...state, mode: 'advanced' };
    case 'SWITCH_SIMPLE':
      return { ...state, mode: 'simple' };
    case 'INVALIDATE':
      return { ...state, validation: 'invalid' };
    case 'REVALIDATE':
      return { ...state, validation: 'valid' };
    default:
      return state;
  }
}
