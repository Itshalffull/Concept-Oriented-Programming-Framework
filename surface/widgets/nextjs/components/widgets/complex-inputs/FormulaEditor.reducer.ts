/* ---------------------------------------------------------------------------
 * State machine
 * Content: empty (initial) -> editing
 * Interaction: idle (initial) -> focused -> editing -> autocompleting
 * Previewing: idle (initial) -> showing
 * Validation: valid (initial) -> invalid
 * Events: INPUT, FOCUS, BLUR, SHOW_AC, SELECT_SUGGESTION, etc.
 * ------------------------------------------------------------------------- */

export type ContentState = 'empty' | 'editing';
export type InteractionState = 'idle' | 'focused' | 'editing' | 'autocompleting';
export type PreviewState = 'idle' | 'showing';
export type ValidationState = 'valid' | 'invalid';

export interface FormulaMachine {
  content: ContentState;
  interaction: InteractionState;
  previewing: PreviewState;
  validation: ValidationState;
  activeIndex: number;
  errorMessage: string;
  previewResult: string;
}

export type FormulaEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'CLEAR' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'TYPE_CHAR' }
  | { type: 'SHOW_AC' }
  | { type: 'DISMISS_AC' }
  | { type: 'SELECT_SUGGESTION' }
  | { type: 'ACCEPT_SUGGESTION' }
  | { type: 'ESCAPE' }
  | { type: 'NAVIGATE_DOWN' }
  | { type: 'NAVIGATE_UP' }
  | { type: 'HIGHLIGHT'; index: number }
  | { type: 'TRIGGER_AC' }
  | { type: 'EVALUATE'; result: string }
  | { type: 'SYNTAX_ERROR'; message: string }
  | { type: 'TYPE_ERROR'; message: string }
  | { type: 'VALIDATE' };

export function formulaReducer(state: FormulaMachine, event: FormulaEvent): FormulaMachine {
  const s = { ...state };

  switch (event.type) {
    case 'INPUT':
    case 'PASTE':
      if (s.content === 'empty') s.content = 'editing';
      if (s.interaction === 'focused' || s.interaction === 'editing') s.interaction = 'editing';
      if (s.validation === 'invalid') s.validation = 'valid';
      if (s.previewing === 'showing') s.previewing = 'idle';
      break;
    case 'CLEAR':
      s.content = 'empty';
      break;
    case 'FOCUS':
      if (s.interaction === 'idle') s.interaction = 'focused';
      break;
    case 'BLUR':
      s.interaction = 'idle';
      break;
    case 'TYPE_CHAR':
      if (s.interaction === 'focused') s.interaction = 'editing';
      break;
    case 'SHOW_AC':
    case 'TRIGGER_AC':
      s.interaction = 'autocompleting';
      s.activeIndex = 0;
      break;
    case 'SELECT_SUGGESTION':
    case 'ACCEPT_SUGGESTION':
      s.interaction = 'editing';
      s.activeIndex = 0;
      break;
    case 'DISMISS_AC':
    case 'ESCAPE':
      if (s.interaction === 'autocompleting') s.interaction = 'editing';
      break;
    case 'NAVIGATE_DOWN':
      s.activeIndex++;
      break;
    case 'NAVIGATE_UP':
      s.activeIndex = Math.max(0, s.activeIndex - 1);
      break;
    case 'HIGHLIGHT':
      s.activeIndex = event.index;
      break;
    case 'EVALUATE':
      s.previewing = 'showing';
      s.previewResult = event.result;
      break;
    case 'SYNTAX_ERROR':
    case 'TYPE_ERROR':
      s.validation = 'invalid';
      s.errorMessage = event.message;
      s.previewing = 'idle';
      break;
    case 'VALIDATE':
      s.validation = 'valid';
      s.errorMessage = '';
      break;
  }

  return s;
}
