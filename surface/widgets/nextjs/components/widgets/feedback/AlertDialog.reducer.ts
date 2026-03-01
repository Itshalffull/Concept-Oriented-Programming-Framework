/* ---------------------------------------------------------------------------
 * State machine
 * States: closed (initial), open
 * Events: OPEN, CANCEL, CONFIRM
 * Note: Escape and outside-click do NOT close an alert dialog.
 * ------------------------------------------------------------------------- */

export type AlertDialogState = 'closed' | 'open';
export type AlertDialogEvent =
  | { type: 'OPEN' }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM' };

export function alertDialogReducer(
  state: AlertDialogState,
  event: AlertDialogEvent,
): AlertDialogState {
  switch (state) {
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    case 'open':
      if (event.type === 'CANCEL' || event.type === 'CONFIRM') return 'closed';
      return state;
    default:
      return state;
  }
}
