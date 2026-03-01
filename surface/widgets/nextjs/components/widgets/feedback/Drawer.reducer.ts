/* ---------------------------------------------------------------------------
 * State machine
 * States: closed (initial), open
 * Events: OPEN, CLOSE, OUTSIDE_CLICK, ESCAPE
 * ------------------------------------------------------------------------- */

export type DrawerState = 'closed' | 'open';
export type DrawerEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'OUTSIDE_CLICK' }
  | { type: 'ESCAPE' };

export function drawerReducer(state: DrawerState, event: DrawerEvent): DrawerState {
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
