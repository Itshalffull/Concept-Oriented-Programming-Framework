// ============================================================
// Disclosure -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface DisclosureProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerContent?: VNode | string;
  variant?: string;
  size?: string;
}

export const Disclosure = defineComponent({
  name: 'Disclosure',

  props: {
    open: { type: Boolean },
    defaultOpen: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    triggerContent: { type: null as unknown as PropType<any> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['open-change'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const internalState = ref<any>(props.defaultOpen ? 'expanded' : 'collapsed');
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleToggle = () => {
      if (props.disabled) return;
      if (!isControlled) {
        dispatch({ type: 'TOGGLE' });
      }
      props.onOpenChange?.(!isOpen);
    };
    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      };
    const triggerId = `disclosure-trigger-${id}`;
    const contentId = `disclosure-content-${id}`;
    const isControlled = props.open !== undefined;
    const isOpen = currentState === 'expanded';
    const dataState = isOpen ? 'open' : 'closed';

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'disclosure',
        'data-part': 'root',
        'data-state': dataState,
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-variant': props.variant,
        'data-size': props.size,
      }, [
        h('button', {
          'id': triggerId,
          'type': 'button',
          'role': 'button',
          'aria-expanded': isOpen,
          'aria-controls': contentId,
          'data-part': 'trigger',
          'data-state': dataState,
          'data-disabled': props.disabled ? 'true' : 'false',
          'disabled': props.disabled,
          'tabindex': props.disabled ? -1 : 0,
          'onClick': handleToggle,
          'onKeyDown': handleKeyDown,
        }, [
          h('span', {
            'data-part': 'indicator',
            'data-state': dataState,
            'aria-hidden': 'true',
          }),
          props.triggerContent,
        ]),
        h('div', {
          'id': contentId,
          'role': 'region',
          'aria-labelledby': triggerId,
          'data-part': 'content',
          'data-state': dataState,
          'hidden': !isOpen,
        }, slots.default?.()),
      ]);
  },
});

export default Disclosure;