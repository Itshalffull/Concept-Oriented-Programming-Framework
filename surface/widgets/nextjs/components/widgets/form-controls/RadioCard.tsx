'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { cardReducer, type CardState, type CardAction } from './RadioCard.reducer.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface RadioCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Available card options */
  options: RadioCardOption[];
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Number of grid columns (default 2) */
  columns?: number;
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

export const RadioCard = forwardRef<HTMLDivElement, RadioCardProps>(function RadioCard(
  {
    value: valueProp,
    defaultValue = '',
    options,
    label,
    disabled = false,
    required = false,
    columns = 2,
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

  const [_cardState, dispatchCard] = useReducer(cardReducer, 'unselected');

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (disabled) return;
      dispatchCard({ type: 'SELECT' });
      setValue(optionValue);
    },
    [disabled, setValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledOptions = options.filter(() => !disabled);
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
        handleSelect(nextOption.value);
        const radio = document.querySelector(
          `input[name="${groupName}"][value="${nextOption.value}"]`,
        ) as HTMLInputElement | null;
        radio?.focus();
      }
    },
    [options, disabled, value, groupName, handleSelect],
  );

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      aria-required={required ? 'true' : 'false'}
      data-surface-widget=""
      data-widget-name="radio-card"
      data-part="root"
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
        aria-labelledby={labelId}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          const descId = option.description ? `${uid}-${option.value}-desc` : undefined;

          return (
            <div
              key={option.value}
              data-part="card"
              data-state={isSelected ? 'selected' : 'unselected'}
              data-disabled={disabled ? 'true' : 'false'}
              onClick={() => !disabled && handleSelect(option.value)}
            >
              <input
                type="radio"
                data-part="cardInput"
                name={groupName}
                value={option.value}
                checked={isSelected}
                disabled={disabled}
                role="radio"
                aria-checked={isSelected ? 'true' : 'false'}
                aria-label={option.label}
                aria-describedby={descId}
                tabIndex={isSelected ? 0 : -1}
                onChange={() => handleSelect(option.value)}
                style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
              />

              <div
                data-part="cardContent"
                data-state={isSelected ? 'selected' : 'unselected'}
              >
                {option.icon && (
                  <span data-part="cardIcon" data-icon={option.icon} aria-hidden="true" />
                )}
                <span data-part="cardLabel">{option.label}</span>
                {option.description && (
                  <span data-part="cardDescription" id={descId}>
                    {option.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

RadioCard.displayName = 'RadioCard';
export default RadioCard;
