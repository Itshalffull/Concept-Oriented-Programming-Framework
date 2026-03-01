/* ------------------------------------------------------------------ */
/*  SegmentedControl state machines                                    */
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

export type IndicatorState = 'idle' | 'animating';
export type IndicatorAction = { type: 'ANIMATE' } | { type: 'ANIMATION_END' };

export function indicatorReducer(_state: IndicatorState, action: IndicatorAction): IndicatorState {
  switch (action.type) {
    case 'ANIMATE':
      return 'animating';
    case 'ANIMATION_END':
      return 'idle';
    default:
      return _state;
  }
}
