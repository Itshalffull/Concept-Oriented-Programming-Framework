'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { sliderReducer } from './RangeSlider.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface RangeSliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Lower bound of the track. */
  min?: number;
  /** Upper bound of the track. */
  max?: number;
  /** Current minimum value. */
  valueMin?: number;
  /** Default minimum value (uncontrolled). */
  defaultValueMin?: number;
  /** Current maximum value. */
  valueMax?: number;
  /** Default maximum value (uncontrolled). */
  defaultValueMax?: number;
  /** Step increment. */
  step?: number;
  /** Minimum distance between the two thumbs. */
  minRange?: number;
  /** Accessible label. */
  label: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Form field name. */
  name?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when either value changes. */
  onChange?: (values: { min: number; max: number }) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const RangeSlider = forwardRef<HTMLDivElement, RangeSliderProps>(function RangeSlider(
  {
    min = 0,
    max = 100,
    valueMin: controlledMin,
    defaultValueMin = 25,
    valueMax: controlledMax,
    defaultValueMax = 75,
    step = 1,
    minRange,
    label,
    disabled = false,
    name,
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [valMin, setValMin] = useControllableState({
    value: controlledMin,
    defaultValue: defaultValueMin,
    onChange: (v) => onChange?.({ min: v, max: valMax }),
  });

  const [valMax, setValMax] = useControllableState({
    value: controlledMax,
    defaultValue: defaultValueMax,
    onChange: (v) => onChange?.({ min: valMin, max: v }),
  });

  const [interaction, send] = useReducer(sliderReducer, 'idle');
  const trackRef = useRef<HTMLDivElement>(null);

  const percent = (v: number) => ((v - min) / (max - min)) * 100;

  const snapToStep = useCallback(
    (v: number) => {
      const snapped = Math.round((v - min) / step) * step + min;
      return Math.max(min, Math.min(max, snapped));
    },
    [min, max, step],
  );

  const clampMin = useCallback(
    (v: number) => {
      const upper = minRange != null ? valMax - minRange : valMax;
      return Math.max(min, Math.min(v, upper));
    },
    [min, valMax, minRange],
  );

  const clampMax = useCallback(
    (v: number) => {
      const lower = minRange != null ? valMin + minRange : valMin;
      return Math.max(lower, Math.min(v, max));
    },
    [max, valMin, minRange],
  );

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return snapToStep(min + ratio * (max - min));
    },
    [min, max, snapToStep],
  );

  const handlePointerDown = useCallback(
    (thumb: 'min' | 'max') => (e: PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      send({ type: thumb === 'min' ? 'POINTER_DOWN_MIN' : 'POINTER_DOWN_MAX' });
    },
    [disabled],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (interaction === 'draggingMin') {
        setValMin(clampMin(valueFromPointer(e.clientX)));
      } else if (interaction === 'draggingMax') {
        setValMax(clampMax(valueFromPointer(e.clientX)));
      }
    },
    [interaction, valueFromPointer, clampMin, clampMax, setValMin, setValMax],
  );

  const handlePointerUp = useCallback(() => {
    send({ type: 'POINTER_UP' });
  }, []);

  const handleKeyDown = useCallback(
    (thumb: 'min' | 'max') => (e: KeyboardEvent) => {
      if (disabled) return;
      const largeStep = step * 10;
      const setter = thumb === 'min' ? setValMin : setValMax;
      const clamper = thumb === 'min' ? clampMin : clampMax;
      const current = thumb === 'min' ? valMin : valMax;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          setter(clamper(snapToStep(current + step)));
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          setter(clamper(snapToStep(current - step)));
          break;
        case 'PageUp':
          e.preventDefault();
          setter(clamper(snapToStep(current + largeStep)));
          break;
        case 'PageDown':
          e.preventDefault();
          setter(clamper(snapToStep(current - largeStep)));
          break;
        case 'Home':
          e.preventDefault();
          setter(clamper(min));
          break;
        case 'End':
          e.preventDefault();
          setter(clamper(max));
          break;
      }
    },
    [disabled, step, valMin, valMax, min, max, snapToStep, clampMin, clampMax, setValMin, setValMax],
  );

  const thumbMinState = interaction === 'draggingMin' ? 'dragging' : interaction === 'focusedMin' ? 'focused' : 'idle';
  const thumbMaxState = interaction === 'draggingMax' ? 'dragging' : interaction === 'focusedMax' ? 'focused' : 'idle';
  const isDragging = interaction === 'draggingMin' || interaction === 'draggingMax';

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-part="root"
      data-state={isDragging ? 'dragging' : 'idle'}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="range-slider"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      {...rest}
    >
      <label data-part="label">{label}</label>

      <div ref={trackRef} data-part="track" data-disabled={disabled ? 'true' : 'false'}>
        <div
          data-part="range"
          data-state={isDragging ? 'dragging' : 'idle'}
          style={{
            left: `${percent(valMin)}%`,
            width: `${percent(valMax) - percent(valMin)}%`,
          }}
        />
      </div>

      {/* Thumb Min */}
      <span
        role="slider"
        aria-label={`${label} minimum`}
        aria-valuenow={valMin}
        aria-valuemin={min}
        aria-valuemax={minRange != null ? valMax - minRange : valMax}
        aria-valuetext={String(valMin)}
        aria-orientation="horizontal"
        aria-disabled={disabled ? 'true' : 'false'}
        data-part="thumb-min"
        data-state={thumbMinState}
        style={{ left: `${percent(valMin)}%` }}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown('min')}
        onFocus={() => send({ type: 'FOCUS_MIN' })}
        onBlur={() => send({ type: 'BLUR' })}
        onKeyDown={handleKeyDown('min')}
      />

      {/* Thumb Max */}
      <span
        role="slider"
        aria-label={`${label} maximum`}
        aria-valuenow={valMax}
        aria-valuemin={minRange != null ? valMin + minRange : valMin}
        aria-valuemax={max}
        aria-valuetext={String(valMax)}
        aria-orientation="horizontal"
        aria-disabled={disabled ? 'true' : 'false'}
        data-part="thumb-max"
        data-state={thumbMaxState}
        style={{ left: `${percent(valMax)}%` }}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown('max')}
        onFocus={() => send({ type: 'FOCUS_MAX' })}
        onBlur={() => send({ type: 'BLUR' })}
        onKeyDown={handleKeyDown('max')}
      />

      <output data-part="output-min" aria-live="polite">{valMin}</output>
      <output data-part="output-max" aria-live="polite">{valMax}</output>

      {name && (
        <>
          <input type="hidden" name={`${name}-min`} value={valMin} />
          <input type="hidden" name={`${name}-max`} value={valMax} />
        </>
      )}
    </div>
  );
});

RangeSlider.displayName = 'RangeSlider';
export { RangeSlider };
export default RangeSlider;
