// ============================================================
// RadioCard -- Vue 3 Component
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

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface RadioCardProps {
  /** Currently selected value */
  value?: string;
  /** Default value when uncontrolled */
  defaultValue?: string;
  /** Available card options */
  options: RadioCardOption[];
  /** Visible label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required state */
  required?: boolean;
  /** Number of grid columns (default 2) */
  columns?: number;
  /** Form field name */
  name?: string;
  /** Change callback */
  onChange?: (value: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const RadioCard = defineComponent({
  name: 'RadioCard',

  props: {
    value: { type: String },
    defaultValue: { type: String, default: '' },
    options: { type: Array as PropType<any[]>, required: true as const },
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    columns: { type: Number, default: 2 },
    name: { type: String },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const _cardState = ref<any>('unselected');
    const dispatchCard = (action: any) => { /* state machine dispatch */ };
    const valueInternal = ref<any>(undefined);
    const value = computed(() => props.value !== undefined ? props.value : valueInternal.value ?? props.undefined);
    const setValue = (v: any) => { valueInternal.value = v; };

    return (): VNode =>
      h('div', {
        'data-part': 'card',
        'data-state': isSelected ? 'selected' : 'unselected',
        'data-disabled': props.disabled ? 'true' : 'false',
        'onClick': () => !props.disabled && handleSelect(option.value),
      }, [
        h('input', {
          'type': 'radio',
          'data-part': 'cardInput',
          'name': groupName,
          'value': option.value,
          'checked': isSelected,
          'disabled': props.disabled,
          'role': 'radio',
          'aria-checked': isSelected ? 'true' : 'false',
          'aria-label': option.label,
          'aria-describedby': descId,
          'tabindex': isSelected ? 0 : -1,
          'onChange': () => handleSelect(option.value),
          'style': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
        }),
        h('div', { 'data-part': 'cardContent', 'data-state': isSelected ? 'selected' : 'unselected' }, [
          option.icon ? h('span', {
              'data-part': 'cardIcon',
              'data-icon': option.icon,
              'aria-hidden': 'true',
            }) : null,
          h('span', { 'data-part': 'cardLabel' }, [
            option.label,
          ]),
          option.description ? h('span', { 'data-part': 'cardDescription', 'id': descId }, [
              option.description,
            ]) : null,
        ]),
      ]);
  },
});

export default RadioCard;