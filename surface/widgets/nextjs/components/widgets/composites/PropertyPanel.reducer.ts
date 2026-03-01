/* ---------------------------------------------------------------------------
 * PropertyPanel reducer — extracted state machine
 * States: panel (expanded | collapsed), row (displaying | editing), drag
 * ------------------------------------------------------------------------- */

export interface PropertyPanelState {
  panel: 'expanded' | 'collapsed';
  editingKey: string | null;
  editValue: unknown;
  draggingKey: string | null;
}

export type PropertyPanelEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'CLICK_VALUE'; key: string; value: unknown }
  | { type: 'COMMIT'; value: unknown }
  | { type: 'CANCEL' }
  | { type: 'BLUR' }
  | { type: 'EDIT_VALUE'; value: unknown }
  | { type: 'DRAG_START'; key: string }
  | { type: 'DROP' };

export function propertyPanelReducer(
  state: PropertyPanelState,
  event: PropertyPanelEvent,
): PropertyPanelState {
  switch (event.type) {
    case 'EXPAND':
      return { ...state, panel: 'expanded' };
    case 'COLLAPSE':
      return { ...state, panel: 'collapsed' };
    case 'CLICK_VALUE':
      return { ...state, editingKey: event.key, editValue: event.value };
    case 'COMMIT':
      return { ...state, editingKey: null, editValue: null };
    case 'CANCEL':
      return { ...state, editingKey: null, editValue: null };
    case 'BLUR':
      return { ...state, editingKey: null, editValue: null };
    case 'EDIT_VALUE':
      return { ...state, editValue: event.value };
    case 'DRAG_START':
      return { ...state, draggingKey: event.key };
    case 'DROP':
      return { ...state, draggingKey: null };
    default:
      return state;
  }
}
