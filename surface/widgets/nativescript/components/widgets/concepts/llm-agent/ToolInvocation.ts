export type ToolInvocationState = 'collapsed' | 'hoveredCollapsed' | 'expanded' | 'pending' | 'running' | 'succeeded' | 'failed';
export type ToolInvocationEvent =
  | { type: 'EXPAND' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'COLLAPSE' }
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function toolInvocationReducer(state: ToolInvocationState, event: ToolInvocationEvent): ToolInvocationState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

export interface ToolInvocationProps { [key: string]: unknown; }

export function createToolInvocation(props: ToolInvocationProps) {
  let state: ToolInvocationState = 'collapsed';

  function send(type: string) {
    state = toolInvocationReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createToolInvocation;
