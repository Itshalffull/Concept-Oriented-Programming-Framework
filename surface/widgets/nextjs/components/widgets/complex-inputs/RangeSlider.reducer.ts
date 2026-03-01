/* ---------------------------------------------------------------------------
 * State machine
 * Interaction: idle (initial), focusedMin, focusedMax, draggingMin, draggingMax
 * Events: POINTER_DOWN_MIN, POINTER_DOWN_MAX, POINTER_UP, FOCUS_MIN,
 *         FOCUS_MAX, BLUR
 * ------------------------------------------------------------------------- */

export type InteractionState = 'idle' | 'focusedMin' | 'focusedMax' | 'draggingMin' | 'draggingMax';

export type SliderEvent =
  | { type: 'POINTER_DOWN_MIN' }
  | { type: 'POINTER_DOWN_MAX' }
  | { type: 'POINTER_UP' }
  | { type: 'FOCUS_MIN' }
  | { type: 'FOCUS_MAX' }
  | { type: 'BLUR' };

export function sliderReducer(state: InteractionState, event: SliderEvent): InteractionState {
  switch (state) {
    case 'idle':
      if (event.type === 'POINTER_DOWN_MIN') return 'draggingMin';
      if (event.type === 'POINTER_DOWN_MAX') return 'draggingMax';
      if (event.type === 'FOCUS_MIN') return 'focusedMin';
      if (event.type === 'FOCUS_MAX') return 'focusedMax';
      return state;
    case 'focusedMin':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'POINTER_DOWN_MIN') return 'draggingMin';
      if (event.type === 'FOCUS_MAX') return 'focusedMax';
      return state;
    case 'focusedMax':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'POINTER_DOWN_MAX') return 'draggingMax';
      if (event.type === 'FOCUS_MIN') return 'focusedMin';
      return state;
    case 'draggingMin':
      if (event.type === 'POINTER_UP') return 'idle';
      return state;
    case 'draggingMax':
      if (event.type === 'POINTER_UP') return 'idle';
      return state;
    default:
      return state;
  }
}
