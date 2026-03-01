/* ---------------------------------------------------------------------------
 * FilterBuilder reducer — extracted state machine
 * States: filterCount (empty | hasFilters), row (idle | editing), validity
 * ------------------------------------------------------------------------- */

export interface FilterRow {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: 'and' | 'or';
}

export interface FilterBuilderState {
  filterCount: 'empty' | 'hasFilters';
  editingRowId: string | null;
  filters: FilterRow[];
  logic: 'and' | 'or';
}

export type FilterBuilderEvent =
  | { type: 'ADD_FILTER' }
  | { type: 'REMOVE_FILTER'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'FIELD_CHANGE'; id: string; field: string }
  | { type: 'OPERATOR_CHANGE'; id: string; operator: string }
  | { type: 'VALUE_CHANGE'; id: string; value: string }
  | { type: 'TOGGLE_LOGIC'; id: string }
  | { type: 'FOCUS_ROW'; id: string }
  | { type: 'BLUR_ROW' }
  | { type: 'TOGGLE_ROOT_LOGIC' };

let filterCounter = 0;
export function nextFilterId() {
  return `filter-${++filterCounter}`;
}

export function resetFilterCounter() {
  filterCounter = 0;
}

export function filterBuilderReducer(
  state: FilterBuilderState,
  event: FilterBuilderEvent,
): FilterBuilderState {
  switch (event.type) {
    case 'ADD_FILTER': {
      const newFilter: FilterRow = {
        id: nextFilterId(),
        field: '',
        operator: '',
        value: '',
        logic: state.logic,
      };
      const filters = [...state.filters, newFilter];
      return { ...state, filters, filterCount: 'hasFilters' };
    }
    case 'REMOVE_FILTER': {
      const filters = state.filters.filter((f) => f.id !== event.id);
      return {
        ...state,
        filters,
        filterCount: filters.length === 0 ? 'empty' : 'hasFilters',
        editingRowId: state.editingRowId === event.id ? null : state.editingRowId,
      };
    }
    case 'CLEAR_ALL':
      return { ...state, filters: [], filterCount: 'empty', editingRowId: null };
    case 'FIELD_CHANGE': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, field: event.field, operator: '', value: '' } : f,
      );
      return { ...state, filters };
    }
    case 'OPERATOR_CHANGE': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, operator: event.operator, value: '' } : f,
      );
      return { ...state, filters };
    }
    case 'VALUE_CHANGE': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, value: event.value } : f,
      );
      return { ...state, filters };
    }
    case 'TOGGLE_LOGIC': {
      const filters = state.filters.map((f) =>
        f.id === event.id ? { ...f, logic: f.logic === 'and' ? 'or' : 'and' } : f,
      );
      return { ...state, filters };
    }
    case 'TOGGLE_ROOT_LOGIC':
      return { ...state, logic: state.logic === 'and' ? 'or' : 'and' };
    case 'FOCUS_ROW':
      return { ...state, editingRowId: event.id };
    case 'BLUR_ROW':
      return { ...state, editingRowId: null };
    default:
      return state;
  }
}
