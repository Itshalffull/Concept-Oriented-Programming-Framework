export type ListState = {
  focusedIndex: number;
  selectedIds: Set<string>;
};

export type ListAction =
  | { type: 'NAVIGATE_PREV' }
  | { type: 'NAVIGATE_NEXT' }
  | { type: 'NAVIGATE_FIRST' }
  | { type: 'NAVIGATE_LAST' }
  | { type: 'SELECT'; id: string }
  | { type: 'FOCUS'; index: number }
  | { type: 'BLUR' };

export function createListReducer(itemCount: number, multiSelect: boolean) {
  return function listReducer(state: ListState, action: ListAction): ListState {
    switch (action.type) {
      case 'NAVIGATE_PREV':
        return { ...state, focusedIndex: Math.max(0, state.focusedIndex - 1) };
      case 'NAVIGATE_NEXT':
        return { ...state, focusedIndex: Math.min(itemCount - 1, state.focusedIndex + 1) };
      case 'NAVIGATE_FIRST':
        return { ...state, focusedIndex: 0 };
      case 'NAVIGATE_LAST':
        return { ...state, focusedIndex: itemCount - 1 };
      case 'SELECT': {
        const next = new Set(state.selectedIds);
        if (next.has(action.id)) {
          next.delete(action.id);
        } else {
          if (!multiSelect) next.clear();
          next.add(action.id);
        }
        return { ...state, selectedIds: next };
      }
      case 'FOCUS':
        return { ...state, focusedIndex: action.index };
      case 'BLUR':
        return state;
      default:
        return state;
    }
  };
}
