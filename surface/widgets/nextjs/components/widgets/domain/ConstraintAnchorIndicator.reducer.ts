/* ---------------------------------------------------------------------------
 * ConstraintAnchorIndicator state machine
 * States: idle (initial), hovered, selected, deleted
 * ------------------------------------------------------------------------- */

export type AnchorState = 'idle' | 'hovered' | 'selected' | 'deleted';
export type AnchorEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'DELETE' };

export function anchorReducer(state: AnchorState, event: AnchorEvent): AnchorState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'DELETE') return 'deleted';
      return state;
    case 'deleted':
      return state;
    default:
      return state;
  }
}
