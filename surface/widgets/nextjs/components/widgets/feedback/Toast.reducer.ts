/* ---------------------------------------------------------------------------
 * State machine
 * States: entering (initial), visible, paused, exiting, removed
 * Events: ANIMATION_END, POINTER_ENTER, POINTER_LEAVE, DISMISS, TIMEOUT, CLOSE
 * ------------------------------------------------------------------------- */

export type ToastState = 'entering' | 'visible' | 'paused' | 'exiting' | 'removed';
export type ToastEvent =
  | { type: 'ANIMATION_END' }
  | { type: 'POINTER_ENTER' }
  | { type: 'POINTER_LEAVE' }
  | { type: 'DISMISS' }
  | { type: 'TIMEOUT' }
  | { type: 'CLOSE' };

export function toastReducer(state: ToastState, event: ToastEvent): ToastState {
  switch (state) {
    case 'entering':
      if (event.type === 'ANIMATION_END') return 'visible';
      return state;
    case 'visible':
      if (event.type === 'POINTER_ENTER') return 'paused';
      if (
        event.type === 'DISMISS' ||
        event.type === 'TIMEOUT' ||
        event.type === 'CLOSE'
      )
        return 'exiting';
      return state;
    case 'paused':
      if (event.type === 'POINTER_LEAVE') return 'visible';
      if (event.type === 'DISMISS' || event.type === 'CLOSE') return 'exiting';
      return state;
    case 'exiting':
      if (event.type === 'ANIMATION_END') return 'removed';
      return state;
    case 'removed':
      return state;
    default:
      return state;
  }
}
