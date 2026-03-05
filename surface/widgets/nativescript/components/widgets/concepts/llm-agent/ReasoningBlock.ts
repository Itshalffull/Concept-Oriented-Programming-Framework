export type ReasoningBlockState = 'collapsed' | 'expanded';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'STREAM_START' }
  | { type: 'COLLAPSE' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    default:
      return state;
  }
}

export interface ReasoningBlockProps { [key: string]: unknown; }

export function createReasoningBlock(props: ReasoningBlockProps) {
  let state: ReasoningBlockState = 'collapsed';

  function send(type: string) {
    state = reasoningBlockReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createReasoningBlock;
