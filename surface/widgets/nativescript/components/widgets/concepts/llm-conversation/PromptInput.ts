export type PromptInputState = 'empty' | 'composing' | 'submitting';
export type PromptInputEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'ATTACH' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_COMPLETE' }
  | { type: 'SUBMIT_ERROR' };

export function promptInputReducer(state: PromptInputState, event: PromptInputEvent): PromptInputState {
  switch (state) {
    case 'empty':
      if (event.type === 'INPUT') return 'composing';
      if (event.type === 'PASTE') return 'composing';
      if (event.type === 'ATTACH') return 'composing';
      return state;
    case 'composing':
      if (event.type === 'CLEAR') return 'empty';
      if (event.type === 'SUBMIT') return 'submitting';
      return state;
    case 'submitting':
      if (event.type === 'SUBMIT_COMPLETE') return 'empty';
      if (event.type === 'SUBMIT_ERROR') return 'composing';
      return state;
    default:
      return state;
  }
}

export interface PromptInputProps { [key: string]: unknown; }

export function createPromptInput(props: PromptInputProps) {
  let state: PromptInputState = 'empty';

  function send(type: string) {
    state = promptInputReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createPromptInput;
