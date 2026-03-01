export type DataListState = { current: 'static' };

export type DataListAction = { type: 'NOOP' };

export function dataListReducer(state: DataListState, _action: DataListAction): DataListState {
  return state;
}

export const dataListInitialState: DataListState = { current: 'static' };
