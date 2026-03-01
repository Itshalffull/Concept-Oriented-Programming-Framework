/* ------------------------------------------------------------------ */
/*  Textarea state machines                                            */
/* ------------------------------------------------------------------ */

export type ContentState = 'empty' | 'filled';
export type ContentAction = { type: 'INPUT'; value: string } | { type: 'CLEAR' };

export function contentReducer(_state: ContentState, action: ContentAction): ContentState {
  switch (action.type) {
    case 'INPUT':
      return action.value.length > 0 ? 'filled' : 'empty';
    case 'CLEAR':
      return 'empty';
    default:
      return _state;
  }
}

export type FocusState = 'idle' | 'focused';
export type FocusAction = { type: 'FOCUS' } | { type: 'BLUR' };

export function focusReducer(_state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case 'FOCUS':
      return 'focused';
    case 'BLUR':
      return 'idle';
    default:
      return _state;
  }
}

export type ValidationState = 'valid' | 'invalid';
export type ValidationAction = { type: 'INVALIDATE' } | { type: 'VALIDATE' };

export function validationReducer(_state: ValidationState, action: ValidationAction): ValidationState {
  switch (action.type) {
    case 'INVALIDATE':
      return 'invalid';
    case 'VALIDATE':
      return 'valid';
    default:
      return _state;
  }
}
