// ---------------------------------------------------------------------------
// Splitter reducer — resizable split pane state management.
// ---------------------------------------------------------------------------

export interface SplitterState {
  interaction: 'idle' | 'dragging' | 'focused';
  panelSize: number;
}

export type SplitterAction =
  | { type: 'DRAG_START' }
  | { type: 'DRAG_MOVE'; panelSize: number }
  | { type: 'DRAG_END' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'RESIZE_INCREMENT'; step: number; max: number }
  | { type: 'RESIZE_DECREMENT'; step: number; min: number }
  | { type: 'RESIZE_MIN'; min: number }
  | { type: 'RESIZE_MAX'; max: number };

export function splitterReducer(state: SplitterState, action: SplitterAction): SplitterState {
  switch (action.type) {
    case 'DRAG_START':
      return { ...state, interaction: 'dragging' };
    case 'DRAG_MOVE':
      return { ...state, panelSize: action.panelSize };
    case 'DRAG_END':
      return { ...state, interaction: 'idle' };
    case 'FOCUS':
      return { ...state, interaction: 'focused' };
    case 'BLUR':
      return { ...state, interaction: 'idle' };
    case 'RESIZE_INCREMENT':
      return {
        ...state,
        panelSize: Math.min(state.panelSize + action.step, action.max),
      };
    case 'RESIZE_DECREMENT':
      return {
        ...state,
        panelSize: Math.max(state.panelSize - action.step, action.min),
      };
    case 'RESIZE_MIN':
      return { ...state, panelSize: action.min };
    case 'RESIZE_MAX':
      return { ...state, panelSize: action.max };
    default:
      return state;
  }
}
