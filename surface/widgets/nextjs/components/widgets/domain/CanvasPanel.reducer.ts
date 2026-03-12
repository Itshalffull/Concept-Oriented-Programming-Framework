/* ---------------------------------------------------------------------------
 * CanvasPanel state machine
 * Parallel regions: visibility, resize, tabs
 * Visibility: expanded (initial), collapsed, minimized
 * Resize: idle (initial), resizing (parallel)
 * Tabs: inactive (initial), active (parallel)
 * ------------------------------------------------------------------------- */

export type VisibilityState = 'expanded' | 'collapsed' | 'minimized';
export type ResizeState = 'idle' | 'resizing';
export type TabsState = 'inactive' | 'active';

export interface CanvasPanelState {
  visibility: VisibilityState;
  resize: ResizeState;
  tabs: TabsState;
}

export type CanvasPanelEvent =
  | { type: 'COLLAPSE' }
  | { type: 'EXPAND' }
  | { type: 'MINIMIZE' }
  | { type: 'RESIZE_START' }
  | { type: 'RESIZE_END' }
  | { type: 'ACTIVATE_TAB' }
  | { type: 'DEACTIVATE_TAB' };

export const initialCanvasPanelState: CanvasPanelState = {
  visibility: 'expanded',
  resize: 'idle',
  tabs: 'inactive',
};

export function canvasPanelReducer(
  state: CanvasPanelState,
  event: CanvasPanelEvent,
): CanvasPanelState {
  switch (event.type) {
    /* --- Visibility region --- */
    case 'COLLAPSE':
      if (state.visibility === 'expanded') {
        return { ...state, visibility: 'collapsed' };
      }
      return state;

    case 'EXPAND':
      if (state.visibility === 'collapsed' || state.visibility === 'minimized') {
        return { ...state, visibility: 'expanded' };
      }
      return state;

    case 'MINIMIZE':
      if (state.visibility === 'expanded' || state.visibility === 'collapsed') {
        return { ...state, visibility: 'minimized' };
      }
      return state;

    /* --- Resize region (parallel) --- */
    case 'RESIZE_START':
      if (state.resize === 'idle' && state.visibility === 'expanded') {
        return { ...state, resize: 'resizing' };
      }
      return state;

    case 'RESIZE_END':
      if (state.resize === 'resizing') {
        return { ...state, resize: 'idle' };
      }
      return state;

    /* --- Tabs region (parallel) --- */
    case 'ACTIVATE_TAB':
      if (state.tabs === 'inactive') {
        return { ...state, tabs: 'active' };
      }
      return state;

    case 'DEACTIVATE_TAB':
      if (state.tabs === 'active') {
        return { ...state, tabs: 'inactive' };
      }
      return state;

    default:
      return state;
  }
}
