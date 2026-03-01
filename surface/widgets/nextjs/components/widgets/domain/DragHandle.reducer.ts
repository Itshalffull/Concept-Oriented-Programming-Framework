/* ---------------------------------------------------------------------------
 * DragHandle state machine
 * States: idle (initial), hovered, focused, grabbed, dragging
 * ------------------------------------------------------------------------- */

export type DragHandleState = 'idle' | 'hovered' | 'focused' | 'grabbed' | 'dragging';
export type DragHandleEvent =
  | { type: 'GRAB' }
  | { type: 'RELEASE' }
  | { type: 'MOVE' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'DROP' }
  | { type: 'ESCAPE' };

export function dragHandleReducer(state: DragHandleState, event: DragHandleEvent): DragHandleState {
  switch (state) {
    case 'idle':
      if (event.type === 'GRAB') return 'grabbed';
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'GRAB') return 'grabbed';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'GRAB') return 'grabbed';
      return state;
    case 'grabbed':
      if (event.type === 'RELEASE') return 'idle';
      if (event.type === 'MOVE') return 'dragging';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    case 'dragging':
      if (event.type === 'DROP') return 'idle';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    default:
      return state;
  }
}
