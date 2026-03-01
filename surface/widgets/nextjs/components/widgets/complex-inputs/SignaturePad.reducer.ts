/* ---------------------------------------------------------------------------
 * State machine
 * Content: empty (initial) -> drawing -> drawn
 * Focus: unfocused (initial) -> focused
 * Events: STROKE_START, STROKE_END, CLEAR, FOCUS, BLUR
 * ------------------------------------------------------------------------- */

export type ContentState = 'empty' | 'drawing' | 'drawn';
export type FocusState = 'unfocused' | 'focused';

export interface SignatureMachine {
  content: ContentState;
  focus: FocusState;
}

export type SignatureEvent =
  | { type: 'STROKE_START' }
  | { type: 'STROKE_END' }
  | { type: 'CLEAR' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' };

export function signatureReducer(state: SignatureMachine, event: SignatureEvent): SignatureMachine {
  const s = { ...state };

  switch (event.type) {
    case 'STROKE_START':
      if (s.content === 'empty' || s.content === 'drawn') s.content = 'drawing';
      break;
    case 'STROKE_END':
      if (s.content === 'drawing') s.content = 'drawn';
      break;
    case 'CLEAR':
      s.content = 'empty';
      break;
    case 'FOCUS':
      s.focus = 'focused';
      break;
    case 'BLUR':
      s.focus = 'unfocused';
      break;
  }

  return s;
}
