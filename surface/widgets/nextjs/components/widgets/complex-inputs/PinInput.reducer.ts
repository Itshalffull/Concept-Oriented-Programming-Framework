/* ---------------------------------------------------------------------------
 * State machine
 * Completion: empty (initial) -> partial -> complete
 * Focus: unfocused (initial) -> focused
 * Events: INPUT, PASTE, FILL_ALL, CLEAR_ALL, DELETE_CHAR, FOCUS, BLUR
 * ------------------------------------------------------------------------- */

export type CompletionState = 'empty' | 'partial' | 'complete';
export type FocusState = 'unfocused' | 'focused';

export type PinEvent =
  | { type: 'INPUT' }
  | { type: 'PASTE' }
  | { type: 'FILL_ALL' }
  | { type: 'CLEAR_ALL' }
  | { type: 'DELETE_CHAR' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' };

export interface PinMachine {
  completion: CompletionState;
  focus: FocusState;
}

export function pinReducer(state: PinMachine, event: PinEvent): PinMachine {
  let completion = state.completion;
  let focus = state.focus;

  switch (event.type) {
    case 'FILL_ALL':
      completion = 'complete';
      break;
    case 'CLEAR_ALL':
      completion = 'empty';
      break;
    case 'INPUT':
    case 'PASTE':
      if (completion === 'empty') completion = 'partial';
      break;
    case 'DELETE_CHAR':
      if (completion === 'complete') completion = 'partial';
      break;
    case 'FOCUS':
      focus = 'focused';
      break;
    case 'BLUR':
      focus = 'unfocused';
      break;
  }

  return { completion, focus };
}
