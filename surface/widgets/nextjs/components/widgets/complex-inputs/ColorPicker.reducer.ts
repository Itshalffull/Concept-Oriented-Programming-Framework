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
