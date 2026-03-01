/* ---------------------------------------------------------------------------
 * SortBuilder reducer — extracted state machine
 * States: sortCount (empty | hasSorts), drag (idle | dragging)
 * ------------------------------------------------------------------------- */

export interface SortCriterion {
  id: string;
  field: string;
  direction: 'ascending' | 'descending';
}

export interface SortBuilderState {
  sortCount: 'empty' | 'hasSorts';
  draggingId: string | null;
  sorts: SortCriterion[];
}

export type SortBuilderEvent =
  | { type: 'ADD_SORT' }
  | { type: 'REMOVE_SORT'; id: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'FIELD_CHANGE'; id: string; field: string }
  | { type: 'TOGGLE_DIRECTION'; id: string }
  | { type: 'MOVE_UP'; id: string }
  | { type: 'MOVE_DOWN'; id: string }
  | { type: 'DRAG_START'; id: string }
  | { type: 'DRAG_END' };

let sortCounter = 0;
export function nextSortId() {
  return `sort-${++sortCounter}`;
}

export function resetSortCounter() {
  sortCounter = 0;
}

export function sortBuilderReducer(
  state: SortBuilderState,
  event: SortBuilderEvent,
): SortBuilderState {
  switch (event.type) {
    case 'ADD_SORT': {
      const newSort: SortCriterion = {
        id: nextSortId(),
        field: '',
        direction: 'ascending',
      };
      const sorts = [...state.sorts, newSort];
      return { ...state, sorts, sortCount: 'hasSorts' };
    }
    case 'REMOVE_SORT': {
      const sorts = state.sorts.filter((s) => s.id !== event.id);
      return { ...state, sorts, sortCount: sorts.length === 0 ? 'empty' : 'hasSorts' };
    }
    case 'CLEAR_ALL':
      return { ...state, sorts: [], sortCount: 'empty', draggingId: null };
    case 'FIELD_CHANGE': {
      const sorts = state.sorts.map((s) =>
        s.id === event.id ? { ...s, field: event.field } : s,
      );
      return { ...state, sorts };
    }
    case 'TOGGLE_DIRECTION': {
      const sorts = state.sorts.map((s) =>
        s.id === event.id
          ? { ...s, direction: s.direction === 'ascending' ? 'descending' as const : 'ascending' as const }
          : s,
      );
      return { ...state, sorts };
    }
    case 'MOVE_UP': {
      const idx = state.sorts.findIndex((s) => s.id === event.id);
      if (idx <= 0) return state;
      const sorts = [...state.sorts];
      [sorts[idx - 1], sorts[idx]] = [sorts[idx], sorts[idx - 1]];
      return { ...state, sorts };
    }
    case 'MOVE_DOWN': {
      const idx = state.sorts.findIndex((s) => s.id === event.id);
      if (idx < 0 || idx >= state.sorts.length - 1) return state;
      const sorts = [...state.sorts];
      [sorts[idx], sorts[idx + 1]] = [sorts[idx + 1], sorts[idx]];
      return { ...state, sorts };
    }
    case 'DRAG_START':
      return { ...state, draggingId: event.id };
    case 'DRAG_END':
      return { ...state, draggingId: null };
    default:
      return state;
  }
}

export function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
