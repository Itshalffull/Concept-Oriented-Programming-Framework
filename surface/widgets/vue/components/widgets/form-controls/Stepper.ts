// ============================================================
// Stepper -- Vue 3 Component
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

export interface StepperProps {
  /** Current value */
  value?: number;
  /** Default value when uncontrolled */
  defaultValue?: number;
  /** Minimum value (default 0) */
  min?: number;
  /** Maximum value (default 10) */
  max?: number;
  /** Step increment (default 1) */
  step?: number;
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

export const Stepper = defineComponent({
  name: 'Stepper',

  props: {
    value: { type: Number },
    defaultValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 10 },
    step: { type: Number, default: 1 },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const boundaryState = ref<any>(deriveBoundary(value, props.min, props.max),);
    const dispatchBoundary = (action: any) => { /* state machine dispatch */ };
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };
    const clamp = (v: number) => Math.min(props.max, Math.max(props.min, v));

  const applyValue = (next: number) => {
      const clamped = clamp(next);
      setValue(clamped);
      if (clamped <= props.min) dispatchBoundary({ type: 'AT_MIN' });
      else if (clamped >= props.max) dispatchBoundary({ type: 'AT_MAX' });
      else if (boundaryState.value === 'atMin') dispatchBoundary({ type: 'INCREMENT' });
      else if (boundaryState.value === 'atMax') dispatchBoundary({ type: 'DECREMENT' });
    };

  const increment = () => applyValue(value + props.step);
    const decrement = () => applyValue(value - props.step);

    return (): VNode =>
      h('div', {
        'role': 'group',
        'aria-label': props.label,
        'data-surface-widget': '',
        'data-widget-name': 'stepper',
        'data-part': 'root',
        'data-state': dataState,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'onKeyDown': handleKeyDown,
      }, [
        h('span', { 'data-part': 'label', 'id': props.name ? `${name}-label` : undefined }, [
          props.label,
        ]),
        h('button', {
          'type': 'button',
          'data-part': 'decrementButton',
          'aria-label': 'Decrease',
          'aria-disabled': atMin || props.disabled ? 'true' : 'false',
          'disabled': props.disabled || atMin,
          'onClick': decrement,
          'tabindex': 0,
        }, '&minus;'),
        h('span', {
          'data-part': 'value',
          'role': 'spinbutton',
          'aria-valuenow': value,
          'aria-valuemin': props.min,
          'aria-valuemax': props.max,
          'aria-valuetext': String(value),
          'aria-label': props.label,
          'aria-live': 'polite',
          'tabindex': 0,
        }, [
          value,
        ]),
        h('button', {
          'type': 'button',
          'data-part': 'incrementButton',
          'aria-label': 'Increase',
          'aria-disabled': atMax || props.disabled ? 'true' : 'false',
          'disabled': props.disabled || atMax,
          'onClick': increment,
          'tabindex': 0,
        }, '+'),
        props.name && <input type="hidden" props.name={props.name} value={value} />,
      ]);
  },
});

export default Stepper;