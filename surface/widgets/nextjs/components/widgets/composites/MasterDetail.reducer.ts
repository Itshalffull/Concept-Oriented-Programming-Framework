/* ---------------------------------------------------------------------------
 * MasterDetail reducer — extracted state machine
 * States: selection, layout, stackedView, loading
 * ------------------------------------------------------------------------- */

export interface MasterDetailState {
  selection: 'noSelection' | 'hasSelection';
  layout: 'split' | 'stacked';
  stackedView: 'showingList' | 'showingDetail';
  loading: 'idle' | 'loading' | 'error';
  selectedId: string | null;
  searchQuery: string;
}

export type MasterDetailEvent =
  | { type: 'SELECT'; id: string }
  | { type: 'DESELECT' }
  | { type: 'BACK' }
  | { type: 'COLLAPSE' }
  | { type: 'EXPAND' }
  | { type: 'SET_SEARCH'; value: string };

export function masterDetailReducer(
  state: MasterDetailState,
  event: MasterDetailEvent,
): MasterDetailState {
  switch (event.type) {
    case 'SELECT':
      return {
        ...state,
        selection: 'hasSelection',
        selectedId: event.id,
        stackedView: state.layout === 'stacked' ? 'showingDetail' : state.stackedView,
      };
    case 'DESELECT':
      return {
        ...state,
        selection: 'noSelection',
        selectedId: null,
        stackedView: 'showingList',
      };
    case 'BACK':
      return { ...state, stackedView: 'showingList' };
    case 'COLLAPSE':
      return { ...state, layout: 'stacked' };
    case 'EXPAND':
      return { ...state, layout: 'split' };
    case 'SET_SEARCH':
      return { ...state, searchQuery: event.value };
    default:
      return state;
  }
}
