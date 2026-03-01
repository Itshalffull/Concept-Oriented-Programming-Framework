/* ------------------------------------------------------------------ */
/*  RadioGroup state machine                                           */
/* ------------------------------------------------------------------ */

export type ItemState = 'unselected' | 'selected';
export type ItemAction = { type: 'SELECT' } | { type: 'DESELECT' };

export function itemReducer(_state: ItemState, action: ItemAction): ItemState {
  switch (action.type) {
    case 'SELECT':
      return 'selected';
    case 'DESELECT':
      return 'unselected';
    default:
      return _state;
  }
}
