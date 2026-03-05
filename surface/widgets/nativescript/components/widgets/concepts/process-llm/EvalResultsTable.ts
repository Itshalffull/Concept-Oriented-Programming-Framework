export type EvalResultsTableState = 'idle' | 'rowSelected';
export type EvalResultsTableEvent =
  | { type: 'SELECT_ROW' }
  | { type: 'SORT' }
  | { type: 'FILTER' }
  | { type: 'DESELECT' };

export function evalResultsTableReducer(state: EvalResultsTableState, event: EvalResultsTableEvent): EvalResultsTableState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      if (event.type === 'SORT') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'rowSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ROW') return 'rowSelected';
      return state;
    default:
      return state;
  }
}

export interface EvalResultsTableProps { [key: string]: unknown; }

export function createEvalResultsTable(props: EvalResultsTableProps) {
  let state: EvalResultsTableState = 'idle';

  function send(type: string) {
    state = evalResultsTableReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createEvalResultsTable;
