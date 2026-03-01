/* ---------------------------------------------------------------------------
 * InlineEdit state machine
 * States: displaying (initial), focused, editing
 * ------------------------------------------------------------------------- */

export type InlineEditState = 'displaying' | 'focused' | 'editing';
export type InlineEditEvent =
  | { type: 'ACTIVATE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'ESCAPE' };

export function inlineEditReducer(state: InlineEditState, event: InlineEditEvent): InlineEditState {
  switch (state) {
    case 'displaying':
      if (event.type === 'ACTIVATE') return 'editing';
      if (event.type === 'FOCUS') return 'focused';
      return state;
    case 'focused':
      if (event.type === 'ACTIVATE') return 'editing';
      if (event.type === 'BLUR') return 'displaying';
      return state;
    case 'editing':
      if (event.type === 'CONFIRM') return 'displaying';
      if (event.type === 'CANCEL') return 'displaying';
      if (event.type === 'ESCAPE') return 'displaying';
      if (event.type === 'BLUR') return 'displaying';
      return state;
    default:
      return state;
  }
}
