export type MemoryInspectorState = 'viewing' | 'searching' | 'entrySelected' | 'deleting';
export type MemoryInspectorEvent =
  | { type: 'SWITCH_TAB' }
  | { type: 'SEARCH' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' }
  | { type: 'DELETE' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' };

export function memoryInspectorReducer(state: MemoryInspectorState, event: MemoryInspectorEvent): MemoryInspectorState {
  switch (state) {
    case 'viewing':
      if (event.type === 'SWITCH_TAB') return 'viewing';
      if (event.type === 'SEARCH') return 'searching';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'searching':
      if (event.type === 'CLEAR') return 'viewing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      if (event.type === 'DELETE') return 'deleting';
      return state;
    case 'deleting':
      if (event.type === 'CONFIRM') return 'viewing';
      if (event.type === 'CANCEL') return 'entrySelected';
      return state;
    default:
      return state;
  }
}

export interface MemoryInspectorProps { [key: string]: unknown; }

export function createMemoryInspector(props: MemoryInspectorProps) {
  let state: MemoryInspectorState = 'viewing';

  function send(type: string) {
    state = memoryInspectorReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createMemoryInspector;
