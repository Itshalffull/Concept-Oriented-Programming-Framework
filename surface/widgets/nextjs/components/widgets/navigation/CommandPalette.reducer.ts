// ---------------------------------------------------------------------------
// CommandPalette reducer — state management for modal search overlay.
// ---------------------------------------------------------------------------

export interface PaletteState {
  visibility: 'closed' | 'open';
  query: string;
  highlightedIndex: number;
}

export type PaletteAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'INPUT'; query: string }
  | { type: 'HIGHLIGHT'; index: number }
  | { type: 'NAVIGATE_NEXT'; count: number; loop: boolean }
  | { type: 'NAVIGATE_PREV'; count: number; loop: boolean }
  | { type: 'ACTIVATE' }
  | { type: 'RESET' };

export function paletteReducer(state: PaletteState, action: PaletteAction): PaletteState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, visibility: 'open', query: '', highlightedIndex: 0 };
    case 'CLOSE':
    case 'ACTIVATE':
      return { ...state, visibility: 'closed', query: '', highlightedIndex: 0 };
    case 'INPUT':
      return { ...state, query: action.query, highlightedIndex: 0 };
    case 'HIGHLIGHT':
      return { ...state, highlightedIndex: action.index };
    case 'NAVIGATE_NEXT': {
      if (action.count === 0) return state;
      const next = action.loop
        ? (state.highlightedIndex + 1) % action.count
        : Math.min(state.highlightedIndex + 1, action.count - 1);
      return { ...state, highlightedIndex: next };
    }
    case 'NAVIGATE_PREV': {
      if (action.count === 0) return state;
      const prev = action.loop
        ? (state.highlightedIndex - 1 + action.count) % action.count
        : Math.max(state.highlightedIndex - 1, 0);
      return { ...state, highlightedIndex: prev };
    }
    case 'RESET':
      return { ...state, query: '', highlightedIndex: 0 };
    default:
      return state;
  }
}

export interface CommandItemFilter {
  label: string;
}

export const defaultFilter = (item: CommandItemFilter, query: string): boolean =>
  item.label.toLowerCase().includes(query.toLowerCase());
