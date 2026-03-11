// ============================================================
// RangeSlider -- Vue 3 Component
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

export interface RangeSliderProps {
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

export const RangeSlider = defineComponent({
  name: 'RangeSlider',

  props: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    valueMin: { type: Number },
    defaultValueMin: { type: Number, default: 25 },
    valueMax: { type: Number },
    defaultValueMax: { type: Number, default: 75 },
    step: { type: Number, default: 1 },
    minRange: { type: Number },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    name: { type: String },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const interaction = ref<any>('idle');
    const send = (action: any) => { /* state machine dispatch */ };
    const trackRef = ref<any>(null);
    const valMinInternal = ref<any>(undefined);
    const valMin = computed(() => props.valueMin !== undefined ? props.valueMin : valMinInternal.value ?? props.defaultValueMin);
    const setValMin = (v: any) => { valMinInternal.value = v; };
    const valMaxInternal = ref<any>(undefined);
    const valMax = computed(() => props.valueMax !== undefined ? props.valueMax : valMaxInternal.value ?? props.defaultValueMax);
    const setValMax = (v: any) => { valMaxInternal.value = v; };
    const snapToStep = (v: number) => {
      const snapped = Math.round((v - props.min) / props.step) * props.step + props.min;
      return Math.max(props.min, Math.min(props.max, snapped));
    };

  const clampMin = (v: number) => {
      const upper = props.minRange != null ? valMax - minRange : valMax;
      return Math.max(props.min, Math.min(v, upper));
    };

  const clampMax = (v: number) => {
      const lower = props.minRange != null ? valMin + minRange : valMin;
      return Math.max(lower, Math.min(v, props.max));
    };

  const valueFromPointer = (clientX: number) => {
      const track = trackRef.value;
      if (!track) return props.min;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return snapToStep(props.min + ratio * (props.max - props.min));
    };

  const handlePointerDown = (thumb: 'min' | 'max') => (e: PointerEvent) => {
      if (props.disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      send({ type: thumb === 'min' ? 'POINTER_DOWN_MIN' : 'POINTER_DOWN_MAX' });
    };

  const handlePointerMove = (e: PointerEvent) => {
      if (interaction.value === 'draggingMin') {
        setValMin(clampMin(valueFromPointer(e.clientX)));
      } else if (interaction.value === 'draggingMax') {
        setValMax(clampMax(valueFromPointer(e.clientX)));
      }
    };

  const handlePointerUp = () => {
    send({ type: 'POINTER_UP' });
  };

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': props.label,
        'data-part': 'root',
        'data-state': isDragging ? 'dragging' : 'idle',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'data-surface-widget': '',
        'data-widget-name': 'range-slider',
        'onPointerMove': handlePointerMove,
        'onPointerUp': handlePointerUp,
      }, [
        h('label', { 'data-part': 'label' }, [
          props.label,
        ]),
        h('div', {
          'ref': trackRef,
          'data-part': 'track',
          'data-disabled': props.disabled ? 'true' : 'false',
        }, [
          h('div', {
            'data-part': 'range',
            'data-state': isDragging ? 'dragging' : 'idle',
            'style': {
            left: `${percent(valMin)}%`,
            width: `${percent(valMax) - percent(valMin)}%`,
          },
          }),
        ]),
        h('span', {
          'role': 'slider',
          'aria-label': `${label} minimum`,
          'aria-valuenow': valMin,
          'aria-valuemin': props.min,
          'aria-valuemax': props.minRange != null ? valMax - minRange : valMax,
          'aria-valuetext': String(valMin),
          'aria-orientation': 'horizontal',
          'aria-disabled': props.disabled ? 'true' : 'false',
          'data-part': 'thumb-min',
          'data-state': thumbMinState,
          'style': { left: `${percent(valMin)}%` },
          'tabindex': props.disabled ? -1 : 0,
          'onPointerDown': handlePointerDown('min'),
          'onFocus': () => send({ type: 'FOCUS_MIN' }),
          'onBlur': () => send({ type: 'BLUR' }),
          'onKeyDown': handleKeyDown('min'),
        }),
        h('span', {
          'role': 'slider',
          'aria-label': `${label} maximum`,
          'aria-valuenow': valMax,
          'aria-valuemin': props.minRange != null ? valMin + minRange : valMin,
          'aria-valuemax': props.max,
          'aria-valuetext': String(valMax),
          'aria-orientation': 'horizontal',
          'aria-disabled': props.disabled ? 'true' : 'false',
          'data-part': 'thumb-max',
          'data-state': thumbMaxState,
          'style': { left: `${percent(valMax)}%` },
          'tabindex': props.disabled ? -1 : 0,
          'onPointerDown': handlePointerDown('max'),
          'onFocus': () => send({ type: 'FOCUS_MAX' }),
          'onBlur': () => send({ type: 'BLUR' }),
          'onKeyDown': handleKeyDown('max'),
        }),
        h('output', { 'data-part': 'output-min', 'aria-live': 'polite' }, [
          valMin,
        ]),
        h('output', { 'data-part': 'output-max', 'aria-live': 'polite' }, [
          valMax,
        ]),
        props.name ? [
            h('input', {
              'type': 'hidden',
              'name': `${name}-min`,
              'value': valMin,
            }),
            h('input', {
              'type': 'hidden',
              'name': `${name}-max`,
              'value': valMax,
            }),
          ] : null,
      ]);
  },
});

export default RangeSlider;