export type DataTableState = {
  current: 'idle' | 'sorting' | 'loading' | 'empty';
  sortColumn: string | null;
  sortDirection: 'ascending' | 'descending' | 'none';
  selectedRows: Set<number>;
};

export type DataTableAction =
  | { type: 'SORT'; column: string }
  | { type: 'SORT_COMPLETE' }
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'DATA_EMPTY' }
  | { type: 'DATA_AVAILABLE' }
  | { type: 'SELECT_ROW'; index: number }
  | { type: 'DESELECT_ROW'; index: number };

export function dataTableReducer(state: DataTableState, action: DataTableAction): DataTableState {
  switch (action.type) {
    case 'SORT': {
      let nextDirection: 'ascending' | 'descending' = 'ascending';
      if (state.sortColumn === action.column && state.sortDirection === 'ascending') {
        nextDirection = 'descending';
      }
      return {
        ...state,
        current: 'sorting',
        sortColumn: action.column,
        sortDirection: nextDirection,
      };
    }
    case 'SORT_COMPLETE':
      return { ...state, current: 'idle' };
    case 'LOAD':
      return { ...state, current: 'loading' };
    case 'LOAD_COMPLETE':
      return { ...state, current: 'idle' };
    case 'DATA_EMPTY':
      return { ...state, current: 'empty' };
    case 'DATA_AVAILABLE':
      return { ...state, current: 'idle' };
    case 'SELECT_ROW': {
      const next = new Set(state.selectedRows);
      next.add(action.index);
      return { ...state, selectedRows: next };
    }
    case 'DESELECT_ROW': {
      const next = new Set(state.selectedRows);
      next.delete(action.index);
      return { ...state, selectedRows: next };
    }
    default:
      return state;
  }
}
