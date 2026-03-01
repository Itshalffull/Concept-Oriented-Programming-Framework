// State machine from checkbox.widget spec (parallel states: checked/unchecked, focused)
export type CheckboxState = {
  checked: boolean;
  focused: boolean;
};

export type CheckboxEvent =
  | { type: 'TOGGLE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' };

export function checkboxReducer(state: CheckboxState, event: CheckboxEvent): CheckboxState {
  switch (event.type) {
    case 'TOGGLE':
      return { ...state, checked: !state.checked };
    case 'FOCUS':
      return { ...state, focused: true };
    case 'BLUR':
      return { ...state, focused: false };
    default:
      return state;
  }
}
