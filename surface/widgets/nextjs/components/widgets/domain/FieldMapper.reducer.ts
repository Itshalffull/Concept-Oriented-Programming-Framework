/* ---------------------------------------------------------------------------
 * FieldMapper state machine
 * States: idle (initial), editing, picking
 * ------------------------------------------------------------------------- */

export type FMState = 'idle' | 'editing' | 'picking';
export type FMEvent =
  | { type: 'FOCUS_INPUT'; target: string }
  | { type: 'BLUR' }
  | { type: 'OPEN_PICKER'; target: string }
  | { type: 'SELECT_FIELD' }
  | { type: 'CLOSE_PICKER' }
  | { type: 'ESCAPE' }
  | { type: 'INSERT_TOKEN' };

export function fmReducer(state: FMState, event: FMEvent): FMState {
  switch (state) {
    case 'idle':
      if (event.type === 'FOCUS_INPUT') return 'editing';
      if (event.type === 'OPEN_PICKER') return 'picking';
      return state;
    case 'editing':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'OPEN_PICKER') return 'picking';
      if (event.type === 'INSERT_TOKEN') return 'editing';
      return state;
    case 'picking':
      if (event.type === 'SELECT_FIELD') return 'editing';
      if (event.type === 'CLOSE_PICKER') return 'editing';
      if (event.type === 'ESCAPE') return 'editing';
      return state;
    default:
      return state;
  }
}
