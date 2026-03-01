'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { ratingReducer } from './Rating.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface RatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current rating value. */
  value?: number;
  /** Default (uncontrolled) rating value. */
  defaultValue?: number;
  /** Maximum number of stars. */
  max?: number;
  /** Allow half-star precision. */
  half?: boolean;
  /** Read-only display mode. */
  readOnly?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Accessible label for the rating group. */
  label?: string;
  /** Form field name. */
  name?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when value changes. */
  onChange?: (value: number) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Rating = forwardRef<HTMLDivElement, RatingProps>(function Rating(
  {
    value: controlledValue,
    defaultValue = 0,
    max = 5,
    half = false,
    readOnly = false,
    disabled = false,
    required = false,
    label = 'Rating',
    name,
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControllableState({
    value: controlledValue,
    defaultValue,
    onChange,
  });

  const [machine, send] = useReducer(ratingReducer, {
    interaction: 'idle',
    previewValue: 0,
  });

  const focusedIndexRef = useRef(0);
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const step = half ? 0.5 : 1;

  const clamp = useCallback(
    (v: number) => Math.max(0, Math.min(v, max)),
    [max],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, itemValue: number) => {
      if (readOnly || disabled) return;
      let next = value;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = clamp(value + step);
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          next = clamp(value - step);
          e.preventDefault();
          break;
        case 'Home':
          next = 0;
          e.preventDefault();
          break;
        case 'End':
          next = max;
          e.preventDefault();
          break;
        default:
          return;
      }
      setValue(next);
      // Move focus to nearest item
      const idx = Math.max(0, Math.ceil(next) - 1);
      focusedIndexRef.current = idx;
      itemRefs.current[idx]?.focus();
    },
    [readOnly, disabled, value, step, clamp, max, setValue],
  );

  const items = Array.from({ length: max }, (_, i) => i + 1);

  const getItemState = (itemValue: number): 'filled' | 'half' | 'empty' => {
    if (itemValue <= value) return 'filled';
    if (half && itemValue - 0.5 <= value) return 'half';
    return 'empty';
  };

  const isHighlighted = (itemValue: number): boolean =>
    machine.interaction === 'hovering' && itemValue <= machine.previewValue;

  const isHalfHighlighted = (itemValue: number): boolean =>
    machine.interaction === 'hovering' &&
    half &&
    itemValue - 0.5 <= machine.previewValue &&
    itemValue > machine.previewValue;

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      aria-required={required ? 'true' : 'false'}
      aria-disabled={disabled || readOnly ? 'true' : 'false'}
      data-part="root"
      data-state={machine.interaction}
      data-disabled={disabled ? 'true' : 'false'}
      data-readonly={readOnly ? 'true' : 'false'}
      data-value={value}
      data-max={max}
      data-size={size}
      data-surface-widget=""
      data-widget-name="rating"
      onMouseLeave={() => send({ type: 'HOVER_OUT' })}
      {...rest}
    >
      {name && <input type="hidden" name={name} value={value} />}
      {items.map((itemValue, index) => {
        const itemState = getItemState(itemValue);
        const isFocused = focusedIndexRef.current === index;

        return (
          <span
            key={itemValue}
            ref={(el) => { itemRefs.current[index] = el; }}
            role="radio"
            aria-checked={
              itemValue === Math.ceil(value) && getItemState(itemValue) !== 'empty'
                ? 'true'
                : half && itemValue - 0.5 === value
                  ? 'mixed'
                  : 'false'
            }
            aria-label={`${itemValue} of ${max} stars`}
            aria-disabled={disabled || readOnly ? 'true' : 'false'}
            aria-posinset={index + 1}
            aria-setsize={max}
            data-part="item"
            data-state={itemState}
            data-highlighted={isHighlighted(itemValue) ? 'true' : 'false'}
            data-half-highlighted={isHalfHighlighted(itemValue) ? 'true' : 'false'}
            tabIndex={isFocused ? 0 : -1}
            onClick={() => {
              if (readOnly || disabled) return;
              setValue(itemValue);
              send({ type: 'CLICK' });
            }}
            onMouseEnter={() => {
              if (readOnly || disabled) return;
              send({ type: 'HOVER', previewValue: itemValue });
            }}
            onFocus={() => {
              focusedIndexRef.current = index;
              send({ type: 'FOCUS' });
            }}
            onBlur={() => send({ type: 'BLUR' })}
            onKeyDown={(e) => handleKeyDown(e, itemValue)}
          >
            <span data-part="icon" data-state={itemState} aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
});

Rating.displayName = 'Rating';
export { Rating };
export default Rating;
