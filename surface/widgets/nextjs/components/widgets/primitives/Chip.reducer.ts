// State machine from chip.widget spec
export type ChipState = 'idle' | 'selected' | 'hovered' | 'focused' | 'removed';
export type ChipEvent =
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'DELETE' };

export function chipReducer(state: ChipState, event: ChipEvent): ChipState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'DELETE') return 'removed';
      return state;
    case 'removed':
      return state;
    default:
      return state;
  }
}
