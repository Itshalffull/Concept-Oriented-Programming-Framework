/* ---------------------------------------------------------------------------
 * CanvasConnector state machine
 * States: idle (initial), hovered, selected, draggingStart, draggingEnd,
 *         editingLabel
 * ------------------------------------------------------------------------- */

export type ConnectorState = 'idle' | 'hovered' | 'selected' | 'draggingStart' | 'draggingEnd' | 'editingLabel';
export type ConnectorEvent =
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'DRAG_START_HANDLE' }
  | { type: 'DRAG_END_HANDLE' }
  | { type: 'DROP' }
  | { type: 'CONNECT' }
  | { type: 'EDIT_LABEL' }
  | { type: 'CONFIRM' }
  | { type: 'ESCAPE' }
  | { type: 'BLUR' }
  | { type: 'DELETE' };

export function connectorReducer(state: ConnectorState, event: ConnectorEvent): ConnectorState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'HOVER') return 'hovered';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'DRAG_START_HANDLE') return 'draggingStart';
      if (event.type === 'DRAG_END_HANDLE') return 'draggingEnd';
      if (event.type === 'DELETE') return 'idle';
      if (event.type === 'EDIT_LABEL') return 'editingLabel';
      return state;
    case 'draggingStart':
    case 'draggingEnd':
      if (event.type === 'DROP') return 'selected';
      if (event.type === 'CONNECT') return 'selected';
      if (event.type === 'ESCAPE') return 'selected';
      return state;
    case 'editingLabel':
      if (event.type === 'CONFIRM') return 'selected';
      if (event.type === 'ESCAPE') return 'selected';
      if (event.type === 'BLUR') return 'selected';
      return state;
    default:
      return state;
  }
}
