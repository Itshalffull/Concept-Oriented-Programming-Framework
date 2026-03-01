/* ------------------------------------------------------------------ */
/*  Slider state machine                                               */
/* ------------------------------------------------------------------ */

export type InteractionState = 'idle' | 'focused' | 'dragging';
export type InteractionAction =
  | { type: 'POINTER_DOWN' }
  | { type: 'POINTER_UP' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' };

export function interactionReducer(state: InteractionState, action: InteractionAction): InteractionState {
  switch (state) {
    case 'idle':
      if (action.type === 'POINTER_DOWN') return 'dragging';
      if (action.type === 'FOCUS') return 'focused';
      return state;
    case 'focused':
      if (action.type === 'BLUR') return 'idle';
      if (action.type === 'POINTER_DOWN') return 'dragging';
      return state;
    case 'dragging':
      if (action.type === 'POINTER_UP') return 'idle';
      return state;
    default:
      return state;
  }
}
