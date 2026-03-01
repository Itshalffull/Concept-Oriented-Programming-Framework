/* ---------------------------------------------------------------------------
 * StepIndicator state machine
 * Tracks currentStep index
 * ------------------------------------------------------------------------- */

export type StepStatus = 'upcoming' | 'current' | 'completed';

export interface StepIndicatorState {
  currentStep: number;
}

export type StepIndicatorEvent =
  | { type: 'GO_TO_STEP'; index: number }
  | { type: 'NEXT' }
  | { type: 'PREV' };

export function stepIndicatorReducer(
  state: StepIndicatorState,
  event: StepIndicatorEvent,
): StepIndicatorState {
  switch (event.type) {
    case 'GO_TO_STEP':
      return { ...state, currentStep: event.index };
    case 'NEXT':
      return { ...state, currentStep: state.currentStep + 1 };
    case 'PREV':
      return { ...state, currentStep: Math.max(0, state.currentStep - 1) };
    default:
      return state;
  }
}
