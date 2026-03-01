'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { itemReducer, type ItemState, type ItemAction } from './CheckboxGroup.reducer.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CheckboxGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected values */
  values?: string[];
  /** Default values when uncontrolled */
  defaultValues?: string[];
  /** Available options */
  options: OptionItem[];
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Form field name */
  name?: string;
  /** Minimum selections */
  min?: number;
  /** Maximum selections */
  max?: number;
  /** Change callback */
  onChange?: (values: string[]) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(
  function CheckboxGroup(
    {
      values: valuesProp,
      defaultValues = [],
      options,
      orientation = 'vertical',
      label,
      disabled = false,
      required = false,
      name: nameProp,
      min,
      max,
      onChange,
      size = 'md',
      className,
      ...rest
    },
    ref,
  ) {
    const uid = useId();
    const groupName = nameProp ?? uid;
    const labelId = `${uid}-label`;

    const [values, setValues] = useControllableState({
      value: valuesProp,
      defaultValue: defaultValues,
      onChange,
    });

    const [_itemState, dispatchItem] = useReducer(itemReducer, 'unchecked');

    const handleToggle = useCallback(
      (optionValue: string) => {
        if (disabled) return;
        const isChecked = values.includes(optionValue);

        if (isChecked) {
          if (min !== undefined && values.length <= min) return;
          dispatchItem({ type: 'UNCHECK' });
          setValues(values.filter((v) => v !== optionValue));
        } else {
          if (max !== undefined && values.length >= max) return;
          dispatchItem({ type: 'CHECK' });
          setValues([...values, optionValue]);
        }
      },
      [disabled, values, min, max, setValues],
    );

    return (
      <div
        ref={ref}
        role="group"
        aria-label={label}
        aria-orientation={orientation}
        aria-required={required ? 'true' : 'false'}
        data-surface-widget=""
        data-widget-name="checkbox-group"
        data-part="root"
        data-orientation={orientation}
        data-disabled={disabled ? 'true' : 'false'}
        data-size={size}
        className={className}
        {...rest}
      >
        <span data-part="label" id={labelId}>
          {label}
        </span>

        <div
          data-part="items"
          data-orientation={orientation}
          aria-labelledby={labelId}
        >
          {options.map((option) => {
            const isChecked = values.includes(option.value);
            const isDisabled = option.disabled || disabled;
            const optionId = `${uid}-${option.value}`;

            return (
              <label
                key={option.value}
                data-part="item"
                data-state={isChecked ? 'checked' : 'unchecked'}
                data-disabled={isDisabled ? 'true' : 'false'}
              >
                <input
                  type="checkbox"
                  data-part="itemInput"
                  id={optionId}
                  name={`${groupName}[]`}
                  value={option.value}
                  checked={isChecked}
                  disabled={isDisabled}
                  role="checkbox"
                  aria-checked={isChecked ? 'true' : 'false'}
                  aria-disabled={isDisabled ? 'true' : 'false'}
                  aria-label={option.label}
                  onChange={() => handleToggle(option.value)}
                  style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
                />
                <span
                  data-part="itemControl"
                  data-state={isChecked ? 'checked' : 'unchecked'}
                  data-disabled={isDisabled ? 'true' : 'false'}
                  aria-hidden="true"
                />
                <span data-part="itemLabel">{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  },
);

CheckboxGroup.displayName = 'CheckboxGroup';
export default CheckboxGroup;
