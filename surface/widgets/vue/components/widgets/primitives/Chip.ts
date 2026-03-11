// ============================================================
// Chip -- Vue 3 Component
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

export interface ChipProps {
  label?: string;
  selected?: boolean;
  deletable?: boolean;
  disabled?: boolean;
  color?: string;
  value?: string;
  onSelect?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
  icon?: VNode | string;
}

export const Chip = defineComponent({
  name: 'Chip',

  props: {
    label: { type: String, default: '' },
    selected: { type: Boolean, default: false },
    deletable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    color: { type: String },
    value: { type: String },
    onSelect: { type: Function as PropType<(...args: any[]) => any> },
    onDeselect: { type: Function as PropType<(...args: any[]) => any> },
    onDelete: { type: Function as PropType<(...args: any[]) => any> },
    icon: { type: null as unknown as PropType<any> },
  },

  emits: ['deselect', 'select', 'delete'],

  setup(props, { slots, emit }) {
    const state = ref<any>(props.selected ? 'selected' : 'idle');
    const send = (action: any) => { /* state machine dispatch */ };
    const handleClick = () => {
      if (props.disabled) return;
      if (isSelected) {
        send({ type: 'DESELECT' });
        props.onDeselect?.();
      } else {
        send({ type: 'SELECT' });
        props.onSelect?.();
      }
    };
    const handleKeyDown = (e: any) => {
        if (props.disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
        if ((e.key === 'Backspace' || e.key === 'Delete') && props.deletable) {
          e.preventDefault();
          send({ type: 'DELETE' });
          props.onDelete?.();
        }
      };
    const handleDeleteClick = (e: any) => {
        e.stopPropagation();
        if (props.disabled) return;
        send({ type: 'DELETE' });
        props.onDelete?.();
      };
    const isSelected = props.selected || state.value === 'selected';

    if (state.value === 'removed') return () => null as unknown as VNode;
    return (): VNode =>
      h('div', {
        'role': 'option',
        'aria-selected': isSelected ? 'true' : 'false',
        'aria-disabled': props.disabled ? 'true' : 'false',
        'tabindex': props.disabled ? -1 : 0,
        'onClick': handleClick,
        'onKeyDown': handleKeyDown,
        'onMouseEnter': () => send({ type: 'HOVER' }),
        'onMouseLeave': () => send({ type: 'UNHOVER' }),
        'onFocus': () => send({ type: 'FOCUS' }),
        'onBlur': () => send({ type: 'BLUR' }),
        'data-surface-widget': '',
        'data-widget-name': 'chip',
        'data-part': 'root',
        'data-state': isSelected ? 'selected' : 'idle',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-color': props.color,
      }, [
        props.icon ? h('span', { 'data-part': 'icon', 'aria-hidden': 'true' }, [
            props.icon,
          ]) : null,
        h('span', { 'data-part': 'label' }, [
          props.label,
        ]),
        props.deletable ? h('button', {
            'type': 'button',
            'data-part': 'delete-button',
            'role': 'button',
            'aria-label': 'Remove',
            'tabindex': -1,
            'data-visible': props.deletable ? 'true' : 'false',
            'onClick': handleDeleteClick,
          }) : null,
      ]);
  },
});

export default Chip;