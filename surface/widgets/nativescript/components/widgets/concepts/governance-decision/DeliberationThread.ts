export type DeliberationThreadState = 'viewing' | 'composing' | 'entrySelected';
export type DeliberationThreadEvent =
  | { type: 'REPLY_TO' }
  | { type: 'SELECT_ENTRY' }
  | { type: 'SEND' }
  | { type: 'CANCEL' }
  | { type: 'DESELECT' };

export function deliberationThreadReducer(state: DeliberationThreadState, event: DeliberationThreadEvent): DeliberationThreadState {
  switch (state) {
    case 'viewing':
      if (event.type === 'REPLY_TO') return 'composing';
      if (event.type === 'SELECT_ENTRY') return 'entrySelected';
      return state;
    case 'composing':
      if (event.type === 'SEND') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    case 'entrySelected':
      if (event.type === 'DESELECT') return 'viewing';
      return state;
    default:
      return state;
  }
}

export interface DeliberationThreadProps { [key: string]: unknown; }

export function createDeliberationThread(props: DeliberationThreadProps) {
  let state: DeliberationThreadState = 'viewing';

  function send(type: string) {
    state = deliberationThreadReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createDeliberationThread;
