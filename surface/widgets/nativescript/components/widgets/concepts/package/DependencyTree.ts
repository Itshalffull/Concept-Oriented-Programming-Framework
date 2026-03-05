export type DependencyTreeState = 'idle' | 'nodeSelected' | 'filtering';
export type DependencyTreeEvent =
  | { type: 'SELECT' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'SEARCH' }
  | { type: 'FILTER_SCOPE' }
  | { type: 'DESELECT' }
  | { type: 'CLEAR' };

export function dependencyTreeReducer(state: DependencyTreeState, event: DependencyTreeEvent): DependencyTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'nodeSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'FILTER_SCOPE') return 'idle';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'nodeSelected';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface DependencyTreeProps { [key: string]: unknown; }

export function createDependencyTree(props: DependencyTreeProps) {
  let state: DependencyTreeState = 'idle';

  function send(type: string) {
    state = dependencyTreeReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createDependencyTree;
