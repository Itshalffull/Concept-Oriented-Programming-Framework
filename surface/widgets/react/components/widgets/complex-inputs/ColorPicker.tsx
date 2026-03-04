/* ---------------------------------------------------------------------------
 * Color helpers
 * ------------------------------------------------------------------------- */

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/* ---------------------------------------------------------------------------
 * State machine
 * Popover: closed (initial) -> open
 * Interaction: idle (initial) -> selectingArea, selectingSlider
 * Focus: unfocused (initial) -> focused
 * ------------------------------------------------------------------------- */

export type PopoverState = 'closed' | 'open';
export type InteractionState = 'idle' | 'selectingArea' | 'selectingSlider';
export type FocusState = 'unfocused' | 'focused';

export interface ColorMachine {
  popover: PopoverState;
  interaction: InteractionState;
  focus: FocusState;
  hue: number;
  saturation: number;
  lightness: number;
}

export type ColorEvent =
  | { type: 'TRIGGER_CLICK' }
  | { type: 'CLOSE' }
  | { type: 'ESCAPE' }
  | { type: 'OUTSIDE_CLICK' }
  | { type: 'AREA_POINTER_DOWN' }
  | { type: 'SLIDER_POINTER_DOWN' }
  | { type: 'POINTER_UP' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'SET_HUE'; value: number }
  | { type: 'SET_SATURATION'; value: number }
  | { type: 'SET_LIGHTNESS'; value: number }
  | { type: 'INCREASE_SATURATION' }
  | { type: 'DECREASE_SATURATION' }
  | { type: 'INCREASE_LIGHTNESS' }
  | { type: 'DECREASE_LIGHTNESS' }
  | { type: 'INCREASE_HUE' }
  | { type: 'DECREASE_HUE' };

export function colorReducer(state: ColorMachine, event: ColorEvent): ColorMachine {
  const s = { ...state };
  const step = 1;

  switch (event.type) {
    case 'TRIGGER_CLICK':
      s.popover = s.popover === 'closed' ? 'open' : 'closed';
      break;
    case 'CLOSE':
    case 'ESCAPE':
    case 'OUTSIDE_CLICK':
      s.popover = 'closed';
      break;
    case 'AREA_POINTER_DOWN':
      s.interaction = 'selectingArea';
      break;
    case 'SLIDER_POINTER_DOWN':
      s.interaction = 'selectingSlider';
      break;
    case 'POINTER_UP':
      s.interaction = 'idle';
      break;
    case 'FOCUS':
      s.focus = 'focused';
      break;
    case 'BLUR':
      s.focus = 'unfocused';
      break;
    case 'SET_HUE':
      s.hue = Math.max(0, Math.min(360, event.value));
      break;
    case 'SET_SATURATION':
      s.saturation = Math.max(0, Math.min(100, event.value));
      break;
    case 'SET_LIGHTNESS':
      s.lightness = Math.max(0, Math.min(100, event.value));
      break;
    case 'INCREASE_SATURATION':
      s.saturation = Math.min(100, s.saturation + step);
      break;
    case 'DECREASE_SATURATION':
      s.saturation = Math.max(0, s.saturation - step);
      break;
    case 'INCREASE_LIGHTNESS':
      s.lightness = Math.min(100, s.lightness + step);
      break;
    case 'DECREASE_LIGHTNESS':
      s.lightness = Math.max(0, s.lightness - step);
      break;
    case 'INCREASE_HUE':
      s.hue = (s.hue + step) % 360;
      break;
    case 'DECREASE_HUE':
      s.hue = (s.hue - step + 360) % 360;
      break;
  }

  return s;
}


