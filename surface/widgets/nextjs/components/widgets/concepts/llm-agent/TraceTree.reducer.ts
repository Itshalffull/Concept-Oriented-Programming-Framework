export type TraceTreeState = 'idle' | 'spanSelected' | 'ready' | 'fetching';
export type TraceTreeEvent =
  | { type: 'SELECT_SPAN' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'FILTER' }
  | { type: 'DESELECT' }
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' };

export function traceTreeReducer(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'FILTER') return 'idle';
      return state;
    case 'spanSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_SPAN') return 'spanSelected';
      return state;
    case 'ready':
      if (event.type === 'LOAD') return 'fetching';
      return state;
    case 'fetching':
      if (event.type === 'LOAD_COMPLETE') return 'ready';
      return state;
    default:
      return state;
  }
}
