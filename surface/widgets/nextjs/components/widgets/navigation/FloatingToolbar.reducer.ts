// ---------------------------------------------------------------------------
// FloatingToolbar reducer — visibility state for floating bubble toolbar.
// ---------------------------------------------------------------------------

export type VisibilityState = 'hidden' | 'visible';

export type VisibilityAction =
  | { type: 'SHOW' }
  | { type: 'HIDE' }
  | { type: 'CLICK_OUTSIDE' }
  | { type: 'ESCAPE' };

export function visibilityReducer(state: VisibilityState, action: VisibilityAction): VisibilityState {
  switch (state) {
    case 'hidden':
      if (action.type === 'SHOW') return 'visible';
      return state;
    case 'visible':
      if (
        action.type === 'HIDE' ||
        action.type === 'CLICK_OUTSIDE' ||
        action.type === 'ESCAPE'
      ) {
        return 'hidden';
      }
      return state;
    default:
      return state;
  }
}