import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useControllableState } from '../shared/useControllableState.js';
import { useFloatingPosition } from '../shared/useFloatingPosition.js';
import { useOutsideClick } from '../shared/useOutsideClick.js';
import { colorReducer, hexToHsl, hslToHex } from './ColorPicker.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ColorPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current color value (hex string). */
  value?: string;
  /** Default (uncontrolled) color value. */
  defaultValue?: string;
  /** Color format for the input field. */
  format?: 'hex' | 'rgb' | 'hsl' | 'oklch';
  /** Preset swatch colors. */
  swatches?: string[];
  /** Disabled state. */
  disabled?: boolean;
  /** Form field name. */
  name?: string;
  /** Show alpha channel controls. */
  alpha?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when value changes. */
  onChange?: (color: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
  {
    value: controlledValue,
    defaultValue = '#000000',
    format = 'hex',
    swatches,
    disabled = false,
    name,
    alpha = false,
    size = 'md',
    onChange,
    ...rest
  },
  ref,
) {
  const [colorValue, setColorValue] = useControllableState({
    value: controlledValue,
    defaultValue,
    onChange,
  });

  const initHsl = hexToHsl(colorValue);
  const [machine, send] = useReducer(colorReducer, {
    popover: 'closed',
    interaction: 'idle',
    focus: 'unfocused',
    hue: initHsl.h,
    saturation: initHsl.s,
    lightness: initHsl.l,
  });

  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useFloatingPosition(triggerRef, floatingRef, {
    placement: 'bottom-start',
    enabled: machine.popover === 'open',
  });

  useOutsideClick(floatingRef, () => {
    if (machine.popover === 'open') send({ type: 'OUTSIDE_CLICK' });
  }, machine.popover === 'open');

  const commitColor = useCallback(() => {
    const hex = hslToHex(machine.hue, machine.saturation, machine.lightness);
    setColorValue(hex);
  }, [machine.hue, machine.saturation, machine.lightness, setColorValue]);

  const handleAreaPointer = useCallback(
    (e: PointerEvent) => {
      const area = areaRef.current;
      if (!area || disabled) return;
      const rect = area.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      send({ type: 'SET_SATURATION', value: Math.round(x * 100) });
      send({ type: 'SET_LIGHTNESS', value: Math.round((1 - y) * 100) });
    },
    [disabled],
  );

  const handleAreaPointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      send({ type: 'AREA_POINTER_DOWN' });
      handleAreaPointer(e);
    },
    [disabled, handleAreaPointer],
  );

  const handleAreaPointerMove = useCallback(
    (e: PointerEvent) => {
      if (machine.interaction === 'selectingArea') handleAreaPointer(e);
    },
    [machine.interaction, handleAreaPointer],
  );

  const handlePointerUp = useCallback(() => {
    send({ type: 'POINTER_UP' });
    commitColor();
  }, [commitColor]);

  const handleHueSliderPointer = useCallback(
    (e: PointerEvent) => {
      const target = (e.currentTarget as HTMLElement);
      const rect = target.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      send({ type: 'SET_HUE', value: Math.round(x * 360) });
    },
    [],
  );

  const handleAreaThumbKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); send({ type: 'INCREASE_LIGHTNESS' }); commitColor(); break;
        case 'ArrowDown': e.preventDefault(); send({ type: 'DECREASE_LIGHTNESS' }); commitColor(); break;
        case 'ArrowLeft': e.preventDefault(); send({ type: 'DECREASE_SATURATION' }); commitColor(); break;
        case 'ArrowRight': e.preventDefault(); send({ type: 'INCREASE_SATURATION' }); commitColor(); break;
      }
    },
    [commitColor],
  );

  const handleHueKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault(); send({ type: 'INCREASE_HUE' }); commitColor(); break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault(); send({ type: 'DECREASE_HUE' }); commitColor(); break;
      }
    },
    [commitColor],
  );

  const handleInputCommit = useCallback(
    (inputValue: string) => {
      if (/^#[0-9a-fA-F]{6}$/.test(inputValue)) {
        setColorValue(inputValue);
        const hsl = hexToHsl(inputValue);
        send({ type: 'SET_HUE', value: hsl.h });
        send({ type: 'SET_SATURATION', value: hsl.s });
        send({ type: 'SET_LIGHTNESS', value: hsl.l });
      }
    },
    [setColorValue],
  );

  const handleSwatchClick = useCallback(
    (color: string) => {
      setColorValue(color);
      const hsl = hexToHsl(color);
      send({ type: 'SET_HUE', value: hsl.h });
      send({ type: 'SET_SATURATION', value: hsl.s });
      send({ type: 'SET_LIGHTNESS', value: hsl.l });
    },
    [setColorValue],
  );

  const handleEyedropper = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).EyeDropper?.().open();
      if (result?.sRGBHex) handleSwatchClick(result.sRGBHex);
    } catch {
      // User cancelled or not supported
    }
  }, [handleSwatchClick]);

  const isOpen = machine.popover === 'open';
  const currentHex = hslToHex(machine.hue, machine.saturation, machine.lightness);
  const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  return (
    <div
      ref={ref}
      data-part="root"
      data-state={isOpen ? 'open' : 'closed'}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="color-picker"
      {...rest}
    >
      <button
        ref={triggerRef}
        type="button"
        data-part="trigger"
        aria-label="Select color"
        aria-haspopup="dialog"
        aria-expanded={isOpen ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => send({ type: 'TRIGGER_CLICK' })}
      >
        <span
          data-part="swatch"
          aria-hidden="true"
          style={{ backgroundColor: colorValue }}
        />
      </button>

      {name && <input type="hidden" name={name} value={colorValue} />}

      {isOpen && (
        <div data-part="positioner" data-state="open" data-placement="bottom-start">
          <div
            ref={floatingRef}
            id={contentId}
            role="dialog"
            aria-modal="true"
            aria-label="Color picker"
            data-part="content"
            data-state="open"
          >
            {/* Saturation/Lightness area */}
            <div
              ref={areaRef}
              data-part="area"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${machine.hue}, 100%, 50%))`,
              }}
              onPointerDown={handleAreaPointerDown}
              onPointerMove={handleAreaPointerMove}
              onPointerUp={handlePointerUp}
            >
              <span
                role="slider"
                aria-label="Color area selector"
                aria-valuetext={`Saturation ${machine.saturation}%, Lightness ${machine.lightness}%`}
                data-part="area-thumb"
                data-state={machine.interaction === 'selectingArea' ? 'dragging' : 'idle'}
                style={{
                  left: `${machine.saturation}%`,
                  top: `${100 - machine.lightness}%`,
                  backgroundColor: currentHex,
                }}
                tabIndex={0}
                onKeyDown={handleAreaThumbKeyDown}
              />
            </div>

            {/* Hue slider */}
            <div
              data-part="channel-slider"
              data-channel="hue"
              onPointerDown={(e) => {
                e.preventDefault();
                send({ type: 'SLIDER_POINTER_DOWN' });
                handleHueSliderPointer(e);
              }}
              onPointerMove={(e) => {
                if (machine.interaction === 'selectingSlider') handleHueSliderPointer(e);
              }}
              onPointerUp={handlePointerUp}
            >
              <div
                data-part="channel-slider-track"
                data-channel="hue"
                style={{
                  background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                }}
              />
              <span
                role="slider"
                aria-label="Hue slider thumb"
                aria-valuenow={machine.hue}
                aria-valuemin={0}
                aria-valuemax={360}
                data-part="channel-slider-thumb"
                data-state={machine.interaction === 'selectingSlider' ? 'dragging' : 'idle'}
                style={{ left: `${(machine.hue / 360) * 100}%` }}
                tabIndex={0}
                onKeyDown={handleHueKeyDown}
              />
            </div>

            {/* Alpha slider */}
            {alpha && (
              <div data-part="channel-slider" data-channel="alpha">
                <div data-part="channel-slider-track" data-channel="alpha" />
                <span
                  role="slider"
                  aria-label="Alpha slider thumb"
                  aria-valuenow={100}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  data-part="channel-slider-thumb"
                  tabIndex={0}
                />
              </div>
            )}

            {/* Hex input */}
            <input
              data-part="input"
              aria-label={`Color value (${format})`}
              value={currentHex}
              onChange={() => {}}
              onBlur={(e) => handleInputCommit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInputCommit((e.target as HTMLInputElement).value);
              }}
            />

            {/* Swatch group */}
            {swatches && swatches.length > 0 && (
              <div role="group" aria-label="Preset colors" data-part="swatch-group">
                {swatches.map((swatch, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Select color ${swatch}`}
                    data-part="swatch-trigger"
                    style={{ backgroundColor: swatch }}
                    tabIndex={0}
                    onClick={() => handleSwatchClick(swatch)}
                  />
                ))}
              </div>
            )}

            {/* Eyedropper */}
            <button
              type="button"
              data-part="eye-dropper-button"
              aria-label="Pick color from screen"
              disabled={!supportsEyeDropper}
              onClick={handleEyedropper}
            >
              &#x1F441;
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

ColorPicker.displayName = 'ColorPicker';
export { ColorPicker };
export default ColorPicker;
