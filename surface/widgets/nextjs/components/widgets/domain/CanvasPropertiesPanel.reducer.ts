/* ---------------------------------------------------------------------------
 * CanvasPropertiesPanel state machine
 * States: empty (initial), showingItem, showingConnector, showingCanvas
 * ------------------------------------------------------------------------- */

export type PropertiesPanelState = 'empty' | 'showingItem' | 'showingConnector' | 'showingCanvas';
export type PropertiesPanelEvent =
  | { type: 'SELECT_ITEM' }
  | { type: 'SELECT_CONNECTOR' }
  | { type: 'SELECT_CANVAS' }
  | { type: 'DESELECT' };

export function propertiesPanelReducer(
  state: PropertiesPanelState,
  event: PropertiesPanelEvent,
): PropertiesPanelState {
  switch (state) {
    case 'empty':
      if (event.type === 'SELECT_ITEM') return 'showingItem';
      if (event.type === 'SELECT_CONNECTOR') return 'showingConnector';
      if (event.type === 'SELECT_CANVAS') return 'showingCanvas';
      return state;
    case 'showingItem':
      if (event.type === 'DESELECT') return 'empty';
      if (event.type === 'SELECT_ITEM') return 'showingItem';
      if (event.type === 'SELECT_CONNECTOR') return 'showingConnector';
      return state;
    case 'showingConnector':
      if (event.type === 'DESELECT') return 'empty';
      if (event.type === 'SELECT_ITEM') return 'showingItem';
      if (event.type === 'SELECT_CONNECTOR') return 'showingConnector';
      return state;
    case 'showingCanvas':
      if (event.type === 'DESELECT') return 'empty';
      if (event.type === 'SELECT_ITEM') return 'showingItem';
      if (event.type === 'SELECT_CONNECTOR') return 'showingConnector';
      return state;
    default:
      return state;
  }
}
