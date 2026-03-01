/* ------------------------------------------------------------------ */
/*  ComboboxMulti state machines                                       */
/* ------------------------------------------------------------------ */

export type OpenCloseState = 'closed' | 'open';
export type OpenCloseAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'INPUT' }
  | { type: 'BLUR' };

export function openCloseReducer(state: OpenCloseState, action: OpenCloseAction): OpenCloseState {
  switch (state) {
    case 'closed':
      if (action.type === 'OPEN' || action.type === 'INPUT') return 'open';
      return state;
    case 'open':
      if (action.type === 'CLOSE' || action.type === 'BLUR') return 'closed';
      return state;
    default:
      return state;
  }
}

export type FilterState = 'idle' | 'filtering';
export type FilterAction = { type: 'BEGIN_FILTER' } | { type: 'END_FILTER' } | { type: 'INPUT' };

export function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (state) {
    case 'idle':
      if (action.type === 'BEGIN_FILTER') return 'filtering';
      return state;
    case 'filtering':
      if (action.type === 'END_FILTER') return 'idle';
      if (action.type === 'INPUT') return 'filtering';
      return state;
    default:
      return state;
  }
}
