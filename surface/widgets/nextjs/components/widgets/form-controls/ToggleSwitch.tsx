'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { toggleReducer, type ToggleState, type ToggleAction } from './ToggleSwitch.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ToggleSwitchProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Checked state */
  checked?: boolean;
  /** Default checked when uncontrolled */
  defaultChecked?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Visible label */
  label: string;
  /** Form field name */
  name?: string;
  /** Required state */
  required?: boolean;
  /** Change callback */
  onChange?: (checked: boolean) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ToggleSwitch = forwardRef<HTMLDivElement, ToggleSwitchProps>(function ToggleSwitch(
  {
    checked: checkedProp,
    defaultChecked = false,
    disabled = false,
    label,
    name,
    required = false,
    onChange,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  const uid = useId();

  const [checked, setChecked] = useControllableState({
    value: checkedProp,
    defaultValue: defaultChecked,
    onChange,
  });

  const [toggleState, dispatchToggle] = useReducer(
    toggleReducer,
    checked ? 'on' : 'off',
  );

  const handleToggle = useCallback(() => {
    if (disabled) return;
    dispatchToggle({ type: 'TOGGLE' });
    setChecked(!checked);
  }, [disabled, checked, setChecked]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  const stateValue = checked ? 'on' : 'off';

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="toggle-switch"
      data-part="root"
      data-state={stateValue}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      className={className}
      onClick={handleToggle}
      {...rest}
    >
      <input
        type="checkbox"
        id={uid}
        data-part="input"
        role="switch"
        checked={checked}
        disabled={disabled}
        required={required}
        name={name}
        aria-checked={checked ? 'true' : 'false'}
        aria-label={label}
        aria-disabled={disabled ? 'true' : 'false'}
        onChange={handleToggle}
        onKeyDown={handleKeyDown}
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      />

      <div
        data-part="control"
        data-state={stateValue}
        data-disabled={disabled ? 'true' : 'false'}
      >
        <div
          data-part="thumb"
          data-state={stateValue}
          style={{
            transform: checked ? 'translateX(100%)' : 'translateX(0)',
          }}
        />
      </div>

      <label data-part="label" htmlFor={uid}>
        {label}
      </label>
    </div>
  );
});

ToggleSwitch.displayName = 'ToggleSwitch';
export default ToggleSwitch;
