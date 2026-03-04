// ============================================================
// Slider -- Vue 3 Component
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

export interface SliderProps {
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

export const Slider = defineComponent({
  name: 'Slider',

  props: {
    value: { type: Number },
    defaultValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    step: { type: Number, default: 1 },
    orientation: { type: String, default: 'horizontal' },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const interactionState = ref<any>('idle');
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const trackRef = ref<any>(null);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };
    const clamp = (v: number) => {
      const stepped = Math.round(v / props.step) * props.step;
      return Math.min(props.max, Math.max(props.min, stepped));
    };

  const percent = ((value - props.min) / (props.max - props.min)) * 100;

  const getValueFromPointer = (
(clientX: number, clientY: number): number => {
      if (!trackRef.value) return value;
      const rect = trackRef.value.getBoundingClientRect();
      const ratio =
        props.orientation === 'horizontal'
          ? (clientX - rect.left) / rect.width
          : 1 - (clientY - rect.top) / rect.height;
      return clamp(props.min + ratio * (props.max - props.min));
    };

  const handlePointerDown = (e: ReactPointerEvent) => {
      if (props.disabled) return;
      dispatch({ type: 'POINTER_DOWN' });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const next = getValueFromPointer(e.clientX, e.clientY);
      setValue(next);
    };

  const handlePointerMove = (e: ReactPointerEvent) => {
      if (interactionState.value !== 'dragging' || props.disabled) return;
      const next = getValueFromPointer(e.clientX, e.clientY);
      setValue(next);
    };

  const handlePointerUp = () => {
    dispatch({ type: 'POINTER_UP' });
  };

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'slider',
        'data-part': 'root',
        'data-orientation': props.orientation,
        'data-state': interactionState.value === 'dragging' ? 'dragging' : 'idle',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
      }, [
        h('label', { 'data-part': 'label' }, [
          props.label,
        ]),
        h('div', {
          'ref': trackRef,
          'data-part': 'track',
          'data-orientation': props.orientation,
          'onPointerDown': handlePointerDown,
          'onPointerMove': handlePointerMove,
          'onPointerUp': handlePointerUp,
        }, [
          h('div', {
            'data-part': 'range',
            'data-orientation': props.orientation,
            'style': {
            width: isHorizontal ? `${percent}%` : '100%',
            height: !isHorizontal ? `${percent}%` : '100%',
          },
          }),
          h('div', {
            'data-part': 'thumb',
            'role': 'slider',
            'tabindex': props.disabled ? -1 : 0,
            'data-state': interactionState.value === 'dragging' ? 'dragging' : 'idle',
            'aria-label': props.label,
            'aria-valuenow': value,
            'aria-valuemin': props.min,
            'aria-valuemax': props.max,
            'aria-valuetext': String(value),
            'aria-orientation': props.orientation,
            'aria-disabled': props.disabled ? 'true' : 'false',
            'style': {
            left: isHorizontal ? `${percent}%` : '50%',
            bottom: !isHorizontal ? `${percent}%` : 'auto',
          },
            'onFocus': () => dispatch({ type: 'FOCUS' }),
            'onBlur': () => dispatch({ type: 'BLUR' }),
            'onKeyDown': handleKeyDown,
          }),
        ]),
        h('output', {
          'data-part': 'output',
          'aria-live': 'polite',
          'for': '',
        }, [
          value,
        ]),
        props.name && <input type="hidden" props.name={props.name} value={value} />,
      ]);
  },
});)

export default Slider;