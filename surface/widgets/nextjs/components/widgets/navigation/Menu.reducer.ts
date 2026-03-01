// ---------------------------------------------------------------------------
// Menu reducer — open/close state for dropdown command menu.
// ---------------------------------------------------------------------------

export type MenuState = 'closed' | 'open';

export type MenuAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SELECT' };

export function menuReducer(state: MenuState, action: MenuAction): MenuState {
  switch (state) {
    case 'closed':
      if (action.type === 'OPEN') return 'open';
      return state;
    case 'open':
      if (action.type === 'CLOSE' || action.type === 'SELECT') return 'closed';
      return state;
    default:
      return state;
  }
}
