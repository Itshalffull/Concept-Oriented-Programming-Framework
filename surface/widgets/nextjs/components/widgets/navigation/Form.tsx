'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
  type HTMLAttributes,
  type FormEvent,
} from 'react';
import { formReducer, initialFormState } from './Form.reducer.js';

// ---------------------------------------------------------------------------
// Form — Form container with validation state management.
// Manages submission lifecycle: idle -> validating -> submitting -> success/error.
// Derived from form.widget spec.
// ---------------------------------------------------------------------------

export interface FormProps extends Omit<HTMLAttributes<HTMLFormElement>, 'children' | 'onSubmit' | 'onReset'> {
  onSubmit?: (e: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onReset?: () => void;
  onValidate?: () => Promise<string[]> | string[];
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  disabled?: boolean;
  noValidate?: boolean;
  children?: ReactNode;
  submitLabel?: ReactNode;
  resetLabel?: ReactNode;
  showReset?: boolean;
  variant?: string;
  size?: string;
}

export const Form = forwardRef<HTMLFormElement, FormProps>(
  function Form(
    {
      onSubmit,
      onReset,
      onValidate,
      validateOnBlur = true,
      validateOnChange = false,
      disabled = false,
      noValidate = false,
      children,
      submitLabel = 'Submit',
      resetLabel = 'Reset',
      showReset = false,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const [state, dispatch] = useReducer(formReducer, initialFormState);

    const errorSummaryRef = useRef<HTMLDivElement>(null);
    const isSubmitting = state.submission === 'submitting';
    const hasErrors = state.submission === 'error';

    const handleSubmit = useCallback(
      async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (disabled || isSubmitting) return;

        dispatch({ type: 'SUBMIT' });

        // Run validation
        if (onValidate) {
          try {
            const errors = await onValidate();
            if (errors && errors.length > 0) {
              dispatch({ type: 'INVALID', errors });
              return;
            }
          } catch {
            dispatch({ type: 'INVALID', errors: ['Validation failed'] });
            return;
          }
        }

        dispatch({ type: 'VALID' });

        // Run submission
        if (onSubmit) {
          try {
            await onSubmit(e);
            dispatch({ type: 'SUCCESS' });
          } catch {
            dispatch({ type: 'FAILURE', errors: ['Submission failed'] });
          }
        } else {
          dispatch({ type: 'SUCCESS' });
        }
      },
      [disabled, isSubmitting, onValidate, onSubmit]
    );

    const handleReset = useCallback(() => {
      dispatch({ type: 'RESET' });
      onReset?.();
    }, [onReset]);

    return (
      <form
        ref={ref}
        role="form"
        aria-label="Form"
        aria-busy={isSubmitting ? 'true' : 'false'}
        className={className}
        noValidate={noValidate}
        data-surface-widget=""
        data-widget-name="form"
        data-part="root"
        data-state={state.submission}
        data-disabled={disabled ? 'true' : 'false'}
        data-variant={variant}
        data-size={size}
        onSubmit={handleSubmit}
        onReset={handleReset}
        {...rest}
      >
        <div
          data-part="fields"
          data-state={state.submission}
        >
          {children}
        </div>
        {hasErrors && state.errors.length > 0 && (
          <div
            ref={errorSummaryRef}
            role="alert"
            aria-live="assertive"
            aria-label="Form errors"
            data-part="error-summary"
          >
            <ul>
              {state.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        <div
          data-part="actions"
          data-state={state.submission}
        >
          <button
            type="submit"
            aria-disabled={isSubmitting || disabled ? 'true' : 'false'}
            disabled={isSubmitting || disabled}
            data-part="submit-button"
            data-state={state.submission}
          >
            {submitLabel}
          </button>
          {showReset && (
            <button
              type="reset"
              aria-disabled={disabled ? 'true' : 'false'}
              disabled={disabled}
              data-part="reset-button"
            >
              {resetLabel}
            </button>
          )}
        </div>
      </form>
    );
  }
);

Form.displayName = 'Form';
export default Form;
