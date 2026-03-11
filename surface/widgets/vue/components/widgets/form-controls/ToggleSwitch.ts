// ============================================================
// ToggleSwitch -- Vue 3 Component
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

export interface ToggleSwitchProps {
  /** Checked state */
  checked?: boolean;
  /** Default checked when uncontrolled */
  defaultChecked?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Visible label */
  label: string;
  /** Form field name */
  name?: string;
  /** Required state */
  required?: boolean;
  /** Change callback */
  onChange?: (checked: boolean) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const ToggleSwitch = defineComponent({
  name: 'ToggleSwitch',

  props: {
    checked: { type: Boolean },
    defaultChecked: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    label: { type: String, required: true as const },
    name: { type: String },
    required: { type: Boolean, default: false },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const toggleState = ref<any>(checked ? 'on' : 'off',);
    const dispatchToggle = (action: any) => { /* state machine dispatch */ };
    const checkedInternal = ref<any>(undefined);
    const checked = computed(() => props.checked !== undefined ? props.checked : checkedInternal.value ?? props.defaultChecked);
    const setChecked = (v: any) => { checkedInternal.value = v; };
    const handleToggle = () => {
    if (props.disabled) return;
    dispatchToggle({ type: 'TOGGLE' });
    setChecked(!checked);
  };

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'toggle-switch',
        'data-part': 'root',
        'data-state': stateValue,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-size': props.size,
        'onClick': handleToggle,
      }, [
        h('input', {
          'type': 'checkbox',
          'id': uid,
          'data-part': 'input',
          'role': 'switch',
          'checked': checked,
          'disabled': props.disabled,
          'required': props.required,
          'name': props.name,
          'aria-checked': checked ? 'true' : 'false',
          'aria-label': props.label,
          'aria-disabled': props.disabled ? 'true' : 'false',
          'onChange': handleToggle,
          'onKeyDown': handleKeyDown,
          'style': { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' },
        }),
        h('div', {
          'data-part': 'control',
          'data-state': stateValue,
          'data-disabled': props.disabled ? 'true' : 'false',
        }, [
          h('div', {
            'data-part': 'thumb',
            'data-state': stateValue,
            'style': {
            transform: checked ? 'translateX(100%)' : 'translateX(0)',
          },
          }),
        ]),
        h('label', { 'data-part': 'label', 'for': uid }, [
          props.label,
        ]),
      ]);
  },
});

export default ToggleSwitch;