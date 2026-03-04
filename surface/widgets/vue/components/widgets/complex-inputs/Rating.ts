// ============================================================
// Rating -- Vue 3 Component
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

export interface RatingProps {
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

export const Rating = defineComponent({
  name: 'Rating',

  props: {
    value: { type: Number },
    defaultValue: { type: Number, default: 0 },
    max: { type: Number, default: 5 },
    half: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    label: { type: String, default: 'Rating' },
    name: { type: String },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  setup(props, { slots, emit }) {
    const machine = ref<any>({ interaction: 'idle', previewValue: 0, });
    const send = (action: any) => { /* state machine dispatch */ };
    const focusedIndexRef = ref<any>(0);
    const itemRefs = ref<any>([]);
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };

    return (): VNode =>
      h('span', {
        'ref': (el) => { itemRefs.value[index] = el; },
        'role': 'radio',
        'aria-checked': itemValue === Math.ceil(value) && getItemState(itemValue) !== 'empty'
                ? 'true'
                : props.half && itemValue - 0.5 === value
                  ? 'mixed'
                  : 'false',
        'aria-label': `${itemValue} of ${max} stars`,
        'aria-disabled': props.disabled || props.readOnly ? 'true' : 'false',
        'aria-posinset': index + 1,
        'aria-setsize': props.max,
        'data-part': 'item',
        'data-state': itemState,
        'data-highlighted': isHighlighted(itemValue) ? 'true' : 'false',
        'data-half-highlighted': isHalfHighlighted(itemValue) ? 'true' : 'false',
        'tabindex': isFocused ? 0 : -1,
        'onClick': () => {
              if (props.readOnly || props.disabled) return;
              setValue(itemValue);
              send({ type: 'CLICK' });
            },
        'onMouseEnter': () => {
              if (props.readOnly || props.disabled) return;
              send({ type: 'HOVER', previewValue: itemValue });
            },
        'onFocus': () => {
              focusedIndexRef.value = index;
              send({ type: 'FOCUS' });
            },
        'onBlur': () => send({ type: 'BLUR' }),
        'onKeyDown': (e) => handleKeyDown(e, itemValue),
      }, [
        h('span', {
          'data-part': 'icon',
          'data-state': itemState,
          'aria-hidden': 'true',
        }),
      ]);
  },
});

export default Rating;