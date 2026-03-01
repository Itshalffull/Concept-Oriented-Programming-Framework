export type TimelineState = {
  current: 'idle' | 'scrolling' | 'resizing' | 'barHovered' | 'barSelected';
  selectedId: string | null;
  hoveredId: string | null;
};

export type TimelineAction =
  | { type: 'SCROLL' }
  | { type: 'SCROLL_END' }
  | { type: 'RESIZE_BAR' }
  | { type: 'RESIZE_END' }
  | { type: 'RESIZE_CANCEL' }
  | { type: 'SELECT_BAR'; id: string }
  | { type: 'DESELECT_BAR' }
  | { type: 'HOVER_BAR'; id: string }
  | { type: 'UNHOVER_BAR' };

export function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case 'SCROLL':
      return { ...state, current: 'scrolling' };
    case 'SCROLL_END':
      return { ...state, current: 'idle' };
    case 'RESIZE_BAR':
      return { ...state, current: 'resizing' };
    case 'RESIZE_END':
    case 'RESIZE_CANCEL':
      return { ...state, current: 'idle' };
    case 'SELECT_BAR':
      return { ...state, current: 'barSelected', selectedId: action.id };
    case 'DESELECT_BAR':
      return { ...state, current: 'idle', selectedId: null };
    case 'HOVER_BAR':
      return { ...state, current: 'barHovered', hoveredId: action.id };
    case 'UNHOVER_BAR':
      return {
        ...state,
        current: state.selectedId ? 'barSelected' : 'idle',
        hoveredId: null,
      };
    default:
      return state;
  }
}

export const timelineInitialState: TimelineState = { current: 'idle', selectedId: null, hoveredId: null };
