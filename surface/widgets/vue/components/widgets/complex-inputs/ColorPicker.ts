// ============================================================
// ColorPicker -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  computed,
} from 'vue';

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface ColorPickerProps {
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

export const ColorPicker = defineComponent({
  name: 'ColorPicker',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '#000000' },
    format: { type: String, default: 'hex' },
    swatches: { type: Array as PropType<any[]> },
    disabled: { type: Boolean, default: false },
    name: { type: String },
    alpha: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const machine = ref<any>({ popover: 'closed', interaction: 'idle', focus: 'unfocused', hue: initHsl.h, saturation: initHsl.s, lightness: initHsl.l, });
    const send = (action: any) => { /* state machine dispatch */ };
    const triggerRef = ref<any>(null);
    const floatingRef = ref<any>(null);
    const areaRef = ref<any>(null);
    const colorValueInternal = ref<any>(undefined);
    const colorValue = computed(() => props.value !== undefined ? props.value : colorValueInternal.value ?? props.undefined);
    const setColorValue = (v: any) => { colorValueInternal.value = v; };
    const commitColor = () => {
    const hex = hslToHex(machine.value.hue, machine.value.saturation, machine.value.lightness);
    setColorValue(hex);
  }, [machine.value.hue, machine.value.saturation, machine.value.lightness, setColorValue]);

  const handleAreaPointer = (e: PointerEvent) => {
      const area = areaRef.value;
      if (!area || props.disabled) return;
      const rect = area.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      send({ type: 'SET_SATURATION', value: Math.round(x * 100) });
      send({ type: 'SET_LIGHTNESS', value: Math.round((1 - y) * 100) });
    };

  const handleAreaPointerDown = (e: PointerEvent) => {
      if (props.disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      send({ type: 'AREA_POINTER_DOWN' });
      handleAreaPointer(e);
    };

  const handleAreaPointerMove = (e: PointerEvent) => {
      if (machine.value.interaction === 'selectingArea') handleAreaPointer(e);
    };

  const handlePointerUp = () => {
    send({ type: 'POINTER_UP' });
    commitColor();
  };
    const handleHueSliderPointer = (e: PointerEvent) => {
      const target = (e.currentTarget as HTMLElement);
      const rect = target.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      send({ type: 'SET_HUE', value: Math.round(x * 360) });
    };

  const handleAreaThumbKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); send({ type: 'INCREASE_LIGHTNESS' }); commitColor(); break;
        case 'ArrowDown': e.preventDefault(); send({ type: 'DECREASE_LIGHTNESS' }); commitColor(); break;
        case 'ArrowLeft': e.preventDefault(); send({ type: 'DECREASE_SATURATION' }); commitColor(); break;
        case 'ArrowRight': e.preventDefault(); send({ type: 'INCREASE_SATURATION' }); commitColor(); break;
      }
    };

  const handleHueKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault(); send({ type: 'INCREASE_HUE' }); commitColor(); break;
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault(); send({ type: 'DECREASE_HUE' }); commitColor(); break;
      }
    };

  const handleInputCommit = (inputValue: string) => {
      if (/^#[0-9a-fA-F]{6}$/.test(inputValue)) {
        setColorValue(inputValue);
        const hsl = hexToHsl(inputValue);
        send({ type: 'SET_HUE', value: hsl.h });
        send({ type: 'SET_SATURATION', value: hsl.s });
        send({ type: 'SET_LIGHTNESS', value: hsl.l });
      }
    };

  const handleSwatchClick = (color: string) => {
      setColorValue(color);
      const hsl = hexToHsl(color);
      send({ type: 'SET_HUE', value: hsl.h });
      send({ type: 'SET_SATURATION', value: hsl.s });
      send({ type: 'SET_LIGHTNESS', value: hsl.l });
    };

  const handleEyedropper = (
async () => {
    if (typeof window === 'undefined') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).EyeDropper?.().open();
      if (result?.sRGBHex) handleSwatchClick(result.sRGBHex);
    } catch {
      // User cancelled or not supported
    }
  };
    const hex = hslToHex(machine.value.hue, machine.value.saturation, machine.value.lightness);

    return (): VNode =>
      h('div', {
        'data-part': 'root',
        'data-state': isOpen ? 'open' : 'closed',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'color-picker',
      }, [
        h('button', {
          'ref': triggerRef,
          'type': 'button',
          'data-part': 'trigger',
          'aria-label': 'Select color',
          'aria-haspopup': 'dialog',
          'aria-expanded': isOpen ? 'true' : 'false',
          'disabled': props.disabled,
          'onClick': () => send({ type: 'TRIGGER_CLICK' }),
        }, [
          h('span', {
            'data-part': 'swatch',
            'aria-hidden': 'true',
            'style': { backgroundColor: colorValue },
          }),
        ]),
        props.name && <input type="hidden" props.name={props.name} props.value={colorValue} />,
        isOpen ? h('div', {
            'data-part': 'positioner',
            'data-state': 'open',
            'data-placement': 'bottom-start',
          }, [
            h('div', {
              'ref': floatingRef,
              'id': contentId,
              'role': 'dialog',
              'aria-modal': 'true',
              'aria-label': 'Color picker',
              'data-part': 'content',
              'data-state': 'open',
            }, [
              h('div', {
                'ref': areaRef,
                'data-part': 'area',
                'style': {
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${machine.value.hue}, 100%, 50%))`,
              },
                'onPointerDown': handleAreaPointerDown,
                'onPointerMove': handleAreaPointerMove,
                'onPointerUp': handlePointerUp,
              }, [
                h('span', {
                  'role': 'slider',
                  'aria-label': 'Color area selector',
                  'aria-valuetext': `Saturation ${machine.saturation}%, Lightness ${machine.lightness}%`,
                  'data-part': 'area-thumb',
                  'data-state': machine.value.interaction === 'selectingArea' ? 'dragging' : 'idle',
                  'style': {
                  left: `${machine.value.saturation}%`,
                  top: `${100 - machine.value.lightness}%`,
                  backgroundColor: currentHex,
                },
                  'tabindex': 0,
                  'onKeyDown': handleAreaThumbKeyDown,
                }),
              ]),
              h('div', {
                'data-part': 'channel-slider',
                'data-channel': 'hue',
                'onPointerDown': (e) => {
                e.preventDefault();
                send({ type: 'SLIDER_POINTER_DOWN' });
                handleHueSliderPointer(e);
              },
                'onPointerMove': (e) => {
                if (machine.value.interaction === 'selectingSlider') handleHueSliderPointer(e);
              },
                'onPointerUp': handlePointerUp,
              }, [
                h('div', {
                  'data-part': 'channel-slider-track',
                  'data-channel': 'hue',
                  'style': {
                  background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                },
                }),
                h('span', {
                  'role': 'slider',
                  'aria-label': 'Hue slider thumb',
                  'aria-valuenow': machine.value.hue,
                  'aria-valuemin': 0,
                  'aria-valuemax': 360,
                  'data-part': 'channel-slider-thumb',
                  'data-state': machine.value.interaction === 'selectingSlider' ? 'dragging' : 'idle',
                  'style': { left: `${(machine.value.hue / 360) * 100}%` },
                  'tabindex': 0,
                  'onKeyDown': handleHueKeyDown,
                }),
              ]),
              props.alpha ? h('div', { 'data-part': 'channel-slider', 'data-channel': 'alpha' }, [
                  h('div', { 'data-part': 'channel-slider-track', 'data-channel': 'alpha' }),
                  h('span', {
                    'role': 'slider',
                    'aria-label': 'Alpha slider thumb',
                    'aria-valuenow': 100,
                    'aria-valuemin': 0,
                    'aria-valuemax': 100,
                    'data-part': 'channel-slider-thumb',
                    'tabindex': 0,
                  }),
                ]) : null,
              h('input', {
                'data-part': 'input',
                'aria-label': `Color value (${format})`,
                'value': currentHex,
                'onChange': () => {},
                'onBlur': (e) => handleInputCommit(e.target.value),
                'onKeyDown': (e) => {
                if (e.key === 'Enter') handleInputCommit((e.target as HTMLInputElement).value);
              },
              }),
              props.swatches && props.swatches.length > 0 ? h('div', {
                  'role': 'group',
                  'aria-label': 'Preset colors',
                  'data-part': 'swatch-group',
                }, [
                  ...props.swatches.map((swatch, i) => h('button', {
                      'type': 'button',
                      'aria-label': `Select color ${swatch}`,
                      'data-part': 'swatch-trigger',
                      'style': { backgroundColor: swatch },
                      'tabindex': 0,
                      'onClick': () => handleSwatchClick(swatch),
                    })),
                ]) : null,
              h('button', {
                'type': 'button',
                'data-part': 'eye-dropper-button',
                'aria-label': 'Pick color from screen',
                'disabled': !supportsEyeDropper,
                'onClick': handleEyedropper,
              }, '&#x1F441;'),
            ]),
          ]) : null,
      ]);
  },
});

export default ColorPicker;