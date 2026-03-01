/* ---------------------------------------------------------------------------
 * State machine
 * States: hidden (initial), showing, visible, hiding
 * Events: POINTER_ENTER, POINTER_LEAVE, FOCUS, BLUR, ESCAPE, DELAY_ELAPSED
 * ------------------------------------------------------------------------- */

export type TooltipState = 'hidden' | 'showing' | 'visible' | 'hiding';
export type TooltipEvent =
  | { type: 'POINTER_ENTER' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'ESCAPE' }
  | { type: 'DELAY_ELAPSED' };

export function tooltipReducer(state: TooltipState, event: TooltipEvent): TooltipState {
  switch (state) {
    case 'hidden':
      if (event.type === 'POINTER_ENTER' || event.type === 'FOCUS') return 'showing';
      return state;
    case 'showing':
      if (event.type === 'DELAY_ELAPSED') return 'visible';
      if (
        event.type === 'POINTER_LEAVE' ||
        event.type === 'BLUR' ||
        event.type === 'ESCAPE'
      )
        return 'hidden';
      return state;
    case 'visible':
      if (event.type === 'POINTER_LEAVE' || event.type === 'BLUR') return 'hiding';
      if (event.type === 'ESCAPE') return 'hidden';
      return state;
    case 'hiding':
      if (event.type === 'DELAY_ELAPSED') return 'hidden';
      if (event.type === 'POINTER_ENTER' || event.type === 'FOCUS') return 'visible';
      return state;
    default:
      return state;
  }
}
