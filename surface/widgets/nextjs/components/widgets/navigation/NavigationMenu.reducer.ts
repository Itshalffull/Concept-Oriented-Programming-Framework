// ---------------------------------------------------------------------------
// NavigationMenu reducer — state for horizontal nav with dropdown panels.
// ---------------------------------------------------------------------------

export interface NavMenuState {
  openItem: number | null;
  mobileExpanded: boolean;
}

export type NavMenuAction =
  | { type: 'OPEN'; index: number }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE_MOBILE' }
  | { type: 'NAVIGATE' };

export function navMenuReducer(state: NavMenuState, action: NavMenuAction): NavMenuState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, openItem: action.index };
    case 'CLOSE':
      return { ...state, openItem: null };
    case 'TOGGLE_MOBILE':
      return { ...state, mobileExpanded: !state.mobileExpanded };
    case 'NAVIGATE':
      return { ...state, mobileExpanded: false, openItem: null };
    default:
      return state;
  }
}
