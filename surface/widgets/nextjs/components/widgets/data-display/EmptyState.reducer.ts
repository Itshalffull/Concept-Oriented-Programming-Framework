export type EmptyStateState = { current: 'static' };

export type EmptyStateAction = { type: 'NOOP' };

export function emptyStateReducer(state: EmptyStateState, _action: EmptyStateAction): EmptyStateState {
  return state;
}

export const emptyStateInitialState: EmptyStateState = { current: 'static' };
