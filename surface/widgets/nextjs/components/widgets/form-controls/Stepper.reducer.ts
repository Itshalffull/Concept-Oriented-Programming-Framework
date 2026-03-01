/* ------------------------------------------------------------------ */
/*  Stepper state machine                                              */
/* ------------------------------------------------------------------ */

export type BoundaryState = 'idle' | 'atMin' | 'atMax';
export type BoundaryAction =
  | { type: 'AT_MIN' }
  | { type: 'AT_MAX' }
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' };

export function boundaryReducer(state: BoundaryState, action: BoundaryAction): BoundaryState {
  switch (state) {
    case 'idle':
      if (action.type === 'AT_MIN') return 'atMin';
      if (action.type === 'AT_MAX') return 'atMax';
      return state;
    case 'atMin':
      if (action.type === 'INCREMENT') return 'idle';
      if (action.type === 'AT_MAX') return 'atMax';
      return state;
    case 'atMax':
      if (action.type === 'DECREMENT') return 'idle';
      if (action.type === 'AT_MIN') return 'atMin';
      return state;
    default:
      return state;
  }
}

export function deriveBoundary(value: number, min: number, max: number): BoundaryState {
  if (value <= min) return 'atMin';
  if (value >= max) return 'atMax';
  return 'idle';
}
