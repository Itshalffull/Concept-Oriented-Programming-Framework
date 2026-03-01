/* ---------------------------------------------------------------------------
 * ConditionBuilder state machine
 * States: idle (initial), fieldChanged
 * ------------------------------------------------------------------------- */

export interface CBState {
  current: 'idle' | 'fieldChanged';
}

export type CBEvent =
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; index: number }
  | { type: 'TOGGLE_LOGIC' }
  | { type: 'CHANGE_FIELD' }
  | { type: 'CHANGE_OPERATOR' }
  | { type: 'CHANGE_VALUE' }
  | { type: 'OPERATOR_RESET' };

export function cbReducer(state: CBState, event: CBEvent): CBState {
  switch (state.current) {
    case 'idle':
      if (event.type === 'CHANGE_FIELD') return { current: 'fieldChanged' };
      return state;
    case 'fieldChanged':
      if (event.type === 'OPERATOR_RESET') return { current: 'idle' };
      return state;
    default:
      return state;
  }
}
