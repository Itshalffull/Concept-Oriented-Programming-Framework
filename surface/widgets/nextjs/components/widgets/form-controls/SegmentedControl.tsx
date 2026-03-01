'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useId,
  type HTMLAttributes,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { itemReducer, indicatorReducer, type ItemState, type ItemAction, type IndicatorState, type IndicatorAction } from './SegmentedControl.reducer.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SegmentOption {
  value: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Available segment options (minimum 2) */
  options: SegmentOption[];
  /** Size variant */
  size?: 'sm' | 'md';
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  function SegmentedControl(
    {
      value: valueProp,
      defaultValue,
      options,
      size = 'md',
      label,
      disabled = false,
      name,
      onChange,
      className,
      ...rest
    },
    ref,
  ) {
    const uid = useId();
    const itemsRef = useRef<HTMLDivElement>(null);

    const [value, setValue] = useControllableState({
      value: valueProp,
      defaultValue: defaultValue ?? (options[0]?.value ?? ''),
      onChange,
    });

    const [_itemState, dispatchItem] = useReducer(itemReducer, 'unselected');
    const [indicatorState, dispatchIndicator] = useReducer(indicatorReducer, 'idle');

    const handleSelect = useCallback(
      (optionValue: string) => {
        if (disabled || optionValue === value) return;
        dispatchItem({ type: 'SELECT' });
        dispatchIndicator({ type: 'ANIMATE' });
        setValue(optionValue);
        // End animation on next frame
        requestAnimationFrame(() => {
          dispatchIndicator({ type: 'ANIMATION_END' });
        });
      },
      [disabled, value, setValue],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent, currentValue: string) => {
        if (disabled) return;
        const currentIndex = options.findIndex((o) => o.value === currentValue);
        let nextIndex = currentIndex;

        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            nextIndex = (currentIndex + 1) % options.length;
            break;
          case 'ArrowLeft':
            e.preventDefault();
            nextIndex = (currentIndex - 1 + options.length) % options.length;
            break;
          case ' ':
          case 'Enter':
            e.preventDefault();
            handleSelect(currentValue);
            return;
          default:
            return;
        }

        const next = options[nextIndex];
        if (next) {
          handleSelect(next.value);
          const btn = itemsRef.current?.querySelector(
            `[data-value="${next.value}"]`,
          ) as HTMLButtonElement | null;
          btn?.focus();
        }
      },
      [disabled, options, handleSelect],
    );

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label={label}
        aria-orientation="horizontal"
        data-surface-widget=""
        data-widget-name="segmented-control"
        data-part="root"
        data-size={size}
        data-disabled={disabled ? 'true' : 'false'}
        className={className}
        {...rest}
      >
        <div ref={itemsRef} data-part="items" data-size={size}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                data-part="item"
                data-value={option.value}
                data-state={isSelected ? 'selected' : 'unselected'}
                data-disabled={disabled ? 'true' : 'false'}
                role="radio"
                aria-checked={isSelected ? 'true' : 'false'}
                aria-label={option.label}
                aria-disabled={disabled ? 'true' : 'false'}
                tabIndex={isSelected ? 0 : -1}
                disabled={disabled}
                onClick={() => handleSelect(option.value)}
                onKeyDown={(e) => handleKeyDown(e, option.value)}
              >
                <span data-part="itemLabel">{option.label}</span>
              </button>
            );
          })}

          <div
            data-part="indicator"
            data-animating={indicatorState === 'animating' ? 'true' : 'false'}
            aria-hidden="true"
          />
        </div>

        {name && <input type="hidden" name={name} value={value} />}
      </div>
    );
  },
);

SegmentedControl.displayName = 'SegmentedControl';
export default SegmentedControl;
