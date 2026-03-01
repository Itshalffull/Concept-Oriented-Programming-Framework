/* ------------------------------------------------------------------ */
/*  ToggleSwitch state machine                                         */
/* ------------------------------------------------------------------ */

export type ToggleState = 'off' | 'on';
export type ToggleAction = { type: 'TOGGLE' };

export function toggleReducer(state: ToggleState, _action: ToggleAction): ToggleState {
  return state === 'off' ? 'on' : 'off';
}
