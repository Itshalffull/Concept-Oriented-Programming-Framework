export type RunListTableState = 'idle' | 'rowSelected';
export type RunListTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'PAGE' }
  | { type: 'DESELECT' };

export function runListTableReducer(state: RunListTableState, event: RunListTableEvent): RunListTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      if (event.type === 'PAGE') return 'idle';
      return state;
    case 'rowSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      return state;
    default:
      return state;
  }
}
