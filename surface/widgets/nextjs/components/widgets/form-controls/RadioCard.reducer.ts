/* ------------------------------------------------------------------ */
/*  RadioCard state machine                                            */
/* ------------------------------------------------------------------ */

export type CardState = 'unselected' | 'selected';
export type CardAction = { type: 'SELECT' } | { type: 'DESELECT' };

export function cardReducer(_state: CardState, action: CardAction): CardState {
  switch (action.type) {
    case 'SELECT':
      return 'selected';
    case 'DESELECT':
      return 'unselected';
    default:
      return _state;
  }
}
