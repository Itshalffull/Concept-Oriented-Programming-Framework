// ---------------------------------------------------------------------------
// Fieldset reducer — state management for collapsible fieldset sections.
// ---------------------------------------------------------------------------

export type FieldsetDisclosureState = 'expanded' | 'collapsed';

export type FieldsetDisclosureAction =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'TOGGLE' };

export function fieldsetDisclosureReducer(
  state: FieldsetDisclosureState,
  action: FieldsetDisclosureAction,
): FieldsetDisclosureState {
  switch (action.type) {
    case 'EXPAND':
      return 'expanded';
    case 'COLLAPSE':
      return 'collapsed';
    case 'TOGGLE':
      return state === 'expanded' ? 'collapsed' : 'expanded';
    default:
      return state;
  }
}
