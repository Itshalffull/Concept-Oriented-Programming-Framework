'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { focusReducer, validationReducer, type FocusState, type FocusAction, type ValidationState, type ValidationAction } from './NumberInput.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface NumberInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current value */
  value?: number;
  /** Default value when uncontrolled */
  defaultValue?: number;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment (default 1) */
  step?: number;
  /** Decimal precision */
  precision?: number;
  /** Visible label */
  label: string;
  /** Helper text */
  description?: string;
  /** Error message */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: number | undefined) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const NumberInput = forwardRef<HTMLDivElement, NumberInputProps>(function NumberInput(
  {
    value: valueProp,
    defaultValue,
    min,
    max,
    step = 1,
    precision,
    label,
    description,
    error,
    placeholder = '',
    disabled = false,
    required = false,
    readOnly = false,
    name,
    onChange,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  const uid = useId();
  const descriptionId = `${uid}-desc`;
  const errorId = `${uid}-error`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useControllableState<number | undefined>({
    value: valueProp,
    defaultValue: defaultValue,
    onChange,
  });

  const [focusState, dispatchFocus] = useReducer(focusReducer, 'idle');
  const [validationState, dispatchValidation] = useReducer(
    validationReducer,
    error ? 'invalid' : 'valid',
  );

  useEffect(() => {
    if (error) dispatchValidation({ type: 'INVALIDATE' });
    else dispatchValidation({ type: 'VALIDATE' });
  }, [error]);

  const clamp = useCallback(
    (v: number): number => {
      let clamped = v;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max],
  );

  const formatValue = useCallback(
    (v: number | undefined): string => {
      if (v === undefined) return '';
      if (precision !== undefined) return v.toFixed(precision);
      return String(v);
    },
    [precision],
  );

  const applyDelta = useCallback(
    (delta: number) => {
      if (disabled || readOnly) return;
      const current = value ?? min ?? 0;
      const next = clamp(current + delta);
      setValue(next);
    },
    [value, min, disabled, readOnly, clamp, setValue],
  );

  const increment = useCallback(() => applyDelta(step), [applyDelta, step]);
  const decrement = useCallback(() => applyDelta(-step), [applyDelta, step]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') {
        setValue(undefined);
        return;
      }
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed)) {
        setValue(clamp(parsed));
      }
    },
    [setValue, clamp],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          increment();
          break;
        case 'ArrowDown':
          e.preventDefault();
          decrement();
          break;
        case 'Home':
          if (min !== undefined) {
            e.preventDefault();
            setValue(min);
          }
          break;
        case 'End':
          if (max !== undefined) {
            e.preventDefault();
            setValue(max);
          }
          break;
      }
    },
    [increment, decrement, min, max, setValue],
  );

  const atMin = min !== undefined && value !== undefined && value <= min;
  const atMax = max !== undefined && value !== undefined && value >= max;
  const isInvalid = validationState === 'invalid';

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="number-input"
      data-part="root"
      data-state={focusState === 'focused' ? 'focused' : 'idle'}
      data-disabled={disabled ? 'true' : 'false'}
      data-invalid={isInvalid ? 'true' : 'false'}
      data-size={size}
      className={className}
      {...rest}
    >
      <label data-part="label" htmlFor={uid}>
        {label}
      </label>

      <input
        ref={inputRef}
        id={uid}
        data-part="input"
        type="text"
        inputMode="decimal"
        role="spinbutton"
        value={formatValue(value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        name={name}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-invalid={isInvalid ? 'true' : 'false'}
        aria-errormessage={isInvalid ? errorId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        autoComplete="off"
        onChange={handleInputChange}
        onFocus={() => {
          dispatchFocus({ type: 'FOCUS' });
          inputRef.current?.select();
        }}
        onBlur={() => dispatchFocus({ type: 'BLUR' })}
        onKeyDown={handleKeyDown}
      />

      <button
        type="button"
        data-part="decrementButton"
        aria-label="Decrease value"
        aria-disabled={atMin || disabled ? 'true' : 'false'}
        aria-hidden="true"
        disabled={disabled || atMin}
        onClick={decrement}
        tabIndex={-1}
      >
        &minus;
      </button>

      <button
        type="button"
        data-part="incrementButton"
        aria-label="Increase value"
        aria-disabled={atMax || disabled ? 'true' : 'false'}
        aria-hidden="true"
        disabled={disabled || atMax}
        onClick={increment}
        tabIndex={-1}
      >
        +
      </button>

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
    </div>
  );
});

NumberInput.displayName = 'NumberInput';
export default NumberInput;
