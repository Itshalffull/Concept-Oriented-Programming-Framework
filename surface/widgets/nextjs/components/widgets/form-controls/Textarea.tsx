'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useId,
  type TextareaHTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { contentReducer, focusReducer, validationReducer, type ContentState, type ContentAction, type FocusState, type FocusAction, type ValidationState, type ValidationAction } from './Textarea.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  /** Current value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Number of visible rows */
  rows?: number;
  /** Auto-resize to fit content */
  autoResize?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Visible label */
  label: string;
  /** Helper text */
  description?: string;
  /** Error message (renders when validation is invalid) */
  error?: string;
  /** Read-only state */
  readOnly?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Change callback */
  onChange?: (value: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value: valueProp,
    defaultValue = '',
    rows = 3,
    autoResize = true,
    maxLength,
    label,
    description,
    error,
    disabled = false,
    required = false,
    readOnly = false,
    name,
    placeholder = '',
    size = 'md',
    onChange,
    className,
    ...rest
  },
  ref,
) {
  const uid = useId();
  const descriptionId = `${uid}-desc`;
  const errorId = `${uid}-error`;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const [contentState, dispatchContent] = useReducer(
    contentReducer,
    value.length > 0 ? 'filled' : 'empty',
  );
  const [focusState, dispatchFocus] = useReducer(focusReducer, 'idle');
  const [validationState, dispatchValidation] = useReducer(
    validationReducer,
    error ? 'invalid' : 'valid',
  );

  // Sync external error prop
  useEffect(() => {
    if (error) dispatchValidation({ type: 'INVALIDATE' });
    else dispatchValidation({ type: 'VALIDATE' });
  }, [error]);

  // Auto-resize
  useEffect(() => {
    if (!autoResize || !textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, autoResize]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setValue(next);
      dispatchContent({ type: 'INPUT', value: next });
    },
    [setValue],
  );

  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [ref],
  );

  const isInvalid = validationState === 'invalid';

  return (
    <div
      data-surface-widget=""
      data-widget-name="textarea"
      data-part="root"
      data-state={focusState === 'focused' ? 'focused' : 'idle'}
      data-content={contentState}
      data-disabled={disabled ? 'true' : 'false'}
      data-invalid={isInvalid ? 'true' : 'false'}
      data-size={size}
      className={className}
    >
      <label data-part="label" htmlFor={uid}>
        {label}
      </label>

      <textarea
        ref={setTextareaRef}
        id={uid}
        data-part="textarea"
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        name={name}
        maxLength={maxLength}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        aria-invalid={isInvalid ? 'true' : 'false'}
        aria-errormessage={isInvalid ? errorId : undefined}
        aria-multiline="true"
        aria-placeholder={placeholder || undefined}
        style={{
          resize: autoResize ? 'none' : 'vertical',
          overflow: autoResize ? 'hidden' : 'auto',
        }}
        onChange={handleInput}
        onFocus={() => dispatchFocus({ type: 'FOCUS' })}
        onBlur={() => dispatchFocus({ type: 'BLUR' })}
        {...rest}
      />

      {description && (
        <span data-part="description" id={descriptionId}>
          {description}
        </span>
      )}

      {isInvalid && error && (
        <span data-part="error" id={errorId} role="alert" aria-live="assertive">
          {error}
        </span>
      )}

      {maxLength !== undefined && (
        <span data-part="charCount" aria-live="polite">
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
export default Textarea;
