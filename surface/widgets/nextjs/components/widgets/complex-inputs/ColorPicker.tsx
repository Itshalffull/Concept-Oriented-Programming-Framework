'use client';

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
