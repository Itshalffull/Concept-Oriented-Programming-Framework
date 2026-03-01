'use client';

import { forwardRef, useReducer, useCallback, type HTMLAttributes } from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { boundaryReducer, deriveBoundary, type BoundaryState, type BoundaryAction } from './Stepper.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface StepperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current value */
  value?: number;
  /** Default value when uncontrolled */
  defaultValue?: number;
  /** Minimum value (default 0) */
  min?: number;
  /** Maximum value (default 10) */
  max?: number;
  /** Step increment (default 1) */
  step?: number;
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: number) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Stepper = forwardRef<HTMLDivElement, StepperProps>(function Stepper(
  {
    value: valueProp,
    defaultValue = 0,
    min = 0,
    max = 10,
    step = 1,
    label,
    disabled = false,
    name,
    onChange,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const [boundaryState, dispatchBoundary] = useReducer(
    boundaryReducer,
    deriveBoundary(value, min, max),
  );

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max],
  );

  const applyValue = useCallback(
    (next: number) => {
      const clamped = clamp(next);
      setValue(clamped);
      if (clamped <= min) dispatchBoundary({ type: 'AT_MIN' });
      else if (clamped >= max) dispatchBoundary({ type: 'AT_MAX' });
      else if (boundaryState === 'atMin') dispatchBoundary({ type: 'INCREMENT' });
      else if (boundaryState === 'atMax') dispatchBoundary({ type: 'DECREMENT' });
    },
    [clamp, setValue, min, max, boundaryState],
  );

  const increment = useCallback(() => applyValue(value + step), [applyValue, value, step]);
  const decrement = useCallback(() => applyValue(value - step), [applyValue, value, step]);

  const atMin = value <= min;
  const atMax = value >= max;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
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
          e.preventDefault();
          applyValue(min);
          break;
        case 'End':
          e.preventDefault();
          applyValue(max);
          break;
      }
    },
    [disabled, increment, decrement, applyValue, min, max],
  );

  const dataState = atMin ? 'at-min' : atMax ? 'at-max' : 'idle';

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-surface-widget=""
      data-widget-name="stepper"
      data-part="root"
      data-state={dataState}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      className={className}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <span data-part="label" id={name ? `${name}-label` : undefined}>
        {label}
      </span>

      <button
        type="button"
        data-part="decrementButton"
        aria-label="Decrease"
        aria-disabled={atMin || disabled ? 'true' : 'false'}
        disabled={disabled || atMin}
        onClick={decrement}
        tabIndex={0}
      >
        &minus;
      </button>

      <span
        data-part="value"
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={String(value)}
        aria-label={label}
        aria-live="polite"
        tabIndex={0}
      >
        {value}
      </span>

      <button
        type="button"
        data-part="incrementButton"
        aria-label="Increase"
        aria-disabled={atMax || disabled ? 'true' : 'false'}
        disabled={disabled || atMax}
        onClick={increment}
        tabIndex={0}
      >
        +
      </button>

      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
});

Stepper.displayName = 'Stepper';
export default Stepper;
