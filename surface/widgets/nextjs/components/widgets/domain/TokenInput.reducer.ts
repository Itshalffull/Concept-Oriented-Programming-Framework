/* ---------------------------------------------------------------------------
 * TokenInput state machine
 * States: static (initial), hovered, focused, selected
 * ------------------------------------------------------------------------- */

export type TokenState = 'static' | 'hovered' | 'focused' | 'selected';
export type TokenEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'REMOVE' };

export function tokenReducer(state: TokenState, event: TokenEvent): TokenState {
  switch (state) {
    case 'static':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'static';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'static';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'static';
      if (event.type === 'BLUR') return 'static';
      return state;
    default:
      return state;
  }
}
