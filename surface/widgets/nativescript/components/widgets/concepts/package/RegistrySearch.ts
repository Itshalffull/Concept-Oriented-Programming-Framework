export type RegistrySearchState = 'idle' | 'searching';
export type RegistrySearchEvent =
  | { type: 'INPUT' }
  | { type: 'SELECT_RESULT' }
  | { type: 'RESULTS' }
  | { type: 'CLEAR' };

export function registrySearchReducer(state: RegistrySearchState, event: RegistrySearchEvent): RegistrySearchState {
  switch (state) {
    case 'idle':
      if (event.type === 'INPUT') return 'searching';
      if (event.type === 'SELECT_RESULT') return 'idle';
      return state;
    case 'searching':
      if (event.type === 'RESULTS') return 'idle';
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface RegistrySearchProps { [key: string]: unknown; }

export function createRegistrySearch(props: RegistrySearchProps) {
  let state: RegistrySearchState = 'idle';

  function send(type: string) {
    state = registrySearchReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createRegistrySearch;
