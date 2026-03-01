/* ---------------------------------------------------------------------------
 * State machine
 * States: closed (initial), open
 * Events: OPEN, CLOSE, TRIGGER_CLICK, OUTSIDE_CLICK, ESCAPE
 * ------------------------------------------------------------------------- */

export type PopoverState = 'closed' | 'open';
export type PopoverEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TRIGGER_CLICK' }
  | { type: 'OUTSIDE_CLICK' }
  | { type: 'ESCAPE' };

export function popoverReducer(state: PopoverState, event: PopoverEvent): PopoverState {
  switch (state) {
    case 'closed':
      if (event.type === 'OPEN' || event.type === 'TRIGGER_CLICK') return 'open';
      return state;
    case 'open':
      if (
        event.type === 'CLOSE' ||
        event.type === 'OUTSIDE_CLICK' ||
        event.type === 'ESCAPE' ||
        event.type === 'TRIGGER_CLICK'
      )
        return 'closed';
      return state;
    default:
      return state;
  }
}
