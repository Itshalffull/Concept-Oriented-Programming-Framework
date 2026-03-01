export type ViewToggleState = { activeValue: string; focusedIndex: number };

export type ViewToggleAction =
  | { type: 'SELECT'; value: string; index: number }
  | { type: 'NAVIGATE_PREV' }
  | { type: 'NAVIGATE_NEXT' }
  | { type: 'NAVIGATE_FIRST' }
  | { type: 'NAVIGATE_LAST' }
  | { type: 'FOCUS'; index: number }
  | { type: 'BLUR' };

export function createViewToggleReducer(optionCount: number) {
  return function viewToggleReducer(state: ViewToggleState, action: ViewToggleAction): ViewToggleState {
    switch (action.type) {
      case 'SELECT':
        return { ...state, activeValue: action.value, focusedIndex: action.index };
      case 'NAVIGATE_PREV':
        return { ...state, focusedIndex: (state.focusedIndex - 1 + optionCount) % optionCount };
      case 'NAVIGATE_NEXT':
        return { ...state, focusedIndex: (state.focusedIndex + 1) % optionCount };
      case 'NAVIGATE_FIRST':
        return { ...state, focusedIndex: 0 };
      case 'NAVIGATE_LAST':
        return { ...state, focusedIndex: optionCount - 1 };
      case 'FOCUS':
        return { ...state, focusedIndex: action.index };
      case 'BLUR':
        return state;
      default:
        return state;
    }
  };
}
