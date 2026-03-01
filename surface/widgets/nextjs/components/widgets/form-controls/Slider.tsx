'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { interactionReducer, type InteractionState, type InteractionAction } from './Slider.reducer.js';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current value */
  value?: number;
  /** Default value when uncontrolled */
  defaultValue?: number;
  /** Minimum value (default 0) */
  min?: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Step size (default 1) */
  step?: number;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
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

export const Slider = forwardRef<HTMLDivElement, SliderProps>(function Slider(
  {
    value: valueProp,
    defaultValue = 0,
    min = 0,
    max = 100,
    step = 1,
    orientation = 'horizontal',
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
  const trackRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange,
  });

  const [interactionState, dispatch] = useReducer(interactionReducer, 'idle');

  const clamp = useCallback(
    (v: number) => {
      const stepped = Math.round(v / step) * step;
      return Math.min(max, Math.max(min, stepped));
    },
    [min, max, step],
  );

  const percent = ((value - min) / (max - min)) * 100;

  const getValueFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio =
        orientation === 'horizontal'
          ? (clientX - rect.left) / rect.width
          : 1 - (clientY - rect.top) / rect.height;
      return clamp(min + ratio * (max - min));
    },
    [orientation, min, max, value, clamp],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled) return;
      dispatch({ type: 'POINTER_DOWN' });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const next = getValueFromPointer(e.clientX, e.clientY);
      setValue(next);
    },
    [disabled, getValueFromPointer, setValue],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (interactionState !== 'dragging' || disabled) return;
      const next = getValueFromPointer(e.clientX, e.clientY);
      setValue(next);
    },
    [interactionState, disabled, getValueFromPointer, setValue],
  );

  const handlePointerUp = useCallback(() => {
    dispatch({ type: 'POINTER_UP' });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      let next = value;
      const largeStep = step * 10;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          next = clamp(value + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          next = clamp(value - step);
          break;
        case 'Home':
          e.preventDefault();
          next = min;
          break;
        case 'End':
          e.preventDefault();
          next = max;
          break;
        case 'PageUp':
          e.preventDefault();
          next = clamp(value + largeStep);
          break;
        case 'PageDown':
          e.preventDefault();
          next = clamp(value - largeStep);
          break;
        default:
          return;
      }
      setValue(next);
    },
    [disabled, value, step, min, max, clamp, setValue],
  );

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="slider"
      data-part="root"
      data-orientation={orientation}
      data-state={interactionState === 'dragging' ? 'dragging' : 'idle'}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      className={className}
      {...rest}
    >
      <label data-part="label">{label}</label>

      <div
        ref={trackRef}
        data-part="track"
        data-orientation={orientation}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          data-part="range"
          data-orientation={orientation}
          style={{
            width: isHorizontal ? `${percent}%` : '100%',
            height: !isHorizontal ? `${percent}%` : '100%',
          }}
        />
        <div
          data-part="thumb"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          data-state={interactionState === 'dragging' ? 'dragging' : 'idle'}
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={String(value)}
          aria-orientation={orientation}
          aria-disabled={disabled ? 'true' : 'false'}
          style={{
            left: isHorizontal ? `${percent}%` : '50%',
            bottom: !isHorizontal ? `${percent}%` : 'auto',
          }}
          onFocus={() => dispatch({ type: 'FOCUS' })}
          onBlur={() => dispatch({ type: 'BLUR' })}
          onKeyDown={handleKeyDown}
        />
      </div>

      <output data-part="output" aria-live="polite" htmlFor="">
        {value}
      </output>

      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
});

Slider.displayName = 'Slider';
export default Slider;
