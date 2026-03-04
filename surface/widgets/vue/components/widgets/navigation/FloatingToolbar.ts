// ============================================================
// FloatingToolbar -- Vue 3 Component
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

export interface FloatingToolbarProps {
  open?: boolean;
  placement?: string;
  offset?: number;
  autoHide?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: string;
  size?: string;
}

export const FloatingToolbar = defineComponent({
  name: 'FloatingToolbar',

  props: {
    open: { type: Boolean },
    placement: { type: String, default: 'top' },
    offset: { type: Number, default: 8 },
    autoHide: { type: Boolean, default: true },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['open-change'],

  setup(props, { slots, emit }) {
    const internalState = ref<any>('hidden');
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const rootRef = ref<any>(null);
    const handleHide = () => {
      if (!isControlled) {
        dispatch({ type: 'HIDE' });
      }
      props.onOpenChange?.(false);
    };
    const handleKeyDown = (e: any) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleHide();
        }
      };
    const isControlled = props.open !== undefined;
    const isVisible = currentState === 'visible';
    const dataState = isVisible ? 'visible' : 'hidden';

    return (): VNode =>
      h('div', {
        'ref': (node) => {
          rootRef.value = node;
        },
        'role': 'toolbar',
        'aria-label': 'Formatting toolbar',
        'aria-orientation': 'horizontal',
        'data-surface-widget': '',
        'data-widget-name': 'floating-toolbar',
        'data-part': 'root',
        'data-state': dataState,
        'data-placement': props.placement,
        'data-variant': props.variant,
        'data-size': props.size,
        'hidden': !isVisible,
        'style': { position: 'absolute' },
        'onKeyDown': handleKeyDown,
      }, [
        h('div', { 'data-part': 'content', 'data-state': dataState }, slots.default?.()),
      ]);
  },
});

export default FloatingToolbar;