/* ---------------------------------------------------------------------------
 * CanvasNode state machine
 * States: idle (initial), hovered, selected, editing, dragging, resizing
 * ------------------------------------------------------------------------- */

export type CanvasNodeState = 'idle' | 'hovered' | 'selected' | 'editing' | 'dragging' | 'resizing';
export type CanvasNodeEvent =
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'EDIT' }
  | { type: 'CONFIRM' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'DRAG_START' }
  | { type: 'DROP' }
  | { type: 'RESIZE_START' }
  | { type: 'RESIZE_END' }
  | { type: 'ESCAPE' }
  | { type: 'BLUR' }
  | { type: 'DELETE' };

export function canvasNodeReducer(state: CanvasNodeState, event: CanvasNodeEvent): CanvasNodeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'DRAG_START') return 'dragging';
      if (event.type === 'HOVER') return 'hovered';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'DRAG_START') return 'dragging';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'EDIT') return 'editing';
      if (event.type === 'DRAG_START') return 'dragging';
      if (event.type === 'RESIZE_START') return 'resizing';
      if (event.type === 'DELETE') return 'idle';
      return state;
    case 'editing':
      if (event.type === 'CONFIRM') return 'selected';
      if (event.type === 'ESCAPE') return 'selected';
      if (event.type === 'BLUR') return 'selected';
      return state;
    case 'dragging':
      if (event.type === 'DROP') return 'selected';
      if (event.type === 'ESCAPE') return 'idle';
      return state;
    case 'resizing':
      if (event.type === 'RESIZE_END') return 'selected';
      if (event.type === 'ESCAPE') return 'selected';
      return state;
    default:
      return state;
  }
}
