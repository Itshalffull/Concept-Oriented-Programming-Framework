/* ---------------------------------------------------------------------------
 * State machine
 * States: closed (initial), open
 * Events: OPEN, CLOSE, OUTSIDE_CLICK, ESCAPE
 * ------------------------------------------------------------------------- */

export type DialogState = 'closed' | 'open';
export type DialogEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'OUTSIDE_CLICK' }
  | { type: 'ESCAPE' };

export function dialogReducer(state: DialogState, event: DialogEvent): DialogState {
  switch (state) {
    case 'closed':
      if (event.type === 'OPEN') return 'open';
      return state;
    case 'open':
      if (
        event.type === 'CLOSE' ||
        event.type === 'OUTSIDE_CLICK' ||
        event.type === 'ESCAPE'
      )
        return 'closed';
      return state;
    default:
      return state;
  }
}
