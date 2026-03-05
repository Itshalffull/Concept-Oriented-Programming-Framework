export type ExpressionToggleInputState = 'fixed' | 'expression' | 'autocompleting';
export type ExpressionToggleInputEvent =
  | { type: 'TOGGLE' }
  | { type: 'INPUT' }
  | { type: 'SHOW_AC' }
  | { type: 'SELECT' }
  | { type: 'DISMISS' };

export function expressionToggleInputReducer(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState {
  switch (state) {
    case 'fixed':
      if (event.type === 'TOGGLE') return 'expression';
      if (event.type === 'INPUT') return 'fixed';
      return state;
    case 'expression':
      if (event.type === 'TOGGLE') return 'fixed';
      if (event.type === 'INPUT') return 'expression';
      if (event.type === 'SHOW_AC') return 'autocompleting';
      return state;
    case 'autocompleting':
      if (event.type === 'SELECT') return 'expression';
      if (event.type === 'DISMISS') return 'expression';
      return state;
    default:
      return state;
  }
}

export interface ExpressionToggleInputProps { [key: string]: unknown; }

export function createExpressionToggleInput(props: ExpressionToggleInputProps) {
  let state: ExpressionToggleInputState = 'fixed';

  function send(type: string) {
    state = expressionToggleInputReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createExpressionToggleInput;
