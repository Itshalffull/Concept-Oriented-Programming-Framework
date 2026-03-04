// ============================================================
// ViewToggle -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

export interface ViewToggleOption {
  value: string;
  icon: string;
  label: string;
}

export interface ViewToggleProps {
  value: string;
  options: ViewToggleOption[];
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: string) => void;
}

export const ViewToggle = defineComponent({
  name: 'ViewToggle',

  props: {
    value: { type: String, required: true as const },
    options: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'View options' },
    size: { type: String, default: 'md' },
    onChange: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['change'],

  setup(props, { slots, emit }) {
    const state = ref<any>({ activeValue: props.value, focusedIndex: initialIndex, });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const itemRefs = ref<any>([]);
    const handleSelect = (optValue: string, index: number) => {
        dispatch({ type: 'SELECT', value: optValue, index });
        props.onChange?.(optValue);
      };
    const handleKeyDown = (e: any, index: number) => {
        let nextIndex = index;
        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            nextIndex = (index - 1 + props.options.length) % props.options.length;
            dispatch({ type: 'NAVIGATE_PREV' });
            itemRefs.value[nextIndex]?.focus();
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            nextIndex = (index + 1) % props.options.length;
            dispatch({ type: 'NAVIGATE_NEXT' });
            itemRefs.value[nextIndex]?.focus();
            break;
          case 'Home':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_FIRST' });
            itemRefs.value[0]?.focus();
            break;
          case 'End':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_LAST' });
            itemRefs.value[props.options.length - 1]?.focus();
            break;
          case ' ':
          case 'Enter':
            e.preventDefault();
            handleSelect(props.options[index].value, index);
            break;
        }
      };
    const reducer = createViewToggleReducer(props.options.length);
    const initialIndex = Math.max(0, props.options.findIndex((o) => o.value === props.value));
    const activeValue = props.value ?? state.value.activeValue;

    return (): VNode =>
      h('button', {
        'ref': (el) => { itemRefs.value[index] = el; },
        'type': 'button',
        'role': 'radio',
        'aria-checked': isActive ? 'true' : 'false',
        'aria-label': option.label,
        'tabindex': isActive ? 0 : -1,
        'data-state': isActive ? 'active' : 'inactive',
        'data-value': option.value,
        'onClick': () => handleSelect(option.value, index),
        'onKeyDown': (e) => handleKeyDown(e, index),
        'onFocus': () => dispatch({ type: 'FOCUS', index }),
        'onBlur': () => dispatch({ type: 'BLUR' }),
      }, [
        h('span', {
          'data-part': 'item-icon',
          'data-icon': option.icon,
          'aria-hidden': 'true',
        }),
      ]);
  },
});

export default ViewToggle;