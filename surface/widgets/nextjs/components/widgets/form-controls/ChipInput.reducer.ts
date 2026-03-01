/* ------------------------------------------------------------------ */
/*  ChipInput state machine                                            */
/* ------------------------------------------------------------------ */

export type InteractionState = 'idle' | 'typing' | 'suggesting';
export type InteractionAction =
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'SUGGEST' }
  | { type: 'SELECT_SUGGESTION' }
  | { type: 'CREATE' }
  | { type: 'CLOSE' };

export function interactionReducer(state: InteractionState, action: InteractionAction): InteractionState {
  switch (state) {
    case 'idle':
      if (action.type === 'FOCUS') return 'typing';
      return state;
    case 'typing':
      if (action.type === 'SUGGEST') return 'suggesting';
      if (action.type === 'BLUR' || action.type === 'CREATE') return 'idle';
      return state;
    case 'suggesting':
      if (action.type === 'SELECT_SUGGESTION') return 'typing';
      if (action.type === 'BLUR') return 'idle';
      if (action.type === 'CLOSE') return 'typing';
      return state;
    default:
      return state;
  }
}
