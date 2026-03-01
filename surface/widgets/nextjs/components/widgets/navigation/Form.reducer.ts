// ---------------------------------------------------------------------------
// Form reducer — submission lifecycle state management.
// Manages: idle -> validating -> submitting -> success/error.
// ---------------------------------------------------------------------------

export type SubmissionState = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

export type SubmissionAction =
  | { type: 'SUBMIT' }
  | { type: 'VALIDATE' }
  | { type: 'VALID' }
  | { type: 'INVALID'; errors: string[] }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE'; errors: string[] }
  | { type: 'RESET' }
  | { type: 'FIX' };

export interface FormState {
  submission: SubmissionState;
  errors: string[];
}

export const initialFormState: FormState = {
  submission: 'idle',
  errors: [],
};

export function formReducer(state: FormState, action: SubmissionAction): FormState {
  switch (action.type) {
    case 'SUBMIT':
    case 'VALIDATE':
      return { ...state, submission: 'validating', errors: [] };
    case 'VALID':
      return { ...state, submission: 'submitting' };
    case 'INVALID':
      return { submission: 'error', errors: action.errors };
    case 'SUCCESS':
      return { submission: 'success', errors: [] };
    case 'FAILURE':
      return { submission: 'error', errors: action.errors };
    case 'RESET':
    case 'FIX':
      return { submission: 'idle', errors: [] };
    default:
      return state;
  }
}
