/* ---------------------------------------------------------------------------
 * State machine
 * States: visible (initial), dismissed
 * Events: DISMISS
 * ------------------------------------------------------------------------- */

export type AlertState = 'visible' | 'dismissed';
export type AlertEvent = { type: 'DISMISS' };

export function alertReducer(state: AlertState, event: AlertEvent): AlertState {
  switch (state) {
    case 'visible':
      if (event.type === 'DISMISS') return 'dismissed';
      return state;
    case 'dismissed':
      return state;
    default:
      return state;
  }
}
