// State machine from text-input.widget spec (parallel states: empty/filled, idle/focused, valid/invalid)
export type TextInputState = {
  fill: 'empty' | 'filled';
  focus: 'idle' | 'focused';
  validity: 'valid' | 'invalid';
};

export type TextInputEvent =
  | { type: 'INPUT'; value: string }
  | { type: 'CLEAR' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'INVALIDATE' }
  | { type: 'VALIDATE' };

export function textInputReducer(state: TextInputState, event: TextInputEvent): TextInputState {
  switch (event.type) {
    case 'INPUT':
      return { ...state, fill: event.value.length > 0 ? 'filled' : 'empty' };
    case 'CLEAR':
      return { ...state, fill: 'empty' };
    case 'FOCUS':
      return { ...state, focus: 'focused' };
    case 'BLUR':
      return { ...state, focus: 'idle' };
    case 'INVALIDATE':
      return { ...state, validity: 'invalid' };
    case 'VALIDATE':
      return { ...state, validity: 'valid' };
    default:
      return state;
  }
}
