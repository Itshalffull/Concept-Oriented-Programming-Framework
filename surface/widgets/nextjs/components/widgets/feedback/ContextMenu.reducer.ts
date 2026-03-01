/* ---------------------------------------------------------------------------
 * State machine
 * States: closed (initial), open
 * Events: CONTEXT_MENU, SELECT, ESCAPE, OUTSIDE_CLICK
 * ------------------------------------------------------------------------- */

export type ContextMenuState = 'closed' | 'open';
export type ContextMenuEvent =
  | { type: 'CONTEXT_MENU' }
  | { type: 'SELECT' }
  | { type: 'ESCAPE' }
  | { type: 'OUTSIDE_CLICK' };

export function contextMenuReducer(
  state: ContextMenuState,
  event: ContextMenuEvent,
): ContextMenuState {
  switch (state) {
    case 'closed':
      if (event.type === 'CONTEXT_MENU') return 'open';
      return state;
    case 'open':
      if (
        event.type === 'SELECT' ||
        event.type === 'ESCAPE' ||
        event.type === 'OUTSIDE_CLICK'
      )
        return 'closed';
      return state;
    default:
      return state;
  }
}
