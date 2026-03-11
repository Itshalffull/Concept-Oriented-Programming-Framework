export type AgentTimelineState = 'idle' | 'entrySelected' | 'interrupted' | 'inactive' | 'active';
export type AgentTimelineEvent =
  | { type: 'NEW_ENTRY' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'INTERRUPT' }
  | { type: 'DESELECT' }
  | { type: 'RESUME' }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_END' };

export function agentTimelineReducer(state: AgentTimelineState, event: AgentTimelineEvent): AgentTimelineState {
  switch (state) {
    case 'idle':
      if (event.type === 'NEW_ENTRY') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      if (event.type === 'INTERRUPT') return 'interrupted';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'interrupted':
      if (event.type === 'RESUME') return 'idle';
      return state;
    case 'inactive':
      if (event.type === 'STREAM_START') return 'active';
      return state;
    case 'active':
      if (event.type === 'STREAM_END') return 'inactive';
      return state;
    default:
      return state;
  }
}
