'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { itemReducer, type ItemState, type ItemAction } from './RadioGroup.reducer.js';

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

export interface RadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
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
  /** Change callback */
  onChange?: (value: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  {
    value: valueProp,
    defaultValue = '',
    options,
    orientation = 'vertical',
    label,
    disabled = false,
    required = false,
    name: nameProp,
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

  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const [_itemState, dispatchItem] = useReducer(itemReducer, 'unselected');

  const handleChange = useCallback(
    (optionValue: string) => {
      if (disabled) return;
      dispatchItem({ type: 'SELECT' });
      setValue(optionValue);
    },
    [disabled, setValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledOptions = options.filter((o) => !o.disabled && !disabled);
      if (enabledOptions.length === 0) return;
      const currentIndex = enabledOptions.findIndex((o) => o.value === value);
      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          nextIndex = (currentIndex + 1) % enabledOptions.length;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          nextIndex = (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
          break;
        case ' ':
          e.preventDefault();
          if (currentIndex >= 0) return;
          nextIndex = 0;
          break;
        default:
          return;
      }

      const nextOption = enabledOptions[nextIndex];
      if (nextOption) {
        handleChange(nextOption.value);
        // Focus the corresponding radio input
        const radio = document.querySelector(
          `input[name="${groupName}"][value="${nextOption.value}"]`,
        ) as HTMLInputElement | null;
        radio?.focus();
      }
    },
    [options, disabled, value, groupName, handleChange],
  );

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      aria-orientation={orientation}
      aria-required={required ? 'true' : 'false'}
      data-surface-widget=""
      data-widget-name="radio-group"
      data-part="root"
      data-orientation={orientation}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      className={className}
      onKeyDown={handleKeyDown}
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
          const isSelected = option.value === value;
          const isDisabled = option.disabled || disabled;
          const optionId = `${uid}-${option.value}`;

          return (
            <label
              key={option.value}
              data-part="item"
              data-state={isSelected ? 'selected' : 'unselected'}
              data-disabled={isDisabled ? 'true' : 'false'}
            >
              <input
                type="radio"
                data-part="itemInput"
                id={optionId}
                name={groupName}
                value={option.value}
                checked={isSelected}
                disabled={isDisabled}
                role="radio"
                aria-checked={isSelected ? 'true' : 'false'}
                aria-disabled={isDisabled ? 'true' : 'false'}
                aria-label={option.label}
                tabIndex={isSelected ? 0 : -1}
                onChange={() => handleChange(option.value)}
                style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
              />
              <span
                data-part="itemControl"
                data-state={isSelected ? 'selected' : 'unselected'}
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
});

RadioGroup.displayName = 'RadioGroup';
export default RadioGroup;
