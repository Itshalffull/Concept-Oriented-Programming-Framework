/* ------------------------------------------------------------------ */
/*  CheckboxGroup state machine                                        */
/* ------------------------------------------------------------------ */

export type ItemState = 'unchecked' | 'checked';
export type ItemAction = { type: 'CHECK' } | { type: 'UNCHECK' };

export function itemReducer(_state: ItemState, action: ItemAction): ItemState {
  switch (action.type) {
    case 'CHECK':
      return 'checked';
    case 'UNCHECK':
      return 'unchecked';
    default:
      return _state;
  }
}
