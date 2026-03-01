'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  useId,
  type ReactNode,
} from 'react';
import { checkboxReducer, type CheckboxState, type CheckboxEvent } from './Checkbox.reducer.js';

// Props from checkbox.widget spec
export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  value?: string;
  name?: string;
  label?: ReactNode;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export const Checkbox = forwardRef<HTMLDivElement, CheckboxProps>(
  function Checkbox(
    {
      checked = false,
      indeterminate = false,
      disabled = false,
      required = false,
      value = '',
      name,
      label,
      onChange,
      className,
    },
    ref
  ) {
    const generatedId = useId();
    const inputId = name || generatedId;
    const labelId = `${inputId}-label`;
    const inputRef = useRef<HTMLInputElement>(null);

    const [state, send] = useReducer(checkboxReducer, {
      checked,
      focused: false,
    });

    // Sync indeterminate property (not available as HTML attribute)
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    // Sync controlled checked state
    const isChecked = checked !== undefined ? checked : state.checked;

    const handleToggle = useCallback(() => {
      if (disabled) return;
      send({ type: 'TOGGLE' });
      onChange?.(!isChecked);
    }, [disabled, isChecked, onChange]);

    const dataState = indeterminate
      ? 'indeterminate'
      : isChecked
        ? 'checked'
        : 'unchecked';

    const ariaChecked = indeterminate
      ? 'mixed' as const
      : isChecked
        ? 'true' as const
        : 'false' as const;

    return (
      <div
        ref={ref}
        className={className}
        data-surface-widget=""
        data-widget-name="checkbox"
        data-part="root"
        data-state={dataState}
        data-disabled={disabled ? 'true' : 'false'}
        onClick={handleToggle}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="checkbox"
          role="checkbox"
          checked={isChecked}
          disabled={disabled}
          required={required}
          value={value}
          name={name}
          aria-checked={ariaChecked}
          aria-required={required ? 'true' : 'false'}
          aria-disabled={disabled ? 'true' : 'false'}
          aria-labelledby={label ? labelId : undefined}
          onChange={handleToggle}
          onFocus={() => send({ type: 'FOCUS' })}
          onBlur={() => send({ type: 'BLUR' })}
          tabIndex={disabled ? -1 : 0}
          data-part="input"
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, margin: 0 }}
        />
        <span
          data-part="control"
          data-state={dataState}
          data-disabled={disabled ? 'true' : 'false'}
          data-focused={state.focused ? 'true' : 'false'}
          aria-hidden="true"
        >
          <span
            data-part="indicator"
            data-state={dataState}
            data-visible={isChecked || indeterminate ? 'true' : 'false'}
            aria-hidden="true"
          >
            {/* check/dash icon rendered via CSS */}
          </span>
        </span>
        {label && (
          <label
            id={labelId}
            htmlFor={inputId}
            data-part="label"
            data-disabled={disabled ? 'true' : 'false'}
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
export default Checkbox;
