/* ---------------------------------------------------------------------------
 * State machine
 * States: hidden (initial), opening, open, closing
 * Events: POINTER_ENTER, POINTER_LEAVE, FOCUS, BLUR, ESCAPE, DELAY_ELAPSED
 * ------------------------------------------------------------------------- */

export type HoverCardState = 'hidden' | 'opening' | 'open' | 'closing';
export type HoverCardEvent =
  | { type: 'POINTER_ENTER' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'ESCAPE' }
  | { type: 'DELAY_ELAPSED' };

export function hoverCardReducer(state: HoverCardState, event: HoverCardEvent): HoverCardState {
  switch (state) {
    case 'hidden':
      if (event.type === 'POINTER_ENTER' || event.type === 'FOCUS') return 'opening';
      return state;
    case 'opening':
      if (event.type === 'DELAY_ELAPSED') return 'open';
      if (
        event.type === 'POINTER_LEAVE' ||
        event.type === 'BLUR'
      )
        return 'hidden';
      return state;
    case 'open':
      if (event.type === 'POINTER_LEAVE' || event.type === 'BLUR') return 'closing';
      if (event.type === 'ESCAPE') return 'hidden';
      return state;
    case 'closing':
      if (event.type === 'DELAY_ELAPSED') return 'hidden';
      if (event.type === 'POINTER_ENTER' || event.type === 'FOCUS') return 'open';
      return state;
    default:
      return state;
  }
}
