/* ---------------------------------------------------------------------------
 * Outliner state machine
 * States: idle/dragging for drag, focusedId tracking
 * ------------------------------------------------------------------------- */

export interface OutlinerState {
  drag: 'idle' | 'dragging';
  focusedId: string | null;
}

export type OutlinerEvent =
  | { type: 'DRAG_START'; id: string }
  | { type: 'DROP' }
  | { type: 'ESCAPE' }
  | { type: 'FOCUS'; id: string };

export function outlinerReducer(state: OutlinerState, event: OutlinerEvent): OutlinerState {
  switch (event.type) {
    case 'DRAG_START':
      return { ...state, drag: 'dragging' };
    case 'DROP':
    case 'ESCAPE':
      return { ...state, drag: 'idle' };
    case 'FOCUS':
      return { ...state, focusedId: event.id };
    default:
      return state;
  }
}
