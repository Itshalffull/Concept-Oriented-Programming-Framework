export type StreamTextState = 'idle' | 'complete' | 'stopped';
export type StreamTextEvent =
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' }
  | { type: 'STOP' };

export function streamTextReducer(state: StreamTextState, event: StreamTextEvent): StreamTextState {
  switch (state) {
    case 'idle':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'complete':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'stopped':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    default:
      return state;
  }
}

export interface StreamTextProps { [key: string]: unknown; }

export function createStreamText(props: StreamTextProps) {
  let state: StreamTextState = 'idle';

  function send(type: string) {
    state = streamTextReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createStreamText;
