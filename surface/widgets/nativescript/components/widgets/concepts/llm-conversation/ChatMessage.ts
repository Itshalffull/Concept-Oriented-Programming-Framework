export type ChatMessageState = 'idle' | 'hovered' | 'copied';
export type ChatMessageEvent =
  | { type: 'HOVER' }
  | { type: 'STREAM_START' }
  | { type: 'COPY' }
  | { type: 'LEAVE' }
  | { type: 'STREAM_END' }
  | { type: 'COPY_TIMEOUT' };

export function chatMessageReducer(state: ChatMessageState, event: ChatMessageEvent): ChatMessageState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STREAM_START') return 'streaming';
      if (event.type === 'COPY') return 'copied';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'copied':
      if (event.type === 'COPY_TIMEOUT') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ChatMessageProps { [key: string]: unknown; }

export function createChatMessage(props: ChatMessageProps) {
  let state: ChatMessageState = 'idle';

  function send(type: string) {
    state = chatMessageReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createChatMessage;
