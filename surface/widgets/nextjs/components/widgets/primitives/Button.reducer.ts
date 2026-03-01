// State machine from button.widget spec
export type ButtonState = 'idle' | 'hovered' | 'focused' | 'pressed';
export type ButtonEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'PRESS' }
  | { type: 'RELEASE' };

export function buttonReducer(state: ButtonState, event: ButtonEvent): ButtonState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'PRESS') return 'pressed';
      if (event.type === 'FOCUS') return 'focused';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'PRESS') return 'pressed';
      if (event.type === 'HOVER') return 'focused';
      return state;
    case 'pressed':
      if (event.type === 'RELEASE') return 'idle';
      return state;
    default:
      return state;
  }
}
