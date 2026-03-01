// ---------------------------------------------------------------------------
// Disclosure reducer — state management for expand/collapse section.
// ---------------------------------------------------------------------------

export type DisclosureState = 'collapsed' | 'expanded';

export type DisclosureAction =
  | { type: 'TOGGLE' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' };

export function disclosureReducer(state: DisclosureState, action: DisclosureAction): DisclosureState {
  switch (state) {
    case 'collapsed':
      if (action.type === 'TOGGLE' || action.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (action.type === 'TOGGLE' || action.type === 'COLLAPSE') return 'collapsed';
      return state;
    default:
      return state;
  }
}
